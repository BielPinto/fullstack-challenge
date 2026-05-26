import { Injectable, Logger } from "@nestjs/common";
import { GAME_WS_EVENTS } from "@crash/contracts";
import type { Server, Socket } from "socket.io";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import { SocketGameEventsPublisher } from "../../infrastructure/realtime/socket-game-events.publisher";
import { toWsRoundStatePayload } from "../../infrastructure/realtime/ws-payload.mapper";

@Injectable()
export class GameGateway {
  private readonly logger = new Logger(GameGateway.name);
  private server: Server | null = null;

  constructor(
    private readonly events: SocketGameEventsPublisher,
    private readonly getCurrentRound: GetCurrentRoundUseCase,
  ) {}

  afterInit(server: Server): void {
    this.server = server;
    this.events.attachServer(server);
    this.logger.log("Game WebSocket gateway ready (server-push only)");
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const view = await this.getCurrentRound.execute();
      client.emit(
        GAME_WS_EVENTS.ROUND_STATE,
        toWsRoundStatePayload({
          round: view.round,
          currentMultiplierMicro: view.currentMultiplierMicro,
          bets: view.bets,
        }),
      );
    } catch (error) {
      this.logger.error("Failed to send initial round state", error);
      client.disconnect();
    }
  }

  getServer(): Server | null {
    return this.server;
  }
}
