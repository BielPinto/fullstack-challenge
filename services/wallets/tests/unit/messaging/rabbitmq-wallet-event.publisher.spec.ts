import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  AMQP_EXCHANGES,
  WALLET_EVENT_ROUTING_KEYS,
} from "@crash/contracts";
import type { Channel } from "amqplib";
import { RabbitMqWalletEventPublisher } from "../../../src/infrastructure/messaging/rabbitmq-wallet-event.publisher";
import { creditSucceeded, debitFailed, debitSucceeded } from "./fixtures";

type PublishCall = {
  exchange: string;
  routingKey: string;
  body: Buffer;
  options: Record<string, unknown>;
};

function createMockChannel(): Channel & { publishCalls: PublishCall[] } {
  const publishCalls: PublishCall[] = [];
  return {
    publishCalls,
    publish: mock((exchange, routingKey, body, options) => {
      publishCalls.push({ exchange, routingKey, body, options });
      return true;
    }),
    assertExchange: mock(async () => undefined),
    close: mock(async () => undefined),
  } as unknown as Channel & { publishCalls: PublishCall[] };
}

describe("RabbitMqWalletEventPublisher", () => {
  let publisher: RabbitMqWalletEventPublisher;
  let channel: Channel & { publishCalls: PublishCall[] };

  beforeEach(() => {
    publisher = new RabbitMqWalletEventPublisher();
    channel = createMockChannel();
    (publisher as unknown as { channel: Channel }).channel = channel;
  });

  it("publishes debit succeeded to wallet.events with correct routing key", async () => {
    const event = debitSucceeded();
    await publisher.publish(event);

    expect(channel.publishCalls).toHaveLength(1);
    const call = channel.publishCalls[0];
    expect(call.exchange).toBe(AMQP_EXCHANGES.walletEvents);
    expect(call.routingKey).toBe(WALLET_EVENT_ROUTING_KEYS.debitSucceededV1);
    expect(call.options.persistent).toBe(true);
    expect(call.options.correlationId).toBe(event.correlationId);
    expect(call.options.messageId).toBe(`${event.commandId}:${event.type}`);

    const body = JSON.parse(call.body.toString()) as { balanceAfterInCents: string };
    expect(body.balanceAfterInCents).toBe("99900");
  });

  it("publishes debit failed with debit.failed routing key", async () => {
    const event = debitFailed({ reason: "insufficient_funds" });
    await publisher.publish(event);

    expect(channel.publishCalls[0].routingKey).toBe(WALLET_EVENT_ROUTING_KEYS.debitFailedV1);
  });

  it("publishes credit succeeded with credit.succeeded routing key", async () => {
    const event = creditSucceeded();
    await publisher.publish(event);

    expect(channel.publishCalls[0].routingKey).toBe(
      WALLET_EVENT_ROUTING_KEYS.creditSucceededV1,
    );
  });
});
