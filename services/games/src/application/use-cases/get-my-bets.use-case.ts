import { Inject, Injectable } from "@nestjs/common";
import {
  BET_REPOSITORY,
  type BetRecord,
  type BetRepositoryPort,
} from "../ports/game.persistence";

@Injectable()
export class GetMyBetsUseCase {
  constructor(
    @Inject(BET_REPOSITORY)
    private readonly bets: BetRepositoryPort,
  ) {}

  async execute(userId: string, skip = 0, take = 20): Promise<BetRecord[]> {
    return this.bets.listMyBets(userId, skip, take);
  }
}
