import { describe, expect, it, beforeAll, beforeEach } from "bun:test";
import {
  AMQP_EXCHANGES,
  WALLET_COMMAND_ROUTING_KEYS,
  WALLET_EVENT_ROUTING_KEYS,
  type WalletDebitRequestedV1,
} from "@crash/contracts";
import {
  ensurePlayerBalance,
  fetchBalanceCents,
  getPlayerToken,
  KONG_BASE_URL,
  PLAYER_USER_ID,
  publishCreditAndWait,
  publishDebitAndExpectFailed,
  publishDebitAndWait,
  SEED_BALANCE_CENTS,
  waitForKeycloak,
  waitForService,
  WALLET_BASE_URL,
  wireCommand,
  connectRabbit,
} from "./helpers";

describe("wallets e2e (docker:up)", () => {
  let token: string;

  beforeAll(async () => {
    await waitForService(`${WALLET_BASE_URL}/health`);
    await waitForKeycloak();
    token = await getPlayerToken();
    await ensurePlayerBalance(token, SEED_BALANCE_CENTS);
  }, 120_000);

  it("GET /health returns ok", async () => {
    const res = await fetch(`${WALLET_BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("wallets");
  });

  it("GET /wallets/me via Kong returns player wallet", async () => {
    const balanceCents = await fetchBalanceCents(token);
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

  describe("RabbitMQ commands", () => {
    let balanceCents: bigint;

    beforeEach(async () => {
      balanceCents = await ensurePlayerBalance(token, SEED_BALANCE_CENTS);
    });

    it("debit via RabbitMQ reduces balance on GET /wallets/me", async () => {
      const debitAmount = 100n;
      const expectedAfter = balanceCents - debitAmount;

      const result = await publishDebitAndWait(debitAmount);
      expect(result.type).toBe("WalletDebitSucceeded");
      expect(result.balanceAfterInCents).toBe(expectedAfter);

      const after = await fetchBalanceCents(token);
      expect(after).toBe(expectedAfter);
    }, 30_000);

    it("credit via RabbitMQ increases balance on GET /wallets/me", async () => {
      const creditAmount = 75n;
      const expectedAfter = balanceCents + creditAmount;

      const result = await publishCreditAndWait(creditAmount);
      expect(result.type).toBe("WalletCreditSucceeded");
      expect(result.balanceAfterInCents).toBe(expectedAfter);

      const after = await fetchBalanceCents(token);
      expect(after).toBe(expectedAfter);
    }, 30_000);

    it("debit fails with insufficient_funds when amount exceeds balance", async () => {
      const drainAmount = balanceCents;
      await publishDebitAndWait(drainAmount);

      const afterDrain = await fetchBalanceCents(token);
      expect(afterDrain).toBe(0n);

      const failed = await publishDebitAndExpectFailed(1n, "insufficient_funds");
      expect(failed.reason).toBe("insufficient_funds");

      const stillZero = await fetchBalanceCents(token);
      expect(stillZero).toBe(0n);

      await publishCreditAndWait(SEED_BALANCE_CENTS);
    }, 45_000);

    it("debit fails with wallet_not_found for unknown user", async () => {
      const failed = await publishDebitAndExpectFailed(100n, "wallet_not_found", {
        userId: "00000000-0000-4000-8000-000000000099",
      });
      expect(failed.reason).toBe("wallet_not_found");
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

      const { connection, channel } = await connectRabbit();

      try {
        const publish = (): void => {
          channel.publish(
            AMQP_EXCHANGES.walletCommands,
            WALLET_COMMAND_ROUTING_KEYS.debitRequestV1,
            wireCommand(command),
            { contentType: "application/json", persistent: true },
          );
        };

        publish();
        await Bun.sleep(1500);
        publish();
        await Bun.sleep(1500);
      } finally {
        await channel.close();
        await connection.close();
      }

      const after = await fetchBalanceCents(token);
      expect(after).toBe(expectedAfter);
    }, 30_000);
  });
});
