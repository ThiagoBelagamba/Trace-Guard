import type { ReactNode } from "react";
import { Icon, type IconName } from "./ui/Icon";

interface PageHeaderProps {
  section: string;
  icon: IconName;
  crumb?: string;
  title: string;
  summary: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ section, icon, crumb, title, summary, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-[22px]">
      <div className="flex min-h-8 items-center gap-2 border-b border-tg-border-subtle pb-3.5 text-[13px] text-tg-text-3">
        <Icon name={icon} size={15} />
        {section}
        {crumb && (
          <>
            <span className="text-[#4A4A52]" aria-hidden="true">
              /
            </span>
            {crumb}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
          <p className="mb-0 mt-2 text-sm text-tg-text-2 [&_strong]:font-semibold [&_strong]:text-tg-text">
            {summary}
          </p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
