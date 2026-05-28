import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Channel, ConsumeMessage } from "amqplib";
import { RabbitMqWalletCommandConsumer } from "../../../src/infrastructure/messaging/rabbitmq-wallet-command.consumer";
import { ProcessWalletCommandHandler } from "../../../src/application/handlers/process-wallet-command.handler";
import { debitCommand } from "./fixtures";
import { serializeWalletEvent } from "../../../src/infrastructure/messaging/event-serializer";
import { silenceNestLogger } from "./test-utils";

function fakeMessage(body: Buffer): ConsumeMessage {
  return {
    content: body,
    fields: {} as ConsumeMessage["fields"],
    properties: {} as ConsumeMessage["properties"],
  };
}

describe("RabbitMqWalletCommandConsumer", () => {
  let consumer: RabbitMqWalletCommandConsumer;
  let handler: ProcessWalletCommandHandler;
  let channel: Channel;

  beforeEach(() => {
    handler = {
      handle: mock(async () => undefined),
    } as unknown as ProcessWalletCommandHandler;

    consumer = new RabbitMqWalletCommandConsumer(handler);
    channel = {
      ack: mock(() => undefined),
      nack: mock(() => undefined),
    } as unknown as Channel;
    (consumer as unknown as { channel: Channel }).channel = channel;
  });

  it("acks message after successful command handling", async () => {
    const command = debitCommand();
    const body = Buffer.from(serializeWalletEvent(command));

    await (consumer as unknown as { handleMessage: (msg: ConsumeMessage | null) => Promise<void> }).handleMessage(
      fakeMessage(body),
    );

    expect(handler.handle).toHaveBeenCalledWith(command);
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it("nacks message when payload is invalid JSON", async () => {
    const restoreLogger = silenceNestLogger();
    try {
      await (consumer as unknown as { handleMessage: (msg: ConsumeMessage | null) => Promise<void> }).handleMessage(
        fakeMessage(Buffer.from("{invalid")),
      );

      expect(handler.handle).not.toHaveBeenCalled();
      expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    } finally {
      restoreLogger();
    }
  });

  it("nacks message when handler throws", async () => {
    const restoreLogger = silenceNestLogger();
    handler.handle = mock(async () => {
      throw new Error("db down");
    });
    const body = Buffer.from(serializeWalletEvent(debitCommand()));

    try {
      await (consumer as unknown as { handleMessage: (msg: ConsumeMessage | null) => Promise<void> }).handleMessage(
        fakeMessage(body),
      );

      expect(channel.nack).toHaveBeenCalledTimes(1);
    } finally {
      restoreLogger();
    }
  });

  it("ignores null messages", async () => {
    await (consumer as unknown as { handleMessage: (msg: ConsumeMessage | null) => Promise<void> }).handleMessage(
      null,
    );
    expect(handler.handle).not.toHaveBeenCalled();
  });
});
