"use client";

import { useState } from "react";

const REQUIRED = process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD;
const STORAGE_KEY = "traceguard.dashboard.auth";

interface DashboardAuthGateProps {
  children: React.ReactNode;
}

export function DashboardAuthGate({ children }: DashboardAuthGateProps) {
  const [unlocked, setUnlocked] = useState(() => {
    if (!REQUIRED) return true;
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "ok";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (unlocked) return children;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <form
        className="w-full max-w-sm space-y-4 rounded-lg border border-surface-border bg-surface-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (password === REQUIRED) {
            sessionStorage.setItem(STORAGE_KEY, "ok");
            setUnlocked(true);
            return;
          }
          setError("Senha inválida");
        }}
      >
        <div>
          <h1 className="text-lg font-semibold text-white">TraceGuard</h1>
          <p className="text-sm text-gray-500">Acesso ao dashboard</p>
        </div>
        <label className="block text-sm text-gray-400">
          Senha
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded border border-surface-border bg-surface px-3 py-2 text-white"
          />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          className="w-full rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
