import {
  BetNotActiveError,
  DuplicateBetError,
} from "../errors/game.errors";
import { computeCashoutPayoutCents } from "../services/bet-payout";
import { assertBetAmountInRange } from "../value-objects/bet-limits";
import type { RoundPhase } from "./round.entity";

export type BetStatus =
  | "DEBIT_PENDING"
  | "ACTIVE"
  | "CASHED_OUT"
  | "LOST"
  | "DEBIT_FAILED";

export type BetLifecycleEvent =
  | "DEBIT_SUCCEEDED"
  | "DEBIT_FAILED"
  | "CASHOUT_SUCCEEDED"
  | "CASHOUT_REVERTED"
  | "ROUND_CRASHED";

const VALID_TRANSITIONS: Record<
  BetStatus,
  Partial<Record<BetLifecycleEvent, BetStatus>>
> = {
  DEBIT_PENDING: {
    DEBIT_SUCCEEDED: "ACTIVE",
    DEBIT_FAILED: "DEBIT_FAILED",
  },
  ACTIVE: {
    CASHOUT_SUCCEEDED: "CASHED_OUT",
    ROUND_CRASHED: "LOST",
  },
  CASHED_OUT: {
    CASHOUT_REVERTED: "ACTIVE",
  },
  LOST: {},
  DEBIT_FAILED: {},
};

export interface BetProps {
  id: string;
  roundId: string;
  userId: string;
  amountInCents: bigint;
  status: BetStatus;
  cashoutMultiplierMicro: bigint | null;
  payoutInCents: bigint | null;
  debitCommandId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CashoutResult = {
  payoutInCents: bigint;
  cashoutMultiplierMicro: bigint;
};

export class Bet {
  private constructor(
    public readonly id: string,
    public readonly roundId: string,
    public readonly userId: string,
    public readonly amountInCents: bigint,
    private status: BetStatus,
    private cashoutMultiplierMicro: bigint | null,
    private payoutInCents: bigint | null,
    public readonly debitCommandId: string,
    public readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static createDebitPending(input: {
    id: string;
    roundId: string;
    userId: string;
    amountInCents: bigint;
    debitCommandId: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): Bet {
    assertBetAmountInRange(input.amountInCents);
    const now = input.createdAt ?? new Date();
    return new Bet(
      input.id,
      input.roundId,
      input.userId,
      input.amountInCents,
      "DEBIT_PENDING",
      null,
      null,
      input.debitCommandId,
      now,
      input.updatedAt ?? now,
    );
  }

  static reconstitute(props: BetProps): Bet {
    return new Bet(
      props.id,
      props.roundId,
      props.userId,
      props.amountInCents,
      props.status,
      props.cashoutMultiplierMicro,
      props.payoutInCents,
      props.debitCommandId,
      props.createdAt,
      props.updatedAt,
    );
  }

  static canTransition(status: BetStatus, event: BetLifecycleEvent): boolean {
    return VALID_TRANSITIONS[status][event] !== undefined;
  }

  static nextStatus(
    status: BetStatus,
    event: BetLifecycleEvent,
  ): BetStatus | null {
    return VALID_TRANSITIONS[status][event] ?? null;
  }

  static wouldBeDuplicate(
    existingUserIdsOnRound: readonly string[],
    userId: string,
  ): boolean {
    return existingUserIdsOnRound.includes(userId);
  }

  getStatus(): BetStatus {
    return this.status;
  }

  getCashoutMultiplierMicro(): bigint | null {
    return this.cashoutMultiplierMicro;
  }

  getPayoutInCents(): bigint | null {
    return this.payoutInCents;
  }

  isTerminal(): boolean {
    return (
      this.status === "CASHED_OUT" ||
      this.status === "LOST" ||
      this.status === "DEBIT_FAILED"
    );
  }

  canConfirmDebit(): boolean {
    return this.status === "DEBIT_PENDING";
  }

  canCashOut(roundPhase: RoundPhase): boolean {
    return this.status === "ACTIVE" && roundPhase === "RUNNING";
  }

  assertCanCashOut(roundPhase: RoundPhase): void {
    if (this.status === "DEBIT_PENDING") {
      throw new BetNotActiveError("Bet is still being confirmed");
    }
    if (!this.canCashOut(roundPhase)) {
      throw new BetNotActiveError();
    }
  }

  assertNotDuplicate(existingUserIdsOnRound: readonly string[]): void {
    if (Bet.wouldBeDuplicate(existingUserIdsOnRound, this.userId)) {
      throw new DuplicateBetError();
    }
  }

  private applyTransition(event: BetLifecycleEvent): void {
    const next = Bet.nextStatus(this.status, event);
    if (!next) {
      throw new BetNotActiveError(`Invalid bet transition: ${this.status} + ${event}`);
    }
    this.status = next;
    this.updatedAt = new Date();
  }

  confirmDebit(): void {
    if (!this.canConfirmDebit()) {
      throw new BetNotActiveError("Bet is not awaiting debit confirmation");
    }
    this.applyTransition("DEBIT_SUCCEEDED");
  }

  failDebit(): void {
    this.applyTransition("DEBIT_FAILED");
  }

  calculateCashout(multiplierMicro: bigint): CashoutResult {
    if (this.status !== "ACTIVE") {
      throw new BetNotActiveError();
    }
    return {
      payoutInCents: computeCashoutPayoutCents(this.amountInCents, multiplierMicro),
      cashoutMultiplierMicro: multiplierMicro,
    };
  }

  cashOut(multiplierMicro: bigint): CashoutResult {
    const result = this.calculateCashout(multiplierMicro);
    this.cashoutMultiplierMicro = result.cashoutMultiplierMicro;
    this.payoutInCents = result.payoutInCents;
    this.applyTransition("CASHOUT_SUCCEEDED");
    return result;
  }

  revertCashout(): void {
    this.cashoutMultiplierMicro = null;
    this.payoutInCents = null;
    this.applyTransition("CASHOUT_REVERTED");
  }

  markLost(): void {
    this.applyTransition("ROUND_CRASHED");
  }

  toProps(): BetProps {
    return {
      id: this.id,
      roundId: this.roundId,
      userId: this.userId,
      amountInCents: this.amountInCents,
      status: this.status,
      cashoutMultiplierMicro: this.cashoutMultiplierMicro,
      payoutInCents: this.payoutInCents,
      debitCommandId: this.debitCommandId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
