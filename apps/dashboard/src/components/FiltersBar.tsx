"use client";

import { LEVEL_OPTIONS } from "../lib/format";

export interface FilterValues {
  service: string;
  level: string;
}

interface FiltersBarProps {
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
  services: string[];
}

export function FiltersBar({ filters, onChange, services }: FiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={filters.service}
        onChange={(e) =>
          onChange({ ...filters, service: e.target.value })
        }
        className="rounded-md border border-surface-border bg-surface-card px-3 py-2 text-sm text-gray-200"
      >
        <option value="">Todos os serviços</option>
        {services.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={filters.level}
        onChange={(e) => onChange({ ...filters, level: e.target.value })}
        className="rounded-md border border-surface-border bg-surface-card px-3 py-2 text-sm text-gray-200"
      >
        {LEVEL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
