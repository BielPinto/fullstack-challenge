import { randomUUID } from "node:crypto";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Wallet } from "../../domain/entities/wallet.entity";
import { Money } from "../../domain/value-objects/money";
import { PrismaService } from "../persistence/prisma.service";

@Injectable()
export class PlayerWalletSeed implements OnModuleInit {
  private readonly logger = new Logger(PlayerWalletSeed.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const userId = process.env.SEED_PLAYER_USER_ID;
    const balanceRaw = process.env.SEED_PLAYER_BALANCE_CENTS;

    if (!userId || !balanceRaw) {
      this.logger.log("Player wallet seed skipped (SEED_PLAYER_USER_ID or SEED_PLAYER_BALANCE_CENTS not set)");
      return;
    }

    const balanceInCents = BigInt(balanceRaw);
    const existing = await this.prisma.wallet.findUnique({ where: { userId } });

    if (existing) {
      if (existing.balanceInCents === balanceInCents) {
        this.logger.log(`Player wallet already seeded for user ${userId}`);
        return;
      }
      await this.prisma.wallet.update({
        where: { userId },
        data: { balanceInCents },
      });
      this.logger.log(`Updated player wallet balance for user ${userId}`);
      return;
    }

    const wallet = Wallet.create(userId, randomUUID());
    wallet.credit(Money.fromCents(balanceInCents));

    await this.prisma.wallet.create({
      data: {
        id: wallet.id,
        userId: wallet.userId,
        balanceInCents: wallet.getBalance().amountInCents,
        currency: wallet.getBalance().currency,
      },
    });

    this.logger.log(`Seeded player wallet for user ${userId} with ${balanceInCents} cents`);
  }
}
