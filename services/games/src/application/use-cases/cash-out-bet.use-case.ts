import { Inject, Injectable } from "@nestjs/common";
import { BetStatus, RoundPhase } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  BET_REPOSITORY,
  type BetRecord,
  type BetRepositoryPort,
} from "../ports/game.persistence";
import { WALLET_GATEWAY, type WalletGatewayPort } from "../ports/wallet-gateway.port";
import { GameRoundService } from "../services/game-round.service";
import {
  BetNotActiveError,
  BetNotFoundError,
  RoundNotRunningError,
  WalletOperationRejectedError,
} from "../../domain/errors/game.errors";
import { computeCashoutPayoutCents } from "../../domain/services/bet-payout";

export type CashOutBetInput = {
  userId: string;
};

export type CashOutBetResult = {
  bet: BetRecord;
  payoutInCents: bigint;
  multiplierMicro: bigint;
};

@Injectable()
export class CashOutBetUseCase {
  constructor(
    private readonly gameRoundService: GameRoundService,
    @Inject(BET_REPOSITORY)
    private readonly bets: BetRepositoryPort,
    @Inject(WALLET_GATEWAY)
    private readonly walletGateway: WalletGatewayPort,
  ) {}

  async execute(input: CashOutBetInput): Promise<CashOutBetResult> {
    const round = await this.gameRoundService.getActiveRound();
    if (round.phase !== RoundPhase.RUNNING) {
      throw new RoundNotRunningError();
    }

    const userBet = await this.bets.findUserBetOnRound(input.userId, round.id);
    if (!userBet) {
      throw new BetNotFoundError("No active bet for the current round");
    }
    if (userBet.status === BetStatus.DEBIT_PENDING) {
      throw new BetNotActiveError("Bet is still being confirmed");
    }
    if (userBet.status !== BetStatus.ACTIVE) {
      throw new BetNotActiveError();
    }

    const activeBet = userBet;

    const multiplierMicro = await this.gameRoundService.getCurrentMultiplierMicro(round);
    if (!multiplierMicro) {
      throw new RoundNotRunningError();
    }

    const payoutInCents = computeCashoutPayoutCents(
      activeBet.amountInCents,
      multiplierMicro,
    );

    const cashedOut = await this.bets.markCashedOut({
      betId: activeBet.id,
      cashoutMultiplierMicro: multiplierMicro,
      payoutInCents,
    });
    if (!cashedOut) {
      throw new BetNotActiveError();
    }

    const credit = await this.walletGateway.requestCredit({
      commandId: randomUUID(),
      userId: input.userId,
      gameRoundId: round.id,
      betId: activeBet.id,
      amountInCents: payoutInCents,
      reason: "cashout",
    });

    if (!credit.ok) {
      await this.bets.revertCashout(activeBet.id);
      throw new WalletOperationRejectedError(credit.reason);
    }

    const updated = await this.bets.findById(activeBet.id);
    if (!updated) {
      throw new Error("Bet missing after cashout");
    }

    return {
      bet: updated,
      payoutInCents,
      multiplierMicro,
    };
  }
}
