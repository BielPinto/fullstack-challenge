import type { WalletCommandEventV1, WalletResultEventV1 } from "@crash/contracts";

const BIGINT_JSON_KEYS = new Set([
  "amountInCents",
  "balanceAfterInCents",
]);

export function serializeWalletCommand(command: WalletCommandEventV1): string {
  return JSON.stringify(command, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

export function parseWalletResult(raw: Buffer): WalletResultEventV1 {
  const parsed = JSON.parse(raw.toString("utf8"), (key, value) => {
    if (typeof value === "string" && BIGINT_JSON_KEYS.has(key)) {
      return BigInt(value);
    }
    return value;
  }) as WalletResultEventV1;

  if (parsed.version !== "v1") {
    throw new Error(`Unsupported event version: ${String(parsed.version)}`);
  }

  return parsed;
}
