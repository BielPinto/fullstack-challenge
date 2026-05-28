import { describe, expect, it } from "bun:test";
import { Round } from "../../../src/domain/entities/round.entity";
import {
  RoundNotInBettingPhaseError,
  RoundNotRunningError,
} from "../../../src/domain/errors/game.errors";

describe("Round", () => {
  const baseProps = {
    id: "round-1",
    phase: "BETTING" as const,
    commitHash: "commit",
    serverSecret: "secret",
    clientSeed: "client",
    nonce: "1",
    crashMultiplierMicro: null,
    runDurationMs: null,
    bettingEndsAt: new Date(10_000),
    runningStartedAt: null,
    settledAt: null,
    createdAt: new Date(0),
  };

  function createRound(overrides: Partial<typeof baseProps> = {}): Round {
    return Round.reconstitute({ ...baseProps, ...overrides });
  }

  it("accepts bets only during BETTING", () => {
    expect(createRound().acceptsBets()).toBe(true);
    expect(createRound({ phase: "RUNNING" }).acceptsBets()).toBe(false);
    expect(createRound({ phase: "SETTLED" }).acceptsBets()).toBe(false);
  });

  it("assertAcceptsBets throws when not in BETTING", () => {
    expect(() => createRound({ phase: "RUNNING" }).assertAcceptsBets()).toThrow(
      RoundNotInBettingPhaseError,
    );
  });

  it("starts running from BETTING with crash outcome", () => {
    const round = createRound();
    const startedAt = new Date(5_000);
    round.startRunning(
      { crashMultiplierMicro: 2_000_000n, runDurationMs: 8_000 },
      startedAt,
    );

    expect(round.getPhase()).toBe("RUNNING");
    expect(round.getCrashMultiplierMicro()).toBe(2_000_000n);
    expect(round.getRunDurationMs()).toBe(8_000);
    expect(round.getRunningStartedAt()).toEqual(startedAt);
  });

  it("rejects startRunning when not in BETTING", () => {
    const round = createRound({ phase: "RUNNING" });
    expect(() =>
      round.startRunning({ crashMultiplierMicro: 1n, runDurationMs: 1 }, new Date()),
    ).toThrow(RoundNotInBettingPhaseError);
  });

  it("settles only from RUNNING", () => {
    const round = createRound({
      phase: "RUNNING",
      crashMultiplierMicro: 1_500_000n,
      runDurationMs: 5_000,
      runningStartedAt: new Date(1_000),
    });
    const settledAt = new Date(10_000);
    round.settle(settledAt);

    expect(round.getPhase()).toBe("SETTLED");
    expect(round.getSettledAt()).toEqual(settledAt);
  });

  it("rejects settle when not RUNNING", () => {
    expect(() => createRound().settle(new Date())).toThrow(RoundNotRunningError);
  });

  it("detects betting window and run duration timing", () => {
    const round = createRound({ bettingEndsAt: new Date(10_000) });
    expect(round.isBettingWindowOpen(9_999)).toBe(true);
    expect(round.shouldStartRunning(10_000)).toBe(true);

    const running = createRound({
      phase: "RUNNING",
      runningStartedAt: new Date(1_000),
      runDurationMs: 5_000,
    });
    expect(running.hasRunningDurationElapsed(5_999)).toBe(false);
    expect(running.shouldSettle(6_000)).toBe(true);
  });

  it("exposes phase transitions via static helpers", () => {
    expect(Round.canTransition("BETTING", "BETTING_WINDOW_EXPIRED")).toBe(true);
    expect(Round.nextPhase("RUNNING", "RUN_DURATION_ELAPSED")).toBe("SETTLED");
  });
});
