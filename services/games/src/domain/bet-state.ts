import { assertBetAmountInRange } from "./value-objects/bet-limits";
import type { RoundPhase } from "./round-lifecycle";
import { canAcceptBets, canCashOutDuringRound } from "./round-lifecycle";

export type BetStatus =
  | "DEBIT_PENDING"
  | "ACTIVE"
  | "CASHED_OUT"
  | "LOST"
  | "DEBIT_FAILED";

export type BetLifecycleEvent =
  | "DEBIT_SUCCEEDED"
  | "DEBIT_FAILED"
  | "CASHOUT_SUCCEEDED"
  | "CASHOUT_REVERTED"
  | "ROUND_CRASHED";

const VALID_TRANSITIONS: Record<
  BetStatus,
  Partial<Record<BetLifecycleEvent, BetStatus>>
> = {
  DEBIT_PENDING: {
    DEBIT_SUCCEEDED: "ACTIVE",
    DEBIT_FAILED: "DEBIT_FAILED",
  },
  ACTIVE: {
    CASHOUT_SUCCEEDED: "CASHED_OUT",
    ROUND_CRASHED: "LOST",
  },
  CASHED_OUT: {
    CASHOUT_REVERTED: "ACTIVE",
  },
  LOST: {},
  DEBIT_FAILED: {},
};

export function canTransitionBet(
  status: BetStatus,
  event: BetLifecycleEvent,
): boolean {
  return VALID_TRANSITIONS[status][event] !== undefined;
}

export function nextBetStatus(
  status: BetStatus,
  event: BetLifecycleEvent,
): BetStatus | null {
  return VALID_TRANSITIONS[status][event] ?? null;
}

export function canPlaceBetOnRound(roundPhase: RoundPhase): boolean {
  return canAcceptBets(roundPhase);
}

export function canCashOutBet(
  status: BetStatus,
  roundPhase: RoundPhase,
): boolean {
  return status === "ACTIVE" && canCashOutDuringRound(roundPhase);
}

export function canConfirmDebit(status: BetStatus): boolean {
  return status === "DEBIT_PENDING";
}

export function isTerminalBetStatus(status: BetStatus): boolean {
  return status === "CASHED_OUT" || status === "LOST" || status === "DEBIT_FAILED";
}

export function assertBetAmountValid(amountInCents: bigint): void {
  assertBetAmountInRange(amountInCents);
}

export function wouldBeDuplicateBet(
  existingUserIdsOnRound: readonly string[],
  userId: string,
): boolean {
  return existingUserIdsOnRound.includes(userId);
}
