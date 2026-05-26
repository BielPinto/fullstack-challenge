import { useEffect } from "react";
import type { ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { getUserManager } from "@/auth/user-manager";

export default function LoginPage(): ReactElement {
  const navigate = useNavigate();
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    void getUserManager()
      .getUser()
      .then((u) => {
        if (u && !u.expired) {
          navigate("/", { replace: true });
        }
      })
      .catch(() => {
        /* unauthenticated */
      });
  }, [hydrated, navigate]);

  const login = (): void => {
    void getUserManager().signinRedirect();
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-zinc-500">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[var(--color-brand-mint)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">Jungle Crash</h1>
        <p className="mt-3 text-zinc-400">
          Entre com sua conta Keycloak (OIDC + PKCE) para jogar. Usuário de teste:{" "}
          <span className="font-mono text-zinc-200">player</span> /{" "}
          <span className="font-mono text-zinc-200">player123</span>
        </p>
      </div>
      <button
        type="button"
        onClick={login}
        className="rounded-xl bg-gradient-to-r from-[var(--color-brand-ember)] to-orange-500 px-10 py-3 text-lg font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-110 active:scale-[0.99]"
      >
        Entrar com Keycloak
      </button>
    </div>
  );
}
