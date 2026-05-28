import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { BetRecord, RoundRecord } from "../../application/ports/game.persistence";
import { formatCents, formatMultiplierMicro } from "../mappers/format";

export class BetViewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  cashoutMultiplier!: string | null;

  @ApiProperty({ nullable: true })
  payout!: string | null;
}

export class RoundViewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ["BETTING", "RUNNING", "SETTLED"] })
  phase!: string;

  @ApiProperty()
  commitHash!: string;

  @ApiProperty()
  clientSeed!: string;

  @ApiProperty()
  nonce!: string;

  @ApiProperty()
  bettingEndsAt!: string;

  @ApiProperty({ nullable: true })
  runningStartedAt!: string | null;

  @ApiProperty({ nullable: true })
  settledAt!: string | null;

  @ApiProperty({ nullable: true })
  crashMultiplier!: string | null;

  @ApiProperty({ nullable: true })
  currentMultiplier!: string | null;

  @ApiProperty({ type: [BetViewDto] })
  bets!: BetViewDto[];
}

export function toBetViewDto(bet: BetRecord): BetViewDto {
  return {
    id: bet.id,
    userId: bet.userId,
    amount: formatCents(bet.amountInCents),
    status: bet.status,
    cashoutMultiplier: bet.cashoutMultiplierMicro
      ? formatMultiplierMicro(bet.cashoutMultiplierMicro)
      : null,
    payout: bet.payoutInCents ? formatCents(bet.payoutInCents) : null,
  };
}

export function toRoundViewDto(input: {
  round: RoundRecord;
  currentMultiplierMicro: bigint | null;
  bets: BetRecord[];
}): RoundViewDto {
  const { round, currentMultiplierMicro, bets } = input;
  return {
    id: round.id,
    phase: round.phase,
    commitHash: round.commitHash,
    clientSeed: round.clientSeed,
    nonce: round.nonce,
    bettingEndsAt: round.bettingEndsAt.toISOString(),
    runningStartedAt: round.runningStartedAt?.toISOString() ?? null,
    settledAt: round.settledAt?.toISOString() ?? null,
    crashMultiplier: round.crashMultiplierMicro
      ? formatMultiplierMicro(round.crashMultiplierMicro)
      : null,
    currentMultiplier: currentMultiplierMicro
      ? formatMultiplierMicro(currentMultiplierMicro)
      : null,
    bets: bets.map(toBetViewDto),
  };
}

export class RoundHistoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  crashMultiplier!: string;

  @ApiProperty()
  settledAt!: string;
}

export class RoundHistoryResponseDto {
  @ApiProperty({ type: [RoundHistoryItemDto] })
  items!: RoundHistoryItemDto[];
}

export function toRoundHistoryItemDto(round: RoundRecord): RoundHistoryItemDto {
  if (!round.crashMultiplierMicro || !round.settledAt) {
    throw new Error("Settled round missing crash data");
  }
  return {
    id: round.id,
    crashMultiplier: formatMultiplierMicro(round.crashMultiplierMicro),
    settledAt: round.settledAt.toISOString(),
  };
}

export class VerifyRoundResponseDto {
  @ApiProperty()
  roundId!: string;

  @ApiProperty()
  commitHash!: string;

  @ApiPropertyOptional({ nullable: true })
  serverSecret!: string | null;

  @ApiProperty()
  clientSeed!: string;

  @ApiProperty()
  nonce!: string;

  @ApiPropertyOptional({ nullable: true })
  crashMultiplier!: string | null;

  @ApiPropertyOptional({ nullable: true })
  runDurationMs!: number | null;

  @ApiProperty()
  verified!: boolean;
}
