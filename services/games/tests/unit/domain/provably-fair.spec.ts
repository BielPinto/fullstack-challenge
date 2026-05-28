import { describe, expect, it } from "bun:test";
import {
  commitServerSecret,
  deriveCrashOutcome,
  displayMultiplierMicroAtProgress,
  MICRO_UNIT,
  verifyCrashOutcome,
} from "../../../src/domain/services/provably-fair";

describe("provably fair", () => {
  const serverSecret = "a".repeat(64);
  const clientSeed = "client-seed-abc";
  const nonce = "42";

  it("commit hash is deterministic", () => {
    const hash = commitServerSecret(serverSecret);
    expect(hash).toBe(commitServerSecret(serverSecret));
    expect(hash).toHaveLength(64);
  });

  it("crash outcome is reproducible from seeds", () => {
    const first = deriveCrashOutcome(serverSecret, clientSeed, nonce);
    const second = deriveCrashOutcome(serverSecret, clientSeed, nonce);
    expect(first).toEqual(second);
    expect(first.crashMultiplierMicro).toBeGreaterThanOrEqual(MICRO_UNIT);
  });

  it("verification passes for derived outcome", () => {
    const commitHash = commitServerSecret(serverSecret);
    const outcome = deriveCrashOutcome(serverSecret, clientSeed, nonce);
    expect(
      verifyCrashOutcome({
        serverSecret,
        commitHash,
        clientSeed,
        nonce,
        crashMultiplierMicro: outcome.crashMultiplierMicro,
        runDurationMs: outcome.runDurationMs,
      }),
    ).toBe(true);
  });

  it("verification fails when crash point is tampered", () => {
    const commitHash = commitServerSecret(serverSecret);
    const outcome = deriveCrashOutcome(serverSecret, clientSeed, nonce);
    expect(
      verifyCrashOutcome({
        serverSecret,
        commitHash,
        clientSeed,
        nonce,
        crashMultiplierMicro: outcome.crashMultiplierMicro + 1n,
        runDurationMs: outcome.runDurationMs,
      }),
    ).toBe(false);
  });

  it("multiplier progresses from 1x toward crash point", () => {
    const outcome = deriveCrashOutcome(serverSecret, clientSeed, nonce);
    const atStart = displayMultiplierMicroAtProgress({
      crashMultiplierMicro: outcome.crashMultiplierMicro,
      runDurationMs: outcome.runDurationMs,
      elapsedMs: 0,
    });
    const atEnd = displayMultiplierMicroAtProgress({
      crashMultiplierMicro: outcome.crashMultiplierMicro,
      runDurationMs: outcome.runDurationMs,
      elapsedMs: outcome.runDurationMs,
    });
    expect(atStart).toBe(MICRO_UNIT);
    expect(atEnd).toBe(outcome.crashMultiplierMicro);
  });
});
