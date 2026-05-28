import type {
  WsBetPayloadV1,
  WsRoundCrashedPayloadV1,
  WsRoundPhasePayloadV1,
  WsRoundStatePayloadV1,
  WsRoundTickPayloadV1,
} from "@crash/contracts";
import type { BetRecord, RoundRecord } from "../../application/ports/game.persistence";
import type { RoundStateBroadcast } from "../../application/ports/game-events.port";
import { formatCents, formatMultiplierMicro } from "../../common/format";

export function toWsBetPayload(bet: BetRecord): WsBetPayloadV1 {
  return {
    id: bet.id,
    userId: bet.userId,
    amount: formatCents(bet.amountInCents),
    status: bet.status,
    cashoutMultiplier: bet.cashoutMultiplierMicro
      ? formatMultiplierMicro(bet.cashoutMultiplierMicro)
      : null,
    payout: bet.payoutInCents ? formatCents(bet.payoutInCents) : null,
    autoCashoutMultiplier: bet.autoCashoutMultiplierMicro
      ? formatMultiplierMicro(bet.autoCashoutMultiplierMicro)
      : null,
  };
}

export function toWsRoundStatePayload(input: RoundStateBroadcast): WsRoundStatePayloadV1 {
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
    runDurationMs: round.runDurationMs,
    bets: bets.map(toWsBetPayload),
  };
}

export function toWsRoundPhasePayload(round: RoundRecord): WsRoundPhasePayloadV1 {
  return {
    roundId: round.id,
    phase: round.phase,
    bettingEndsAt: round.bettingEndsAt.toISOString(),
    runningStartedAt: round.runningStartedAt?.toISOString() ?? null,
  };
}

export function toWsRoundTickPayload(input: {
  roundId: string;
  currentMultiplierMicro: bigint;
  elapsedMs: number;
  runDurationMs: number;
}): WsRoundTickPayloadV1 {
  return {
    roundId: input.roundId,
    currentMultiplier: formatMultiplierMicro(input.currentMultiplierMicro),
    elapsedMs: input.elapsedMs,
    runDurationMs: input.runDurationMs,
  };
}

export function toWsRoundCrashedPayload(round: RoundRecord): WsRoundCrashedPayloadV1 {
  if (!round.crashMultiplierMicro || !round.settledAt || !round.runDurationMs) {
    throw new Error("Settled round missing crash data for WebSocket payload");
  }

  return {
    roundId: round.id,
    crashMultiplier: formatMultiplierMicro(round.crashMultiplierMicro),
    settledAt: round.settledAt.toISOString(),
    verify: {
      commitHash: round.commitHash,
      serverSecret: round.serverSecret,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      runDurationMs: round.runDurationMs,
    },
  };
}
