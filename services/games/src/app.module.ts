import { Module } from "@nestjs/common";
import { ApplicationModule } from "./application/application.module";
import { AuthModule } from "./infrastructure/auth/auth.module";
import { GamesController } from "./presentation/controllers/games.controller";
import { WsModule } from "./presentation/ws/ws.module";

@Module({
  imports: [ApplicationModule, AuthModule, WsModule],
  controllers: [GamesController],
})
export class AppModule {}
