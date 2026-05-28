import { describe, expect, it } from "bun:test";
import {
  parseWalletCommand,
  parseWalletResult,
  serializeWalletEvent,
  serializeWalletResult,
} from "../../../src/infrastructure/messaging/event-serializer";
import { creditCommand, creditSucceeded, debitCommand, debitFailed, debitSucceeded } from "./fixtures";

describe("event-serializer (wallets)", () => {
  it("serializes debit commands with bigint amounts as JSON strings", () => {
    const wire = serializeWalletEvent(debitCommand({ amount: { amountInCents: 150n, currency: "BRL" } }));
    expect(wire).toContain('"150"');
    expect(wire).not.toContain("150n");
  });

  it("round-trips debit commands", () => {
    const command = debitCommand({ amount: { amountInCents: 999_999_999_999n, currency: "BRL" } });
    const parsed = parseWalletCommand(Buffer.from(serializeWalletEvent(command)));
    expect(parsed.type).toBe("WalletDebitRequested");
    expect(parsed.amount.amountInCents).toBe(999_999_999_999n);
  });

  it("round-trips credit commands", () => {
    const command = creditCommand();
    const parsed = parseWalletCommand(Buffer.from(serializeWalletEvent(command)));
    expect(parsed.type).toBe("WalletCreditRequested");
    expect(parsed.reason).toBe("cashout");
    expect(parsed.amount.amountInCents).toBe(250n);
  });

  it("parses debit succeeded results with bigint balance", () => {
    const event = debitSucceeded({ balanceAfterInCents: 42_000n });
    const parsed = parseWalletResult(serializeWalletResult(event));
    expect(parsed.type).toBe("WalletDebitSucceeded");
    if (parsed.type === "WalletDebitSucceeded") {
      expect(parsed.balanceAfterInCents).toBe(42_000n);
    }
  });

  it("parses debit failed results without bigint fields", () => {
    const event = debitFailed({ reason: "insufficient_funds" });
    const parsed = parseWalletResult(serializeWalletResult(event));
    expect(parsed.type).toBe("WalletDebitFailed");
    if (parsed.type === "WalletDebitFailed") {
      expect(parsed.reason).toBe("insufficient_funds");
    }
  });

  it("parses credit succeeded results", () => {
    const event = creditSucceeded({ balanceAfterInCents: 100_000n });
    const parsed = parseWalletResult(serializeWalletResult(event));
    expect(parsed.type).toBe("WalletCreditSucceeded");
    if (parsed.type === "WalletCreditSucceeded") {
      expect(parsed.balanceAfterInCents).toBe(100_000n);
    }
  });

  it("rejects unsupported event versions", () => {
    const payload = JSON.stringify({ version: "v2", type: "WalletDebitRequested" });
    expect(() => parseWalletCommand(Buffer.from(payload))).toThrow(/Unsupported event version/);
  });

  it("rejects invalid JSON payloads", () => {
    expect(() => parseWalletCommand(Buffer.from("{not-json"))).toThrow();
  });
});
