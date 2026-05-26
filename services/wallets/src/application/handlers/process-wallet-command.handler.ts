import { Injectable, Inject, Logger } from "@nestjs/common";
import type {
  WalletCommandEventV1,
  WalletCreditRequestedV1,
  WalletDebitRequestedV1,
  WalletCreditFailedV1,
  WalletCreditSucceededV1,
  WalletDebitFailedV1,
  WalletDebitSucceededV1,
  WalletResultEventV1,
} from "@crash/contracts";
import { Wallet } from "../../domain/entities/wallet.entity";
import { InsufficientFundsError } from "../../domain/errors/wallet.errors";
import { Money } from "../../domain/value-objects/money";
import {
  PROCESSED_COMMAND_REPOSITORY,
  type ProcessedCommandRepository,
} from "../ports/processed-command.repository";
import {
  WALLET_EVENT_PUBLISHER,
  type WalletEventPublisher,
} from "../ports/wallet-event.publisher";
import {
  WALLET_REPOSITORY,
  type WalletRepository,
} from "../ports/wallet.repository";
import { WalletCommandPersistence } from "../../infrastructure/persistence/wallet-command.persistence";

@Injectable()
export class ProcessWalletCommandHandler {
  private readonly logger = new Logger(ProcessWalletCommandHandler.name);

  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
    @Inject(PROCESSED_COMMAND_REPOSITORY)
    private readonly processedCommands: ProcessedCommandRepository,
    @Inject(WALLET_EVENT_PUBLISHER)
    private readonly eventPublisher: WalletEventPublisher,
    private readonly commandPersistence: WalletCommandPersistence,
  ) {}

  async handle(command: WalletCommandEventV1): Promise<void> {
    const existing = await this.processedCommands.findByCommandId(command.commandId);
    if (existing) {
      await this.eventPublisher.publish(existing.resultEvent);
      return;
    }

    const { result, wallet } =
      command.type === "WalletDebitRequested"
        ? await this.handleDebit(command)
        : await this.handleCredit(command);

    const record = { commandId: command.commandId, resultEvent: result };
    await this.commandPersistence.persist(wallet, record);
    await this.eventPublisher.publish(result);
  }

  private async handleDebit(
    command: WalletDebitRequestedV1,
  ): Promise<{
    result: WalletDebitSucceededV1 | WalletDebitFailedV1;
    wallet: Wallet | null;
  }> {
    const base = this.baseMetadata(command);
    const wallet = await this.walletRepository.findByUserId(command.userId);

    if (!wallet) {
      return {
        wallet: null,
        result: {
          ...base,
          type: "WalletDebitFailed",
          reason: "wallet_not_found",
        },
      };
    }

    const amount = Money.fromCents(command.amount.amountInCents, command.amount.currency);

    try {
      wallet.debit(amount);
      return {
        wallet,
        result: {
          ...base,
          type: "WalletDebitSucceeded",
          balanceAfterInCents: wallet.getBalance().amountInCents,
        },
      };
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        return {
          wallet: null,
          result: {
            ...base,
            type: "WalletDebitFailed",
            reason: "insufficient_funds",
          },
        };
      }
      this.logger.error("Unexpected debit error", error);
      return {
        wallet: null,
        result: {
          ...base,
          type: "WalletDebitFailed",
          reason: "unknown",
        },
      };
    }
  }

  private async handleCredit(
    command: WalletCreditRequestedV1,
  ): Promise<{
    result: WalletCreditSucceededV1 | WalletCreditFailedV1;
    wallet: Wallet | null;
  }> {
    const base = this.baseMetadata(command);
    const wallet = await this.walletRepository.findByUserId(command.userId);

    if (!wallet) {
      return {
        wallet: null,
        result: {
          ...base,
          type: "WalletCreditFailed",
          reason: "wallet_not_found",
        },
      };
    }

    const amount = Money.fromCents(command.amount.amountInCents, command.amount.currency);

    try {
      if (!amount.isZero()) {
        wallet.credit(amount);
      }
      return {
        wallet: amount.isZero() ? null : wallet,
        result: {
          ...base,
          type: "WalletCreditSucceeded",
          balanceAfterInCents: wallet.getBalance().amountInCents,
        },
      };
    } catch (error) {
      this.logger.error("Unexpected credit error", error);
      return {
        wallet: null,
        result: {
          ...base,
          type: "WalletCreditFailed",
          reason: "unknown",
        },
      };
    }
  }

  private baseMetadata(command: WalletCommandEventV1): Omit<WalletResultEventV1, "type"> {
    return {
      version: "v1",
      commandId: command.commandId,
      correlationId: command.correlationId,
      createdAt: new Date().toISOString(),
      userId: command.userId,
      gameRoundId: command.gameRoundId,
      betId: command.betId,
    };
  }
}
