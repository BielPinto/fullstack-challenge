import { randomUUID } from "node:crypto";
import { Injectable, Inject } from "@nestjs/common";
import { Wallet } from "../../domain/entities/wallet.entity";
import { WalletAlreadyExistsError } from "../../domain/errors/wallet.errors";
import {
  WALLET_REPOSITORY,
  type WalletRepository,
} from "../ports/wallet.repository";

@Injectable()
export class CreateWalletForUserUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  async execute(userId: string): Promise<Wallet> {
    const existing = await this.walletRepository.findByUserId(userId);
    if (existing) {
      throw new WalletAlreadyExistsError(userId);
    }

    const wallet = Wallet.create(userId, randomUUID());
    await this.walletRepository.create(wallet);
    return wallet;
  }
}
