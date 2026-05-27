import type { ReactElement } from "react";
import type { RoundHistoryItemDto } from "@/lib/api";
import { crashMultiplierHeat, multiplierToNumber } from "@/lib/multiplier";
import { cn } from "@/lib/utils";

type Props = {
  items: RoundHistoryItemDto[];
  loading?: boolean;
  onRoundClick?: (roundId: string) => void;
};

export function RoundHistoryBar({ items, loading, onRoundClick }: Props): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {loading
        ? Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-8 w-14 animate-pulse rounded-lg bg-white/5" />
          ))
        : items.map((r) => {
            const m = multiplierToNumber(r.crashMultiplier);
            const heat = crashMultiplierHeat(m);
            const label = new Date(r.settledAt).toLocaleString();
            const chipClass = cn(
              "rounded-lg px-2 py-1 font-mono text-xs font-bold tabular-nums transition-colors",
              heat === "low" && "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30",
              heat === "mid" && "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30",
              heat === "high" && "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/35",
              onRoundClick && "cursor-pointer hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-mint)]",
            );
            if (onRoundClick) {
              return (
                <button
                  key={r.id}
                  type="button"
                  title={`${label} — clique para verificar`}
                  className={chipClass}
                  onClick={() => onRoundClick(r.id)}
                >
                  {m.toFixed(2)}×
                </button>
              );
            }
            return (
              <div key={r.id} title={label} className={chipClass}>
                {m.toFixed(2)}×
              </div>
            );
          })}
    </div>
  );
}
