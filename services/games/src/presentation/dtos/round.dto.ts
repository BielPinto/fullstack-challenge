import type { BetRecord, RoundRecord } from "../../application/ports/game.persistence";
import { formatCents, formatMultiplierMicro } from "../mappers/format";

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

export function toBetViewDto(bet: BetRecord): BetViewDto {
  return {
    id: bet.id,
    userId: bet.userId,
    amount: formatCents(bet.amountInCents),
    status: bet.status,
    cashoutMultiplier: bet.cashoutMultiplierMicro
      ? formatMultiplierMicro(bet.cashoutMultiplierMicro)
      : null,
    payout: bet.payoutInCents ? formatCents(bet.payoutInCents) : null,
  };
}

export function toRoundViewDto(input: {
  round: RoundRecord;
  currentMultiplierMicro: bigint | null;
  bets: BetRecord[];
}): RoundViewDto {
  const { round, currentMultiplierMicro, bets } = input;
  return {
    id: round.id,
    phase: round.phase,
    commitHash: round.commitHash,
    clientSeed: round.clientSeed,
    nonce: round.nonce,
    bettingEndsAt: round.bettingEndsAt.toISOString(),
    runningStartedAt: round.runningStartedAt?.toISOString() ?? null,
    settledAt: round.settledAt?.toISOString() ?? null,
    crashMultiplier: round.crashMultiplierMicro
      ? formatMultiplierMicro(round.crashMultiplierMicro)
      : null,
    currentMultiplier: currentMultiplierMicro
      ? formatMultiplierMicro(currentMultiplierMicro)
      : null,
    bets: bets.map(toBetViewDto),
  };
}

export type RoundHistoryItemDto = {
  id: string;
  crashMultiplier: string;
  settledAt: string;
};

export function toRoundHistoryItemDto(round: RoundRecord): RoundHistoryItemDto {
  if (!round.crashMultiplierMicro || !round.settledAt) {
    throw new Error("Settled round missing crash data");
  }
  return {
    id: round.id,
    crashMultiplier: formatMultiplierMicro(round.crashMultiplierMicro),
    settledAt: round.settledAt.toISOString(),
  };
}

export type VerifyRoundResponseDto = {
  roundId: string;
  commitHash: string;
  serverSecret: string | null;
  clientSeed: string;
  nonce: string;
  crashMultiplier: string | null;
  runDurationMs: number | null;
  verified: boolean;
};
