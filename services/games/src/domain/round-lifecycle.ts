export type { RoundPhase, RoundLifecycleEvent } from "./entities/round.entity";
export { Round } from "./entities/round.entity";

import { Round, type RoundPhase, type RoundLifecycleEvent } from "./entities/round.entity";

export function canTransition(
  phase: RoundPhase,
  event: RoundLifecycleEvent,
): boolean {
  return Round.canTransition(phase, event);
}

export function nextPhase(
  phase: RoundPhase,
  event: RoundLifecycleEvent,
): RoundPhase | null {
  return Round.nextPhase(phase, event);
}

export function canAcceptBets(phase: RoundPhase): boolean {
  return phase === "BETTING";
}

export function canCashOutDuringRound(phase: RoundPhase): boolean {
  return phase === "RUNNING";
}

export function canStartRunning(phase: RoundPhase): boolean {
  return phase === "BETTING";
}

export function canSettle(phase: RoundPhase): boolean {
  return phase === "RUNNING";
}

export function isBettingWindowOpen(
  bettingEndsAtMs: number,
  nowMs: number,
): boolean {
  return bettingEndsAtMs > nowMs;
}

export function shouldTransitionBettingToRunning(
  bettingEndsAtMs: number,
  nowMs: number,
): boolean {
  return !isBettingWindowOpen(bettingEndsAtMs, nowMs);
}

export function hasRunningDurationElapsed(
  runningStartedAtMs: number,
  runDurationMs: number,
  nowMs: number,
): boolean {
  return nowMs >= runningStartedAtMs + runDurationMs;
}

export function shouldSettleRunningRound(
  runningStartedAtMs: number,
  runDurationMs: number,
  nowMs: number,
): boolean {
  return hasRunningDurationElapsed(runningStartedAtMs, runDurationMs, nowMs);
}
