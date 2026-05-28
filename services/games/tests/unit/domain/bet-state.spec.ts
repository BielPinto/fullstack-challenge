import { describe, expect, it } from "bun:test";
import { BetAmountOutOfRangeError } from "../../../src/domain/errors/game.errors";
import {
  assertBetAmountValid,
  canCashOutBet,
  canConfirmDebit,
  canPlaceBetOnRound,
  canTransitionBet,
  isTerminalBetStatus,
  nextBetStatus,
  wouldBeDuplicateBet,
  type BetStatus,
} from "../../../src/domain/bet-state";
import { computeCashoutPayoutCents } from "../../../src/domain/services/bet-payout";

describe("bet state", () => {
  describe("status transitions", () => {
    it("follows DEBIT_PENDING → ACTIVE → CASHED_OUT", () => {
      expect(canTransitionBet("DEBIT_PENDING", "DEBIT_SUCCEEDED")).toBe(true);
      expect(nextBetStatus("DEBIT_PENDING", "DEBIT_SUCCEEDED")).toBe("ACTIVE");

      expect(canTransitionBet("ACTIVE", "CASHOUT_SUCCEEDED")).toBe(true);
      expect(nextBetStatus("ACTIVE", "CASHOUT_SUCCEEDED")).toBe("CASHED_OUT");
    });

    it("follows DEBIT_PENDING → ACTIVE → LOST on crash", () => {
      expect(nextBetStatus("DEBIT_PENDING", "DEBIT_SUCCEEDED")).toBe("ACTIVE");
      expect(nextBetStatus("ACTIVE", "ROUND_CRASHED")).toBe("LOST");
    });

    it("marks debit failure as terminal", () => {
      expect(nextBetStatus("DEBIT_PENDING", "DEBIT_FAILED")).toBe("DEBIT_FAILED");
      expect(isTerminalBetStatus("DEBIT_FAILED")).toBe(true);
    });

    it("reverts cashout compensation back to ACTIVE", () => {
      expect(nextBetStatus("CASHED_OUT", "CASHOUT_REVERTED")).toBe("ACTIVE");
    });

    it("rejects invalid transitions", () => {
      const invalid: Array<[BetStatus, "DEBIT_SUCCEEDED" | "CASHOUT_SUCCEEDED" | "ROUND_CRASHED"]> = [
        ["ACTIVE", "DEBIT_SUCCEEDED"],
        ["CASHED_OUT", "ROUND_CRASHED"],
        ["LOST", "CASHOUT_SUCCEEDED"],
        ["DEBIT_FAILED", "DEBIT_SUCCEEDED"],
        ["DEBIT_PENDING", "CASHOUT_SUCCEEDED"],
      ];

      for (const [status, event] of invalid) {
        expect(canTransitionBet(status, event)).toBe(false);
        expect(nextBetStatus(status, event)).toBeNull();
      }
    });
  });

  describe("round phase guards", () => {
    it("allows placing bets only during BETTING", () => {
      expect(canPlaceBetOnRound("BETTING")).toBe(true);
      expect(canPlaceBetOnRound("RUNNING")).toBe(false);
      expect(canPlaceBetOnRound("SETTLED")).toBe(false);
    });

    it("allows cashout only for ACTIVE bets while RUNNING", () => {
      expect(canCashOutBet("ACTIVE", "RUNNING")).toBe(true);
      expect(canCashOutBet("DEBIT_PENDING", "RUNNING")).toBe(false);
      expect(canCashOutBet("ACTIVE", "BETTING")).toBe(false);
      expect(canCashOutBet("CASHED_OUT", "RUNNING")).toBe(false);
    });

    it("requires DEBIT_PENDING before confirming debit", () => {
      expect(canConfirmDebit("DEBIT_PENDING")).toBe(true);
      expect(canConfirmDebit("ACTIVE")).toBe(false);
    });
  });

  describe("bet amount validation", () => {
    it("accepts amounts within limits", () => {
      expect(() => assertBetAmountValid(100n)).not.toThrow();
      expect(() => assertBetAmountValid(100_000n)).not.toThrow();
    });

    it("rejects amounts outside limits", () => {
      expect(() => assertBetAmountValid(99n)).toThrow(BetAmountOutOfRangeError);
      expect(() => assertBetAmountValid(100_001n)).toThrow(BetAmountOutOfRangeError);
    });
  });

  describe("duplicate bet detection", () => {
    it("detects when the user already has a bet on the round", () => {
      expect(wouldBeDuplicateBet(["user-a", "user-b"], "user-a")).toBe(true);
      expect(wouldBeDuplicateBet(["user-a"], "user-b")).toBe(false);
      expect(wouldBeDuplicateBet([], "user-a")).toBe(false);
    });
  });

  describe("cashout payout", () => {
    it("computes payout via bet-payout for an active cashout", () => {
      const amount = 10_000n;
      const multiplierMicro = 2_500_000n;
      const payout = computeCashoutPayoutCents(amount, multiplierMicro);
      expect(payout).toBe(25_000n);
    });
  });
});
