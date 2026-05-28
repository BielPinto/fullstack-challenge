import {
  RoundNotInBettingPhaseError,
  RoundNotRunningError,
} from "../errors/game.errors";
import type { CrashOutcome } from "../services/provably-fair";

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

export interface RoundProps {
  id: string;
  phase: RoundPhase;
  commitHash: string;
  serverSecret: string;
  clientSeed: string;
  nonce: string;
  crashMultiplierMicro: bigint | null;
  runDurationMs: number | null;
  bettingEndsAt: Date;
  runningStartedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
}

export class Round {
  private constructor(
    public readonly id: string,
    private phase: RoundPhase,
    public readonly commitHash: string,
    public readonly serverSecret: string,
    public readonly clientSeed: string,
    public readonly nonce: string,
    private crashMultiplierMicro: bigint | null,
    private runDurationMs: number | null,
    public readonly bettingEndsAt: Date,
    private runningStartedAt: Date | null,
    private settledAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  static reconstitute(props: RoundProps): Round {
    return new Round(
      props.id,
      props.phase,
      props.commitHash,
      props.serverSecret,
      props.clientSeed,
      props.nonce,
      props.crashMultiplierMicro,
      props.runDurationMs,
      props.bettingEndsAt,
      props.runningStartedAt,
      props.settledAt,
      props.createdAt,
    );
  }

  static canTransition(phase: RoundPhase, event: RoundLifecycleEvent): boolean {
    return VALID_TRANSITIONS[phase][event] !== undefined;
  }

  static nextPhase(
    phase: RoundPhase,
    event: RoundLifecycleEvent,
  ): RoundPhase | null {
    return VALID_TRANSITIONS[phase][event] ?? null;
  }

  getPhase(): RoundPhase {
    return this.phase;
  }

  getCrashMultiplierMicro(): bigint | null {
    return this.crashMultiplierMicro;
  }

  getRunDurationMs(): number | null {
    return this.runDurationMs;
  }

  getRunningStartedAt(): Date | null {
    return this.runningStartedAt;
  }

  getSettledAt(): Date | null {
    return this.settledAt;
  }

  acceptsBets(): boolean {
    return this.phase === "BETTING";
  }

  allowsCashOut(): boolean {
    return this.phase === "RUNNING";
  }

  assertAcceptsBets(): void {
    if (!this.acceptsBets()) {
      throw new RoundNotInBettingPhaseError();
    }
  }

  assertRunning(): void {
    if (!this.allowsCashOut()) {
      throw new RoundNotRunningError();
    }
  }

  isBettingWindowOpen(nowMs: number): boolean {
    return this.bettingEndsAt.getTime() > nowMs;
  }

  shouldStartRunning(nowMs: number): boolean {
    return this.phase === "BETTING" && !this.isBettingWindowOpen(nowMs);
  }

  hasRunningDurationElapsed(nowMs: number): boolean {
    if (!this.runningStartedAt || this.runDurationMs === null) {
      return false;
    }
    return nowMs >= this.runningStartedAt.getTime() + this.runDurationMs;
  }

  shouldSettle(nowMs: number): boolean {
    return this.phase === "RUNNING" && this.hasRunningDurationElapsed(nowMs);
  }

  startRunning(outcome: CrashOutcome, runningStartedAt: Date): void {
    if (this.phase !== "BETTING") {
      throw new RoundNotInBettingPhaseError("Round cannot start running from current phase");
    }
    this.phase = "RUNNING";
    this.crashMultiplierMicro = outcome.crashMultiplierMicro;
    this.runDurationMs = outcome.runDurationMs;
    this.runningStartedAt = runningStartedAt;
  }

  settle(settledAt: Date): void {
    if (this.phase !== "RUNNING") {
      throw new RoundNotRunningError("Round cannot settle from current phase");
    }
    this.phase = "SETTLED";
    this.settledAt = settledAt;
  }

  toProps(): RoundProps {
    return {
      id: this.id,
      phase: this.phase,
      commitHash: this.commitHash,
      serverSecret: this.serverSecret,
      clientSeed: this.clientSeed,
      nonce: this.nonce,
      crashMultiplierMicro: this.crashMultiplierMicro,
      runDurationMs: this.runDurationMs,
      bettingEndsAt: this.bettingEndsAt,
      runningStartedAt: this.runningStartedAt,
      settledAt: this.settledAt,
      createdAt: this.createdAt,
    };
  }
}
