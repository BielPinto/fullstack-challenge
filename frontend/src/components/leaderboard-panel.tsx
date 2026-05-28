import { useQuery } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gamesApi, type LeaderboardPeriod } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  myUserId?: string;
};

function labelUser(userId: string, myUserId?: string): string {
  if (myUserId && userId === myUserId) {
    return "Você";
  }
  return `${userId.slice(0, 6)}…${userId.slice(-4)}`;
}

export function LeaderboardPanel({ myUserId }: Props): ReactElement {
  const [period, setPeriod] = useState<LeaderboardPeriod>("24h");

  const query = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => gamesApi.leaderboard(period, 10),
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>Top lucro líquido (apostas finalizadas).</CardDescription>
        <div className="flex gap-2 pt-2">
          {(["24h", "7d"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                period === p
                  ? "bg-[var(--color-brand-mint)]/20 text-[var(--color-brand-mint)]"
                  : "bg-white/5 text-zinc-400 hover:text-zinc-200",
              )}
            >
              {p === "24h" ? "24h" : "7 dias"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading && <p className="text-sm text-zinc-500">Carregando…</p>}
        {!query.isLoading && (query.data?.items.length ?? 0) === 0 && (
          <p className="text-sm text-zinc-500">Nenhum jogador com lucro no período.</p>
        )}
        <ol className="space-y-2">
          {(query.data?.items ?? []).map((entry) => (
            <li
              key={entry.userId}
              className={cn(
                "flex items-center justify-between rounded-xl border px-3 py-2 text-sm",
                myUserId === entry.userId
                  ? "border-[var(--color-brand-mint)]/40 bg-[var(--color-brand-mint)]/5"
                  : "border-white/[0.06] bg-white/[0.02]",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-6 shrink-0 font-mono text-zinc-500">#{entry.rank}</span>
                <span className="truncate font-medium text-zinc-100">
                  {labelUser(entry.userId, myUserId)}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono font-bold text-emerald-300">+R$ {entry.profit}</p>
                <p className="text-[10px] text-zinc-500">{entry.betCount} apostas</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
