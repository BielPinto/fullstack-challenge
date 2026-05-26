import type { Wallet } from "../../domain/entities/wallet.entity";

export class WalletResponseDto {
  id!: string;
  userId!: string;
  balanceInCents!: string;
  balance!: string;
  currency!: string;

  static fromWallet(wallet: Wallet): WalletResponseDto {
    const balance = wallet.getBalance();
    const cents = balance.amountInCents;
    const whole = cents / 100n;
    const fraction = (cents < 0n ? -cents : cents) % 100n;
    const balanceFormatted = `${whole}.${fraction.toString().padStart(2, "0")}`;

    return {
      id: wallet.id,
      userId: wallet.userId,
      balanceInCents: cents.toString(),
      balance: balanceFormatted,
      currency: balance.currency,
    };
  }
}
