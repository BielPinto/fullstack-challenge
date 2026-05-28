export type { BetStatus, BetLifecycleEvent } from "./entities/bet.entity";
export { Bet } from "./entities/bet.entity";

import { assertBetAmountInRange } from "./value-objects/bet-limits";
import {
  Bet,
  type BetLifecycleEvent,
  type BetStatus,
} from "./entities/bet.entity";
import type { RoundPhase } from "./entities/round.entity";

export function canTransitionBet(
  status: BetStatus,
  event: BetLifecycleEvent,
): boolean {
  return Bet.canTransition(status, event);
}

export function nextBetStatus(
  status: BetStatus,
  event: BetLifecycleEvent,
): BetStatus | null {
  return Bet.nextStatus(status, event);
}

export function canPlaceBetOnRound(roundPhase: RoundPhase): boolean {
  return roundPhase === "BETTING";
}

export function canCashOutBet(
  status: BetStatus,
  roundPhase: RoundPhase,
): boolean {
  return status === "ACTIVE" && roundPhase === "RUNNING";
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
  return Bet.wouldBeDuplicate(existingUserIdsOnRound, userId);
}
