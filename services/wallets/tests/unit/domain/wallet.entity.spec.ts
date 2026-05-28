import { describe, expect, it } from "bun:test";
import { Wallet } from "../../../src/domain/entities/wallet.entity";
import {
  InsufficientFundsError,
  InvalidAmountError,
} from "../../../src/domain/errors/wallet.errors";
import { Money } from "../../../src/domain/value-objects/money";

describe("Wallet", () => {
  const userId = "user-1";

  function createWallet(initialCents = 0n): Wallet {
    return Wallet.reconstitute({
      id: "wallet-1",
      userId,
      balance: Money.fromCents(initialCents),
    });
  }

  it("starts with zero balance", () => {
    const wallet = Wallet.create(userId, "wallet-1");
    expect(wallet.getBalance().amountInCents).toBe(0n);
  });

  it("credits increase balance", () => {
    const wallet = createWallet();
    wallet.credit(Money.fromCents(10_00n));
    wallet.credit(Money.fromCents(5_50n));
    expect(wallet.getBalance().amountInCents).toBe(15_50n);
  });

  it("debits decrease balance", () => {
    const wallet = createWallet(20_00n);
    wallet.debit(Money.fromCents(7_25n));
    expect(wallet.getBalance().amountInCents).toBe(12_75n);
  });

  it("rejects debit when balance is insufficient", () => {
    const wallet = createWallet(100n);
    expect(() => wallet.debit(Money.fromCents(101n))).toThrow(InsufficientFundsError);
    expect(wallet.getBalance().amountInCents).toBe(100n);
  });

  it("rejects zero credit and debit", () => {
    const wallet = createWallet(100n);
    expect(() => wallet.credit(Money.zero())).toThrow(InvalidAmountError);
    expect(() => wallet.debit(Money.zero())).toThrow(InvalidAmountError);
  });

  it("uses bigint precision without floating point", () => {
    const wallet = createWallet();
    wallet.credit(Money.fromCents(999_999_999_999n));
    expect(wallet.getBalance().amountInCents).toBe(999_999_999_999n);
  });
});

describe("Money", () => {
  it("rejects negative amounts", () => {
    expect(() => Money.fromCents(-1n)).toThrow();
  });
});
