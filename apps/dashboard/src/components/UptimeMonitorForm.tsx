"use client";

import { useState } from "react";
import type { CreateUptimeMonitorInput } from "@traceguard/shared";
import { Card, CardHeader } from "./ui/Card";
import { Button, Field } from "./ui/Controls";

interface UptimeMonitorFormProps {
  onSubmit: (data: CreateUptimeMonitorInput) => Promise<void>;
  onClose: () => void;
}

export function UptimeMonitorForm({ onSubmit, onClose }: UptimeMonitorFormProps) {
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
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="div">
      <form
        id="uptime-monitor-form"
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-col gap-[18px]"
      >
        <CardHeader title="Novo monitor HTTP" />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_160px]">
          <Field
            label="Nome"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Field
            label="URL"
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <Field
            label="Intervalo em segundos"
            type="number"
            min={10}
            value={intervalSec}
            onChange={(e) => setIntervalSec(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Criando…" : "Criar monitor"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
