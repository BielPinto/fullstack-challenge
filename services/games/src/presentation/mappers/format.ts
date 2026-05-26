import { MICRO_UNIT } from "../../domain/services/provably-fair";

export function formatMultiplierMicro(micro: bigint): string {
  const whole = micro / MICRO_UNIT;
  const hundredths = (micro % MICRO_UNIT) / 10_000n;
  return `${whole}.${hundredths.toString().padStart(2, "0")}`;
}

export function formatCents(amountInCents: bigint): string {
  const whole = amountInCents / 100n;
  const cents = amountInCents % 100n;
  return `${whole}.${cents.toString().padStart(2, "0")}`;
}
