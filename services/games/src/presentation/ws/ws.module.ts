import { Module } from "@nestjs/common";
import { ApplicationModule } from "../../application/application.module";
import { GameGateway } from "./game.gateway";

@Module({
  imports: [ApplicationModule],
  providers: [GameGateway],
})
export class WsModule {}
