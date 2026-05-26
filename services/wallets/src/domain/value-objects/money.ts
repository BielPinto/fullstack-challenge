export type CurrencyCode = "BRL";

export class Money {
  private constructor(
    public readonly amountInCents: bigint,
    public readonly currency: CurrencyCode = "BRL",
  ) {}

  static fromCents(amountInCents: bigint, currency: CurrencyCode = "BRL"): Money {
    if (amountInCents < 0n) {
      throw new Error("Amount in cents cannot be negative");
    }
    return new Money(amountInCents, currency);
  }

  static zero(currency: CurrencyCode = "BRL"): Money {
    return Money.fromCents(0n, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromCents(this.amountInCents + other.amountInCents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromCents(this.amountInCents - other.amountInCents, this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountInCents > other.amountInCents;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountInCents >= other.amountInCents;
  }

  isZero(): boolean {
    return this.amountInCents === 0n;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error("Currency mismatch");
    }
  }
}
