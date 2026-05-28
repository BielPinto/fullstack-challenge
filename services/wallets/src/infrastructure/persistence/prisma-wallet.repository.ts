import { Injectable } from "@nestjs/common";
import type { WalletRepository } from "../../application/ports/wallet.repository";
import { Wallet } from "../../domain/entities/wallet.entity";
import { Money } from "../../domain/value-objects/money";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaWalletRepository implements WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<Wallet | null> {
    const row = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!row) {
      return null;
    }
    return this.toDomain(row);
  }

  async create(wallet: Wallet): Promise<void> {
    const balance = wallet.getBalance();
    await this.prisma.wallet.create({
      data: {
        id: wallet.id,
        userId: wallet.userId,
        balanceInCents: balance.amountInCents,
        currency: balance.currency,
      },
    });
  }

  async save(wallet: Wallet): Promise<void> {
    const balance = wallet.getBalance();
    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balanceInCents: balance.amountInCents,
        currency: balance.currency,
      },
    });
  }

  private toDomain(row: {
    id: string;
    userId: string;
    balanceInCents: bigint;
    currency: string;
  }): Wallet {
    return Wallet.reconstitute({
      id: row.id,
      userId: row.userId,
      balance: Money.fromCents(row.balanceInCents, row.currency as "BRL"),
    });
  }
}
