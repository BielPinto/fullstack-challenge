export const GAME_BASE_URL = process.env.GAME_BASE_URL ?? "http://localhost:4001";
export const KONG_BASE_URL = process.env.KONG_BASE_URL ?? "http://localhost:8000";
export const WALLET_BASE_URL = process.env.WALLET_BASE_URL ?? "http://localhost:8000/wallets";
export const KEYCLOAK_TOKEN_URL =
  process.env.KEYCLOAK_TOKEN_URL ??
  "http://localhost:8080/realms/crash-game/protocol/openid-connect/token";
export const PLAYER_USER_ID =
  process.env.SEED_PLAYER_USER_ID ?? "f47ac10b-58cc-4372-a567-0e02b2c3d479";

export type RoundPhase = "BETTING" | "RUNNING" | "SETTLED";

export type RoundView = {
  id: string;
  phase: RoundPhase;
  bettingEndsAt: string;
  currentMultiplier: string | null;
  bets: Array<{ id: string; userId: string; status: string }>;
};

export type BetActionResponse = {
  betId: string;
  roundId: string;
  status: string;
  amount: string;
  cashoutMultiplier?: string;
  payout?: string;
};

export type VerifyRoundResponse = {
  roundId: string;
  commitHash: string;
  serverSecret: string | null;
  clientSeed: string;
  nonce: string;
  crashMultiplier: string | null;
  runDurationMs: number | null;
  verified: boolean;
};

export async function getPlayerToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: "crash-game-client",
    grant_type: "password",
    username: "player",
    password: "player123",
  });

  const response = await fetch(KEYCLOAK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Keycloak token failed: ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as { access_token: string };
  return json.access_token;
}

export async function waitForKeycloak(attempts = 30): Promise<void> {
  const realmUrl = "http://localhost:8080/realms/crash-game";
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(realmUrl);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await Bun.sleep(2000);
  }
  throw new Error(`Keycloak not ready: ${realmUrl}`);
}

export async function waitForService(url: string, attempts = 30): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await Bun.sleep(2000);
  }
  throw new Error(`Service not ready: ${url}`);
}

export async function fetchBalanceCents(token: string): Promise<bigint> {
  const res = await fetch(`${WALLET_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GET /wallets/me failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { balanceInCents: string };
  return BigInt(body.balanceInCents);
}

export async function getCurrentRound(
  baseUrl = `${KONG_BASE_URL}/games`,
): Promise<RoundView> {
  const res = await fetch(`${baseUrl}/rounds/current`);
  if (!res.ok) {
    throw new Error(`GET rounds/current failed: ${res.status}`);
  }
  return (await res.json()) as RoundView;
}

export function playerHasBetOnRound(round: RoundView): boolean {
  return round.bets.some(
    (b) => b.userId === PLAYER_USER_ID && b.status !== "DEBIT_FAILED",
  );
}

/** Waits until the active round is in BETTING and the player has no bet on it. */
export async function waitForOpenBettingRound(
  token: string,
  options: { timeoutMs?: number; baseUrl?: string } = {},
): Promise<RoundView> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const baseUrl = options.baseUrl ?? `${KONG_BASE_URL}/games`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const round = await getCurrentRound(baseUrl);
    if (round.phase === "BETTING" && !playerHasBetOnRound(round)) {
      return round;
    }
    if (round.phase === "RUNNING" && playerHasBetOnRound(round)) {
      await cashOut(token, baseUrl).catch(() => undefined);
    }
    await Bun.sleep(400);
  }

  throw new Error("Timed out waiting for open betting round");
}

/** Waits until the given round is no longer active (settled or replaced by a new round). */
export async function waitForRoundToEnd(
  roundId: string,
  options: { timeoutMs?: number; baseUrl?: string } = {},
): Promise<RoundView> {
  const timeoutMs = options.timeoutMs ?? 150_000;
  const baseUrl = options.baseUrl ?? `${KONG_BASE_URL}/games`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const round = await getCurrentRound(baseUrl);
    if (round.id !== roundId || round.phase === "SETTLED") {
      return round;
    }
    await Bun.sleep(400);
  }

  throw new Error(`Timed out waiting for round ${roundId} to end`);
}

export async function waitForRoundPhase(
  phase: RoundPhase,
  options: { timeoutMs?: number; baseUrl?: string } = {},
): Promise<RoundView> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const baseUrl = options.baseUrl ?? `${KONG_BASE_URL}/games`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const round = await getCurrentRound(baseUrl);
    if (round.phase === phase) {
      return round;
    }
    await Bun.sleep(400);
  }

  throw new Error(`Timed out waiting for round phase ${phase}`);
}

export async function placeBet(
  token: string,
  amountInCents: bigint,
  baseUrl = `${KONG_BASE_URL}/games`,
): Promise<{ status: number; body: BetActionResponse | { message: string } }> {
  const res = await fetch(`${baseUrl}/bet`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amountInCents: amountInCents.toString() }),
  });
  const body = (await res.json()) as BetActionResponse | { message: string };
  return { status: res.status, body };
}

export async function cashOut(
  token: string,
  baseUrl = `${KONG_BASE_URL}/games`,
): Promise<{ status: number; body: BetActionResponse | { message: string } }> {
  const res = await fetch(`${baseUrl}/bet/cashout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as BetActionResponse | { message: string };
  return { status: res.status, body };
}

export async function verifyRound(
  roundId: string,
  baseUrl = `${KONG_BASE_URL}/games`,
): Promise<VerifyRoundResponse> {
  const res = await fetch(`${baseUrl}/rounds/${roundId}/verify`);
  if (!res.ok) {
    throw new Error(
      `GET rounds/${roundId}/verify failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as VerifyRoundResponse;
}

export async function getMyBets(
  token: string,
  baseUrl = `${KONG_BASE_URL}/games`,
): Promise<{ items: Array<{ id: string; status: string; roundId: string }> }> {
  const res = await fetch(`${baseUrl}/bets/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GET bets/me failed: ${res.status}`);
  }
  return (await res.json()) as {
    items: Array<{ id: string; status: string; roundId: string }>;
  };
}
