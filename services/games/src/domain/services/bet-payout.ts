import { MICRO_UNIT } from "./provably-fair";

export function computeCashoutPayoutCents(
  amountInCents: bigint,
  multiplierMicro: bigint,
): bigint {
  return (amountInCents * multiplierMicro) / MICRO_UNIT;
}
