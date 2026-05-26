import { describe, expect, it } from "bun:test";
import type { WalletDebitRequestedV1 } from "@crash/contracts";
import { parseWalletResult, serializeWalletCommand } from "../../../src/infrastructure/messaging/event-serializer";

describe("event serializer", () => {
  it("round-trips bigint fields in wallet commands", () => {
    const command: WalletDebitRequestedV1 = {
      version: "v1",
      type: "WalletDebitRequested",
      commandId: "cmd-1",
      correlationId: "corr-1",
      createdAt: new Date().toISOString(),
      userId: "user-1",
      gameRoundId: "round-1",
      betId: "bet-1",
      amount: { amountInCents: 10_000n, currency: "BRL" },
    };

    const raw = serializeWalletCommand(command);
    const parsed = JSON.parse(raw, (key, value) => {
      if (typeof value === "string" && key === "amountInCents") {
        return BigInt(value);
      }
      return value;
    }) as WalletDebitRequestedV1;

    expect(parsed.amount.amountInCents).toBe(10_000n);
  });

  it("parses wallet result events with bigint balances", () => {
    const payload = JSON.stringify({
      version: "v1",
      type: "WalletDebitSucceeded",
      commandId: "cmd-1",
      correlationId: "corr-1",
      createdAt: new Date().toISOString(),
      userId: "user-1",
      gameRoundId: "round-1",
      betId: "bet-1",
      balanceAfterInCents: "90000",
    });

    const event = parseWalletResult(Buffer.from(payload));
    expect(event.type).toBe("WalletDebitSucceeded");
    if (event.type === "WalletDebitSucceeded") {
      expect(event.balanceAfterInCents).toBe(90_000n);
    }
  });
});
