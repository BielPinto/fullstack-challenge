import { InsufficientFundsError, InvalidAmountError } from "../errors/wallet.errors";
import { Money } from "../value-objects/money";

export interface WalletProps {
  id: string;
  userId: string;
  balance: Money;
}

export class Wallet {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    private balance: Money,
  ) {}

  static create(userId: string, id: string): Wallet {
    return new Wallet(id, userId, Money.zero());
  }

  static reconstitute(props: WalletProps): Wallet {
    return new Wallet(props.id, props.userId, props.balance);
  }

  getBalance(): Money {
    return this.balance;
  }

  credit(amount: Money): void {
    if (amount.isZero()) {
      throw new InvalidAmountError("Credit amount must be greater than zero");
    }
    this.balance = this.balance.add(amount);
  }

  debit(amount: Money): void {
    if (amount.isZero()) {
      throw new InvalidAmountError("Debit amount must be greater than zero");
    }
    if (!this.balance.isGreaterThanOrEqual(amount)) {
      throw new InsufficientFundsError();
    }
    this.balance = this.balance.subtract(amount);
  }
}
