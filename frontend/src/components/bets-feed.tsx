import type { ReactElement } from "react";

import type { WsBetPayloadV1 } from "@/lib/game-ws-events";
import { cn } from "@/lib/utils";

type Props = {
  bets: WsBetPayloadV1[];
  myUserId?: string;
};

function labelFor(uid: string, myUserId?: string): string {
  if (myUserId && uid === myUserId) {
    return "Você";
  }
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

export function BetsFeed({ bets, myUserId }: Props): ReactElement {
  const sorted = [...bets].sort((a, b) => {
    const score = (s: string): number => {
      if (s === "ACTIVE") {
        return 0;
      }
      if (s === "DEBIT_PENDING") {
        return 1;
      }
      if (s === "CASHED_OUT") {
        return 2;
      }
      return 3;
    };
    return score(a.status) - score(b.status);
  });

  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
      {sorted.length === 0 && (
        <li className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-zinc-500">
          Nenhuma aposta nesta rodada.
        </li>
      )}
      {sorted.map((b) => {
        const mine = myUserId === b.userId;
        const cashed = b.status === "CASHED_OUT";
        const active = b.status === "ACTIVE" || b.status === "DEBIT_PENDING";
        return (
          <li
            key={b.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
              mine && "border-[var(--color-brand-mint)]/40 bg-[var(--color-brand-mint)]/5",
              !mine && "border-white/[0.06] bg-white/[0.02]",
              cashed && "ring-1 ring-emerald-500/30",
            )}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-zinc-100">{labelFor(b.userId, myUserId)}</p>
              <p className="text-xs text-zinc-500">
                R$ {b.amount.replace(".", ",")} ·{" "}
                <span
                  className={cn(
                    active && "text-[var(--color-brand-mint)]",
                    cashed && "text-emerald-300",
                    b.status === "LOST" && "text-rose-300",
                  )}
                >
                  {b.status === "CASHED_OUT" && b.cashoutMultiplier
                    ? `Saque ${b.cashoutMultiplier}×`
                    : b.status}
                </span>
              </p>
            </div>
            {b.payout && <span className="shrink-0 font-mono text-emerald-300">+R$ {b.payout}</span>}
          </li>
        );
      })}
    </ul>
  );
}
