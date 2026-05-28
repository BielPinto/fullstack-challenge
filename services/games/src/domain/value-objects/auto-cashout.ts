import { AutoCashoutMultiplierOutOfRangeError } from "../errors/game.errors";
import { MAX_CRASH_MULTIPLIER_MICRO, MICRO_UNIT } from "../services/provably-fair";

/** Minimum auto cashout target: 1.01x */
export const MIN_AUTO_CASHOUT_MULTIPLIER_MICRO = 1_010_000n;

export function assertAutoCashoutMultiplierInRange(multiplierMicro: bigint): void {
  if (
    multiplierMicro < MIN_AUTO_CASHOUT_MULTIPLIER_MICRO ||
    multiplierMicro > MAX_CRASH_MULTIPLIER_MICRO
  ) {
    throw new AutoCashoutMultiplierOutOfRangeError();
  }
}

/** Parse display multiplier (e.g. "2.50") into micro units. */
export function parseMultiplierStringToMicro(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const whole = BigInt(match[1]);
  const frac = (match[2] ?? "").padEnd(6, "0").slice(0, 6);
  const micro = whole * MICRO_UNIT + BigInt(frac);
  return micro;
}
