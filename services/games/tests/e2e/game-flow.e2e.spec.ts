import { describe, expect, it, beforeAll } from "bun:test";
import {
  ensurePlayerBalance,
  SEED_BALANCE_CENTS,
} from "../../../wallets/tests/e2e/helpers";
import { formatMultiplierMicro } from "../../src/common/format";
import { deriveCrashOutcome } from "../../src/domain/services/provably-fair";
import {
  cashOut,
  fetchBalanceCents,
  GAME_BASE_URL,
  getCurrentRound,
  getMyBets,
  getPlayerToken,
  KONG_BASE_URL,
  placeBet,
  verifyRound,
  waitForKeycloak,
  waitForOpenBettingRound,
  waitForRoundPhase,
  waitForRoundToEnd,
  waitForService,
} from "./helpers";

const BET_AMOUNT_CENTS = 1_000n;
const SMALL_BET_CENTS = 500n;
const MAX_BET_CENTS = 100_000n;

function expectCreated(status: number): void {
  expect(status === 201 || status === 200).toBe(true);
}

describe("games e2e (docker:up)", () => {
  let token: string;

  beforeAll(async () => {
    await waitForService(`${GAME_BASE_URL}/health`);
    await waitForService(`${KONG_BASE_URL}/games/rounds/current`);
    await waitForKeycloak();
    token = await getPlayerToken();
    await ensurePlayerBalance(token, SEED_BALANCE_CENTS);
    const balance = await fetchBalanceCents(token);
    expect(balance).toBeGreaterThan(0n);
  }, 120_000);

  it("GET /health returns ok", async () => {
    const res = await fetch(`${GAME_BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("games");
  });

  it("GET /games/rounds/current via Kong returns a round", async () => {
    const round = await getCurrentRound();
    expect(["BETTING", "RUNNING", "SETTLED"]).toContain(round.phase);
    expect(round.id).toBeTruthy();
    expect(round.bettingEndsAt).toBeTruthy();
  });

  it("rejects bet when round is RUNNING (not in betting phase)", async () => {
    await waitForRoundPhase("BETTING", { timeoutMs: 60_000 });
    await waitForRoundPhase("RUNNING", { timeoutMs: 60_000 });

    const runningRound = await getCurrentRound();
    expect(runningRound.phase).toBe("RUNNING");

    const result = await placeBet(token, BET_AMOUNT_CENTS);
    expect(result.status).toBe(409);
    const message =
      "message" in result.body ? result.body.message : JSON.stringify(result.body);
    expect(message.toLowerCase()).toMatch(/betting|phase|accepting bets/);
  }, 90_000);

  it("rejects a second bet in the same round", async () => {
    await waitForOpenBettingRound(token, { timeoutMs: 120_000 });
    const balanceBefore = await fetchBalanceCents(token);

    const first = await placeBet(token, BET_AMOUNT_CENTS);
    expectCreated(first.status);

    const second = await placeBet(token, BET_AMOUNT_CENTS);
    expect(second.status).toBe(409);

    const balanceAfter = await fetchBalanceCents(token);
    expect(balanceAfter).toBe(balanceBefore - BET_AMOUNT_CENTS);
  }, 60_000);

  it("bet → running → cashout updates wallet balance", async () => {
    await waitForOpenBettingRound(token, { timeoutMs: 180_000 });
    const balanceBeforeBet = await fetchBalanceCents(token);

    const placed = await placeBet(token, BET_AMOUNT_CENTS);
    expectCreated(placed.status);
    if (!("betId" in placed.body)) {
      throw new Error(`Unexpected place bet body: ${JSON.stringify(placed.body)}`);
    }

    await waitForRoundPhase("RUNNING", { timeoutMs: 60_000 });
    const balanceAfterDebit = await fetchBalanceCents(token);
    expect(balanceAfterDebit).toBe(balanceBeforeBet - BET_AMOUNT_CENTS);

    const cashed = await cashOut(token);
    expectCreated(cashed.status);
    if (!("payout" in cashed.body) || !cashed.body.payout) {
      throw new Error(`Unexpected cashout body: ${JSON.stringify(cashed.body)}`);
    }
    expect(cashed.body.status).toBe("CASHED_OUT");

    const payoutFromDecimal = (() => {
      const [whole, frac = "00"] = cashed.body.payout!.split(".");
      return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0").slice(0, 2));
    })();

    const afterCashout = await fetchBalanceCents(token);
    expect(afterCashout).toBe(balanceAfterDebit + payoutFromDecimal);
    expect(payoutFromDecimal).toBeGreaterThan(0n);
  }, 180_000);

  it("rejects bet with insufficient wallet balance", async () => {
    await waitForOpenBettingRound(token, { timeoutMs: 120_000 });
    let balanceBefore = await fetchBalanceCents(token);

    // Must stay below MAX_BET so stake (balanceBefore + 1) is still a legal amount.
    let drains = 0;
    while (balanceBefore >= MAX_BET_CENTS && drains < 12) {
      await waitForOpenBettingRound(token, { timeoutMs: 120_000 });
      const drain = await placeBet(token, MAX_BET_CENTS);
      expectCreated(drain.status);
      if (!("roundId" in drain.body)) {
        throw new Error(`Unexpected drain bet body: ${JSON.stringify(drain.body)}`);
      }
      await waitForRoundPhase("RUNNING", { timeoutMs: 60_000 });
      await waitForRoundToEnd(drain.body.roundId, { timeoutMs: 150_000 });
      await waitForOpenBettingRound(token, { timeoutMs: 120_000 });
      balanceBefore = await fetchBalanceCents(token);
      drains++;
    }

    expect(balanceBefore).toBeLessThan(MAX_BET_CENTS);
    const overBalance = balanceBefore + 1n;

    const result = await placeBet(token, overBalance);

    expect(result.status).toBe(409);
    const message =
      "message" in result.body ? result.body.message : JSON.stringify(result.body);
    expect(message.toLowerCase()).toContain("insufficient");

    const balanceAfter = await fetchBalanceCents(token);
    expect(balanceAfter).toBe(balanceBefore);
  }, 480_000);

  it("bet → crash → bet lost and stake not returned", async () => {
    await waitForOpenBettingRound(token, { timeoutMs: 120_000 });
    const balanceBefore = await fetchBalanceCents(token);

    const placed = await placeBet(token, SMALL_BET_CENTS);
    expectCreated(placed.status);
    if (!("betId" in placed.body)) {
      throw new Error(`Unexpected place bet body: ${JSON.stringify(placed.body)}`);
    }
    const betId = placed.body.betId;
    const roundId = placed.body.roundId;

    const afterBet = await fetchBalanceCents(token);
    expect(afterBet).toBe(balanceBefore - SMALL_BET_CENTS);

    await waitForRoundPhase("RUNNING", { timeoutMs: 60_000 });
    await waitForRoundToEnd(roundId, { timeoutMs: 150_000 });

    const myBets = await getMyBets(token);
    const bet = myBets.items.find((b) => b.id === betId && b.roundId === roundId);
    expect(bet?.status).toBe("LOST");

    const balanceAfter = await fetchBalanceCents(token);
    expect(balanceAfter).toBe(afterBet);
  }, 150_000);

  it("settled round GET /verify via Kong returns verified=true", async () => {
    await waitForOpenBettingRound(token, { timeoutMs: 120_000 });

    const placed = await placeBet(token, SMALL_BET_CENTS);
    expectCreated(placed.status);
    if (!("roundId" in placed.body)) {
      throw new Error(`Unexpected place bet body: ${JSON.stringify(placed.body)}`);
    }
    const roundId = placed.body.roundId;

    await waitForRoundPhase("RUNNING", { timeoutMs: 60_000 });
    await waitForRoundToEnd(roundId, { timeoutMs: 150_000 });

    const verify = await verifyRound(roundId);
    expect(verify.roundId).toBe(roundId);
    expect(verify.verified).toBe(true);
    expect(verify.serverSecret).toBeTruthy();
    expect(verify.crashMultiplier).toBeTruthy();
    expect(verify.runDurationMs).not.toBeNull();

    const derived = deriveCrashOutcome(
      verify.serverSecret!,
      verify.clientSeed,
      verify.nonce,
    );
    expect(formatMultiplierMicro(derived.crashMultiplierMicro)).toBe(
      verify.crashMultiplier,
    );
    expect(derived.runDurationMs).toBe(verify.runDurationMs);
  }, 180_000);
});
