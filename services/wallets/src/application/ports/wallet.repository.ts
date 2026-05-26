import { Wallet } from "../../domain/entities/wallet.entity";

export const WALLET_REPOSITORY = Symbol("WALLET_REPOSITORY");

export interface WalletRepository {
  findByUserId(userId: string): Promise<Wallet | null>;
  save(wallet: Wallet): Promise<void>;
  create(wallet: Wallet): Promise<void>;
}
