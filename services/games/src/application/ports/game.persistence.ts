import type { BetStatus, RoundPhase } from "@prisma/client";

export type { BetStatus, RoundPhase };

export type RoundRecord = {
  id: string;
  phase: RoundPhase;
  commitHash: string;
  serverSecret: string;
  clientSeed: string;
  nonce: string;
  crashMultiplierMicro: bigint | null;
  runDurationMs: number | null;
  bettingEndsAt: Date;
  runningStartedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
};

export type BetRecord = {
  id: string;
  roundId: string;
  userId: string;
  amountInCents: bigint;
  status: BetStatus;
  cashoutMultiplierMicro: bigint | null;
  payoutInCents: bigint | null;
  autoCashoutMultiplierMicro: bigint | null;
  debitCommandId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type LeaderboardEntry = {
  userId: string;
  profitInCents: bigint;
  betCount: number;
};

export type LeaderboardPeriod = "24h" | "7d";

export const ROUND_REPOSITORY = Symbol("ROUND_REPOSITORY");

export type CreateRoundInput = Pick<
  RoundRecord,
  | "phase"
  | "commitHash"
  | "serverSecret"
  | "clientSeed"
  | "nonce"
  | "bettingEndsAt"
> &
  Partial<Pick<RoundRecord, "crashMultiplierMicro" | "runDurationMs" | "runningStartedAt">>;

export type RoundRepositoryPort = {
  findActiveRound(): Promise<RoundRecord | null>;
  createRound(input: CreateRoundInput): Promise<RoundRecord>;
  updateRound(id: string, patch: Partial<RoundRecord>): Promise<void>;
  findById(id: string): Promise<RoundRecord | null>;
  listRecentSettledRounds(skip: number, take: number): Promise<RoundRecord[]>;
  findLatestSettledRound(): Promise<RoundRecord | null>;
};

export const BET_REPOSITORY = Symbol("BET_REPOSITORY");

export type BetRepositoryPort = {
  createBetDebitPending(input: {
    id: string;
    roundId: string;
    userId: string;
    amountInCents: bigint;
    debitCommandId: string;
    autoCashoutMultiplierMicro?: bigint | null;
  }): Promise<BetRecord>;
  deleteBet(id: string): Promise<void>;
  markDebitSucceeded(debitCommandId: string): Promise<void>;
  findByDebitCommandId(debitCommandId: string): Promise<BetRecord | null>;
  findById(id: string): Promise<BetRecord | null>;
  findUserBetOnRound(userId: string, roundId: string): Promise<BetRecord | null>;
  markCashedOut(input: {
    betId: string;
    cashoutMultiplierMicro: bigint;
    payoutInCents: bigint;
  }): Promise<boolean>;
  revertCashout(betId: string): Promise<void>;
  markAllActiveBetsLost(roundId: string): Promise<number>;
  listMyBets(userId: string, skip: number, take: number): Promise<BetRecord[]>;
  listPublicBetsForRound(roundId: string): Promise<BetRecord[]>;
  listActiveBetsDueForAutoCashout(
    roundId: string,
    currentMultiplierMicro: bigint,
  ): Promise<BetRecord[]>;
  getLeaderboard(
    period: LeaderboardPeriod,
    limit: number,
  ): Promise<LeaderboardEntry[]>;
};
