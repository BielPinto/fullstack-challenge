/** Display-only parse of server multiplier strings (e.g. "1.420000"). */
export function multiplierToNumber(s: string | null | undefined): number {
  if (s == null || s === "") {
    return 1;
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Color for history pills: cold (low) → hot (high). */
export function crashMultiplierHeat(mult: number): "low" | "mid" | "high" {
  if (mult < 1.5) {
    return "low";
  }
  if (mult < 3) {
    return "mid";
  }
  return "high";
}
