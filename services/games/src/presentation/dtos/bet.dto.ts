import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { BetRecord } from "../../application/ports/game.persistence";
import { formatCents, formatMultiplierMicro } from "../mappers/format";

export class PlaceBetRequestDto {
  @ApiProperty({
    example: "1000",
    description: "Bet stake in centavos (BRL). Min 100, max 100000.",
  })
  amountInCents!: string;
}

export class BetActionResponseDto {
  @ApiProperty()
  betId!: string;

  @ApiProperty()
  roundId!: string;

  @ApiProperty({ enum: ["DEBIT_PENDING", "ACTIVE", "CASHED_OUT", "LOST", "DEBIT_FAILED"] })
  status!: string;

  @ApiProperty({ example: "10.00", description: "Formatted BRL amount" })
  amount!: string;

  @ApiPropertyOptional({ example: "1.42" })
  cashoutMultiplier?: string;

  @ApiPropertyOptional({ example: "14.20" })
  payout?: string;
}

export function toBetActionResponse(bet: BetRecord, extras?: {
  cashoutMultiplier?: bigint;
  payoutInCents?: bigint;
}): BetActionResponseDto {
  return {
    betId: bet.id,
    roundId: bet.roundId,
    status: bet.status,
    amount: formatCents(bet.amountInCents),
    cashoutMultiplier: extras?.cashoutMultiplier
      ? formatMultiplierMicro(extras.cashoutMultiplier)
      : bet.cashoutMultiplierMicro
        ? formatMultiplierMicro(bet.cashoutMultiplierMicro)
        : undefined,
    payout: extras?.payoutInCents
      ? formatCents(extras.payoutInCents)
      : bet.payoutInCents
        ? formatCents(bet.payoutInCents)
        : undefined,
  };
}

export class MyBetItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  roundId!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  cashoutMultiplier!: string | null;

  @ApiProperty({ nullable: true })
  payout!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class MyBetsResponseDto {
  @ApiProperty({ type: [MyBetItemDto] })
  items!: MyBetItemDto[];
}

export function toMyBetItemDto(bet: BetRecord): MyBetItemDto {
  return {
    id: bet.id,
    roundId: bet.roundId,
    amount: formatCents(bet.amountInCents),
    status: bet.status,
    cashoutMultiplier: bet.cashoutMultiplierMicro
      ? formatMultiplierMicro(bet.cashoutMultiplierMicro)
      : null,
    payout: bet.payoutInCents ? formatCents(bet.payoutInCents) : null,
    createdAt: bet.createdAt.toISOString(),
  };
}
