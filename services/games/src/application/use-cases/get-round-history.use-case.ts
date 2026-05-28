import { Inject, Injectable } from "@nestjs/common";
import {
  ROUND_REPOSITORY,
  type RoundRecord,
  type RoundRepositoryPort,
} from "../ports/game.persistence";

@Injectable()
export class GetRoundHistoryUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly rounds: RoundRepositoryPort,
  ) {}

  async execute(skip = 0, take = 20): Promise<RoundRecord[]> {
    return this.rounds.listRecentSettledRounds(skip, take);
  }
}
