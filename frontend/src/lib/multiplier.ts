export function multiplierToNumber(s: string | null | undefined): number {
  if (s == null || s === "") {
    return 1;
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function crashMultiplierHeat(mult: number): "low" | "mid" | "high" {
  if (mult < 1.5) {
    return "low";
  }
  if (mult < 3) {
    return "mid";
  }
  return "high";
}
