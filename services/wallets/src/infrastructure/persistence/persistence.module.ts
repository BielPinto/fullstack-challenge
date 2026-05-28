import { Module } from "@nestjs/common";
import { WALLET_REPOSITORY } from "../../application/ports/wallet.repository";
import { PROCESSED_COMMAND_REPOSITORY } from "../../application/ports/processed-command.repository";
import { PrismaProcessedCommandRepository } from "./prisma-processed-command.repository";
import { PrismaService } from "./prisma.service";
import { PrismaWalletRepository } from "./prisma-wallet.repository";
import { WalletCommandPersistence } from "./wallet-command.persistence";
import { PlayerWalletSeed } from "../seed/player-wallet.seed";

@Module({
  providers: [
    PrismaService,
    PrismaWalletRepository,
    PrismaProcessedCommandRepository,
    WalletCommandPersistence,
    PlayerWalletSeed,
    { provide: WALLET_REPOSITORY, useExisting: PrismaWalletRepository },
    { provide: PROCESSED_COMMAND_REPOSITORY, useExisting: PrismaProcessedCommandRepository },
  ],
  exports: [WALLET_REPOSITORY, PROCESSED_COMMAND_REPOSITORY, PrismaService, WalletCommandPersistence],
})
export class PersistenceModule {}
