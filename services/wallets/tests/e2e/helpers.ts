import {
  AMQP_EXCHANGES,
  WALLET_COMMAND_ROUTING_KEYS,
  WALLET_EVENT_ROUTING_KEYS,
  type WalletCreditRequestedV1,
  type WalletCreditSucceededV1,
  type WalletDebitRequestedV1,
  type WalletDebitSucceededV1,
  type WalletResultEventV1,
} from "@crash/contracts";
import type { Channel, ChannelModel } from "amqplib";
import { connect } from "amqplib";

export const WALLET_BASE_URL = process.env.WALLET_BASE_URL ?? "http://localhost:4002";
export const KONG_BASE_URL = process.env.KONG_BASE_URL ?? "http://localhost:8000";
export const KEYCLOAK_TOKEN_URL =
  process.env.KEYCLOAK_TOKEN_URL ??
  "http://localhost:8080/realms/crash-game/protocol/openid-connect/token";
export const RABBITMQ_URL = "amqp://admin:admin@localhost:5672";
export const PLAYER_USER_ID =
  process.env.SEED_PLAYER_USER_ID ?? "f47ac10b-58cc-4372-a567-0e02b2c3d479";
export const SEED_BALANCE_CENTS = 100_000n;

const BIGINT_JSON_KEYS = new Set(["amountInCents", "balanceAfterInCents"]);

export function parseWalletResult(raw: string): WalletResultEventV1 {
  return JSON.parse(raw, (key, value) => {
    if (typeof value === "string" && BIGINT_JSON_KEYS.has(key)) {
      return BigInt(value);
    }
    return value;
  }) as WalletResultEventV1;
}

export function wireCommand(command: WalletDebitRequestedV1 | WalletCreditRequestedV1): Buffer {
  return Buffer.from(
    JSON.stringify(command, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}

export async function getPlayerToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: "crash-game-client",
    grant_type: "password",
    username: "player",
    password: "player123",
  });

  const response = await fetch(KEYCLOAK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Keycloak token failed: ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as { access_token: string };
  return json.access_token;
}

export async function waitForKeycloak(attempts = 30): Promise<void> {
  const realmUrl = "http://localhost:8080/realms/crash-game";
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(realmUrl);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await Bun.sleep(2000);
  }
  throw new Error(`Keycloak not ready: ${realmUrl}`);
}

export async function waitForService(url: string, attempts = 30): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await Bun.sleep(2000);
  }
  throw new Error(`Service not ready: ${url}`);
}

export async function fetchBalanceCents(
  token: string,
  baseUrl = WALLET_BASE_URL,
): Promise<bigint> {
  const res = await fetch(`${baseUrl}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GET /me failed: ${res.status}`);
  }
  const body = (await res.json()) as { balanceInCents: string };
  return BigInt(body.balanceInCents);
}

export async function connectRabbit(): Promise<{ connection: ChannelModel; channel: Channel }> {
  const connection = await connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertExchange(AMQP_EXCHANGES.walletCommands, "topic", { durable: true });
  await channel.assertExchange(AMQP_EXCHANGES.walletEvents, "topic", { durable: true });
  return { connection, channel };
}

/** Top up player balance when game activity or prior runs drained the wallet. */
export async function ensurePlayerBalance(
  token: string,
  targetCents: bigint = SEED_BALANCE_CENTS,
): Promise<bigint> {
  const current = await fetchBalanceCents(token);
  if (current >= targetCents) {
    return current;
  }

  await publishCreditAndWait(targetCents - current);
  return fetchBalanceCents(token);
}

export async function waitForWalletEvent<T extends WalletResultEventV1>(
  channel: Channel,
  routingKey: string,
  match: (event: WalletResultEventV1) => event is T,
  timeoutMs = 15_000,
): Promise<T> {
  const eventsQueue = await channel.assertQueue("", { exclusive: true });
  await channel.bindQueue(eventsQueue.queue, AMQP_EXCHANGES.walletEvents, routingKey);

  let consumerTag = "";
  let settled = false;
  let resolveMatch!: (event: T) => void;
  let rejectMatch!: (error: Error) => void;

  const matchPromise = new Promise<T>((resolve, reject) => {
    resolveMatch = resolve;
    rejectMatch = reject;
  });

  const timeout = setTimeout(() => {
    if (settled) {
      return;
    }
    settled = true;
    void channel.cancel(consumerTag).catch(() => undefined);
    rejectMatch(new Error(`Wallet event timeout (${routingKey})`));
  }, timeoutMs);

  const { consumerTag: tag } = await channel.consume(
    eventsQueue.queue,
    (msg) => {
      if (!msg || settled) {
        return;
      }
      const event = parseWalletResult(msg.content.toString());
      channel.ack(msg);
      if (match(event)) {
        settled = true;
        clearTimeout(timeout);
        void channel.cancel(consumerTag).catch(() => undefined);
        resolveMatch(event);
      }
    },
    { noAck: false },
  );
  consumerTag = tag;

  return matchPromise;
}

export async function publishDebitAndWait(
  amountInCents: bigint,
  overrides?: Partial<Pick<WalletDebitRequestedV1, "commandId" | "correlationId" | "gameRoundId" | "betId">>,
): Promise<WalletDebitSucceededV1> {
  const commandId = overrides?.commandId ?? `e2e-debit-${crypto.randomUUID()}`;
  const correlationId = overrides?.correlationId ?? `e2e-corr-${crypto.randomUUID()}`;

  const command: WalletDebitRequestedV1 = {
    type: "WalletDebitRequested",
    version: "v1",
    commandId,
    correlationId,
    createdAt: new Date().toISOString(),
    userId: PLAYER_USER_ID,
    gameRoundId: overrides?.gameRoundId ?? "e2e-round-1",
    betId: overrides?.betId ?? "e2e-bet-1",
    amount: { amountInCents, currency: "BRL" },
  };

  const { connection, channel } = await connectRabbit();

  try {
    const eventPromise = waitForWalletEvent(
      channel,
      WALLET_EVENT_ROUTING_KEYS.debitSucceededV1,
      (event): event is WalletDebitSucceededV1 =>
        event.type === "WalletDebitSucceeded" && event.commandId === commandId,
    );

    channel.publish(
      AMQP_EXCHANGES.walletCommands,
      WALLET_COMMAND_ROUTING_KEYS.debitRequestV1,
      wireCommand(command),
      { contentType: "application/json", persistent: true },
    );

    return await eventPromise;
  } finally {
    await channel.close();
    await connection.close();
  }
}

export async function publishCreditAndWait(amountInCents: bigint): Promise<WalletCreditSucceededV1> {
  const commandId = `e2e-credit-${crypto.randomUUID()}`;
  const correlationId = `e2e-credit-corr-${crypto.randomUUID()}`;

  const command: WalletCreditRequestedV1 = {
    type: "WalletCreditRequested",
    version: "v1",
    commandId,
    correlationId,
    createdAt: new Date().toISOString(),
    userId: PLAYER_USER_ID,
    gameRoundId: "e2e-round-topup",
    betId: "e2e-bet-topup",
    reason: "refund",
    amount: { amountInCents, currency: "BRL" },
  };

  const { connection, channel } = await connectRabbit();

  try {
    const eventPromise = waitForWalletEvent(
      channel,
      WALLET_EVENT_ROUTING_KEYS.creditSucceededV1,
      (event): event is WalletCreditSucceededV1 =>
        event.type === "WalletCreditSucceeded" && event.commandId === commandId,
    );

    channel.publish(
      AMQP_EXCHANGES.walletCommands,
      WALLET_COMMAND_ROUTING_KEYS.creditRequestV1,
      wireCommand(command),
      { contentType: "application/json", persistent: true },
    );

    return await eventPromise;
  } finally {
    await channel.close();
    await connection.close();
  }
}
