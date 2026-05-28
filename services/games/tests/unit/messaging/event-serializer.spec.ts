import { describe, expect, it } from "bun:test";
import { parseWalletResult, serializeWalletCommand } from "../../../src/infrastructure/messaging/event-serializer";
import {
  creditCommand,
  debitCommand,
  debitFailed,
  debitSucceeded,
  walletResultBuffer,
} from "./fixtures";

describe("event-serializer (games)", () => {
  it("serializes wallet commands with bigint amounts as strings", () => {
    const command = debitCommand({ amount: { amountInCents: 10_000n, currency: "BRL" } });
    const raw = serializeWalletCommand(command);
    expect(raw).toContain('"10000"');

    const reparsed = JSON.parse(raw) as { amount: { amountInCents: string } };
    expect(reparsed.amount.amountInCents).toBe("10000");
  });

  it("round-trips credit commands through serialize helper", () => {
    const command = creditCommand({ amount: { amountInCents: 5_00n, currency: "BRL" } });
    const wire = serializeWalletCommand(command);
    expect(wire).toContain("WalletCreditRequested");
    expect(wire).toContain('"500"');
  });

  it("parses wallet debit succeeded events with bigint balances", () => {
    const event = parseWalletResult(walletResultBuffer(debitSucceeded({ balanceAfterInCents: 90_000n })));
    expect(event.type).toBe("WalletDebitSucceeded");
    if (event.type === "WalletDebitSucceeded") {
      expect(event.balanceAfterInCents).toBe(90_000n);
    }
  });

  it("parses wallet debit failed events", () => {
    const event = parseWalletResult(walletResultBuffer(debitFailed({ reason: "wallet_not_found" })));
    expect(event.type).toBe("WalletDebitFailed");
    if (event.type === "WalletDebitFailed") {
      expect(event.reason).toBe("wallet_not_found");
    }
  });

  it("rejects unsupported versions", () => {
    const payload = Buffer.from(JSON.stringify({ version: "v0", type: "WalletDebitSucceeded" }));
    expect(() => parseWalletResult(payload)).toThrow(/Unsupported event version/);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseWalletResult(Buffer.from("not-json"))).toThrow();
  });
});
