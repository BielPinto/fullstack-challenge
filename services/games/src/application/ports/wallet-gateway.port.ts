import type { WalletCreditFailedV1, WalletDebitFailedV1 } from "@crash/contracts";

export const WALLET_GATEWAY = Symbol("WALLET_GATEWAY");

export type WalletDebitSuccess = { ok: true; balanceAfterInCents: bigint };
export type WalletDebitFailure = { ok: false; reason: WalletDebitFailedV1["reason"] };
export type WalletDebitResult = WalletDebitSuccess | WalletDebitFailure;

export type WalletCreditSuccess = { ok: true; balanceAfterInCents: bigint };
export type WalletCreditFailure = { ok: false; reason: WalletCreditFailedV1["reason"] };
export type WalletCreditResult = WalletCreditSuccess | WalletCreditFailure;

export type WalletGatewayPort = {
  requestDebit(input: {
    commandId: string;
    userId: string;
    gameRoundId: string;
    betId: string;
    amountInCents: bigint;
  }): Promise<WalletDebitResult>;

  requestCredit(input: {
    commandId: string;
    userId: string;
    gameRoundId: string;
    betId: string;
    amountInCents: bigint;
    reason: "cashout" | "rollback" | "refund";
  }): Promise<WalletCreditResult>;
};
