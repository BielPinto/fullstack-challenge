import { Injectable } from "@nestjs/common";
import type { ProcessedCommandRecord } from "../../application/ports/processed-command.repository";
import { Wallet } from "../../domain/entities/wallet.entity";
import { serializeWalletResult } from "../messaging/event-serializer";
import { PrismaService } from "./prisma.service";

@Injectable()
export class WalletCommandPersistence {
  constructor(private readonly prisma: PrismaService) {}

  async persist(wallet: Wallet | null, record: ProcessedCommandRecord): Promise<void> {
    const payload = JSON.parse(serializeWalletResult(record.resultEvent)) as object;

    await this.prisma.$transaction(async (tx) => {
      if (wallet) {
        const balance = wallet.getBalance();
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balanceInCents: balance.amountInCents,
            currency: balance.currency,
          },
        });
      }

      await tx.processedCommand.create({
        data: {
          commandId: record.commandId,
          resultType: record.resultEvent.type,
          resultJson: payload,
        },
      });
    });
  }
}
