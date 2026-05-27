import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
  AMQP_EXCHANGES,
  WALLET_COMMAND_ROUTING_KEYS,
} from "@crash/contracts";
import type { Channel, ConsumeMessage } from "amqplib";
import { RabbitMqWalletGateway } from "../../../src/infrastructure/messaging/rabbitmq-wallet.gateway";
import {
  WalletOperationRejectedError,
  WalletOperationTimeoutError,
} from "../../../src/domain/errors/game.errors";
import { debitFailed, debitSucceeded, walletResultBuffer } from "./fixtures";
import { silenceNestLogger } from "./test-utils";

type GatewayWithChannel = RabbitMqWalletGateway & {
  channel: Channel;
  ensureChannel: () => Promise<Channel>;
  handleWalletEvent: (message: ConsumeMessage | null) => void;
};

function createMockChannel(): Channel {
  return {
    publish: mock(() => true),
    prefetch: mock(async () => undefined),
    assertExchange: mock(async () => undefined),
    assertQueue: mock(async () => undefined),
    bindQueue: mock(async () => undefined),
    consume: mock(async () => ({ consumerTag: "tag-1" })),
    ack: mock(() => undefined),
    nack: mock(() => undefined),
    close: mock(async () => undefined),
  } as unknown as Channel;
}

/** Flushes microtasks so async ensureChannel + publish run before assertions. */
async function flushAsync(): Promise<void> {
  await Promise.resolve();
}

function fakeConsumeMessage(body: Buffer): ConsumeMessage {
  return {
    content: body,
    fields: {} as ConsumeMessage["fields"],
    properties: {} as ConsumeMessage["properties"],
  };
}

describe("RabbitMqWalletGateway", () => {
  let gateway: GatewayWithChannel;
  let mockChannel: Channel;

  beforeEach(() => {
    gateway = new RabbitMqWalletGateway() as GatewayWithChannel;
    mockChannel = createMockChannel();
    gateway.channel = mockChannel;
    spyOn(gateway, "ensureChannel").mockImplementation(async () => mockChannel);
    process.env.WALLET_RPC_TIMEOUT_MS = "5000";
  });

  it("publishes debit commands to wallet.commands exchange", async () => {
    const commandId = "cmd-debit-publish";
    const debitPromise = gateway.requestDebit({
      commandId,
      userId: "user-1",
      gameRoundId: "round-1",
      betId: "bet-1",
      amountInCents: 500n,
    });
    await flushAsync();

    expect(mockChannel.publish).toHaveBeenCalled();
    const publishCall = (mockChannel.publish as ReturnType<typeof mock>).mock.calls[0];
    expect(publishCall[0]).toBe(AMQP_EXCHANGES.walletCommands);
    expect(publishCall[1]).toBe(WALLET_COMMAND_ROUTING_KEYS.debitRequestV1);

    const body = JSON.parse((publishCall[2] as Buffer).toString()) as { commandId: string };
    expect(body.commandId).toBe(commandId);

    gateway.handleWalletEvent(
      fakeConsumeMessage(walletResultBuffer(debitSucceeded({ commandId, balanceAfterInCents: 99_500n }))),
    );

    const result = await debitPromise;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.balanceAfterInCents).toBe(99_500n);
    }
  });

  it("publishes credit commands with credit routing key and resolves success", async () => {
    const commandId = "cmd-credit-publish";
    const creditPromise = gateway.requestCredit({
      commandId,
      userId: "user-1",
      gameRoundId: "round-1",
      betId: "bet-1",
      amountInCents: 1_000n,
      reason: "cashout",
    });
    await flushAsync();

    const publishCall = (mockChannel.publish as ReturnType<typeof mock>).mock.calls[0];
    expect(publishCall[1]).toBe(WALLET_COMMAND_ROUTING_KEYS.creditRequestV1);

    gateway.handleWalletEvent(
      fakeConsumeMessage(
        walletResultBuffer({
          type: "WalletCreditSucceeded",
          version: "v1",
          commandId,
          correlationId: "corr-credit-1",
          createdAt: new Date().toISOString(),
          userId: "user-1",
          gameRoundId: "round-1",
          betId: "bet-1",
          balanceAfterInCents: 101_000n,
        }),
      ),
    );

    const result = await creditPromise;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.balanceAfterInCents).toBe(101_000n);
    }
  });

  it("maps debit failed to ok:false with reason", async () => {
    const commandId = "cmd-debit-fail";
    const debitPromise = gateway.requestDebit({
      commandId,
      userId: "user-1",
      gameRoundId: "round-1",
      betId: "bet-1",
      amountInCents: 500n,
    });
    await flushAsync();

    gateway.handleWalletEvent(
      fakeConsumeMessage(walletResultBuffer(debitFailed({ commandId, reason: "insufficient_funds" }))),
    );

    const result = await debitPromise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_funds");
    }
  });

  it("rejects with timeout when no wallet event arrives", async () => {
    process.env.WALLET_RPC_TIMEOUT_MS = "30";

    await expect(
      gateway.requestDebit({
        commandId: "cmd-timeout",
        userId: "user-1",
        gameRoundId: "round-1",
        betId: "bet-1",
        amountInCents: 100n,
      }),
    ).rejects.toBeInstanceOf(WalletOperationTimeoutError);
  }, 10_000);

  it("acks unknown commandId events without resolving pending operations", () => {
    gateway.handleWalletEvent(
      fakeConsumeMessage(walletResultBuffer(debitSucceeded({ commandId: "unknown-cmd" }))),
    );
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it("nacks malformed wallet event payloads", () => {
    const restoreLogger = silenceNestLogger();
    try {
      gateway.handleWalletEvent(fakeConsumeMessage(Buffer.from("{bad-json")));
      expect(mockChannel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    } finally {
      restoreLogger();
    }
  });

  it("serializes bigint amounts in published debit commands", async () => {
    void gateway.requestDebit({
      commandId: "cmd-bigint",
      userId: "user-1",
      gameRoundId: "round-1",
      betId: "bet-1",
      amountInCents: 12_345n,
    });
    await flushAsync();

    const publishCall = (mockChannel.publish as ReturnType<typeof mock>).mock.calls[0];
    const wire = (publishCall[2] as Buffer).toString();
    const parsed = JSON.parse(wire) as { amount: { amountInCents: string } };
    expect(parsed.amount.amountInCents).toBe("12345");
    expect(wire).not.toContain("12345n");
  });

  it("throws WalletOperationRejectedError for unexpected event types on debit", async () => {
    const commandId = "cmd-wrong-event";
    const debitPromise = gateway.requestDebit({
      commandId,
      userId: "user-1",
      gameRoundId: "round-1",
      betId: "bet-1",
      amountInCents: 100n,
    });
    await flushAsync();

    gateway.handleWalletEvent(
      fakeConsumeMessage(
        walletResultBuffer({
          type: "WalletCreditSucceeded",
          version: "v1",
          commandId,
          correlationId: "corr-1",
          createdAt: new Date().toISOString(),
          userId: "user-1",
          gameRoundId: "round-1",
          betId: "bet-1",
          balanceAfterInCents: 1_000n,
        }),
      ),
    );

    await expect(debitPromise).rejects.toBeInstanceOf(WalletOperationRejectedError);
  });
});
