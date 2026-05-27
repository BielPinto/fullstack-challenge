import type {
  WalletCreditRequestedV1,
  WalletCreditSucceededV1,
  WalletDebitRequestedV1,
  WalletDebitSucceededV1,
  WalletDebitFailedV1,
  WalletCreditFailedV1,
} from "@crash/contracts";
export function debitCommand(
  overrides: Partial<WalletDebitRequestedV1> = {},
): WalletDebitRequestedV1 {
  return {
    type: "WalletDebitRequested",
    version: "v1",
    commandId: overrides.commandId ?? "cmd-1",
    correlationId: overrides.correlationId ?? "corr-1",
    createdAt: overrides.createdAt ?? "2026-05-27T00:00:00.000Z",
    userId: overrides.userId ?? "user-1",
    gameRoundId: overrides.gameRoundId ?? "round-1",
    betId: overrides.betId ?? "bet-1",
    amount: overrides.amount ?? { amountInCents: 1_000n, currency: "BRL" },
  };
}

export function creditCommand(
  overrides: Partial<WalletCreditRequestedV1> = {},
): WalletCreditRequestedV1 {
  return {
    type: "WalletCreditRequested",
    version: "v1",
    commandId: overrides.commandId ?? "cmd-credit-1",
    correlationId: overrides.correlationId ?? "corr-credit-1",
    createdAt: overrides.createdAt ?? "2026-05-27T00:00:00.000Z",
    userId: overrides.userId ?? "user-1",
    gameRoundId: overrides.gameRoundId ?? "round-1",
    betId: overrides.betId ?? "bet-1",
    reason: overrides.reason ?? "cashout",
    amount: overrides.amount ?? { amountInCents: 2_000n, currency: "BRL" },
  };
}

export function debitSucceeded(
  overrides: Partial<WalletDebitSucceededV1> = {},
): WalletDebitSucceededV1 {
  return {
    type: "WalletDebitSucceeded",
    version: "v1",
    commandId: overrides.commandId ?? "cmd-1",
    correlationId: overrides.correlationId ?? "corr-1",
    createdAt: overrides.createdAt ?? "2026-05-27T00:00:00.000Z",
    userId: overrides.userId ?? "user-1",
    gameRoundId: overrides.gameRoundId ?? "round-1",
    betId: overrides.betId ?? "bet-1",
    balanceAfterInCents: overrides.balanceAfterInCents ?? 99_000n,
  };
}

export function debitFailed(
  overrides: Partial<WalletDebitFailedV1> = {},
): WalletDebitFailedV1 {
  return {
    type: "WalletDebitFailed",
    version: "v1",
    commandId: overrides.commandId ?? "cmd-1",
    correlationId: overrides.correlationId ?? "corr-1",
    createdAt: overrides.createdAt ?? "2026-05-27T00:00:00.000Z",
    userId: overrides.userId ?? "user-1",
    gameRoundId: overrides.gameRoundId ?? "round-1",
    betId: overrides.betId ?? "bet-1",
    reason: overrides.reason ?? "insufficient_funds",
  };
}

/** Serializes wallet result events the same way the Wallet publisher does on the wire. */
export function walletResultBuffer(
  event:
    | WalletDebitSucceededV1
    | WalletDebitFailedV1
    | WalletCreditSucceededV1
    | WalletCreditFailedV1,
): Buffer {
  return Buffer.from(
    JSON.stringify(event, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}
