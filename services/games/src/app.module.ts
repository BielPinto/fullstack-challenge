import { Module } from "@nestjs/common";
import { ApplicationModule } from "./application/application.module";
import { AuthModule } from "./infrastructure/auth/auth.module";
import { GamesController } from "./presentation/controllers/games.controller";

@Module({
  imports: [ApplicationModule, AuthModule],
  controllers: [GamesController],
})
export class AppModule {}
