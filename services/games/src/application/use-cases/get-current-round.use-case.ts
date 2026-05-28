import { Inject, Injectable } from "@nestjs/common";
import type { BetRecord, RoundRecord } from "../ports/game.persistence";
import { BET_REPOSITORY, type BetRepositoryPort } from "../ports/game.persistence";
import { GameRoundService } from "../services/game-round.service";

export type CurrentRoundView = {
  round: RoundRecord;
  currentMultiplierMicro: bigint | null;
  bets: BetRecord[];
};

@Injectable()
export class GetCurrentRoundUseCase {
  constructor(
    private readonly gameRoundService: GameRoundService,
    @Inject(BET_REPOSITORY)
    private readonly bets: BetRepositoryPort,
  ) {}

  async execute(): Promise<CurrentRoundView> {
    const round = await this.gameRoundService.getActiveRound();
    const currentMultiplierMicro = await this.gameRoundService.getCurrentMultiplierMicro(round);
    const bets = await this.bets.listPublicBetsForRound(round.id);
    return { round, currentMultiplierMicro, bets };
  }
}
