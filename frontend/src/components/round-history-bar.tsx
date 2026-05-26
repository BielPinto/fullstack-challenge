import type { ReactElement } from "react";
import { crashMultiplierHeat, multiplierToNumber } from "@/lib/multiplier";
import { cn } from "@/lib/utils";

type RoundHistoryItemDto = {
  id: string;
  crashMultiplier: string;
  settledAt: string;
};

type Props = {
  items: RoundHistoryItemDto[];
  loading?: boolean;
};

export function RoundHistoryBar({ items, loading }: Props): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {loading
        ? Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-8 w-14 animate-pulse rounded-lg bg-white/5" />
          ))
        : items.map((r) => {
            const m = multiplierToNumber(r.crashMultiplier);
            const heat = crashMultiplierHeat(m);
            return (
              <div
                key={r.id}
                title={new Date(r.settledAt).toLocaleString()}
                className={cn(
                  "rounded-lg px-2 py-1 font-mono text-xs font-bold tabular-nums",
                  heat === "low" && "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30",
                  heat === "mid" && "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30",
                  heat === "high" && "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/35",
                )}
              >
                {m.toFixed(2)}×
              </div>
            );
          })}
    </div>
  );
}
