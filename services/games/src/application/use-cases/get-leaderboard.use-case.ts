import { Inject, Injectable } from "@nestjs/common";
import {
  BET_REPOSITORY,
  type BetRepositoryPort,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from "../ports/game.persistence";

export type GetLeaderboardInput = {
  period: LeaderboardPeriod;
  limit?: number;
};

export type GetLeaderboardResult = {
  period: LeaderboardPeriod;
  items: LeaderboardEntry[];
};

@Injectable()
export class GetLeaderboardUseCase {
  constructor(
    @Inject(BET_REPOSITORY)
    private readonly bets: BetRepositoryPort,
  ) {}

  async execute(input: GetLeaderboardInput): Promise<GetLeaderboardResult> {
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
    const items = await this.bets.getLeaderboard(input.period, limit);
    return { period: input.period, items };
  }
}
