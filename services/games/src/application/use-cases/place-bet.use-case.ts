import { Inject, Injectable } from "@nestjs/common";
import { RoundPhase } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  BET_REPOSITORY,
  type BetRecord,
  type BetRepositoryPort,
} from "../ports/game.persistence";
import { WALLET_GATEWAY, type WalletGatewayPort } from "../ports/wallet-gateway.port";
import { GAME_EVENTS, type GameEventsPort } from "../ports/game-events.port";
import { GameRoundService } from "../services/game-round.service";
import {
  DuplicateBetError,
  RoundNotInBettingPhaseError,
  WalletOperationRejectedError,
  WalletOperationTimeoutError,
} from "../../domain/errors/game.errors";
import { assertBetAmountInRange } from "../../domain/value-objects/bet-limits";

export type PlaceBetInput = {
  userId: string;
  amountInCents: bigint;
};

export type PlaceBetResult = {
  bet: BetRecord;
  roundId: string;
};

@Injectable()
export class PlaceBetUseCase {
  constructor(
    private readonly gameRoundService: GameRoundService,
    @Inject(BET_REPOSITORY)
    private readonly bets: BetRepositoryPort,
    @Inject(WALLET_GATEWAY)
    private readonly walletGateway: WalletGatewayPort,
    @Inject(GAME_EVENTS)
    private readonly events: GameEventsPort,
  ) {}

  async execute(input: PlaceBetInput): Promise<PlaceBetResult> {
    assertBetAmountInRange(input.amountInCents);

    const round = await this.gameRoundService.getActiveRound();
    if (round.phase !== RoundPhase.BETTING) {
      throw new RoundNotInBettingPhaseError();
    }

    const betId = randomUUID();
    const debitCommandId = randomUUID();

    let bet: BetRecord;
    try {
      bet = await this.bets.createBetDebitPending({
        id: betId,
        roundId: round.id,
        userId: input.userId,
        amountInCents: input.amountInCents,
        debitCommandId,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new DuplicateBetError();
      }
      throw error;
    }

    try {
      const debit = await this.walletGateway.requestDebit({
        commandId: debitCommandId,
        userId: input.userId,
        gameRoundId: round.id,
        betId,
        amountInCents: input.amountInCents,
      });

      if (!debit.ok) {
        await this.bets.deleteBet(betId);
        throw new WalletOperationRejectedError(debit.reason);
      }

      await this.bets.markDebitSucceeded(debitCommandId);
      const activeBet = await this.bets.findById(betId);
      if (!activeBet) {
        throw new Error("Bet missing after debit success");
      }

      this.events.broadcastBetPlaced(activeBet);

      return { bet: activeBet, roundId: round.id };
    } catch (error) {
      if (
        error instanceof WalletOperationRejectedError ||
        error instanceof WalletOperationTimeoutError
      ) {
        await this.bets.deleteBet(betId).catch(() => undefined);
      }
      throw error;
    }
  }
}
