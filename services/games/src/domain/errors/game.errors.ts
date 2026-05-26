export class RoundNotInBettingPhaseError extends Error {
  constructor(message = "Round is not accepting bets") {
    super(message);
    this.name = "RoundNotInBettingPhaseError";
  }
}

export class RoundNotRunningError extends Error {
  constructor(message = "Round is not running") {
    super(message);
    this.name = "RoundNotRunningError";
  }
}

export class BetNotFoundError extends Error {
  constructor(message = "Bet not found") {
    super(message);
    this.name = "BetNotFoundError";
  }
}

export class BetNotActiveError extends Error {
  constructor(message = "Bet cannot be cashed out") {
    super(message);
    this.name = "BetNotActiveError";
  }
}

export class BetAmountOutOfRangeError extends Error {
  constructor(
    message = "Bet amount must be between min and max (inclusive), in cents",
  ) {
    super(message);
    this.name = "BetAmountOutOfRangeError";
  }
}

export class DuplicateBetError extends Error {
  constructor(message = "Player already has a bet in this round") {
    super(message);
    this.name = "DuplicateBetError";
  }
}

export class WalletOperationTimeoutError extends Error {
  constructor(message = "Wallet operation timed out") {
    super(message);
    this.name = "WalletOperationTimeoutError";
  }
}

export class WalletOperationRejectedError extends Error {
  constructor(
    public readonly reason: string,
    message = "Wallet rejected the operation",
  ) {
    super(message);
    this.name = "WalletOperationRejectedError";
  }
}

export class RoundNotFoundError extends Error {
  constructor(message = "Round not found") {
    super(message);
    this.name = "RoundNotFoundError";
  }
}
