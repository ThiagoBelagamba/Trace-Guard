import type { ReactNode } from "react";

/** Mensagem de vazio dentro de um card. `<code>` interno vira comando em mono. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 px-5 py-12 text-center text-sm text-tg-text-2 [&_code]:rounded-[5px] [&_code]:border [&_code]:border-[#26262A] [&_code]:bg-tg-surface-3 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-tg-text">
      {children}
    </p>
  );
}
