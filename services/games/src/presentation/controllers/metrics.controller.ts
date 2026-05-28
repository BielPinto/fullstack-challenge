import { Controller, Get, Header } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { GameMetricsService } from "../../infrastructure/observability/game-metrics.service";

@ApiExcludeController()
@Controller()
export class MetricsController {
  constructor(private readonly metrics: GameMetricsService) {}

  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async prometheus(): Promise<string> {
    return this.metrics.metricsText();
  }
}
