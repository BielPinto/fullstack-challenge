import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  BET_REPOSITORY,
  type BetRecord,
  type BetRepositoryPort,
} from "../ports/game.persistence";
import { WALLET_GATEWAY, type WalletGatewayPort } from "../ports/wallet-gateway.port";
import { GAME_EVENTS, type GameEventsPort } from "../ports/game-events.port";
import { GameMetricsService } from "../../infrastructure/observability/game-metrics.service";
import { GameRoundService } from "../services/game-round.service";
import {
  betToDomain,
  roundToDomain,
} from "../mappers/game-domain.mapper";
import {
  BetNotActiveError,
  BetNotFoundError,
  RoundNotRunningError,
  WalletOperationRejectedError,
} from "../../domain/errors/game.errors";

export type CashOutBetInput = {
  userId: string;
  /** When set (e.g. auto cashout), cash out at this multiplier instead of the live tick. */
  multiplierMicro?: bigint;
  source?: "manual" | "auto";
};

export type CashOutBetResult = {
  bet: BetRecord;
  payoutInCents: bigint;
  multiplierMicro: bigint;
};

@Injectable()
export class CashOutBetUseCase {
  private readonly logger = new Logger(CashOutBetUseCase.name);

  constructor(
    @Inject(forwardRef(() => GameRoundService))
    private readonly gameRoundService: GameRoundService,
    private readonly metrics: GameMetricsService,
    @Inject(BET_REPOSITORY)
    private readonly bets: BetRepositoryPort,
    @Inject(WALLET_GATEWAY)
    private readonly walletGateway: WalletGatewayPort,
    @Inject(GAME_EVENTS)
    private readonly events: GameEventsPort,
  ) {}

  async execute(input: CashOutBetInput): Promise<CashOutBetResult> {
    const roundRecord = await this.gameRoundService.getActiveRound();
    const round = roundToDomain(roundRecord);
    round.assertRunning();

    const userBetRecord = await this.bets.findUserBetOnRound(input.userId, roundRecord.id);
    if (!userBetRecord) {
      throw new BetNotFoundError("No active bet for the current round");
    }

    const bet = betToDomain(userBetRecord);
    bet.assertCanCashOut(round.getPhase());

    const multiplierMicro =
      input.multiplierMicro ??
      (await this.gameRoundService.getCurrentMultiplierMicro(roundRecord));
    if (!multiplierMicro) {
      throw new RoundNotRunningError();
    }

    const { payoutInCents } = bet.calculateCashout(multiplierMicro);

    const cashedOut = await this.bets.markCashedOut({
      betId: bet.id,
      cashoutMultiplierMicro: multiplierMicro,
      payoutInCents,
    });
    if (!cashedOut) {
      throw new BetNotActiveError();
    }

    const credit = await this.walletGateway.requestCredit({
      commandId: randomUUID(),
      userId: input.userId,
      gameRoundId: roundRecord.id,
      betId: bet.id,
      amountInCents: payoutInCents,
      reason: "cashout",
    });

    if (!credit.ok) {
      await this.bets.revertCashout(bet.id);
      throw new WalletOperationRejectedError(credit.reason);
    }

    const updated = await this.bets.findById(bet.id);
    if (!updated) {
      throw new Error("Bet missing after cashout");
    }

    this.events.broadcastBetCashedOut(updated);
    this.metrics.recordCashout(payoutInCents, input.source === "auto");

    return {
      bet: updated,
      payoutInCents,
      multiplierMicro,
    };
  }

  async processAutoCashoutsForRound(
    roundId: string,
    currentMultiplierMicro: bigint,
  ): Promise<void> {
    const due = await this.bets.listActiveBetsDueForAutoCashout(
      roundId,
      currentMultiplierMicro,
    );

    for (const bet of due) {
      if (!bet.autoCashoutMultiplierMicro) {
        continue;
      }
      try {
        await this.execute({
          userId: bet.userId,
          multiplierMicro: bet.autoCashoutMultiplierMicro,
          source: "auto",
        });
      } catch (error) {
        if (
          error instanceof BetNotActiveError ||
          error instanceof BetNotFoundError
        ) {
          continue;
        }
        this.logger.warn(
          `Auto cashout failed for bet ${bet.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
