import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { toast } from "sonner";

import { useAuthStore } from "@/auth/auth-store";
import { getUserManager } from "@/auth/user-manager";
import { BetsFeed } from "@/components/bets-feed";
import { CrashMultiplierChart } from "@/components/crash-multiplier-chart";
import { GameShell } from "@/components/game-shell";
import { LeaderboardPanel } from "@/components/leaderboard-panel";
import { RoundHistoryBar } from "@/components/round-history-bar";
import { RoundVerifyDialog } from "@/components/round-verify-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGameSocket } from "@/hooks/use-game-socket";
import { ApiError, gamesApi, walletsApi } from "@/lib/api";
import { decodeJwtPayload } from "@/lib/jwt";
import { multiplierToNumber } from "@/lib/multiplier";
import { parseBrlToCents } from "@/lib/money";
import { roundDtoToWsState } from "@/lib/round-mapper";
import { useGameRealtimeStore } from "@/stores/game-realtime-store";

function useCountdown(isoDeadline: string | null): number | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, []);
  if (!isoDeadline) {
    return null;
  }
  const ms = new Date(isoDeadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

export default function GamePage(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const token = user?.access_token ?? null;
  const accessSub = token ? decodeJwtPayload(token)?.sub : undefined;
  const username =
    (user?.profile?.preferred_username as string | undefined) ??
    (user?.profile?.name as string | undefined) ??
    accessSub?.slice(0, 8);

  const queryClient = useQueryClient();
  const applyRoundState = useGameRealtimeStore((s) => s.applyRoundState);
  const round = useGameRealtimeStore((s) => s.round);
  const multiplierSeries = useGameRealtimeStore((s) => s.multiplierSeries);
  const lastCrash = useGameRealtimeStore((s) => s.lastCrash);

  const { connected } = useGameSocket(!!token);

  const walletQuery = useQuery({
    queryKey: ["wallet", accessSub],
    enabled: !!token,
    queryFn: async () => {
      try {
        return await walletsApi.me(token!);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          await walletsApi.create(token!);
          return walletsApi.me(token!);
        }
        throw e;
      }
    },
  });

  const historyQuery = useQuery({
    queryKey: ["round-history"],
    queryFn: () => gamesApi.history(0, 20),
    refetchInterval: 20_000,
  });

  const roundQuery = useQuery({
    queryKey: ["round-rest"],
    queryFn: () => gamesApi.currentRound(),
    staleTime: 5_000,
    refetchInterval: connected ? false : 8000,
  });

  useEffect(() => {
    const d = roundQuery.data;
    if (!d) {
      return;
    }
    const cur = useGameRealtimeStore.getState().round;
    if (!cur || cur.id !== d.id) {
      applyRoundState(roundDtoToWsState(d));
    }
  }, [roundQuery.data, applyRoundState]);

  const phase = round?.phase ?? "BETTING";
  const countdown = useCountdown(phase === "BETTING" ? (round?.bettingEndsAt ?? null) : null);
  const currentMult = multiplierToNumber(round?.currentMultiplier ?? null);
  const crashedVisual = phase === "SETTLED" || !!lastCrash;

  const myBet = useMemo(() => {
    if (!round || !accessSub) {
      return null;
    }
    return (
      round.bets.find((b) => b.userId === accessSub && (b.status === "ACTIVE" || b.status === "DEBIT_PENDING")) ??
      null
    );
  }, [round, accessSub]);

  const stakeNumber = myBet ? Number(myBet.amount.replace(",", ".")) : 0;
  const potentialPayout = stakeNumber > 0 && phase === "RUNNING" ? stakeNumber * currentMult : null;

  const [stakeInput, setStakeInput] = useState("10");
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [autoCashoutInput, setAutoCashoutInput] = useState("2.00");
  const [verifyRoundId, setVerifyRoundId] = useState<string | null>(null);

  const betMutation = useMutation({
    mutationFn: async () => {
      const parsed = parseBrlToCents(stakeInput);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      const autoTarget =
        autoCashoutEnabled && autoCashoutInput.trim() ? autoCashoutInput.trim() : undefined;
      return gamesApi.placeBet(parsed.cents.toString(), token!, autoTarget);
    },
    onSuccess: () => {
      toast.success("Aposta registrada");
      void queryClient.invalidateQueries({ queryKey: ["wallet", accessSub] });
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        toast.error(e.message);
        return;
      }
      const msg = e instanceof Error ? e.message : "Falha na aposta";
      toast.error(msg);
    },
  });

  const cashMutation = useMutation({
    mutationFn: () => gamesApi.cashout(token!),
    onSuccess: () => {
      toast.success("Cash out confirmado");
      void queryClient.invalidateQueries({ queryKey: ["wallet", accessSub] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Falha no cash out";
      toast.error(msg);
    },
  });

  const handleLogout = async (): Promise<void> => {
    try {
      await getUserManager().removeUser();
      useAuthStore.getState().setUser(null);
    } catch {
      useAuthStore.getState().setUser(null);
    }
  };

  return (
    <GameShell
      username={username}
      wallet={walletQuery.data}
      walletLoading={walletQuery.isLoading}
      wsConnected={connected}
      onLogout={handleLogout}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Curva do crash</CardTitle>
            <CardDescription className="space-y-2">
              <p>
                Commit da rodada (antes do run):{" "}
                <span className="break-all font-mono text-[11px] text-zinc-300">{round?.commitHash ?? "—"}</span>
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                <span>
                  Client seed:{" "}
                  <span className="font-mono text-zinc-300">{round?.clientSeed ?? "—"}</span>
                </span>
                <span>
                  Nonce: <span className="font-mono text-zinc-300">{round?.nonce ?? "—"}</span>
                </span>
              </p>
              <p className="text-[10px] leading-relaxed text-zinc-500">
                Após o crash, o server secret é revelado — clique em uma rodada no histórico para verificar.
              </p>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CrashMultiplierChart series={multiplierSeries} crashed={crashedVisual} />
            <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
              <span>
                Fase: <strong className="text-zinc-200">{phase}</strong>
              </span>
              {phase === "BETTING" && countdown !== null && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-zinc-200">
                  apostas fecham em {countdown}s
                </span>
              )}
              {phase === "RUNNING" && (
                <span>
                  multiplicador ao vivo:{" "}
                  <strong className="text-[var(--color-brand-mint)]">{currentMult.toFixed(2)}×</strong>
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Controles</CardTitle>
            <CardDescription>Aposte na fase de apostas; saque durante a subida.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                id="auto-cashout"
                type="checkbox"
                checked={autoCashoutEnabled}
                onChange={(e) => setAutoCashoutEnabled(e.target.checked)}
                disabled={phase !== "BETTING"}
                className="rounded border-white/20"
              />
              <label htmlFor="auto-cashout" className="text-xs font-medium text-zinc-400">
                Auto cashout em
              </label>
              <Input
                inputMode="decimal"
                value={autoCashoutInput}
                onChange={(e) => setAutoCashoutInput(e.target.value)}
                disabled={!autoCashoutEnabled || phase !== "BETTING"}
                className="h-8 w-20 px-2 text-sm"
                aria-label="Multiplicador alvo"
              />
              <span className="text-xs text-zinc-500">×</span>
            </div>
            <div>
              <label htmlFor="stake" className="mb-1 block text-xs font-medium text-zinc-400">
                Valor (R$)
              </label>
              <Input
                id="stake"
                inputMode="decimal"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                disabled={phase !== "BETTING" || betMutation.isPending}
              />
              <p className="mt-1 text-[10px] text-zinc-500">Mín. R$ 1,00 · máx. R$ 1.000,00</p>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={phase !== "BETTING" || betMutation.isPending || !token}
              onClick={() => betMutation.mutate()}
            >
              Apostar
            </Button>
            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3 text-sm">
              {potentialPayout != null && myBet ? (
                <p className="text-zinc-300">
                  Pagamento potencial:{" "}
                  <span className="font-mono font-bold text-[var(--color-brand-mint)]">
                    R$ {potentialPayout.toFixed(2).replace(".", ",")}
                  </span>
                </p>
              ) : (
                <p className="text-zinc-500">Faça uma aposta para ver o payout potencial na subida.</p>
              )}
            </div>
            <Button
              type="button"
              variant="mint"
              className="w-full"
              disabled={phase !== "RUNNING" || !myBet || cashMutation.isPending}
              onClick={() => cashMutation.mutate()}
            >
              Cash out
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Apostas da rodada</CardTitle>
            <CardDescription>Atualização em tempo real via WebSocket.</CardDescription>
          </CardHeader>
          <CardContent>
            <BetsFeed bets={round?.bets ?? []} myUserId={accessSub} />
          </CardContent>
        </Card>

        <LeaderboardPanel myUserId={accessSub} />

        <Card>
          <CardHeader>
            <CardTitle>Histórico (~20)</CardTitle>
            <CardDescription>Últimos crash points — clique para verificar provably fair.</CardDescription>
          </CardHeader>
          <CardContent>
            <RoundHistoryBar
              items={historyQuery.data?.items ?? []}
              loading={historyQuery.isLoading}
              onRoundClick={setVerifyRoundId}
            />
          </CardContent>
        </Card>
      </div>

      <RoundVerifyDialog
        roundId={verifyRoundId}
        open={verifyRoundId !== null}
        onClose={() => setVerifyRoundId(null)}
      />
    </GameShell>
  );
}
