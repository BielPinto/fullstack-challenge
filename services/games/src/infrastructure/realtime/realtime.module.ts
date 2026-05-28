import { Global, Module } from "@nestjs/common";
import { GAME_EVENTS } from "../../application/ports/game-events.port";
import { SocketGameEventsPublisher } from "./socket-game-events.publisher";

@Global()
@Module({
  providers: [
    SocketGameEventsPublisher,
    {
      provide: GAME_EVENTS,
      useExisting: SocketGameEventsPublisher,
    },
  ],
  exports: [GAME_EVENTS, SocketGameEventsPublisher],
})
export class RealtimeModule {}
