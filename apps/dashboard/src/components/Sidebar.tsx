"use client";

import clsx from "clsx";
import { ConnectionStatus } from "./ConnectionStatus";
import { Icon, type IconName } from "./ui/Icon";

export type Tab = "events" | "alerts" | "security" | "uptime";

export const TAB_META: Record<Tab, { label: string; icon: IconName }> = {
  events: { label: "Eventos", icon: "events" },
  alerts: { label: "Alertas", icon: "bell" },
  security: { label: "Segurança", icon: "shield" },
  uptime: { label: "Uptime", icon: "pulse" },
};

const TABS: Tab[] = ["events", "alerts", "security", "uptime"];

interface SidebarProps {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  actionableAlerts: number;
  connected: boolean;
  error: string | null;
  eventCount: number;
}

export function Sidebar({
  tab,
  onTabChange,
  actionableAlerts,
  connected,
  error,
  eventCount,
}: SidebarProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="box-border flex flex-[1_1_232px] flex-col gap-7 border-b border-r-0 border-[#1F1F23] bg-tg-sidebar px-3.5 py-5 min-[800px]:max-w-[232px] min-[800px]:border-b-0 min-[800px]:border-r"
    >
      <div className="flex items-center gap-2.5 px-2 py-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-tg-border-strong bg-tg-surface-3 text-tg-text">
          <Icon name="logo" size={18} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">TraceGuard</span>
          <span className="text-xs text-tg-text-3">Observabilidade em tempo real</span>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        {TABS.map((t) => {
          const active = t === tab;
          const meta = TAB_META[t];
          return (
            <button
              key={t}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onTabChange(t)}
              className={clsx(
                "flex min-h-10 items-center gap-2.5 rounded-tg-md border px-2.5 text-left text-sm",
                active
                  ? "border-[#27272C] bg-tg-surface-3 text-tg-text"
                  : "border-transparent text-tg-text-2 hover:text-tg-text"
              )}
            >
              <Icon name={meta.icon} />
              {meta.label}
              {t === "alerts" && actionableAlerts > 0 && (
                <span className="ml-auto rounded-tg-sm bg-[#232327] px-[7px] py-px font-mono text-[11px] text-[#D4D4D8]">
                  {actionableAlerts}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-auto">
        <ConnectionStatus connected={connected} error={error} eventCount={eventCount} />
      </div>
    </nav>
  );
}
