"use client";

import { LEVEL_OPTIONS } from "../lib/format";
import { Select } from "./ui/Controls";

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
    <>
      <Select
        label="Filtrar por serviço"
        value={filters.service}
        onChange={(service) => onChange({ ...filters, service })}
        options={[
          { value: "", label: "Todos os serviços" },
          ...services.map((s) => ({ value: s, label: s })),
        ]}
      />
      <Select
        label="Filtrar por nível"
        value={filters.level}
        onChange={(level) => onChange({ ...filters, level })}
        options={LEVEL_OPTIONS}
      />
    </>
  );
}
