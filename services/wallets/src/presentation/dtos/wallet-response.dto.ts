import { ApiProperty } from "@nestjs/swagger";
import type { Wallet } from "../../domain/entities/wallet.entity";

export class WalletResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ description: "Balance in centavos as string (no float)" })
  balanceInCents!: string;

  @ApiProperty({ example: "1000.00" })
  balance!: string;

  @ApiProperty({ example: "BRL" })
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
