import { BetAmountOutOfRangeError } from "../errors/game.errors";

/** Rules from README: min 1.00, max 1_000.00 (BRL) represented in cents. */
export const MIN_BET_AMOUNT_CENTS = 100n;
export const MAX_BET_AMOUNT_CENTS = 100_000n;

export function assertBetAmountInRange(amountInCents: bigint): void {
  if (amountInCents < MIN_BET_AMOUNT_CENTS || amountInCents > MAX_BET_AMOUNT_CENTS) {
    throw new BetAmountOutOfRangeError();
  }
}
