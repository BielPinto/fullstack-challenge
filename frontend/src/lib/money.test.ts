import { describe, expect, it } from "vitest";
import { formatBrlFromCents, parseBrlToCents } from "./money";

describe("parseBrlToCents", () => {
  it("accepts decimal comma and dot", () => {
    expect(parseBrlToCents("10,50")).toEqual({ ok: true, cents: 1050n });
    expect(parseBrlToCents("10.5")).toEqual({ ok: true, cents: 1050n });
  });
  it("rejects below minimum", () => {
    expect(parseBrlToCents("0,50").ok).toBe(false);
  });
  it("rejects above maximum", () => {
    expect(parseBrlToCents("1000,01").ok).toBe(false);
  });
});

describe("formatBrlFromCents", () => {
  it("formats with comma", () => {
    expect(formatBrlFromCents(100_000n)).toBe("1000,00");
  });
});
