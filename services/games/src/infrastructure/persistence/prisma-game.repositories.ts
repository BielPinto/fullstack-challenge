import { Injectable } from "@nestjs/common";
import type {
  BetRecord,
  BetRepositoryPort,
  CreateRoundInput,
  RoundRecord,
  RoundRepositoryPort,
} from "../../application/ports/game.persistence";
import { PrismaService } from "./prisma.service";
import { BetStatus, Prisma, RoundPhase } from "@prisma/client";

function mapRound(row: {
  id: string;
  phase: RoundPhase;
  commitHash: string;
  serverSecret: string;
  clientSeed: string;
  nonce: string;
  crashMultiplierMicro: bigint | null;
  runDurationMs: number | null;
  bettingEndsAt: Date;
  runningStartedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
}): RoundRecord {
  return { ...row };
}

function mapBet(row: {
  id: string;
  roundId: string;
  userId: string;
  amountInCents: bigint;
  status: BetStatus;
  cashoutMultiplierMicro: bigint | null;
  payoutInCents: bigint | null;
  debitCommandId: string;
  createdAt: Date;
  updatedAt: Date;
}): BetRecord {
  return { ...row };
}

@Injectable()
export class PrismaRoundRepository implements RoundRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveRound(): Promise<RoundRecord | null> {
    const row = await this.prisma.round.findFirst({
      where: { phase: { in: [RoundPhase.BETTING, RoundPhase.RUNNING] } },
      orderBy: { createdAt: "desc" },
    });
    return row ? mapRound(row) : null;
  }

  async createRound(input: CreateRoundInput): Promise<RoundRecord> {
    const row = await this.prisma.round.create({
      data: {
        phase: input.phase,
        commitHash: input.commitHash,
        serverSecret: input.serverSecret,
        clientSeed: input.clientSeed,
        nonce: input.nonce,
        bettingEndsAt: input.bettingEndsAt,
        crashMultiplierMicro: input.crashMultiplierMicro ?? null,
        runDurationMs: input.runDurationMs ?? null,
        runningStartedAt: input.runningStartedAt ?? null,
      },
    });
    return mapRound(row);
  }

  async updateRound(id: string, patch: Partial<RoundRecord>): Promise<void> {
    const data: Prisma.RoundUpdateInput = {};
    if (patch.phase !== undefined) {
      data.phase = patch.phase;
    }
    if (patch.crashMultiplierMicro !== undefined) {
      data.crashMultiplierMicro = patch.crashMultiplierMicro;
    }
    if (patch.runDurationMs !== undefined) {
      data.runDurationMs = patch.runDurationMs;
    }
    if (patch.bettingEndsAt !== undefined) {
      data.bettingEndsAt = patch.bettingEndsAt;
    }
    if (patch.runningStartedAt !== undefined) {
      data.runningStartedAt = patch.runningStartedAt;
    }
    if (patch.settledAt !== undefined) {
      data.settledAt = patch.settledAt;
    }

    await this.prisma.round.update({
      where: { id },
      data,
    });
  }

  async findById(id: string): Promise<RoundRecord | null> {
    const row = await this.prisma.round.findUnique({ where: { id } });
    return row ? mapRound(row) : null;
  }

  async listRecentSettledRounds(skip: number, take: number): Promise<RoundRecord[]> {
    const rows = await this.prisma.round.findMany({
      where: { phase: RoundPhase.SETTLED },
      orderBy: { settledAt: "desc" },
      skip,
      take,
    });
    return rows.map(mapRound);
  }

  async findLatestSettledRound(): Promise<RoundRecord | null> {
    const row = await this.prisma.round.findFirst({
      where: { phase: RoundPhase.SETTLED, settledAt: { not: null } },
      orderBy: { settledAt: "desc" },
    });
    return row ? mapRound(row) : null;
  }
}

@Injectable()
export class PrismaBetRepository implements BetRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createBetDebitPending(input: {
    id: string;
    roundId: string;
    userId: string;
    amountInCents: bigint;
    debitCommandId: string;
  }): Promise<BetRecord> {
    const row = await this.prisma.bet.create({
      data: {
        id: input.id,
        roundId: input.roundId,
        userId: input.userId,
        amountInCents: input.amountInCents,
        debitCommandId: input.debitCommandId,
        status: BetStatus.DEBIT_PENDING,
      },
    });
    return mapBet(row);
  }

  async deleteBet(id: string): Promise<void> {
    await this.prisma.bet.delete({ where: { id } });
  }

  async markDebitSucceeded(debitCommandId: string): Promise<void> {
    await this.prisma.bet.updateMany({
      where: { debitCommandId },
      data: { status: BetStatus.ACTIVE },
    });
  }

  async findByDebitCommandId(debitCommandId: string): Promise<BetRecord | null> {
    const row = await this.prisma.bet.findUnique({ where: { debitCommandId } });
    return row ? mapBet(row) : null;
  }

  async findById(id: string): Promise<BetRecord | null> {
    const row = await this.prisma.bet.findUnique({ where: { id } });
    return row ? mapBet(row) : null;
  }

  async findUserBetOnRound(userId: string, roundId: string): Promise<BetRecord | null> {
    const row = await this.prisma.bet.findUnique({
      where: { roundId_userId: { roundId, userId } },
    });
    return row ? mapBet(row) : null;
  }

  async markCashedOut(input: {
    betId: string;
    cashoutMultiplierMicro: bigint;
    payoutInCents: bigint;
  }): Promise<boolean> {
    const result = await this.prisma.bet.updateMany({
      where: { id: input.betId, status: BetStatus.ACTIVE },
      data: {
        status: BetStatus.CASHED_OUT,
        cashoutMultiplierMicro: input.cashoutMultiplierMicro,
        payoutInCents: input.payoutInCents,
      },
    });
    return result.count > 0;
  }

  async revertCashout(betId: string): Promise<void> {
    await this.prisma.bet.updateMany({
      where: { id: betId, status: BetStatus.CASHED_OUT },
      data: {
        status: BetStatus.ACTIVE,
        cashoutMultiplierMicro: null,
        payoutInCents: null,
      },
    });
  }

  async markAllActiveBetsLost(roundId: string): Promise<number> {
    const result = await this.prisma.bet.updateMany({
      where: { roundId, status: BetStatus.ACTIVE },
      data: { status: BetStatus.LOST },
    });
    return result.count;
  }

  async listMyBets(userId: string, skip: number, take: number): Promise<BetRecord[]> {
    const rows = await this.prisma.bet.findMany({
      where: {
        userId,
        status: { notIn: [BetStatus.DEBIT_PENDING] },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    return rows.map(mapBet);
  }

  async listPublicBetsForRound(roundId: string): Promise<BetRecord[]> {
    const rows = await this.prisma.bet.findMany({
      where: {
        roundId,
        status: { in: [BetStatus.ACTIVE, BetStatus.CASHED_OUT, BetStatus.LOST] },
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapBet);
  }
}
