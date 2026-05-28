export type CurrencyCode = "BRL";

export interface EventMetadataV1 {
  version: "v1";
  commandId: string;
  correlationId: string;
  createdAt: string;
}

export interface MoneyAmount {
  amountInCents: bigint;
  currency: CurrencyCode;
}

export interface WalletDebitRequestedV1 extends EventMetadataV1 {
  type: "WalletDebitRequested";
  userId: string;
  gameRoundId: string;
  betId: string;
  amount: MoneyAmount;
}

export interface WalletCreditRequestedV1 extends EventMetadataV1 {
  type: "WalletCreditRequested";
  userId: string;
  gameRoundId: string;
  betId: string;
  reason: "cashout" | "rollback" | "refund";
  amount: MoneyAmount;
}

export interface WalletDebitSucceededV1 extends EventMetadataV1 {
  type: "WalletDebitSucceeded";
  userId: string;
  gameRoundId: string;
  betId: string;
  balanceAfterInCents: bigint;
}

export interface WalletCreditSucceededV1 extends EventMetadataV1 {
  type: "WalletCreditSucceeded";
  userId: string;
  gameRoundId: string;
  betId: string;
  balanceAfterInCents: bigint;
}

export interface WalletDebitFailedV1 extends EventMetadataV1 {
  type: "WalletDebitFailed";
  userId: string;
  gameRoundId: string;
  betId: string;
  reason: "insufficient_funds" | "wallet_not_found" | "duplicate_command" | "unknown";
}

export interface WalletCreditFailedV1 extends EventMetadataV1 {
  type: "WalletCreditFailed";
  userId: string;
  gameRoundId: string;
  betId: string;
  reason: "wallet_not_found" | "duplicate_command" | "unknown";
}

export type WalletCommandEventV1 = WalletDebitRequestedV1 | WalletCreditRequestedV1;

export type WalletResultEventV1 =
  | WalletDebitSucceededV1
  | WalletDebitFailedV1
  | WalletCreditSucceededV1
  | WalletCreditFailedV1;
