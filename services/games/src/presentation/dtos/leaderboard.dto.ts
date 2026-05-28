import { ApiProperty } from "@nestjs/swagger";
import type { LeaderboardEntry, LeaderboardPeriod } from "../../application/ports/game.persistence";
import { formatCents } from "../mappers/format";

export class LeaderboardEntryDto {
  @ApiProperty()
  rank!: number;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ example: "42.50", description: "Net profit in BRL" })
  profit!: string;

  @ApiProperty()
  betCount!: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ enum: ["24h", "7d"] })
  period!: LeaderboardPeriod;

  @ApiProperty({ type: [LeaderboardEntryDto] })
  items!: LeaderboardEntryDto[];
}

export function toLeaderboardResponse(
  period: LeaderboardPeriod,
  items: LeaderboardEntry[],
): LeaderboardResponseDto {
  return {
    period,
    items: items.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      profit: formatCents(entry.profitInCents),
      betCount: entry.betCount,
    })),
  };
}
