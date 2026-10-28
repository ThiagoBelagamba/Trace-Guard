"use client";

import { useState } from "react";
import { Card } from "./ui/Card";
import { Button, Field } from "./ui/Controls";
import { Icon } from "./ui/Icon";

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
    <div className="flex min-h-screen items-center justify-center bg-tg-bg px-4">
      <Card as="div" className="w-full max-w-sm">
        <form
          className="flex flex-col gap-5"
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-tg-border-strong bg-tg-surface-3 text-tg-text">
              <Icon name="logo" size={18} />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="m-0 text-[15px] font-semibold tracking-[-0.01em]">TraceGuard</h1>
              <p className="m-0 text-xs text-tg-text-3">Acesso ao dashboard</p>
            </div>
          </div>
          <Field
            label="Senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error ? true : undefined}
          />
          {error && (
            <p role="alert" className="m-0 text-[13px] text-tg-error-text">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full">
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
