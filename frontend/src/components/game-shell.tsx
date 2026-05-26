import { Coins, LogOut, Radio, Wallet } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { WalletDto } from "@/lib/api";

type Props = {
  username: string | undefined;
  wallet?: WalletDto | null;
  wsConnected: boolean;
  walletLoading?: boolean;
  onLogout: () => void;
  children: ReactNode;
};

export function GameShell({
  username,
  wallet,
  wsConnected,
  walletLoading,
  onLogout,
  children,
}: Props): ReactElement {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-4 pb-10 pt-6 md:px-8">
      <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-brand-iris)] to-[var(--color-brand-ember)] shadow-lg">
            <Coins className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">Jungle Crash</h1>
            <p className="text-xs text-zinc-500">Multiplicador em tempo real · provably fair</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
            title="Conexão WebSocket com o game service"
          >
            <Radio className={wsConnected ? "h-4 w-4 text-emerald-400" : "h-4 w-4 text-zinc-500"} />
            <span className="text-zinc-400">{wsConnected ? "Ao vivo" : "Reconectando…"}</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <Wallet className="h-4 w-4 text-[var(--color-brand-mint)]" />
            <div className="text-sm">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Saldo</p>
              {walletLoading ? (
                <p className="font-mono text-base text-zinc-400">…</p>
              ) : (
                <p className="font-mono text-base font-semibold text-white">
                  R$ {wallet?.balance.replace(".", ",") ?? "—"}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Jogador</p>
            <p className="max-w-[140px] truncate font-medium text-zinc-100">{username ?? "—"}</p>
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={onLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      {children}
    </div>
  );
}
