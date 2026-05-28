import { Bet } from "../../domain/entities/bet.entity";
import { Round } from "../../domain/entities/round.entity";
import type { BetRecord, RoundRecord } from "../ports/game.persistence";

export function roundToDomain(record: RoundRecord): Round {
  return Round.reconstitute({
    id: record.id,
    phase: record.phase,
    commitHash: record.commitHash,
    serverSecret: record.serverSecret,
    clientSeed: record.clientSeed,
    nonce: record.nonce,
    crashMultiplierMicro: record.crashMultiplierMicro,
    runDurationMs: record.runDurationMs,
    bettingEndsAt: record.bettingEndsAt,
    runningStartedAt: record.runningStartedAt,
    settledAt: record.settledAt,
    createdAt: record.createdAt,
  });
}

export function roundToRecord(round: Round): RoundRecord {
  return round.toProps();
}

export function betToDomain(record: BetRecord): Bet {
  return Bet.reconstitute({
    id: record.id,
    roundId: record.roundId,
    userId: record.userId,
    amountInCents: record.amountInCents,
    status: record.status,
    cashoutMultiplierMicro: record.cashoutMultiplierMicro,
    payoutInCents: record.payoutInCents,
    debitCommandId: record.debitCommandId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function betToRecord(bet: Bet): BetRecord {
  return bet.toProps();
}
