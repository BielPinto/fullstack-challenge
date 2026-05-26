import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Wallet } from "../../domain/entities/wallet.entity";
import {
  WALLET_REPOSITORY,
  type WalletRepository,
} from "../ports/wallet.repository";

@Injectable()
export class GetMyWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  async execute(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new NotFoundException("Wallet not found");
    }
    return wallet;
  }
}
