import { Module } from "@nestjs/common";
import { MessagingModule } from "../infrastructure/messaging/messaging.module";
import { ObservabilityModule } from "../infrastructure/observability/observability.module";
import { PersistenceModule } from "../infrastructure/persistence/persistence.module";
import { RealtimeModule } from "../infrastructure/realtime/realtime.module";
import { GameRoundService } from "./services/game-round.service";
import { CashOutBetUseCase } from "./use-cases/cash-out-bet.use-case";
import { GetCurrentRoundUseCase } from "./use-cases/get-current-round.use-case";
import { GetLeaderboardUseCase } from "./use-cases/get-leaderboard.use-case";
import { GetMyBetsUseCase } from "./use-cases/get-my-bets.use-case";
import { GetRoundHistoryUseCase } from "./use-cases/get-round-history.use-case";
import { PlaceBetUseCase } from "./use-cases/place-bet.use-case";
import { VerifyRoundUseCase } from "./use-cases/verify-round.use-case";

@Module({
  imports: [PersistenceModule, MessagingModule, RealtimeModule, ObservabilityModule],
  providers: [
    GameRoundService,
    PlaceBetUseCase,
    CashOutBetUseCase,
    GetCurrentRoundUseCase,
    GetRoundHistoryUseCase,
    VerifyRoundUseCase,
    GetMyBetsUseCase,
    GetLeaderboardUseCase,
  ],
  exports: [
    GameRoundService,
    PlaceBetUseCase,
    CashOutBetUseCase,
    GetCurrentRoundUseCase,
    GetRoundHistoryUseCase,
    VerifyRoundUseCase,
    GetMyBetsUseCase,
    GetLeaderboardUseCase,
  ],
})
export class ApplicationModule {}
