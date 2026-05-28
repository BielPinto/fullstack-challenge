import { Module } from "@nestjs/common";
import { ApplicationModule } from "./application/application.module";
import { AuthModule } from "./infrastructure/auth/auth.module";
import { MessagingModule } from "./infrastructure/messaging/messaging.module";
import { PersistenceModule } from "./infrastructure/persistence/persistence.module";
import { WalletsController } from "./presentation/controllers/wallets.controller";

@Module({
  imports: [PersistenceModule, ApplicationModule, AuthModule, MessagingModule],
  controllers: [WalletsController],
})
export class AppModule {}
