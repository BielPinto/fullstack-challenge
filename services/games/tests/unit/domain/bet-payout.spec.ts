import { describe, expect, it } from "bun:test";
import { computeCashoutPayoutCents } from "../../../src/domain/services/bet-payout";

describe("bet payout", () => {
  it("computes payout using integer arithmetic", () => {
    const payout = computeCashoutPayoutCents(10_000n, 2_500_000n);
    expect(payout).toBe(25_000n);
  });
});
