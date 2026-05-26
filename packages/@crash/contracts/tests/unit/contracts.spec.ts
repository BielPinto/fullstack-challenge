import { describe, expect, it } from "bun:test";
import {
  AMQP_EXCHANGES,
  WALLET_COMMAND_ROUTING_KEYS,
  WALLET_EVENT_ROUTING_KEYS,
  type WalletDebitRequestedV1,
} from "../../src";

describe("@crash/contracts", () => {
  it("defines stable AMQP names", () => {
    expect(AMQP_EXCHANGES.walletCommands).toBe("wallet.commands");
    expect(WALLET_COMMAND_ROUTING_KEYS.debitRequestV1).toBe("wallet.debit.request.v1");
    expect(WALLET_EVENT_ROUTING_KEYS.debitSucceededV1).toBe("wallet.debit.succeeded.v1");
  });

  it("keeps wallet payload shape typed", () => {
    const event: WalletDebitRequestedV1 = {
      type: "WalletDebitRequested",
      version: "v1",
      commandId: "cmd-1",
      correlationId: "corr-1",
      createdAt: new Date().toISOString(),
      userId: "player",
      gameRoundId: "round-1",
      betId: "bet-1",
      amount: {
        amountInCents: 100n,
        currency: "BRL",
      },
    };

    expect(event.amount.amountInCents).toBe(100n);
  });
});
