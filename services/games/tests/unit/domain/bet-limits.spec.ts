import { describe, expect, it } from "bun:test";
import { BetAmountOutOfRangeError } from "../../../src/domain/errors/game.errors";
import { assertBetAmountInRange } from "../../../src/domain/value-objects/bet-limits";

describe("bet limits", () => {
  it("accepts amounts within range", () => {
    expect(() => assertBetAmountInRange(100n)).not.toThrow();
    expect(() => assertBetAmountInRange(100_000n)).not.toThrow();
  });

  it("rejects amounts below minimum", () => {
    expect(() => assertBetAmountInRange(99n)).toThrow(BetAmountOutOfRangeError);
  });

  it("rejects amounts above maximum", () => {
    expect(() => assertBetAmountInRange(100_001n)).toThrow(BetAmountOutOfRangeError);
  });
});
