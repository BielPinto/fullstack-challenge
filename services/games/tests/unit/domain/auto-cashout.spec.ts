import { describe, expect, it } from "bun:test";
import { AutoCashoutMultiplierOutOfRangeError } from "../../../src/domain/errors/game.errors";
import {
  assertAutoCashoutMultiplierInRange,
  parseMultiplierStringToMicro,
} from "../../../src/domain/value-objects/auto-cashout";

describe("auto-cashout", () => {
  it("parses display multipliers to micro units", () => {
    expect(parseMultiplierStringToMicro("2.00")).toBe(2_000_000n);
    expect(parseMultiplierStringToMicro("1.01")).toBe(1_010_000n);
  });

  it("rejects invalid multiplier strings", () => {
    expect(parseMultiplierStringToMicro("")).toBeNull();
    expect(parseMultiplierStringToMicro("abc")).toBeNull();
  });

  it("enforces 1.01x minimum and 1000x maximum", () => {
    expect(() => assertAutoCashoutMultiplierInRange(1_000_000n)).toThrow(
      AutoCashoutMultiplierOutOfRangeError,
    );
    expect(() => assertAutoCashoutMultiplierInRange(1_010_000n)).not.toThrow();
  });
});
