import type { WalletCommandEventV1, WalletResultEventV1 } from "@crash/contracts";

const BIGINT_JSON_KEYS = new Set([
  "amountInCents",
  "balanceAfterInCents",
]);

export function serializeWalletEvent(event: WalletResultEventV1 | WalletCommandEventV1): string {
  return JSON.stringify(event, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

export function parseWalletCommand(raw: Buffer): WalletCommandEventV1 {
  const parsed = JSON.parse(raw.toString("utf8"), (key, value) => {
    if (typeof value === "string" && BIGINT_JSON_KEYS.has(key)) {
      return BigInt(value);
    }
    return value;
  }) as WalletCommandEventV1;

  if (parsed.version !== "v1") {
    throw new Error(`Unsupported event version: ${String(parsed.version)}`);
  }

  return parsed;
}

export function parseWalletResult(raw: string): WalletResultEventV1 {
  return JSON.parse(raw, (key, value) => {
    if (typeof value === "string" && BIGINT_JSON_KEYS.has(key)) {
      return BigInt(value);
    }
    return value;
  }) as WalletResultEventV1;
}

export function serializeWalletResult(event: WalletResultEventV1): string {
  return serializeWalletEvent(event);
}
