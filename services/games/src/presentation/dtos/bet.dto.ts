import type { BetRecord } from "../../application/ports/game.persistence";
import { formatCents, formatMultiplierMicro } from "../mappers/format";

export type PlaceBetRequestDto = {
  amountInCents: string;
};

export type BetActionResponseDto = {
  betId: string;
  roundId: string;
  status: string;
  amount: string;
  cashoutMultiplier?: string;
  payout?: string;
};

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

export type MyBetItemDto = {
  id: string;
  roundId: string;
  amount: string;
  status: string;
  cashoutMultiplier: string | null;
  payout: string | null;
  createdAt: string;
};

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
