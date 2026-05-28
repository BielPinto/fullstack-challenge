import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { Bet } from "../../domain/entities/bet.entity";
import {
  BET_REPOSITORY,
  type BetRecord,
  type BetRepositoryPort,
} from "../ports/game.persistence";
import { WALLET_GATEWAY, type WalletGatewayPort } from "../ports/wallet-gateway.port";
import { GAME_EVENTS, type GameEventsPort } from "../ports/game-events.port";
import { GameRoundService } from "../services/game-round.service";
import { roundToDomain } from "../mappers/game-domain.mapper";
import {
  DuplicateBetError,
  WalletOperationRejectedError,
  WalletOperationTimeoutError,
} from "../../domain/errors/game.errors";

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
    const roundRecord = await this.gameRoundService.getActiveRound();
    roundToDomain(roundRecord).assertAcceptsBets();

    const betId = randomUUID();
    const debitCommandId = randomUUID();

    Bet.createDebitPending({
      id: betId,
      roundId: roundRecord.id,
      userId: input.userId,
      amountInCents: input.amountInCents,
      debitCommandId,
    });

    let bet: BetRecord;
    try {
      bet = await this.bets.createBetDebitPending({
        id: betId,
        roundId: roundRecord.id,
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
        gameRoundId: roundRecord.id,
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

      return { bet: activeBet, roundId: roundRecord.id };
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
