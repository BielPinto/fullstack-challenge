import { Inject, Injectable, Logger } from "@nestjs/common";
import { RoundPhase } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import {
  BET_REPOSITORY,
  ROUND_REPOSITORY,
  type BetRepositoryPort,
  type RoundRecord,
  type RoundRepositoryPort,
} from "../ports/game.persistence";
import {
  commitServerSecret,
  deriveCrashOutcome,
  displayMultiplierMicroAtProgress,
  newServerSecret,
} from "../../domain/services/provably-fair";

const DEFAULT_BETTING_WINDOW_MS = 10_000;
const SETTLED_PAUSE_MS = 2_000;

@Injectable()
export class GameRoundService {
  private readonly logger = new Logger(GameRoundService.name);
  private schedulerTimer: ReturnType<typeof setTimeout> | null = null;
  private bootstrapped = false;

  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly rounds: RoundRepositoryPort,
    @Inject(BET_REPOSITORY)
    private readonly bets: BetRepositoryPort,
  ) {}

  async ensureSchedulerStarted(): Promise<void> {
    if (this.bootstrapped) {
      return;
    }
    this.bootstrapped = true;

    let active = await this.rounds.findActiveRound();
    if (!active) {
      active = await this.createBettingRound();
    }

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
      delayMs = Math.max(100, crashAt - now);
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
        this.scheduleNextTick(created);
      }
      return;
    }

    if (round.phase === RoundPhase.SETTLED) {
      const next = await this.createBettingRound();
      this.scheduleNextTick(next);
      return;
    }

    if (round.phase === RoundPhase.BETTING) {
      if (round.bettingEndsAt.getTime() > Date.now()) {
        this.scheduleNextTick(round);
        return;
      }
      const running = await this.startRunningPhase(round);
      this.scheduleNextTick(running);
      return;
    }

    if (round.phase === RoundPhase.RUNNING) {
      if (!round.runningStartedAt || !round.runDurationMs) {
        this.scheduleNextTick(round);
        return;
      }
      const crashAt = round.runningStartedAt.getTime() + round.runDurationMs;
      if (crashAt > Date.now()) {
        this.scheduleNextTick(round);
        return;
      }
      const settled = await this.settleRound(round);
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

    this.logger.log(`Round ${round.id} opened for betting until ${bettingEndsAt.toISOString()}`);
    return round;
  }

  private async startRunningPhase(round: RoundRecord): Promise<RoundRecord> {
    const outcome = deriveCrashOutcome(round.serverSecret, round.clientSeed, round.nonce);
    const runningStartedAt = new Date();

    await this.rounds.updateRound(round.id, {
      phase: RoundPhase.RUNNING,
      crashMultiplierMicro: outcome.crashMultiplierMicro,
      runDurationMs: outcome.runDurationMs,
      runningStartedAt,
    });

    const updated = await this.rounds.findById(round.id);
    if (!updated) {
      throw new Error(`Round ${round.id} missing after start`);
    }

    this.logger.log(
      `Round ${round.id} running (crash micro=${outcome.crashMultiplierMicro}, duration=${outcome.runDurationMs}ms)`,
    );
    return updated;
  }

  private async settleRound(round: RoundRecord): Promise<RoundRecord> {
    const lostCount = await this.bets.markAllActiveBetsLost(round.id);
    const settledAt = new Date();

    await this.rounds.updateRound(round.id, {
      phase: RoundPhase.SETTLED,
      settledAt,
    });

    const updated = await this.rounds.findById(round.id);
    if (!updated) {
      throw new Error(`Round ${round.id} missing after settle`);
    }

    this.logger.log(`Round ${round.id} settled (${lostCount} losing bets)`);
    return updated;
  }
}
