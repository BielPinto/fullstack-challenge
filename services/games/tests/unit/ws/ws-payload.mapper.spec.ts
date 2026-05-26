import { describe, expect, it } from "bun:test";
import {
  toWsRoundCrashedPayload,
  toWsRoundStatePayload,
  toWsRoundTickPayload,
} from "../../../src/infrastructure/realtime/ws-payload.mapper";

const baseRound = {
  id: "round-1",
  phase: "RUNNING" as const,
  commitHash: "abc",
  serverSecret: "secret",
  clientSeed: "client",
  nonce: "1",
  crashMultiplierMicro: 2_500_000n,
  runDurationMs: 10_000,
  bettingEndsAt: new Date("2026-05-26T12:00:00.000Z"),
  runningStartedAt: new Date("2026-05-26T12:00:10.000Z"),
  settledAt: null,
  createdAt: new Date("2026-05-26T12:00:00.000Z"),
};

describe("ws-payload.mapper", () => {
  it("maps round state with formatted multiplier and bets", () => {
    const payload = toWsRoundStatePayload({
      round: baseRound,
      currentMultiplierMicro: 1_500_000n,
      bets: [
        {
          id: "bet-1",
          roundId: "round-1",
          userId: "user-1",
          amountInCents: 10_00n,
          status: "ACTIVE" as const,
          cashoutMultiplierMicro: null,
          payoutInCents: null,
          debitCommandId: "cmd-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    expect(payload.currentMultiplier).toBe("1.50");
    expect(payload.crashMultiplier).toBe("2.50");
    expect(payload.bets[0]?.amount).toBe("10.00");
  });

  it("maps running tick payload", () => {
    const payload = toWsRoundTickPayload({
      roundId: "round-1",
      currentMultiplierMicro: 1_234_567n,
      elapsedMs: 2500,
      runDurationMs: 10_000,
    });

    expect(payload.currentMultiplier).toBe("1.23");
    expect(payload.elapsedMs).toBe(2500);
  });

  it("maps crashed round with verify block", () => {
    const payload = toWsRoundCrashedPayload({
      ...baseRound,
      phase: "SETTLED" as const,
      settledAt: new Date("2026-05-26T12:00:20.000Z"),
    });

    expect(payload.crashMultiplier).toBe("2.50");
    expect(payload.verify.serverSecret).toBe("secret");
    expect(payload.verify.runDurationMs).toBe(10_000);
  });
});
