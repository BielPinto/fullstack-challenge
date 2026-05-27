import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ProcessWalletCommandHandler } from "../../../src/application/handlers/process-wallet-command.handler";
import { Wallet } from "../../../src/domain/entities/wallet.entity";
import { Money } from "../../../src/domain/value-objects/money";
import type { ProcessedCommandRepository } from "../../../src/application/ports/processed-command.repository";
import type { WalletEventPublisher } from "../../../src/application/ports/wallet-event.publisher";
import type { WalletRepository } from "../../../src/application/ports/wallet.repository";
import { WalletCommandPersistence } from "../../../src/infrastructure/persistence/wallet-command.persistence";
import {
  creditCommand,
  debitCommand,
  debitFailed,
  debitSucceeded,
  TEST_USER_ID,
} from "./fixtures";

function createWallet(balanceCents: bigint): Wallet {
  return Wallet.reconstitute({
    id: "wallet-1",
    userId: TEST_USER_ID,
    balance: Money.fromCents(balanceCents),
  });
}

describe("ProcessWalletCommandHandler", () => {
  let walletRepo: WalletRepository;
  let processedCommands: ProcessedCommandRepository;
  let eventPublisher: WalletEventPublisher;
  let commandPersistence: WalletCommandPersistence;
  let handler: ProcessWalletCommandHandler;

  beforeEach(() => {
    walletRepo = {
      findByUserId: mock(async () => createWallet(100_000n)),
    };
    processedCommands = {
      findByCommandId: mock(async () => null),
    };
    eventPublisher = {
      publish: mock(async () => undefined),
    };
    commandPersistence = {
      persist: mock(async () => undefined),
    } as unknown as WalletCommandPersistence;

    handler = new ProcessWalletCommandHandler(
      walletRepo,
      processedCommands,
      eventPublisher,
      commandPersistence,
    );
  });

  it("debits wallet and publishes success event", async () => {
    const command = debitCommand({ amount: { amountInCents: 1_000n, currency: "BRL" } });
    await handler.handle(command);

    expect(commandPersistence.persist).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);

    const published = (eventPublisher.publish as ReturnType<typeof mock>).mock.calls[0][0];
    expect(published.type).toBe("WalletDebitSucceeded");
    if (published.type === "WalletDebitSucceeded") {
      expect(published.balanceAfterInCents).toBe(99_000n);
    }
  });

  it("returns insufficient_funds without persisting wallet changes", async () => {
    walletRepo.findByUserId = mock(async () => createWallet(50n));
    const command = debitCommand({ amount: { amountInCents: 100n, currency: "BRL" } });

    await handler.handle(command);

    const published = (eventPublisher.publish as ReturnType<typeof mock>).mock.calls[0][0];
    expect(published.type).toBe("WalletDebitFailed");
    if (published.type === "WalletDebitFailed") {
      expect(published.reason).toBe("insufficient_funds");
    }

    const persistCall = (commandPersistence.persist as ReturnType<typeof mock>).mock.calls[0];
    expect(persistCall[0]).toBeNull();
  });

  it("returns wallet_not_found when user has no wallet", async () => {
    walletRepo.findByUserId = mock(async () => null);
    await handler.handle(debitCommand());

    const published = (eventPublisher.publish as ReturnType<typeof mock>).mock.calls[0][0];
    expect(published.type).toBe("WalletDebitFailed");
    if (published.type === "WalletDebitFailed") {
      expect(published.reason).toBe("wallet_not_found");
    }
  });

  it("credits wallet on cashout command", async () => {
    await handler.handle(creditCommand({ amount: { amountInCents: 500n, currency: "BRL" } }));

    const published = (eventPublisher.publish as ReturnType<typeof mock>).mock.calls[0][0];
    expect(published.type).toBe("WalletCreditSucceeded");
    if (published.type === "WalletCreditSucceeded") {
      expect(published.balanceAfterInCents).toBe(100_500n);
    }
  });

  it("allows zero-amount credit (crash settlement) without wallet update", async () => {
    await handler.handle(
      creditCommand({ amount: { amountInCents: 0n, currency: "BRL" }, reason: "refund" }),
    );

    const published = (eventPublisher.publish as ReturnType<typeof mock>).mock.calls[0][0];
    expect(published.type).toBe("WalletCreditSucceeded");
    const persistCall = (commandPersistence.persist as ReturnType<typeof mock>).mock.calls[0];
    expect(persistCall[0]).toBeNull();
  });

  it("replays stored result when commandId was already processed", async () => {
    const stored = debitSucceeded({ commandId: "cmd-dup", balanceAfterInCents: 88_000n });
    processedCommands.findByCommandId = mock(async () => ({
      commandId: "cmd-dup",
      resultEvent: stored,
    }));

    await handler.handle(debitCommand({ commandId: "cmd-dup" }));

    expect(walletRepo.findByUserId).not.toHaveBeenCalled();
    expect(commandPersistence.persist).not.toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalledWith(stored);
  });
});
