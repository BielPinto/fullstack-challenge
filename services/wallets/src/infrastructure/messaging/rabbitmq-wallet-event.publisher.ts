import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  AMQP_EXCHANGES,
  WALLET_EVENT_ROUTING_KEYS,
  type WalletResultEventV1,
} from "@crash/contracts";
import type { Channel, ChannelModel } from "amqplib";
import { connect } from "amqplib";
import type { WalletEventPublisher } from "../../application/ports/wallet-event.publisher";
import { serializeWalletEvent } from "./event-serializer";

@Injectable()
export class RabbitMqWalletEventPublisher
  implements WalletEventPublisher, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMqWalletEventPublisher.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  async onModuleInit(): Promise<void> {
    await this.ensureChannel();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  async publish(event: WalletResultEventV1): Promise<void> {
    const channel = await this.ensureChannel();
    const routingKey = this.routingKeyFor(event);
    const body = Buffer.from(serializeWalletEvent(event));

    channel.publish(AMQP_EXCHANGES.walletEvents, routingKey, body, {
      contentType: "application/json",
      persistent: true,
      correlationId: event.correlationId,
      messageId: `${event.commandId}:${event.type}`,
    });
  }

  private routingKeyFor(event: WalletResultEventV1): string {
    switch (event.type) {
      case "WalletDebitSucceeded":
        return WALLET_EVENT_ROUTING_KEYS.debitSucceededV1;
      case "WalletDebitFailed":
        return WALLET_EVENT_ROUTING_KEYS.debitFailedV1;
      case "WalletCreditSucceeded":
        return WALLET_EVENT_ROUTING_KEYS.creditSucceededV1;
      case "WalletCreditFailed":
        return WALLET_EVENT_ROUTING_KEYS.creditFailedV1;
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    const url = process.env.RABBITMQ_URL;
    if (!url) {
      throw new Error("RABBITMQ_URL is not set");
    }

    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(AMQP_EXCHANGES.walletEvents, "topic", { durable: true });

    this.logger.log("RabbitMQ wallet events publisher ready");
    return this.channel;
  }
}
