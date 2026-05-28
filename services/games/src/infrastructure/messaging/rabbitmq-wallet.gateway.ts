import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  AMQP_EXCHANGES,
  WALLET_COMMAND_ROUTING_KEYS,
  WALLET_EVENT_ROUTING_KEYS,
  type WalletCommandEventV1,
  type WalletCreditRequestedV1,
  type WalletDebitRequestedV1,
  type WalletResultEventV1,
} from "@crash/contracts";
import type { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import { connect } from "amqplib";
import { randomUUID } from "node:crypto";
import type {
  WalletCreditResult,
  WalletDebitResult,
  WalletGatewayPort,
} from "../../application/ports/wallet-gateway.port";
import {
  WalletOperationRejectedError,
  WalletOperationTimeoutError,
} from "../../domain/errors/game.errors";
import { parseWalletResult, serializeWalletCommand } from "./event-serializer";

const GAME_WALLET_EVENTS_QUEUE = "game.service.wallet-events";
const DEFAULT_WALLET_TIMEOUT_MS = 15_000;

type PendingWalletOperation = {
  commandId: string;
  resolve: (event: WalletResultEventV1) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

@Injectable()
export class RabbitMqWalletGateway implements WalletGatewayPort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqWalletGateway.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly pending = new Map<string, PendingWalletOperation>();

  async onModuleInit(): Promise<void> {
    await this.start();
  }

  async onModuleDestroy(): Promise<void> {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Wallet gateway shutting down"));
    }
    this.pending.clear();
    await this.channel?.close();
    await this.connection?.close();
  }

  async requestDebit(input: {
    commandId: string;
    userId: string;
    gameRoundId: string;
    betId: string;
    amountInCents: bigint;
  }): Promise<WalletDebitResult> {
    const correlationId = randomUUID();
    const command: WalletDebitRequestedV1 = {
      version: "v1",
      type: "WalletDebitRequested",
      commandId: input.commandId,
      correlationId,
      createdAt: new Date().toISOString(),
      userId: input.userId,
      gameRoundId: input.gameRoundId,
      betId: input.betId,
      amount: { amountInCents: input.amountInCents, currency: "BRL" },
    };

    const event = await this.publishAndAwait(command);
    return this.mapDebitResult(event);
  }

  async requestCredit(input: {
    commandId: string;
    userId: string;
    gameRoundId: string;
    betId: string;
    amountInCents: bigint;
    reason: "cashout" | "rollback" | "refund";
  }): Promise<WalletCreditResult> {
    const correlationId = randomUUID();
    const command: WalletCreditRequestedV1 = {
      version: "v1",
      type: "WalletCreditRequested",
      commandId: input.commandId,
      correlationId,
      createdAt: new Date().toISOString(),
      userId: input.userId,
      gameRoundId: input.gameRoundId,
      betId: input.betId,
      reason: input.reason,
      amount: { amountInCents: input.amountInCents, currency: "BRL" },
    };

    const event = await this.publishAndAwait(command);
    return this.mapCreditResult(event);
  }

  private async publishAndAwait(command: WalletCommandEventV1): Promise<WalletResultEventV1> {
    const channel = await this.ensureChannel();
    const timeoutMs = Number(process.env.WALLET_RPC_TIMEOUT_MS ?? DEFAULT_WALLET_TIMEOUT_MS);

    const eventPromise = new Promise<WalletResultEventV1>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.commandId);
        reject(new WalletOperationTimeoutError());
      }, timeoutMs);

      this.pending.set(command.commandId, {
        commandId: command.commandId,
        resolve,
        reject,
        timer,
      });
    });

    const routingKey =
      command.type === "WalletDebitRequested"
        ? WALLET_COMMAND_ROUTING_KEYS.debitRequestV1
        : WALLET_COMMAND_ROUTING_KEYS.creditRequestV1;

    channel.publish(
      AMQP_EXCHANGES.walletCommands,
      routingKey,
      Buffer.from(serializeWalletCommand(command)),
      {
        contentType: "application/json",
        persistent: true,
        correlationId: command.correlationId,
        messageId: command.commandId,
      },
    );

    return eventPromise;
  }

  private mapDebitResult(event: WalletResultEventV1): WalletDebitResult {
    if (event.type === "WalletDebitSucceeded") {
      return { ok: true, balanceAfterInCents: event.balanceAfterInCents };
    }
    if (event.type === "WalletDebitFailed") {
      return { ok: false, reason: event.reason };
    }
    throw new WalletOperationRejectedError(event.type, "Unexpected wallet event for debit");
  }

  private mapCreditResult(event: WalletResultEventV1): WalletCreditResult {
    if (event.type === "WalletCreditSucceeded") {
      return { ok: true, balanceAfterInCents: event.balanceAfterInCents };
    }
    if (event.type === "WalletCreditFailed") {
      return { ok: false, reason: event.reason };
    }
    throw new WalletOperationRejectedError(event.type, "Unexpected wallet event for credit");
  }

  private async start(): Promise<void> {
    const url = process.env.RABBITMQ_URL;
    if (!url) {
      throw new Error("RABBITMQ_URL is not set");
    }

    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.prefetch(50);

    await this.channel.assertExchange(AMQP_EXCHANGES.walletEvents, "topic", { durable: true });
    await this.channel.assertQueue(GAME_WALLET_EVENTS_QUEUE, { durable: true });

    for (const routingKey of Object.values(WALLET_EVENT_ROUTING_KEYS)) {
      await this.channel.bindQueue(
        GAME_WALLET_EVENTS_QUEUE,
        AMQP_EXCHANGES.walletEvents,
        routingKey,
      );
    }

    await this.channel.consume(GAME_WALLET_EVENTS_QUEUE, (message) => {
      this.handleWalletEvent(message);
    });

    this.logger.log(`Consuming wallet events from queue ${GAME_WALLET_EVENTS_QUEUE}`);
  }

  private handleWalletEvent(message: ConsumeMessage | null): void {
    if (!message || !this.channel) {
      return;
    }

    try {
      const event = parseWalletResult(message.content);
      const pending = this.pending.get(event.commandId);
      if (!pending) {
        this.channel.ack(message);
        return;
      }

      clearTimeout(pending.timer);
      this.pending.delete(event.commandId);
      pending.resolve(event);
      this.channel.ack(message);
    } catch (error) {
      this.logger.error("Failed to parse wallet event", error);
      this.channel.nack(message, false, false);
    }
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }
    await this.start();
    if (!this.channel) {
      throw new Error("RabbitMQ channel not available");
    }
    return this.channel;
  }
}
