import { GAME_WS_EVENTS } from "@crash/contracts";
import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";
import type {
  GameEventsPort,
  RoundStateBroadcast,
} from "../../application/ports/game-events.port";
import type { BetRecord, RoundRecord } from "../../application/ports/game.persistence";
import {
  toWsBetPayload,
  toWsRoundCrashedPayload,
  toWsRoundPhasePayload,
  toWsRoundStatePayload,
  toWsRoundTickPayload,
} from "./ws-payload.mapper";

@Injectable()
export class SocketGameEventsPublisher implements GameEventsPort {
  private server: Server | null = null;

  attachServer(server: Server): void {
    this.server = server;
  }

  broadcastRoundState(payload: RoundStateBroadcast): void {
    this.server?.emit(GAME_WS_EVENTS.ROUND_STATE, toWsRoundStatePayload(payload));
  }

  broadcastRoundPhase(round: RoundRecord): void {
    this.server?.emit(GAME_WS_EVENTS.ROUND_PHASE, toWsRoundPhasePayload(round));
  }

  broadcastRoundTick(input: {
    roundId: string;
    currentMultiplierMicro: bigint;
    elapsedMs: number;
    runDurationMs: number;
  }): void {
    this.server?.emit(GAME_WS_EVENTS.ROUND_TICK, toWsRoundTickPayload(input));
  }

  broadcastRoundCrashed(round: RoundRecord): void {
    this.server?.emit(GAME_WS_EVENTS.ROUND_CRASHED, toWsRoundCrashedPayload(round));
  }

  broadcastBetPlaced(bet: BetRecord): void {
    this.server?.emit(GAME_WS_EVENTS.BET_PLACED, toWsBetPayload(bet));
  }

  broadcastBetCashedOut(bet: BetRecord): void {
    this.server?.emit(GAME_WS_EVENTS.BET_CASHED_OUT, toWsBetPayload(bet));
  }
}
