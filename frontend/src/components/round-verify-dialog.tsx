import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { useEffect, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, gamesApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  roundId: string | null;
  open: boolean;
  onClose: () => void;
};

function SeedRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="space-y-1">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="break-all font-mono text-[11px] text-zinc-200">{value}</dd>
    </div>
  );
}

export function RoundVerifyDialog({ roundId, open, onClose }: Props): ReactElement | null {
  const verifyQuery = useQuery({
    queryKey: ["round-verify", roundId],
    enabled: open && !!roundId,
    queryFn: () => gamesApi.verifyRound(roundId!),
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const data = verifyQuery.data;
  const errorMessage =
    verifyQuery.error instanceof ApiError
      ? verifyQuery.error.message
      : verifyQuery.error instanceof Error
        ? verifyQuery.error.message
        : verifyQuery.isError
          ? "Falha ao carregar verificação"
          : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="round-verify-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[var(--color-surface-card)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="round-verify-title" className="text-lg font-semibold text-white">
              Verificação provably fair
            </h2>
            {roundId && (
              <p className="mt-0.5 break-all font-mono text-[10px] text-zinc-500">{roundId}</p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>

        {verifyQuery.isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-400">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Carregando dados da rodada…
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{errorMessage}</p>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                data.verified
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/35 bg-amber-500/10 text-amber-200",
              )}
            >
              {data.verified ? (
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              ) : (
                <AlertCircle className="size-4 shrink-0" aria-hidden />
              )}
              {data.verified
                ? "Rodada verificada — crash bate com commit e seeds"
                : "Ainda não verificável — aguarde a rodada encerrar (SETTLED)"}
            </div>

            {data.crashMultiplier != null && (
              <p className="text-sm text-zinc-300">
                Crash point:{" "}
                <span className="font-mono font-bold text-[var(--color-brand-mint)]">
                  {data.crashMultiplier}×
                </span>
              </p>
            )}

            <dl className="grid gap-3 sm:grid-cols-2">
              <SeedRow label="Commit hash" value={data.commitHash} />
              <SeedRow label="Client seed" value={data.clientSeed} />
              <SeedRow label="Nonce" value={data.nonce} />
              {data.serverSecret != null ? (
                <SeedRow label="Server secret (revelado)" value={data.serverSecret} />
              ) : (
                <div className="space-y-1 sm:col-span-2">
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Server secret
                  </dt>
                  <dd className="text-sm text-zinc-400">
                    O segredo do servidor só é revelado após a rodada encerrar (fase SETTLED).
                  </dd>
                </div>
              )}
            </dl>

            {data.runDurationMs != null && (
              <p className="text-xs text-zinc-500">
                Duração do run: <span className="font-mono text-zinc-300">{data.runDurationMs} ms</span>
              </p>
            )}

            <p className="text-[11px] leading-relaxed text-zinc-500">
              Confira offline com o guia <code className="text-zinc-400">PROVABLY_FAIR.md</code> e o script{" "}
              <code className="text-zinc-400">scripts/verify-round.ts</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
