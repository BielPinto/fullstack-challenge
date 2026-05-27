const base = (): string =>
  (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("Resposta inválida do servidor", res.status, text);
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { accessToken?: string | null } = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${base()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.accessToken) {
    headers.set("Authorization", `Bearer ${init.accessToken}`);
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    let message = res.statusText;
    try {
      const j = JSON.parse(body) as { message?: string | string[] };
      if (typeof j.message === "string") {
        message = j.message;
      } else if (Array.isArray(j.message)) {
        message = j.message.join(", ");
      }
    } catch {
      if (body) {
        message = body.slice(0, 200);
      }
    }
    throw new ApiError(message, res.status, body);
  }
  return parseJson<T>(res);
}

export type WalletDto = {
  id: string;
  userId: string;
  balanceInCents: string;
  balance: string;
  currency: string;
};

export type BetViewDto = {
  id: string;
  userId: string;
  amount: string;
  status: string;
  cashoutMultiplier: string | null;
  payout: string | null;
};

export type RoundViewDto = {
  id: string;
  phase: string;
  commitHash: string;
  clientSeed: string;
  nonce: string;
  bettingEndsAt: string;
  runningStartedAt: string | null;
  settledAt: string | null;
  crashMultiplier: string | null;
  currentMultiplier: string | null;
  bets: BetViewDto[];
};

export type RoundHistoryItemDto = {
  id: string;
  crashMultiplier: string;
  settledAt: string;
};

export type VerifyRoundDto = {
  roundId: string;
  commitHash: string;
  serverSecret: string | null;
  clientSeed: string;
  nonce: string;
  crashMultiplier: string | null;
  runDurationMs: number | null;
  verified: boolean;
};

export type BetActionResponseDto = {
  betId: string;
  roundId: string;
  status: string;
  amount: string;
  cashoutMultiplier?: string;
  payout?: string;
};

export const gamesApi = {
  currentRound: (token?: string | null) =>
    apiFetch<RoundViewDto>("/games/rounds/current", { accessToken: token }),
  history: (skip = 0, take = 20) =>
    apiFetch<{ items: RoundHistoryItemDto[] }>(`/games/rounds/history?skip=${skip}&take=${take}`),
  placeBet: (amountInCents: string, token: string) =>
    apiFetch<BetActionResponseDto>("/games/bet", {
      method: "POST",
      accessToken: token,
      body: JSON.stringify({ amountInCents }),
    }),
  cashout: (token: string) =>
    apiFetch<BetActionResponseDto>("/games/bet/cashout", {
      method: "POST",
      accessToken: token,
    }),
  verifyRound: (roundId: string) =>
    apiFetch<VerifyRoundDto>(`/games/rounds/${encodeURIComponent(roundId)}/verify`),
};

export const walletsApi = {
  create: (token: string) =>
    apiFetch<WalletDto>("/wallets", { method: "POST", accessToken: token, body: JSON.stringify({}) }),
  me: (token: string) => apiFetch<WalletDto>("/wallets/me", { accessToken: token }),
};
