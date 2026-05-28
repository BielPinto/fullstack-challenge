import { Global, Module } from "@nestjs/common";
import { GameMetricsService } from "./game-metrics.service";

@Global()
@Module({
  providers: [GameMetricsService],
  exports: [GameMetricsService],
})
export class ObservabilityModule {}
