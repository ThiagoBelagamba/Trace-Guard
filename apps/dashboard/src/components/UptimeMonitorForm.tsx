"use client";

import { useState } from "react";
import type { CreateUptimeMonitorInput } from "@traceguard/shared";

interface UptimeMonitorFormProps {
  onSubmit: (data: CreateUptimeMonitorInput) => Promise<void>;
}

export function UptimeMonitorForm({ onSubmit }: UptimeMonitorFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [intervalSec, setIntervalSec] = useState(60);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ name, url, intervalSec });
      setName("");
      setUrl("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-900/50 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-900/70"
      >
        + Novo monitor
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-lg border border-surface-border bg-surface-card p-4 space-y-3"
    >
      <h3 className="text-sm font-medium text-gray-300">Novo monitor HTTP</h3>
      <input
        type="text"
        placeholder="Nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full rounded border border-surface-border bg-surface-bg px-3 py-2 text-sm text-gray-200"
      />
      <input
        type="url"
        placeholder="https://..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        className="w-full rounded border border-surface-border bg-surface-bg px-3 py-2 text-sm text-gray-200"
      />
      <label className="flex items-center gap-2 text-sm text-gray-400">
        Intervalo (s)
        <input
          type="number"
          min={10}
          value={intervalSec}
          onChange={(e) => setIntervalSec(Number(e.target.value))}
          className="w-24 rounded border border-surface-border bg-surface-bg px-2 py-1 text-gray-200"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Criar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
