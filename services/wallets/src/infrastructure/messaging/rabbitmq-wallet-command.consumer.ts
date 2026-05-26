import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  AMQP_EXCHANGES,
  WALLET_COMMAND_ROUTING_KEYS,
} from "@crash/contracts";
import type { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import { connect } from "amqplib";
import { ProcessWalletCommandHandler } from "../../application/handlers/process-wallet-command.handler";
import { parseWalletCommand } from "./event-serializer";

const WALLET_COMMANDS_QUEUE = "wallet.service.commands";

@Injectable()
export class RabbitMqWalletCommandConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqWalletCommandConsumer.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly commandHandler: ProcessWalletCommandHandler) {}

  async onModuleInit(): Promise<void> {
    await this.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async start(): Promise<void> {
    const url = process.env.RABBITMQ_URL;
    if (!url) {
      throw new Error("RABBITMQ_URL is not set");
    }

    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.prefetch(10);

    await this.channel.assertExchange(AMQP_EXCHANGES.walletCommands, "topic", { durable: true });
    await this.channel.assertQueue(WALLET_COMMANDS_QUEUE, { durable: true });
    await this.channel.bindQueue(
      WALLET_COMMANDS_QUEUE,
      AMQP_EXCHANGES.walletCommands,
      WALLET_COMMAND_ROUTING_KEYS.debitRequestV1,
    );
    await this.channel.bindQueue(
      WALLET_COMMANDS_QUEUE,
      AMQP_EXCHANGES.walletCommands,
      WALLET_COMMAND_ROUTING_KEYS.creditRequestV1,
    );

    await this.channel.consume(WALLET_COMMANDS_QUEUE, (message) => {
      void this.handleMessage(message);
    });

    this.logger.log(`Consuming wallet commands from queue ${WALLET_COMMANDS_QUEUE}`);
  }

  private async handleMessage(message: ConsumeMessage | null): Promise<void> {
    if (!message || !this.channel) {
      return;
    }

    try {
      const command = parseWalletCommand(message.content);
      await this.commandHandler.handle(command);
      this.channel.ack(message);
    } catch (error) {
      this.logger.error("Failed to process wallet command", error);
      this.channel.nack(message, false, false);
    }
  }
}
