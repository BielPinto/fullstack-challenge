import { describe, expect, it } from "bun:test";
import { Bet } from "../../../src/domain/entities/bet.entity";
import {
  BetAmountOutOfRangeError,
  BetNotActiveError,
  DuplicateBetError,
} from "../../../src/domain/errors/game.errors";

describe("Bet", () => {
  function activeBet(overrides: Partial<ReturnType<Bet["toProps"]>> = {}): Bet {
    return Bet.reconstitute({
      id: "bet-1",
      roundId: "round-1",
      userId: "user-1",
      amountInCents: 10_000n,
      status: "ACTIVE",
      cashoutMultiplierMicro: null,
      payoutInCents: null,
      debitCommandId: "cmd-1",
      createdAt: new Date(0),
      updatedAt: new Date(0),
      ...overrides,
    });
  }

  it("creates debit-pending bets with validated amount", () => {
    const bet = Bet.createDebitPending({
      id: "bet-1",
      roundId: "round-1",
      userId: "user-1",
      amountInCents: 100n,
      debitCommandId: "cmd-1",
    });
    expect(bet.getStatus()).toBe("DEBIT_PENDING");
  });

  it("rejects out-of-range amounts on create", () => {
    expect(() =>
      Bet.createDebitPending({
        id: "bet-1",
        roundId: "round-1",
        userId: "user-1",
        amountInCents: 50n,
        debitCommandId: "cmd-1",
      }),
    ).toThrow(BetAmountOutOfRangeError);
  });

  it("calculates cashout payout without changing status", () => {
    const bet = activeBet();
    const { payoutInCents } = bet.calculateCashout(2_500_000n);
    expect(bet.getStatus()).toBe("ACTIVE");
    expect(payoutInCents).toBe(25_000n);
  });

  it("follows debit → active → cashed out", () => {
    const bet = Bet.createDebitPending({
      id: "bet-1",
      roundId: "round-1",
      userId: "user-1",
      amountInCents: 10_000n,
      debitCommandId: "cmd-1",
    });

    bet.confirmDebit();
    expect(bet.getStatus()).toBe("ACTIVE");

    const { payoutInCents, cashoutMultiplierMicro } = bet.cashOut(2_500_000n);
    expect(bet.getStatus()).toBe("CASHED_OUT");
    expect(payoutInCents).toBe(25_000n);
    expect(cashoutMultiplierMicro).toBe(2_500_000n);
  });

  it("marks active bets as lost on crash", () => {
    const bet = activeBet();
    bet.markLost();
    expect(bet.getStatus()).toBe("LOST");
    expect(bet.isTerminal()).toBe(true);
  });

  it("reverts cashout compensation back to active", () => {
    const bet = activeBet();
    bet.cashOut(2_000_000n);
    bet.revertCashout();
    expect(bet.getStatus()).toBe("ACTIVE");
    expect(bet.getPayoutInCents()).toBeNull();
  });

  it("guards cashout by round phase and status", () => {
    const bet = activeBet();
    expect(bet.canCashOut("RUNNING")).toBe(true);
    expect(bet.canCashOut("BETTING")).toBe(false);
    expect(() => bet.assertCanCashOut("BETTING")).toThrow(BetNotActiveError);

    const pending = Bet.createDebitPending({
      id: "bet-2",
      roundId: "round-1",
      userId: "user-2",
      amountInCents: 100n,
      debitCommandId: "cmd-2",
    });
    expect(() => pending.assertCanCashOut("RUNNING")).toThrow(BetNotActiveError);
  });

  it("detects duplicate bets on a round", () => {
    const bet = activeBet({ userId: "user-a" });
    expect(() => bet.assertNotDuplicate(["user-a", "user-b"])).toThrow(
      DuplicateBetError,
    );
    expect(() => bet.assertNotDuplicate(["user-b"])).not.toThrow();
  });

  it("exposes status transitions via static helpers", () => {
    expect(Bet.canTransition("DEBIT_PENDING", "DEBIT_SUCCEEDED")).toBe(true);
    expect(Bet.nextStatus("ACTIVE", "ROUND_CRASHED")).toBe("LOST");
    expect(Bet.nextStatus("LOST", "CASHOUT_SUCCEEDED")).toBeNull();
  });
});
