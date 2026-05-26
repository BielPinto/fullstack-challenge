import { describe, expect, it, beforeAll } from "bun:test";
import {
  AMQP_EXCHANGES,
  WALLET_COMMAND_ROUTING_KEYS,
  WALLET_EVENT_ROUTING_KEYS,
  type WalletDebitRequestedV1,
  type WalletDebitSucceededV1,
} from "@crash/contracts";
import amqplib from "amqplib";

const WALLET_BASE_URL = process.env.WALLET_BASE_URL ?? "http://localhost:4002";
const KONG_BASE_URL = process.env.KONG_BASE_URL ?? "http://localhost:8000";
const KEYCLOAK_TOKEN_URL =
  process.env.KEYCLOAK_TOKEN_URL ??
  "http://localhost:8080/realms/crash-game/protocol/openid-connect/token";
/** Host tests must use localhost; ignore service .env (rabbitmq hostname). */
const RABBITMQ_URL = "amqp://admin:admin@localhost:5672";
const PLAYER_USER_ID = process.env.SEED_PLAYER_USER_ID ?? "f47ac10b-58cc-4372-a567-0e02b2c3d479";

async function getPlayerToken(): Promise<string> {
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

async function waitForKeycloak(attempts = 30): Promise<void> {
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

async function waitForService(url: string, attempts = 30): Promise<void> {
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

async function fetchBalanceCents(token: string, baseUrl = WALLET_BASE_URL): Promise<bigint> {
  const res = await fetch(`${baseUrl}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GET /me failed: ${res.status}`);
  }
  const body = (await res.json()) as { balanceInCents: string };
  return BigInt(body.balanceInCents);
}

describe("wallets e2e (docker:up)", () => {
  let token: string;
  let balanceCents: bigint;

  beforeAll(async () => {
    await waitForService(`${WALLET_BASE_URL}/health`);
    await waitForKeycloak();
    token = await getPlayerToken();
    balanceCents = await fetchBalanceCents(token);
    expect(balanceCents).toBeGreaterThan(0n);
  }, 120_000);

  it("GET /health returns ok", async () => {
    const res = await fetch(`${WALLET_BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("wallets");
  });

  it("GET /wallets/me via Kong returns player wallet", async () => {
    const res = await fetch(`${KONG_BASE_URL}/wallets/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      userId: string;
      balanceInCents: string;
      balance: string;
      currency: string;
    };
    expect(body.userId).toBe(PLAYER_USER_ID);
    expect(body.balanceInCents).toBe(balanceCents.toString());
    expect(body.currency).toBe("BRL");
    expect(body.balance).toMatch(/^\d+\.\d{2}$/);
  });

  it("POST /wallets returns 409 when wallet already exists (seed)", async () => {
    const res = await fetch(`${WALLET_BASE_URL}/wallets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(409);
  });

  it("debit via RabbitMQ reduces balance on GET /wallets/me", async () => {
    const commandId = `e2e-debit-${crypto.randomUUID()}`;
    const correlationId = `e2e-corr-${crypto.randomUUID()}`;
    const debitAmount = 100n;
    const expectedAfter = balanceCents - debitAmount;

    const command: WalletDebitRequestedV1 = {
      type: "WalletDebitRequested",
      version: "v1",
      commandId,
      correlationId,
      createdAt: new Date().toISOString(),
      userId: PLAYER_USER_ID,
      gameRoundId: "e2e-round-1",
      betId: "e2e-bet-1",
      amount: { amountInCents: debitAmount, currency: "BRL" },
    };

    const connection = await amqplib.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertExchange(AMQP_EXCHANGES.walletEvents, "topic", { durable: true });
    const eventsQueue = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(
      eventsQueue.queue,
      AMQP_EXCHANGES.walletEvents,
      WALLET_EVENT_ROUTING_KEYS.debitSucceededV1,
    );

    const resultPromise = new Promise<WalletDebitSucceededV1>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Debit result timeout")), 15_000);
      void channel.consume(
        eventsQueue.queue,
        (msg) => {
          if (!msg) {
            return;
          }
          const raw = JSON.parse(msg.content.toString()) as WalletDebitSucceededV1 & {
            balanceAfterInCents: string | bigint;
          };
          if (raw.commandId === commandId) {
            clearTimeout(timeout);
            channel.ack(msg);
            resolve({
              ...raw,
              balanceAfterInCents: BigInt(raw.balanceAfterInCents),
            });
          }
        },
        { noAck: false },
      );
    });

    channel.publish(
      AMQP_EXCHANGES.walletCommands,
      WALLET_COMMAND_ROUTING_KEYS.debitRequestV1,
      Buffer.from(
        JSON.stringify(command, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
      ),
      { contentType: "application/json", persistent: true },
    );

    const result = await resultPromise;
    expect(result.type).toBe("WalletDebitSucceeded");
    expect(result.balanceAfterInCents).toBe(expectedAfter);

    await channel.close();
    await connection.close();

    balanceCents = await fetchBalanceCents(token);
    expect(balanceCents).toBe(expectedAfter);
  }, 30_000);

  it("duplicate debit command is idempotent (same commandId)", async () => {
    const commandId = `e2e-dup-${crypto.randomUUID()}`;
    const correlationId = `e2e-dup-corr-${crypto.randomUUID()}`;
    const debitAmount = 50n;
    const expectedAfter = balanceCents - debitAmount;

    const command: WalletDebitRequestedV1 = {
      type: "WalletDebitRequested",
      version: "v1",
      commandId,
      correlationId,
      createdAt: new Date().toISOString(),
      userId: PLAYER_USER_ID,
      gameRoundId: "e2e-round-dup",
      betId: "e2e-bet-dup",
      amount: { amountInCents: debitAmount, currency: "BRL" },
    };

    const wire = JSON.stringify(command, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );

    const connection = await amqplib.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertExchange(AMQP_EXCHANGES.walletCommands, "topic", { durable: true });

    const publish = (): void => {
      channel.publish(
        AMQP_EXCHANGES.walletCommands,
        WALLET_COMMAND_ROUTING_KEYS.debitRequestV1,
        Buffer.from(wire),
        { contentType: "application/json", persistent: true },
      );
    };

    publish();
    await Bun.sleep(1500);
    publish();
    await Bun.sleep(1500);

    await channel.close();
    await connection.close();

    balanceCents = await fetchBalanceCents(token);
    expect(balanceCents).toBe(expectedAfter);
  }, 30_000);
});
