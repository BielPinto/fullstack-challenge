import type {
  WalletCreditRequestedV1,
  WalletDebitRequestedV1,
  WalletDebitSucceededV1,
  WalletCreditSucceededV1,
  WalletDebitFailedV1,
} from "@crash/contracts";

export const TEST_USER_ID = "user-test-1";
export const TEST_ROUND_ID = "round-test-1";
export const TEST_BET_ID = "bet-test-1";

export function debitCommand(
  overrides: Partial<WalletDebitRequestedV1> = {},
): WalletDebitRequestedV1 {
  return {
    type: "WalletDebitRequested",
    version: "v1",
    commandId: overrides.commandId ?? "cmd-debit-1",
    correlationId: overrides.correlationId ?? "corr-debit-1",
    createdAt: overrides.createdAt ?? "2026-05-27T00:00:00.000Z",
    userId: overrides.userId ?? TEST_USER_ID,
    gameRoundId: overrides.gameRoundId ?? TEST_ROUND_ID,
    betId: overrides.betId ?? TEST_BET_ID,
    amount: overrides.amount ?? { amountInCents: 100n, currency: "BRL" },
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
    userId: overrides.userId ?? TEST_USER_ID,
    gameRoundId: overrides.gameRoundId ?? TEST_ROUND_ID,
    betId: overrides.betId ?? TEST_BET_ID,
    reason: overrides.reason ?? "cashout",
    amount: overrides.amount ?? { amountInCents: 250n, currency: "BRL" },
  };
}

export function debitSucceeded(
  overrides: Partial<WalletDebitSucceededV1> = {},
): WalletDebitSucceededV1 {
  return {
    type: "WalletDebitSucceeded",
    version: "v1",
    commandId: overrides.commandId ?? "cmd-debit-1",
    correlationId: overrides.correlationId ?? "corr-debit-1",
    createdAt: overrides.createdAt ?? "2026-05-27T00:00:00.000Z",
    userId: overrides.userId ?? TEST_USER_ID,
    gameRoundId: overrides.gameRoundId ?? TEST_ROUND_ID,
    betId: overrides.betId ?? TEST_BET_ID,
    balanceAfterInCents: overrides.balanceAfterInCents ?? 99_900n,
  };
}

export function creditSucceeded(
  overrides: Partial<WalletCreditSucceededV1> = {},
): WalletCreditSucceededV1 {
  return {
    type: "WalletCreditSucceeded",
    version: "v1",
    commandId: overrides.commandId ?? "cmd-credit-1",
    correlationId: overrides.correlationId ?? "corr-credit-1",
    createdAt: overrides.createdAt ?? "2026-05-27T00:00:00.000Z",
    userId: overrides.userId ?? TEST_USER_ID,
    gameRoundId: overrides.gameRoundId ?? TEST_ROUND_ID,
    betId: overrides.betId ?? TEST_BET_ID,
    balanceAfterInCents: overrides.balanceAfterInCents ?? 100_150n,
  };
}

export function debitFailed(
  overrides: Partial<WalletDebitFailedV1> = {},
): WalletDebitFailedV1 {
  return {
    type: "WalletDebitFailed",
    version: "v1",
    commandId: overrides.commandId ?? "cmd-debit-1",
    correlationId: overrides.correlationId ?? "corr-debit-1",
    createdAt: overrides.createdAt ?? "2026-05-27T00:00:00.000Z",
    userId: overrides.userId ?? TEST_USER_ID,
    gameRoundId: overrides.gameRoundId ?? TEST_ROUND_ID,
    betId: overrides.betId ?? TEST_BET_ID,
    reason: overrides.reason ?? "insufficient_funds",
  };
}
