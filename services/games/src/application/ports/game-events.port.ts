import type { BetRecord, RoundRecord } from "./game.persistence";

export const GAME_EVENTS = Symbol("GAME_EVENTS");

export type RoundStateBroadcast = {
  round: RoundRecord;
  currentMultiplierMicro: bigint | null;
  bets: BetRecord[];
};

export interface GameEventsPort {
  broadcastRoundState(payload: RoundStateBroadcast): void;
  broadcastRoundPhase(round: RoundRecord): void;
  broadcastRoundTick(input: {
    roundId: string;
    currentMultiplierMicro: bigint;
    elapsedMs: number;
    runDurationMs: number;
  }): void;
  broadcastRoundCrashed(round: RoundRecord): void;
  broadcastBetPlaced(bet: BetRecord): void;
  broadcastBetCashedOut(bet: BetRecord): void;
}
