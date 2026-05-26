import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { getUserManager } from "@/auth/user-manager";

export default function AuthCallbackPage(): ReactElement {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getUserManager()
      .signinRedirectCallback()
      .then((u) => {
        setUser(u);
        navigate("/", { replace: true });
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Falha no callback OIDC");
      });
  }, [navigate, setUser]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-rose-300">{error}</p>
        <button
          type="button"
          className="text-sm text-zinc-400 underline"
          onClick={() => navigate("/login", { replace: true })}
        >
          Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-zinc-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[var(--color-brand-mint)]" />
      <p>Finalizando login…</p>
    </div>
  );
}
