import { Logger } from "@nestjs/common";
import { GAME_WS_EVENTS } from "@crash/contracts";
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import { SocketGameEventsPublisher } from "../../infrastructure/realtime/socket-game-events.publisher";
import { toWsRoundStatePayload } from "../../infrastructure/realtime/ws-payload.mapper";

const wsCorsOrigin = process.env.WS_CORS_ORIGIN ?? "*";

@WebSocketGateway({
  cors: {
    origin: wsCorsOrigin === "*" ? true : wsCorsOrigin.split(",").map((o) => o.trim()),
  },
  transports: ["websocket", "polling"],
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly events: SocketGameEventsPublisher,
    private readonly getCurrentRound: GetCurrentRoundUseCase,
  ) {}

  afterInit(server: Server): void {
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
}
