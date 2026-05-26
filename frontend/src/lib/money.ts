const MIN_CENTS = 100n;
const MAX_CENTS = 100_000n;

/** Parse user-facing BRL input (e.g. "10,50" / "10.50") to centavos as bigint. */
export function parseBrlToCents(input: string): { ok: true; cents: bigint } | { ok: false; error: string } {
  const trimmed = input.trim().replace(/\s/g, "");
  if (!trimmed) {
    return { ok: false, error: "Informe um valor" };
  }
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return { ok: false, error: "Use até 2 casas decimais (ex: 10 ou 10,50)" };
  }
  const [wholeRaw, fracRaw = ""] = normalized.split(".");
  const frac = (fracRaw + "00").slice(0, 2);
  let cents: bigint;
  try {
    cents = BigInt(wholeRaw) * 100n + BigInt(frac);
  } catch {
    return { ok: false, error: "Valor inválido" };
  }
  if (cents < MIN_CENTS) {
    return { ok: false, error: "Aposta mínima: R$ 1,00" };
  }
  if (cents > MAX_CENTS) {
    return { ok: false, error: "Aposta máxima: R$ 1.000,00" };
  }
  return { ok: true, cents };
}

export function formatBrlFromCents(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  const s = `${whole.toString()},${frac}`;
  return neg ? `-${s}` : s;
}

export const BET_LIMITS = { minCents: MIN_CENTS, maxCents: MAX_CENTS };
