export type RoundPhase = "BETTING" | "RUNNING" | "SETTLED";

export type RoundLifecycleEvent =
  | "BETTING_WINDOW_EXPIRED"
  | "RUN_DURATION_ELAPSED";

const VALID_TRANSITIONS: Record<
  RoundPhase,
  Partial<Record<RoundLifecycleEvent, RoundPhase>>
> = {
  BETTING: { BETTING_WINDOW_EXPIRED: "RUNNING" },
  RUNNING: { RUN_DURATION_ELAPSED: "SETTLED" },
  SETTLED: {},
};

export function canTransition(
  phase: RoundPhase,
  event: RoundLifecycleEvent,
): boolean {
  return VALID_TRANSITIONS[phase][event] !== undefined;
}

export function nextPhase(
  phase: RoundPhase,
  event: RoundLifecycleEvent,
): RoundPhase | null {
  return VALID_TRANSITIONS[phase][event] ?? null;
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
