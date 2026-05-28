import { Injectable } from "@nestjs/common";
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

@Injectable()
export class GameMetricsService {
  readonly registry = new Registry();

  readonly betsPlacedTotal: Counter;
  readonly betsCashedOutTotal: Counter;
  readonly betsLostTotal: Counter;
  readonly betVolumeCentsTotal: Counter;
  readonly payoutVolumeCentsTotal: Counter;
  readonly roundsSettledTotal: Counter;
  readonly wsBroadcastDurationSeconds: Histogram;
  readonly rtpRatio: Gauge;
  readonly autoCashoutsTotal: Counter;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.betsPlacedTotal = new Counter({
      name: "crash_game_bets_placed_total",
      help: "Total bets successfully placed (debit confirmed)",
      registers: [this.registry],
    });

    this.betsCashedOutTotal = new Counter({
      name: "crash_game_bets_cashed_out_total",
      help: "Total manual and auto cashouts",
      registers: [this.registry],
    });

    this.betsLostTotal = new Counter({
      name: "crash_game_bets_lost_total",
      help: "Total bets lost on crash",
      registers: [this.registry],
    });

    this.betVolumeCentsTotal = new Counter({
      name: "crash_game_bet_volume_cents_total",
      help: "Sum of stake amounts in cents",
      registers: [this.registry],
    });

    this.payoutVolumeCentsTotal = new Counter({
      name: "crash_game_payout_volume_cents_total",
      help: "Sum of cashout payouts in cents",
      registers: [this.registry],
    });

    this.roundsSettledTotal = new Counter({
      name: "crash_game_rounds_settled_total",
      help: "Total rounds settled (crashed)",
      registers: [this.registry],
    });

    this.autoCashoutsTotal = new Counter({
      name: "crash_game_auto_cashouts_total",
      help: "Cashouts triggered by auto-cashout target",
      registers: [this.registry],
    });

    this.wsBroadcastDurationSeconds = new Histogram({
      name: "crash_game_ws_broadcast_duration_seconds",
      help: "WebSocket broadcast handler duration",
      labelNames: ["event"],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
      registers: [this.registry],
    });

    this.rtpRatio = new Gauge({
      name: "crash_game_rtp_ratio",
      help: "Return-to-player ratio (payout volume / bet volume)",
      registers: [this.registry],
    });
  }

  recordBetPlaced(amountInCents: bigint): void {
    this.betsPlacedTotal.inc();
    this.betVolumeCentsTotal.inc(Number(amountInCents));
    this.refreshRtp();
  }

  recordCashout(payoutInCents: bigint, auto = false): void {
    this.betsCashedOutTotal.inc();
    this.payoutVolumeCentsTotal.inc(Number(payoutInCents));
    if (auto) {
      this.autoCashoutsTotal.inc();
    }
    this.refreshRtp();
  }

  recordBetsLost(count: number): void {
    if (count > 0) {
      this.betsLostTotal.inc(count);
    }
  }

  recordRoundSettled(): void {
    this.roundsSettledTotal.inc();
  }

  observeWsBroadcast(event: string, durationMs: number): void {
    this.wsBroadcastDurationSeconds.observe({ event }, durationMs / 1000);
  }

  private refreshRtp(): void {
    const betVol = this.getMetricValue(this.betVolumeCentsTotal);
    const payoutVol = this.getMetricValue(this.payoutVolumeCentsTotal);
    if (betVol > 0) {
      this.rtpRatio.set(payoutVol / betVol);
    }
  }

  private getMetricValue(counter: Counter): number {
    const metric = counter.get();
    if (metric.type !== "counter") {
      return 0;
    }
    return metric.values.reduce((sum, v) => sum + v.value, 0);
  }

  async metricsText(): Promise<string> {
    return this.registry.metrics();
  }
}
