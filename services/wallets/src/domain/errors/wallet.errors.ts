export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class InsufficientFundsError extends DomainError {
  constructor() {
    super("Insufficient funds");
    this.name = "InsufficientFundsError";
  }
}

export class InvalidAmountError extends DomainError {
  constructor(message = "Amount must be positive") {
    super(message);
    this.name = "InvalidAmountError";
  }
}

export class WalletAlreadyExistsError extends DomainError {
  constructor(userId: string) {
    super(`Wallet already exists for user ${userId}`);
    this.name = "WalletAlreadyExistsError";
  }
}
