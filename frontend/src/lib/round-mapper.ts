import type { RoundViewDto } from "@/lib/api";
import type { WsRoundStatePayloadV1 } from "@/lib/game-ws-events";

export function roundDtoToWsState(d: RoundViewDto): WsRoundStatePayloadV1 {
  return {
    id: d.id,
    phase: d.phase,
    commitHash: d.commitHash,
    clientSeed: d.clientSeed,
    nonce: d.nonce,
    bettingEndsAt: d.bettingEndsAt,
    runningStartedAt: d.runningStartedAt,
    settledAt: d.settledAt,
    crashMultiplier: d.crashMultiplier,
    currentMultiplier: d.currentMultiplier,
    runDurationMs: null,
    bets: d.bets.map((b) => ({
      id: b.id,
      userId: b.userId,
      amount: b.amount,
      status: b.status,
      cashoutMultiplier: b.cashoutMultiplier,
      payout: b.payout,
    })),
  };
}
