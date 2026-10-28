import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article";
  flush?: boolean;
}

/** Card base: superfície + borda 1px, raio 14px. `flush` remove o padding (cards de tabela). */
export function Card({ as: Tag = "section", flush = false, className, children, ...rest }: CardProps) {
  return (
    <Tag
      className={clsx(
        "min-w-0 rounded-tg-xl border border-tg-border bg-tg-surface",
        flush ? "overflow-hidden" : "flex flex-col gap-[18px] px-[22px] py-5",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  meta?: ReactNode;
  id?: string;
  subtitle?: ReactNode;
}

export function CardHeader({ title, meta, id, subtitle }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="m-0 flex items-center gap-2 text-sm font-medium text-tg-text">
          {title}
        </h2>
        {subtitle && <span className="text-xs text-tg-text-3">{subtitle}</span>}
      </div>
      {meta}
    </div>
  );
}

/** Texto meta em mono à direita do cabeçalho do card. */
export function Meta({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-tg-text-3">{children}</span>;
}

interface TableCardProps {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}

export function TableCard({ title, meta, children, bodyClassName }: TableCardProps) {
  return (
    <Card flush>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-tg-border px-5 py-4">
        <h2 className="m-0 text-sm font-medium text-tg-text">{title}</h2>
        {meta}
      </div>
      <div className={clsx("overflow-x-auto", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function LiveIndicator({ live }: { live: boolean }) {
  return (
    <span className="inline-flex items-center gap-[7px] text-xs text-tg-text-2">
      <span
        className={clsx("h-1.5 w-1.5 rounded-full", live ? "bg-tg-ok" : "bg-tg-text-3")}
        aria-hidden="true"
      />
      {live ? "Ao vivo" : "Pausado"}
    </span>
  );
}
