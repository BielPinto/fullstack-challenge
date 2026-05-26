import { useEffect } from "react";
import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { getUserManager } from "@/auth/user-manager";
import AuthCallbackPage from "@/pages/auth-callback-page";
import GamePage from "@/pages/game-page";
import LoginPage from "@/pages/login-page";

function Protected({ children }: { children: ReactElement }): ReactElement {
  const user = useAuthStore((s) => s.user);
  if (!user || user.expired) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AuthBootstrap(): null {
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  useEffect(() => {
    void getUserManager()
      .getUser()
      .then((u) => {
        setUser(u);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setHydrated(true);
      });
  }, [setUser, setHydrated]);
  return null;
}

function HydrationGate({ children }: { children: ReactElement }): ReactElement {
  const hydrated = useAuthStore((s) => s.hydrated);
  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-zinc-500">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[var(--color-brand-mint)]" />
      </div>
    );
  }
  return children;
}

export default function App(): ReactElement {
  return (
    <>
      <AuthBootstrap />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route
            path="/"
            element={
              <HydrationGate>
                <Protected>
                  <GamePage />
                </Protected>
              </HydrationGate>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
