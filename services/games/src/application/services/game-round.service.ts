import { Inject, Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { RoundPhase } from "@prisma/client";
import { randomBytes } from "node:crypto";
import {
  BET_REPOSITORY,
  ROUND_REPOSITORY,
  type BetRepositoryPort,
  type RoundRecord,
  type RoundRepositoryPort,
} from "../ports/game.persistence";
import {
  GAME_EVENTS,
  type GameEventsPort,
} from "../ports/game-events.port";
import {
  commitServerSecret,
  deriveCrashOutcome,
  displayMultiplierMicroAtProgress,
  newServerSecret,
} from "../../domain/services/provably-fair";
import { roundToDomain } from "../mappers/game-domain.mapper";
import { GameMetricsService } from "../../infrastructure/observability/game-metrics.service";

const DEFAULT_BETTING_WINDOW_MS = 10_000;
const SETTLED_PAUSE_MS = 2_000;
const DEFAULT_TICK_INTERVAL_MS = 100;

@Injectable()
export class GameRoundService {
  private readonly logger = new Logger(GameRoundService.name);
  private schedulerTimer: ReturnType<typeof setTimeout> | null = null;
  private bootstrapped = false;
  private readonly tickIntervalMs: number;

  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly rounds: RoundRepositoryPort,
    @Inject(BET_REPOSITORY)
    private readonly bets: BetRepositoryPort,
    @Inject(GAME_EVENTS)
    private readonly events: GameEventsPort,
    private readonly moduleRef: ModuleRef,
    private readonly metrics: GameMetricsService,
  ) {
    this.tickIntervalMs = Number(
      process.env.RUNNING_TICK_INTERVAL_MS ?? DEFAULT_TICK_INTERVAL_MS,
    );
  }

  async ensureSchedulerStarted(): Promise<void> {
    if (this.bootstrapped) {
      return;
    }
    this.bootstrapped = true;

    let active = await this.rounds.findActiveRound();
    if (!active) {
      active = await this.createBettingRound();
    }

    await this.publishRoundSnapshot(active);
    this.scheduleNextTick(active);
  }

  async getActiveRound(): Promise<RoundRecord> {
    await this.ensureSchedulerStarted();
    const round = await this.rounds.findActiveRound();
    if (!round) {
      return this.createBettingRound();
    }
    return round;
  }

  async getCurrentMultiplierMicro(round: RoundRecord): Promise<bigint | null> {
    if (round.phase !== RoundPhase.RUNNING || !round.runningStartedAt) {
      return null;
    }
    if (!round.crashMultiplierMicro || !round.runDurationMs) {
      return null;
    }

    const elapsedMs = Date.now() - round.runningStartedAt.getTime();
    return displayMultiplierMicroAtProgress({
      crashMultiplierMicro: round.crashMultiplierMicro,
      runDurationMs: round.runDurationMs,
      elapsedMs,
    });
  }

  async publishRoundSnapshot(round: RoundRecord): Promise<void> {
    const currentMultiplierMicro = await this.getCurrentMultiplierMicro(round);
    const roundBets = await this.bets.listPublicBetsForRound(round.id);
    this.events.broadcastRoundState({
      round,
      currentMultiplierMicro,
      bets: roundBets,
    });
  }

  private scheduleNextTick(round: RoundRecord): void {
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
    }

    const now = Date.now();
    let delayMs = 500;

    if (round.phase === RoundPhase.BETTING) {
      delayMs = Math.max(100, round.bettingEndsAt.getTime() - now);
    } else if (round.phase === RoundPhase.RUNNING && round.runningStartedAt && round.runDurationMs) {
      const crashAt = round.runningStartedAt.getTime() + round.runDurationMs;
      const remainingMs = crashAt - now;
      delayMs =
        remainingMs > 0
          ? Math.min(this.tickIntervalMs, remainingMs)
          : 0;
    } else if (round.phase === RoundPhase.SETTLED) {
      delayMs = SETTLED_PAUSE_MS;
    }

    this.schedulerTimer = setTimeout(() => {
      void this.advanceRound(round.id);
    }, delayMs);
  }

  private async advanceRound(roundId: string): Promise<void> {
    const round = await this.rounds.findById(roundId);
    if (!round) {
      const active = await this.rounds.findActiveRound();
      if (active) {
        this.scheduleNextTick(active);
      } else {
        const created = await this.createBettingRound();
        await this.publishRoundSnapshot(created);
        this.scheduleNextTick(created);
      }
      return;
    }

    if (round.phase === RoundPhase.SETTLED) {
      const next = await this.createBettingRound();
      this.events.broadcastRoundPhase(next);
      await this.publishRoundSnapshot(next);
      this.scheduleNextTick(next);
      return;
    }

    if (round.phase === RoundPhase.BETTING) {
      if (round.bettingEndsAt.getTime() > Date.now()) {
        this.scheduleNextTick(round);
        return;
      }
      const running = await this.startRunningPhase(round);
      this.events.broadcastRoundPhase(running);
      await this.publishRoundSnapshot(running);
      this.scheduleNextTick(running);
      return;
    }

    if (round.phase === RoundPhase.RUNNING) {
      if (!round.runningStartedAt || !round.runDurationMs || !round.crashMultiplierMicro) {
        this.scheduleNextTick(round);
        return;
      }

      const elapsedMs = Date.now() - round.runningStartedAt.getTime();
      const crashAt = round.runningStartedAt.getTime() + round.runDurationMs;

      if (crashAt > Date.now()) {
        const multiplierMicro = displayMultiplierMicroAtProgress({
          crashMultiplierMicro: round.crashMultiplierMicro,
          runDurationMs: round.runDurationMs,
          elapsedMs,
        });
        this.events.broadcastRoundTick({
          roundId: round.id,
          currentMultiplierMicro: multiplierMicro,
          elapsedMs,
          runDurationMs: round.runDurationMs,
        });
        await this.processAutoCashouts(round.id, multiplierMicro);
        this.scheduleNextTick(round);
        return;
      }

      const settled = await this.settleRound(round);
      this.events.broadcastRoundCrashed(settled);
      this.events.broadcastRoundPhase(settled);
      await this.publishRoundSnapshot(settled);
      this.scheduleNextTick(settled);
    }
  }

  private async createBettingRound(): Promise<RoundRecord> {
    const serverSecret = newServerSecret();
    const commitHash = commitServerSecret(serverSecret);
    const clientSeed = randomBytes(16).toString("hex");
    const latestSettled = await this.rounds.findLatestSettledRound();
    const nonce = latestSettled
      ? String(Number.parseInt(latestSettled.nonce, 10) + 1)
      : "1";
    const bettingWindowMs = Number(
      process.env.BETTING_WINDOW_MS ?? DEFAULT_BETTING_WINDOW_MS,
    );
    const bettingEndsAt = new Date(Date.now() + bettingWindowMs);

    const round = await this.rounds.createRound({
      phase: RoundPhase.BETTING,
      commitHash,
      serverSecret,
      clientSeed,
      nonce,
      bettingEndsAt,
    });

    this.events.broadcastRoundPhase(round);
    this.logger.log(`Round ${round.id} opened for betting until ${bettingEndsAt.toISOString()}`);
    return round;
  }

  private async startRunningPhase(roundRecord: RoundRecord): Promise<RoundRecord> {
    const round = roundToDomain(roundRecord);
    const outcome = deriveCrashOutcome(
      roundRecord.serverSecret,
      roundRecord.clientSeed,
      roundRecord.nonce,
    );
    const runningStartedAt = new Date();
    round.startRunning(outcome, runningStartedAt);
    const updatedProps = round.toProps();

    await this.rounds.updateRound(roundRecord.id, {
      phase: RoundPhase.RUNNING,
      crashMultiplierMicro: updatedProps.crashMultiplierMicro,
      runDurationMs: updatedProps.runDurationMs,
      runningStartedAt: updatedProps.runningStartedAt,
    });

    const updated = await this.rounds.findById(roundRecord.id);
    if (!updated) {
      throw new Error(`Round ${roundRecord.id} missing after start`);
    }

    this.logger.log(
      `Round ${roundRecord.id} running (crash micro=${outcome.crashMultiplierMicro}, duration=${outcome.runDurationMs}ms)`,
    );
    return updated;
  }

  private async settleRound(roundRecord: RoundRecord): Promise<RoundRecord> {
    const lostCount = await this.bets.markAllActiveBetsLost(roundRecord.id);
    this.metrics.recordBetsLost(lostCount);
    this.metrics.recordRoundSettled();
    const settledAt = new Date();
    const round = roundToDomain(roundRecord);
    round.settle(settledAt);

    await this.rounds.updateRound(roundRecord.id, {
      phase: RoundPhase.SETTLED,
      settledAt: round.getSettledAt(),
    });

    const updated = await this.rounds.findById(roundRecord.id);
    if (!updated) {
      throw new Error(`Round ${roundRecord.id} missing after settle`);
    }

    this.logger.log(`Round ${roundRecord.id} settled (${lostCount} losing bets)`);
    return updated;
  }

  private async processAutoCashouts(
    roundId: string,
    currentMultiplierMicro: bigint,
  ): Promise<void> {
    const { CashOutBetUseCase } = await import("../use-cases/cash-out-bet.use-case");
    const cashOut = this.moduleRef.get(CashOutBetUseCase, { strict: false });
    await cashOut.processAutoCashoutsForRound(roundId, currentMultiplierMicro);
  }
}
