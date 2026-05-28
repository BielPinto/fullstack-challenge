import { GAME_WS_EVENTS } from "@crash/contracts";
import { Injectable } from "@nestjs/common";
import { GameMetricsService } from "../observability/game-metrics.service";
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

  constructor(private readonly metrics: GameMetricsService) {}

  attachServer(server: Server): void {
    this.server = server;
  }

  broadcastRoundState(payload: RoundStateBroadcast): void {
    this.emitTimed(GAME_WS_EVENTS.ROUND_STATE, () =>
      this.server?.emit(GAME_WS_EVENTS.ROUND_STATE, toWsRoundStatePayload(payload)),
    );
  }

  broadcastRoundPhase(round: RoundRecord): void {
    this.emitTimed(GAME_WS_EVENTS.ROUND_PHASE, () =>
      this.server?.emit(GAME_WS_EVENTS.ROUND_PHASE, toWsRoundPhasePayload(round)),
    );
  }

  broadcastRoundTick(input: {
    roundId: string;
    currentMultiplierMicro: bigint;
    elapsedMs: number;
    runDurationMs: number;
  }): void {
    this.emitTimed(GAME_WS_EVENTS.ROUND_TICK, () =>
      this.server?.emit(GAME_WS_EVENTS.ROUND_TICK, toWsRoundTickPayload(input)),
    );
  }

  broadcastRoundCrashed(round: RoundRecord): void {
    this.emitTimed(GAME_WS_EVENTS.ROUND_CRASHED, () =>
      this.server?.emit(GAME_WS_EVENTS.ROUND_CRASHED, toWsRoundCrashedPayload(round)),
    );
  }

  broadcastBetPlaced(bet: BetRecord): void {
    this.emitTimed(GAME_WS_EVENTS.BET_PLACED, () =>
      this.server?.emit(GAME_WS_EVENTS.BET_PLACED, toWsBetPayload(bet)),
    );
  }

  broadcastBetCashedOut(bet: BetRecord): void {
    this.emitTimed(GAME_WS_EVENTS.BET_CASHED_OUT, () =>
      this.server?.emit(GAME_WS_EVENTS.BET_CASHED_OUT, toWsBetPayload(bet)),
    );
  }

  private emitTimed(event: string, fn: () => void): void {
    const start = performance.now();
    fn();
    this.metrics.observeWsBroadcast(event, performance.now() - start);
  }
}
