import { createHash, createHmac, randomBytes } from "node:crypto";

const TWO_POW32 = 2n ** 32n;
/** 1000x cap (integer micro units, 10^6 = 1x). */
export const MAX_CRASH_MULTIPLIER_MICRO = 1_000_000_000n;
export const MICRO_UNIT = 1_000_000n;

export type CrashOutcome = {
  crashMultiplierMicro: bigint;
  runDurationMs: number;
};

export function newServerSecret(): string {
  return randomBytes(32).toString("hex");
}

export function commitServerSecret(serverSecret: string): string {
  return createHash("sha256").update(serverSecret, "utf8").digest("hex");
}

/** Deterministic outcome from disclosed server secret + public seeds (verifiable offline). */
export function deriveCrashOutcome(
  serverSecret: string,
  clientSeed: string,
  nonce: string,
): CrashOutcome {
  const digest = createHmac("sha256", serverSecret)
    .update(`${clientSeed}:${nonce}`)
    .digest();

  const h = digest.readUInt32BE(0);
  const hh = BigInt(h);

  // Classic crash-style mapping: multiplier = ((100·2³² − h) / (100·(2³² − h))), using BigInt rationals only.
  const num = 100n * TWO_POW32 - hh;
  const den = 100n * (TWO_POW32 - hh);
  let crashMultiplierMicro = (num * MICRO_UNIT) / den;

  if (crashMultiplierMicro < MICRO_UNIT) {
    crashMultiplierMicro = MICRO_UNIT;
  }
  if (crashMultiplierMicro > MAX_CRASH_MULTIPLIER_MICRO) {
    crashMultiplierMicro = MAX_CRASH_MULTIPLIER_MICRO;
  }

  const h2 = digest.readUInt32BE(4);
  const minMs = 5_000;
  const maxMs = 45_000;
  const runDurationMs = minMs + (h2 % (maxMs - minMs + 1));

  return { crashMultiplierMicro, runDurationMs };
}

export function verifyCrashOutcome(input: {
  serverSecret: string;
  commitHash: string;
  clientSeed: string;
  nonce: string;
  crashMultiplierMicro: bigint;
  runDurationMs: number;
}): boolean {
  if (commitServerSecret(input.serverSecret) !== input.commitHash) {
    return false;
  }

  const derived = deriveCrashOutcome(input.serverSecret, input.clientSeed, input.nonce);
  return (
    derived.crashMultiplierMicro === input.crashMultiplierMicro &&
    derived.runDurationMs === input.runDurationMs
  );
}

export function displayMultiplierMicroAtProgress(args: {
  crashMultiplierMicro: bigint;
  runDurationMs: number;
  elapsedMs: number;
}): bigint {
  const { crashMultiplierMicro, runDurationMs, elapsedMs } = args;
  if (elapsedMs <= 0) {
    return MICRO_UNIT;
  }
  if (elapsedMs >= runDurationMs) {
    return crashMultiplierMicro;
  }

  const span = crashMultiplierMicro - MICRO_UNIT;
  const progress = BigInt(elapsedMs);
  const duration = BigInt(runDurationMs);
  return MICRO_UNIT + (span * progress) / duration;
}
