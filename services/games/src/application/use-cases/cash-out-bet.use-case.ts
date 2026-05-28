import { Inject, Injectable } from "@nestjs/common";
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

    const multiplierMicro = await this.gameRoundService.getCurrentMultiplierMicro(roundRecord);
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

    return {
      bet: updated,
      payoutInCents,
      multiplierMicro,
    };
  }
}
