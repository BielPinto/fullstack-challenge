import { AutoCashoutMultiplierOutOfRangeError } from "../errors/game.errors";
import { MAX_CRASH_MULTIPLIER_MICRO, MICRO_UNIT } from "../services/provably-fair";

export const MIN_AUTO_CASHOUT_MULTIPLIER_MICRO = 1_010_000n;

export function assertAutoCashoutMultiplierInRange(multiplierMicro: bigint): void {
  if (
    multiplierMicro < MIN_AUTO_CASHOUT_MULTIPLIER_MICRO ||
    multiplierMicro > MAX_CRASH_MULTIPLIER_MICRO
  ) {
    throw new AutoCashoutMultiplierOutOfRangeError();
  }
}

function isDigitsOnly(part: string): boolean {
  if (part.length === 0) {
    return false;
  }
  for (const ch of part) {
    if (ch < "0" || ch > "9") {
      return false;
    }
  }
  return true;
}

export function parseMultiplierStringToMicro(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dotIndex = trimmed.indexOf(".");
  const wholePart = dotIndex === -1 ? trimmed : trimmed.slice(0, dotIndex);
  const fracPart = dotIndex === -1 ? "" : trimmed.slice(dotIndex + 1);

  if (dotIndex !== trimmed.lastIndexOf(".")) {
    return null;
  }
  if (!isDigitsOnly(wholePart) || (fracPart !== "" && !isDigitsOnly(fracPart))) {
    return null;
  }
  if (fracPart.length > 6) {
    return null;
  }

  const whole = BigInt(wholePart);
  const fracPadded = fracPart.padEnd(6, "0").slice(0, 6);
  return whole * MICRO_UNIT + BigInt(fracPadded);
}
