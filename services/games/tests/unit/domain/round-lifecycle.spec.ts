import { describe, expect, it } from "bun:test";
import {
  canAcceptBets,
  canCashOutDuringRound,
  canSettle,
  canStartRunning,
  canTransition,
  hasRunningDurationElapsed,
  isBettingWindowOpen,
  nextPhase,
  shouldSettleRunningRound,
  shouldTransitionBettingToRunning,
  type RoundPhase,
} from "../../../src/domain/round-lifecycle";

describe("round lifecycle", () => {
  describe("phase transitions", () => {
    it("allows BETTING → RUNNING when the betting window expires", () => {
      expect(canTransition("BETTING", "BETTING_WINDOW_EXPIRED")).toBe(true);
      expect(nextPhase("BETTING", "BETTING_WINDOW_EXPIRED")).toBe("RUNNING");
    });

    it("allows RUNNING → SETTLED when run duration elapses", () => {
      expect(canTransition("RUNNING", "RUN_DURATION_ELAPSED")).toBe(true);
      expect(nextPhase("RUNNING", "RUN_DURATION_ELAPSED")).toBe("SETTLED");
    });

    it("rejects invalid transitions", () => {
      const invalid: Array<[RoundPhase, "BETTING_WINDOW_EXPIRED" | "RUN_DURATION_ELAPSED"]> = [
        ["BETTING", "RUN_DURATION_ELAPSED"],
        ["RUNNING", "BETTING_WINDOW_EXPIRED"],
        ["SETTLED", "BETTING_WINDOW_EXPIRED"],
        ["SETTLED", "RUN_DURATION_ELAPSED"],
      ];

      for (const [phase, event] of invalid) {
        expect(canTransition(phase, event)).toBe(false);
        expect(nextPhase(phase, event)).toBeNull();
      }
    });

    it("does not transition SETTLED further on the same round", () => {
      expect(canTransition("SETTLED", "BETTING_WINDOW_EXPIRED")).toBe(false);
      expect(canTransition("SETTLED", "RUN_DURATION_ELAPSED")).toBe(false);
      expect(nextPhase("SETTLED", "BETTING_WINDOW_EXPIRED")).toBeNull();
    });
  });

  describe("invariants", () => {
    it("only accepts bets during BETTING", () => {
      expect(canAcceptBets("BETTING")).toBe(true);
      expect(canAcceptBets("RUNNING")).toBe(false);
      expect(canAcceptBets("SETTLED")).toBe(false);
    });

    it("only allows cashout during RUNNING", () => {
      expect(canCashOutDuringRound("RUNNING")).toBe(true);
      expect(canCashOutDuringRound("BETTING")).toBe(false);
      expect(canCashOutDuringRound("SETTLED")).toBe(false);
    });

    it("only starts running from BETTING and settles from RUNNING", () => {
      expect(canStartRunning("BETTING")).toBe(true);
      expect(canStartRunning("RUNNING")).toBe(false);

      expect(canSettle("RUNNING")).toBe(true);
      expect(canSettle("BETTING")).toBe(false);
      expect(canSettle("SETTLED")).toBe(false);
    });
  });

  describe("timing", () => {
    it("detects open vs expired betting window", () => {
      const endsAt = 10_000;
      expect(isBettingWindowOpen(endsAt, 9_999)).toBe(true);
      expect(isBettingWindowOpen(endsAt, 10_000)).toBe(false);
      expect(shouldTransitionBettingToRunning(endsAt, 10_000)).toBe(true);
    });

    it("settles only after the full run duration", () => {
      const startedAt = 1_000;
      const duration = 5_000;
      expect(hasRunningDurationElapsed(startedAt, duration, 5_999)).toBe(false);
      expect(hasRunningDurationElapsed(startedAt, duration, 6_000)).toBe(true);
      expect(shouldSettleRunningRound(startedAt, duration, 6_000)).toBe(true);
    });
  });
});
