# Redesign do dashboard TraceGuard — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o visual de `traceguard-redesign/` ao `apps/dashboard` sem alterar busca de dados, WebSocket ou estado de domínio.

**Architecture:** Tokens CSS globais mapeados no Tailwind; primitivas em `src/components/ui/`; cálculos de apresentação (percentuais, parse de mensagem HTTP, origem do alerta, tons) como funções puras em `src/lib/view.ts`, testadas com Vitest; componentes de tela reescritos sobre as primitivas. Barras/proporções em HTML/CSS, linhas em Recharts restilizado.

**Tech Stack:** Next 15, React 19, Tailwind 3.4, Recharts 2.15, Vitest 3.2, `next/font/google` (Geist, Geist_Mono).

**Spec:** `docs/superpowers/specs/2026-10-27-dashboard-redesign-design.md` (+ `traceguard-redesign/DESIGN.md`, `tokens.css`, `screens/*.html` como referência visual)

## Global Constraints

- Não tocar: `apps/dashboard/src/lib/api.ts`, `apps/dashboard/src/hooks/useTelemetrySocket.ts`, `packages/**`, `apps/backend/**`, SDK.
- Nenhuma dependência nova. Ícones = SVG inline com os paths de `screens/*.html`.
- Nenhuma informação nova na tela; só percentuais e somas de dados existentes.
- Valores de cor/raio/fonte só via tokens `--tg-*` (cópia exata de `traceguard-redesign/tokens.css`). Exceções literais permitidas pelo DESIGN.md: `#202024` (item ativo do segmentado), `#111113` (texto do botão primário), `#1A1A1E` (botão secundário), `#D6D6DA` (segmento sólido de acionáveis).
- Sem sombras, gradientes decorativos ou glow; única textura = hachura.
- Dados técnicos (hora, trace id, ms, IP, path, score, %) em fonte mono.
- Alvos clicáveis ≥ 40px de altura; `:focus-visible` com outline 2px `--tg-text-2` offset 2px.
- Gráficos com `role="img"` + `aria-label`; ícones `aria-hidden="true"`.
- Copy em pt-BR, sentence case.
- Commits **sem** linhas de assinatura/atribuição (`Co-Authored-By`, "Generated with…") — instrução do usuário.

## Review Focus

- Zero dados (stats vazias, `timeline` com 0 ou 1 ponto, nenhum alerta/ameaça/monitor): nada quebra, divisões por zero rendem `0%`, aparecem estados vazios → testes de `percentOf`/`barScale` (Task 2) com total 0.
- Muitas categorias (4 níveis, 6 tipos de ameaça): barras cabem sem overflow horizontal → `orderLevels` com 4 níveis (Task 2) + inspeção visual Task 9.
- Mensagens fora do padrão HTTP (ex.: `"Pedido criado"`, `"HTTP"` sozinho) mostram a mensagem inteira sem tag → testes de `parseHttpMessage` (Task 2).
- Alerta sem `metadata` ou com metadata vazia → ícone genérico → teste de `alertSource` (Task 2).
- Largura ~400px: sidebar empilha, tabelas rolam dentro do card, sem scroll horizontal da página → verificação Task 9.

---

## File Structure

```
apps/dashboard/
  tailwind.config.js                 MODIFY  cores tg.*, fontes, raios; remove surface.* (Task 8)
  src/app/globals.css                MODIFY  tokens, pills, .tg-table, foco, reduced-motion
  src/app/layout.tsx                 MODIFY  next/font Geist + Geist_Mono
  src/lib/labels.ts                  CREATE  THREAT_LABELS único
  src/lib/view.ts                    CREATE  funções puras de apresentação
  src/lib/view.test.ts               CREATE  testes Vitest
  src/lib/format.ts                  MODIFY  remove levelBadgeClass/severityBadgeClass ao fim (Task 8)
  src/components/ui/Icon.tsx         CREATE
  src/components/ui/Card.tsx         CREATE  Card, CardHeader, TableCard, LiveIndicator
  src/components/ui/Controls.tsx     CREATE  Chip, Pill, Button, Select, Field, SegmentedControl
  src/components/ui/EmptyState.tsx   CREATE
  src/components/ui/VerticalBars.tsx CREATE
  src/components/ui/ProportionBar.tsx CREATE
  src/components/ui/LineChartCard.tsx CREATE  (Recharts)
  src/components/Sidebar.tsx         CREATE
  src/components/PageHeader.tsx      CREATE
  src/components/{DashboardView,ConnectionStatus,FiltersBar,EventCharts,EventTable,
     AlertStatsBanner,AlertsPanel,RaspStatsCharts,RaspPanel,UptimeMonitorForm,
     UptimePanel,UptimeTimeline,TraceDrawer,DashboardAuthGate}.tsx   MODIFY
vitest.config.ts                     MODIFY  inclui apps/dashboard/src/lib/**/*.test.ts
```

---

### Task 1: Fundação (tokens, Tailwind, fontes, Vitest)

**Files:**
- Modify: `apps/dashboard/src/app/globals.css`, `apps/dashboard/tailwind.config.js`, `apps/dashboard/src/app/layout.tsx`, `vitest.config.ts`

**Interfaces:**
- Produces: variáveis `--tg-*`; classes `.tg-pill`, `.tg-pill--error|threat|warn|level`, `.tg-pill--info` (cor `--tg-info-text`, bg `rgb(143 168 214 / .12)`, borda `/ .24`), `.tg-pill--neutral` (cor `--tg-text-2`, bg `--tg-surface-3`, borda `--tg-border-strong`), `.tg-pill--ok` (cor `--tg-ok`, bg `rgb(127 184 148 / .12)`, borda `/ .24`), `.tg-table` (estilos de `.tg-t` das referências: th 12px/500 `--tg-text-3` padding 12px 20px borda `--tg-border`; td 14px 20px borda `--tg-border-subtle` cor `#D4D4D8`; última linha sem borda; hover `--tg-hover`), `.tg-hatch` (`background: var(--tg-hatch)`). Tailwind: `bg-tg-bg`, `bg-tg-surface`, `text-tg-text-2`, `border-tg-border-strong` etc. (chave `tg` com sub-chaves = nome do token sem prefixo, ex. `tg.surface-2`, `tg.error-fill`), `font-sans`/`font-mono` → `var(--tg-font)`/`var(--tg-mono)`, `rounded-tg-sm|md|lg|xl`.
- Mantém `surface.*` no Tailwind até a Task 8 (componentes antigos ainda usam).

- [ ] **Step 1:** Em `globals.css`, após as diretivas `@tailwind`, colar o `:root` de `tokens.css` com `--tg-font: var(--font-geist), system-ui, sans-serif;` e `--tg-mono: var(--font-geist-mono), ui-monospace, monospace;`; classes de pill de `tokens.css` + `--info`/`--neutral`; `.tg-table`; `.tg-hatch`; `body { background: var(--tg-bg); color: var(--tg-text); font-family: var(--tg-font); -webkit-font-smoothing: antialiased }`; `:focus-visible` (constraint global); `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important } }`. Remover `@apply bg-surface ...`.
- [ ] **Step 2:** `layout.tsx`: `import { Geist, Geist_Mono } from "next/font/google"`; `Geist({ subsets: ["latin"], weight: ["400","500","600"], variable: "--font-geist" })`, `Geist_Mono({ subsets: ["latin"], weight: ["400","500"], variable: "--font-geist-mono" })`; classes `${geist.variable} ${geistMono.variable}` no `<html>`.
- [ ] **Step 3:** `tailwind.config.js` com o mapeamento acima.
- [ ] **Step 4:** `vitest.config.ts`: adicionar `"apps/dashboard/src/lib/**/*.test.ts"` ao `include`.
- [ ] **Step 5:** Run `pnpm --filter @traceguard/dashboard build` → Expected: build OK. (Se `next/font/google` falhar por falta de rede, registrar e seguir; o fallback `system-ui` mantém a build.)
- [ ] **Step 6:** Commit: `git add apps/dashboard vitest.config.ts && git commit -m "feat(dashboard): add redesign tokens, fonts and tailwind mapping"`

---

### Task 2: Funções puras de apresentação

**Files:**
- Create: `apps/dashboard/src/lib/labels.ts`, `apps/dashboard/src/lib/view.ts`, `apps/dashboard/src/lib/view.test.ts`

**Interfaces:**
- Produces (`labels.ts`): `export const THREAT_LABELS: Record<string, string>` com `rate_limit: "Rate limit", bot_user_agent: "Bot UA", sequential_scan: "Varredura", missing_headers: "Headers ausentes"`; `export function threatLabel(type: string): string` (fallback = type).
- Produces (`view.ts`):
  - `export type Tone = "error" | "warn" | "info" | "threat" | "ok" | "neutral"`
  - `percentOf(value: number, total: number): number` — inteiro arredondado; `total <= 0` → `0`.
  - `barScale(values: number[]): number` — `max(values) * 1.07`, `0` se vazio/todos 0.
  - `parseHttpMessage(message: string): { method: string; rest: string } | null` — regex `/^HTTP (\w+) (.+)$/`.
  - `alertSource(metadata: Record<string, unknown> | undefined): "uptime" | "rasp" | "generic"` — `monitorId` presente → uptime; `raspCount` presente → rasp.
  - `levelTone(level: string): Tone` — error→error, warn→warn, info→info, outros→neutral.
  - `orderLevels(byLevel: Record<string, number>): Array<{ level: string; count: number }>` — ordem error, warn, info, debug, depois desconhecidos; omite chaves ausentes.
  - `threatTone(type: string): Tone` — sequential_scan → threat; outros → neutral.
  - `uptimeTone(status: string | undefined): Tone` — up→ok, degraded→warn, down→error, undefined→neutral.
  - `countByLevel(events: { level: string }[]): Record<string, number>`.

- [ ] **Step 1: Escrever testes** em `view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { alertSource, barScale, countByLevel, orderLevels, parseHttpMessage, percentOf, threatTone, uptimeTone, levelTone } from "./view";

describe("percentOf", () => {
  it("arredonda", () => expect(percentOf(15, 18)).toBe(83));
  it("total zero vira 0", () => expect(percentOf(0, 0)).toBe(0));
});
describe("barScale", () => {
  it("dá folga de 7%", () => expect(barScale([15, 3])).toBeCloseTo(16.05));
  it("vazio vira 0", () => { expect(barScale([])).toBe(0); expect(barScale([0, 0])).toBe(0); });
});
describe("parseHttpMessage", () => {
  it("extrai método", () => expect(parseHttpMessage("HTTP GET http://localhost/unreachable failed"))
    .toEqual({ method: "GET", rest: "http://localhost/unreachable failed" }));
  it("ignora mensagens comuns", () => { expect(parseHttpMessage("Pedido criado")).toBeNull(); expect(parseHttpMessage("HTTP")).toBeNull(); });
});
describe("alertSource", () => {
  it("uptime", () => expect(alertSource({ monitorId: "m1", url: "x" })).toBe("uptime"));
  it("rasp", () => expect(alertSource({ raspCount: 5 })).toBe("rasp"));
  it("genérico sem metadata", () => { expect(alertSource(undefined)).toBe("generic"); expect(alertSource({})).toBe("generic"); });
});
describe("orderLevels", () => {
  it("ordena 4 níveis", () => expect(orderLevels({ info: 3, debug: 1, error: 15, warn: 2 }).map((l) => l.level))
    .toEqual(["error", "warn", "info", "debug"]));
  it("omite ausentes", () => expect(orderLevels({ info: 3 })).toEqual([{ level: "info", count: 3 }]));
});
describe("tons", () => {
  it("threat", () => { expect(threatTone("sequential_scan")).toBe("threat"); expect(threatTone("bot_user_agent")).toBe("neutral"); });
  it("uptime", () => { expect(uptimeTone("up")).toBe("ok"); expect(uptimeTone(undefined)).toBe("neutral"); });
  it("level", () => expect(levelTone("debug")).toBe("neutral"));
});
it("countByLevel", () => expect(countByLevel([{ level: "error" }, { level: "error" }, { level: "info" }]))
  .toEqual({ error: 2, info: 1 }));
```

- [ ] **Step 2:** Run `pnpm test -- apps/dashboard/src/lib/view.test.ts` → Expected: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `labels.ts` e `view.ts` com as assinaturas acima.
- [ ] **Step 4:** Run `pnpm test` → Expected: tudo PASS (incluindo suítes existentes).
- [ ] **Step 5:** Commit: `feat(dashboard): add presentation helpers for redesign`

---

### Task 3: Primitivas de UI

**Files:**
- Create: `apps/dashboard/src/components/ui/{Icon,Card,Controls,EmptyState,VerticalBars,ProportionBar,LineChartCard}.tsx`

**Interfaces:**
- Consumes: `Tone`, `percentOf`, `barScale` (Task 2).
- Produces:
  - `Icon({ name, size = 16, className })` — `name: "pulse" | "events" | "bell" | "shield" | "activity" | "clock" | "chevron-down" | "plus" | "alert" | "server" | "check" | "x-circle" | "gauge" | "close"`; paths copiados das referências (quando a referência não tiver o ícone, usar estilo Lucide, stroke 1.8, round). Sempre `aria-hidden`.
  - `Card({ as?: "section" | "div", className?, children, ...aria })` — `bg-tg-surface border border-tg-border rounded-tg-xl p-5` (20px; 22px horizontal).
  - `CardHeader({ title: ReactNode, meta?: ReactNode, id?: string })` — h2 14px/500 + meta à direita.
  - `TableCard({ title, meta?, children })` — card padding 0, header `px-5 py-4 border-b`, corpo `overflow-x-auto`.
  - `LiveIndicator({ live: boolean })` — ponto `--tg-ok` + "Ao vivo" / ponto `--tg-text-3` + "Pausado".
  - `Chip({ icon?: IconName, children })` — 12px, borda `--tg-border-strong`, raio 7px.
  - `Pill({ tone: Tone, mono?: boolean, icon?: IconName, children })` — classes `.tg-pill .tg-pill--{tone}`; `mono` → `.tg-pill--level` + uppercase.
  - `Button({ variant: "primary" | "secondary" | "destructive", size?: "md" | "sm", icon?, ...buttonProps })` — md 40px raio 9px; sm 32px raio 7px.
  - `Select({ label: string (aria-label), value, onChange, options: {value,label}[] })` — 40px, chevron absoluto.
  - `Field({ label, ...inputProps })` — label visível 13px `--tg-text-2` + input 40px `bg-tg-sidebar border-tg-border-strong rounded-tg-md`.
  - `SegmentedControl<T>({ label, value: T, onChange, items: {value: T; label: string; count?: number}[] })` — `role="tablist"`, botões `role="tab"` `aria-selected`, trilho `bg-tg-sidebar p-[3px]`, ativo `bg-[#202024] border-tg-border-strong`, altura 34px dentro de trilho de 40px.
  - `EmptyState({ children })` — `py-12 text-center text-sm text-tg-text-2`; `<code>` interno em mono `text-tg-text`.
  - `VerticalBars({ items: {key: string; label: string; value: number; tone: Tone}[], ariaLabel: string, height?: number = 250, monoLabels?: boolean })` — trilho `.tg-hatch` raio 10px borda `#1F1F23`; preenchimento absoluto bottom, altura `value/barScale` em %, `min-height: 76px` se `value > 0`, cor `--tg-{tone}-fill` + `border-top --tg-{tone}-line` (neutral: `#26262B` / `#3A3A41`), número 24–26px cor clara do tom (error `#F2CFCB`, info `#CFDCF2`, threat `#DDD6F5`, warn `--tg-warn-text`, neutral `--tg-text`), `%` mono 12px = `percentOf(value, soma)`; com ≥ 5 itens número 20px e padding 10px; rótulo 12–13px centralizado, `break-words`.
  - `ProportionBar({ segments: {key: string; value: number; style: "hatch" | "solid" | Tone}[], ariaLabel: string, height?: number = 12 })` — `flex gap-1`, `flex: value 1 0`; segmentos de valor 0 omitidos; hatch = `repeating-linear-gradient(135deg, #222226 0 4px, #18181B 4px 8px)` borda `#26262B`; solid = `#D6D6DA`; tone = fill + borda line.
  - `LineChartCard({ data: {label: string; value: number}[], height?: number = 200, unit?: string, ariaLabel: string, tooltipName: string })` — Recharts `ResponsiveContainer > AreaChart`; `<defs><pattern id={useId()} ...>` hachura stroke `#26262B`; `Area type="linear" stroke="var(--tg-chart-line)" strokeWidth={2} fill="url(#id)"`; `dot` customizado renderiza só no último índice (círculo r=5 preenchido `--tg-chart-line`); `activeDot` r=4; `CartesianGrid vertical={false} strokeDasharray="3 5" stroke="var(--tg-chart-grid)"`; eixos `tick={{ fill: "#85858D", fontSize: 11, fontFamily: "var(--tg-mono)" }}`, `axisLine={{ stroke: "var(--tg-chart-axis)" }}`, `tickLine={false}`, YAxis `allowDecimals={false}` width 40 com `unit`; Tooltip `contentStyle` bg `--tg-surface-2`, borda `--tg-border-strong`, raio 8, `labelStyle`/`itemStyle` cor `--tg-text`, fonte mono 12px, cursor stroke `--tg-border-strong`. Wrapper `<div role="img" aria-label>`.

- [ ] **Step 1:** Implementar os arquivos acima.
- [ ] **Step 2:** Run `pnpm --filter @traceguard/dashboard build` → Expected: OK (primitivas ainda não usadas compilam).
- [ ] **Step 3:** Commit: `feat(dashboard): add redesign ui primitives`

---

### Task 4: Shell — sidebar, header de página, layout, carregamento

**Files:**
- Create: `apps/dashboard/src/components/Sidebar.tsx`, `apps/dashboard/src/components/PageHeader.tsx`
- Modify: `apps/dashboard/src/components/DashboardView.tsx`, `apps/dashboard/src/components/ConnectionStatus.tsx`

**Interfaces:**
- Consumes: `Icon`, `Button`, `Chip` (Task 3); `countByLevel`, `orderLevels` (Task 2).
- Produces:
  - `export type Tab = "events" | "alerts" | "security" | "uptime"` (movido para `Sidebar.tsx`, importado pelo `DashboardView`).
  - `Sidebar({ tab: Tab, onTabChange: (t: Tab) => void, actionableAlerts: number, connected: boolean, error: string | null, eventCount: number })`.
  - `ConnectionStatus` mantém as props atuais (`connected, error, eventCount`) e vira o card do rodapé da sidebar.
  - `PageHeader({ section: string, icon: IconName, crumb?: string, title: string, summary: ReactNode, actions?: ReactNode })`.
  - Estado novo de UI no `DashboardView`: `const [monitorFormOpen, setMonitorFormOpen] = useState(false)` (consumido na Task 7).

- [ ] **Step 1:** `Sidebar`: `<nav aria-label="Navegação principal">` flex 1 1 232px, `bg-tg-sidebar border-r border-[#1F1F23] px-3.5 py-5 flex flex-col gap-7`; logo tile 32px raio 9px com ícone pulse; "TraceGuard" 15px/600 + "Observabilidade em tempo real" 12px `--tg-text-3`; 4 `<button>` 40px raio 8 (ativo: `bg-tg-surface-3 border-[#27272C] text-tg-text`, `aria-current="page"`; inativo: `text-tg-text-2 border-transparent hover:text-tg-text`); badge mono em Alertas apenas se `actionableAlerts > 0`; `<ConnectionStatus>` em `mt-auto`.
- [ ] **Step 2:** `ConnectionStatus`: card `p-3.5 rounded-tg-lg bg-tg-surface border-tg-border`; ponto 8px `--tg-ok` (conectado, com anel `0 0 0 3px rgb(127 184 148 / .15)` — único "halo" permitido, vem da referência) ou `--tg-error` (desconectado); texto "WebSocket conectado"/"Reconectando…"; linha "Eventos recebidos" + número mono; `error` em 12px `--tg-error-text`.
- [ ] **Step 3:** `PageHeader`: breadcrumb (ícone + `section` + opcional `<span class="text-[#4A4A52]">/</span>{crumb}`) com `pb-3.5 border-b border-tg-border-subtle min-h-8 text-[13px] text-tg-text-3`; linha flex-wrap `items-end justify-between gap-4`: H1 28px/600 tracking `-0.02em` + `<p>` 14px `--tg-text-2` com `summary`; `actions` à direita.
- [ ] **Step 4:** `DashboardView`: substituir `<header>` + abas por wrapper `min-h-screen flex flex-wrap bg-tg-bg` com `<Sidebar>` e `<main className="flex-[999_1_560px] min-w-0 px-10 pt-5 pb-12 flex flex-col gap-6">` (padding horizontal 16px abaixo de `sm`). Cada aba renderiza seu `PageHeader` com os resumos do spec (Eventos via `countByLevel(filteredEvents)` + `orderLevels`, só níveis > 0, rótulos "erros"/"warn"/"info"/"debug"; Alertas; Segurança com soma de `byThreatType` e `Chip icon="clock"` "Últimas 24h"; Uptime "{monitors} monitor(es) · {down} fora do ar"). `actionableAlerts = alerts.filter(a => !a.suppressed).length` (useMemo). Carregamento: mesmo wrapper de tela cheia, texto centralizado `text-tg-text-2` "Carregando dashboard…". Lógica de fetch/WS/filtros intacta. Temporariamente passar os componentes de aba como estão.
- [ ] **Step 5:** Run build → OK. Abrir `pnpm dev:dashboard` e conferir sidebar + troca de abas.
- [ ] **Step 6:** Commit: `feat(dashboard): add sidebar shell and page headers`

---

### Task 5: Aba Eventos

**Files:**
- Modify: `apps/dashboard/src/components/{FiltersBar,EventCharts,EventTable,DashboardView}.tsx`

**Interfaces:**
- Consumes: `Select`, `Card`, `CardHeader`, `Chip`, `TableCard`, `LiveIndicator`, `Pill`, `EmptyState`, `VerticalBars`, `LineChartCard` (Task 3); `orderLevels`, `levelTone`, `parseHttpMessage` (Task 2).
- Produces: `FiltersBar` mesmas props; `EventCharts({ stats })` mesmas props; `EventTable({ events, onSelectTrace, live: boolean })` (prop `live` nova, recebe `connected`).

- [ ] **Step 1:** `FiltersBar` → dois `Select` (aria-labels "Filtrar por serviço", "Filtrar por nível"), passado como `actions` do `PageHeader`.
- [ ] **Step 2:** `EventCharts` → `flex flex-wrap gap-4`: card flex `2 1 520px` com `CardHeader title="Eventos por período" meta={<Chip icon="clock">24h</Chip>}`; destaque `{último.count}` 34px/600 + "eventos no último período" + mono "anterior: {penúltimo.count}" (bloco omitido se `timeline` vazio; "anterior" omitido se < 2 pontos); `LineChartCard` com `label: formatTime(bucket)`, `ariaLabel` listando os 2 últimos pontos; vazio → `EmptyState` "Sem eventos nas últimas 24h.". Card flex `1 1 300px` "Distribuição por nível", meta mono "{soma} eventos", `VerticalBars` com `orderLevels(stats.byLevel)`, `monoLabels`; vazio → `EmptyState` "Sem dados".
- [ ] **Step 3:** `EventTable` → `TableCard title="Eventos recentes" meta={<LiveIndicator live={live} />}`; corpo `max-h-[420px] overflow-auto`, `thead` sticky `bg-tg-surface`, `<table className="tg-table min-w-[880px]">`, `th scope="col"`; colunas Hora (mono `--tg-text-2`), Level (`Pill tone={levelTone} mono`), Service (quadrado 6px raio 2 `#6B6B73` + nome), Trace ID (botão mono `--tg-text-3` hover `--tg-text`, `title` mantido, min-h 40px não exigido dentro de célula mas área clicável = célula inteira com `py-3`), Mensagem (tag mono "HTTP {método}" `text-[11px] bg-tg-surface-3 border-[#26262A] rounded-[5px] px-1.5 mr-2` + `rest`, senão mensagem; `max-w-md truncate`), ms (mono direita). Vazio → `TableCard` com `EmptyState`: "Nenhum evento recebido. Execute <code>pnpm dev:demo</code> para gerar telemetria."
- [ ] **Step 4:** Build OK; conferir com `pnpm dev` + `pnpm dev:demo` lado a lado com `screens/eventos.html`.
- [ ] **Step 5:** Commit: `feat(dashboard): redesign events tab`

---

### Task 6: Abas Alertas e Segurança

**Files:**
- Modify: `apps/dashboard/src/components/{AlertStatsBanner,AlertsPanel,RaspStatsCharts,RaspPanel}.tsx`

**Interfaces:**
- Consumes: primitivas (Task 3); `alertSource`, `percentOf`, `threatTone` (Task 2); `threatLabel` (Task 2). Props públicas inalteradas.

- [ ] **Step 1:** `AlertStatsBanner` → `Card as="section" aria-labelledby="fadiga"`: linha flex-wrap gap-6 com bloco flex `2 1 320px` (h2 com ícone shield "Mitigação de fadiga"; `{suppressionRate}%` 44px/600 tracking `-0.03em` + "do total suprimido por cooldown") e dois stats flex `1 1 160px` `bg-tg-surface-2 rounded-tg-lg p-4` ("Suprimidos" / "Acionáveis · 24h", 28px). Abaixo `ProportionBar` `[suppressed: hatch, fired: solid]`, ariaLabel "{x}% suprimidos, {y}% acionáveis", legenda "Ruído suprimido" / "Acionáveis" 12px. Sem dados (`fired === 0 && suppressed === 0`) → card com h2 + `EmptyState` "Nenhum alerta registrado nas últimas 24h.".
- [ ] **Step 2:** `AlertsPanel` → `TableCard`-like `Card` padding 0, header com "Fila de alertas" + `SegmentedControl` (Acionáveis/count, Ruído filtrado/count) ligado ao `showSuppressed` existente. `<ul>` itens `flex flex-wrap items-center gap-4 px-5 py-[18px] border-b border-tg-border-subtle`: tile 40px raio 10 `bg-tg-surface-3` com ícone `pulse|shield|alert` por `alertSource(alert.metadata)`; coluna: `Pill tone={severity==="critical"?"error":"warn"} mono` + (se suprimido `Pill tone="neutral"` "suprimido") + h3 15px/500 título; mensagem 13px `--tg-text-2`; "Regra: {ruleName} · {eventCount} eventos" 12px `--tg-text-3`; à direita chip 12px `{service}` + hora mono. Suprimido → `opacity-70`. Vazios: textos atuais em `EmptyState` (com `<code>pnpm dev:demo:stress</code>`).
- [ ] **Step 3:** `RaspStatsCharts` → dois cards flex `1 1 380px`. "Ameaças por tipo" meta mono "{total} total", `VerticalBars` com `threatLabel`/`threatTone`. "Bloqueados vs registrados" meta mono "24h": grid 2 colunas de stats (quadrado 8px `--tg-error`/`--tg-info`, rótulo, número 36px + `%` mono), `ProportionBar` height 44 `[blocked: error, logged: info]`, escala mono `0 / round(total/2) / total`. PieChart removido. Vazios → `EmptyState` "Sem dados".
- [ ] **Step 4:** `RaspPanel` → `TableCard title="Detecções RASP" meta={<LiveIndicator live />}` (recebe nova prop `live: boolean`, passada como `connected` no `DashboardView`), `tg-table min-w-[900px]`; colunas Hora, IP (mono), Ameaça (`Pill tone="threat"` com `threatLabel`), Ação (blocked → `Pill tone="error" icon="shield"` "blocked"; logged → `Pill tone="info"` "logged"), Score (mono + barra 48×4px trilho `#26262B` preenchida `--tg-text-2` com largura `min(score,100)%`), Path (mono `--tg-text-2`, "{method} {path}", truncate 220px), Trace (botão mono `slice(0,8)…`). Vazio: texto atual em `EmptyState`.
- [ ] **Step 5:** Build OK; conferir com `pnpm dev:demo:stress`, `pnpm dev:demo-api` + `pnpm demo:scrape` vs. `alertas.html` / `seguranca.html`.
- [ ] **Step 6:** Commit: `feat(dashboard): redesign alerts and security tabs`

---

### Task 7: Aba Uptime

**Files:**
- Modify: `apps/dashboard/src/components/{UptimeMonitorForm,UptimePanel,UptimeTimeline,DashboardView}.tsx`

**Interfaces:**
- Consumes: primitivas; `uptimeTone`; `monitorFormOpen` (Task 4).
- Produces: `UptimeMonitorForm({ onSubmit, onClose: () => void })` — renderiza sempre o form aberto (o estado `open` interno sai; quem decide é o `DashboardView`). `onSubmit` inalterado; após sucesso chama `onClose()`.

- [ ] **Step 1:** `DashboardView` (aba uptime): `PageHeader actions={<Button variant="primary" icon="plus" onClick={() => setMonitorFormOpen(true)} aria-expanded={monitorFormOpen}>Novo monitor</Button>}`; `{monitorFormOpen && <UptimeMonitorForm onSubmit={...mesmo de hoje} onClose={() => setMonitorFormOpen(false)} />}`.
- [ ] **Step 2:** `UptimeMonitorForm` → `Card` com `CardHeader title="Novo monitor HTTP"`, grid responsivo de `Field` (Nome, URL `type="url" placeholder="https://..."`, Intervalo em segundos `type="number" min=10`), botões `primary` "Criar monitor" (`"Criando…"` quando `saving`) e `secondary` "Cancelar" (`onClose`).
- [ ] **Step 3:** `UptimePanel` → grid `repeat(auto-fit, minmax(min(100%,200px),1fr)) gap-3` de stat cards (rótulo 13px + valor 32px; tile 48px raio 12 com ícone; Up com ponto `--tg-ok`; Down com ponto `--tg-error`, valor `#F2CFCB`, tile `bg-[#2A1E1D] border-[#4A302D] text-tg-error-text`; Latência "{avg}<span 16px>ms</span>"). `TableCard title="Monitores" meta="{n} de {n}"` com `tg-table min-w-[900px]`: Nome (ponto 8px `uptimeTone`), URL mono, Status (`Pill tone=uptimeTone` com o status ou "—"), Latência mono, Uptime 24h (mono % + barra 72×4 preenchida `--tg-ok` com largura = pct), Último check mono, Ações à direita (`Button size="sm" variant="secondary"` Pausar/Ativar, `variant="destructive"` Remover). Estado vazio atual em `Card` + `EmptyState` (stat cards não aparecem, como hoje).
- [ ] **Step 4:** `UptimeTimeline` → `Card` com header ("Latência dos probes" + subtítulo 12px "Últimos checks"; legenda à direita: traço 14×2 `--tg-chart-line` + nomes únicos de `monitorName` unidos por ", ") e `LineChartCard unit="ms"` com os mesmos dados de hoje (`value: latencyMs ?? 0`). Vazio → `EmptyState` texto atual.
- [ ] **Step 5:** Build OK; criar, pausar e remover um monitor no app rodando e comparar com `uptime.html`.
- [ ] **Step 6:** Commit: `feat(dashboard): redesign uptime tab`

---

### Task 8: Telas fora da referência + limpeza

**Files:**
- Modify: `apps/dashboard/src/components/{TraceDrawer,DashboardAuthGate}.tsx`, `apps/dashboard/src/lib/format.ts`, `apps/dashboard/tailwind.config.js`

- [ ] **Step 1:** `TraceDrawer` → overlay `bg-black/60`; `<aside role="dialog" aria-modal="true" aria-labelledby>` `max-w-xl bg-tg-surface border-l border-tg-border`; header: "Trace" 12px `--tg-text-3`, id mono 13px `break-all`, meta mono 12px, `Button variant="secondary" size="sm"` "Fechar"; itens APM `bg-tg-surface-2 border-tg-border rounded-tg-lg p-3` com `Pill tone=levelTone mono` + hora mono + mensagem + linha mono `--tg-text-3`; itens RASP `border-tg-threat-line bg-tg-threat-fill/40` com `Pill tone="threat"` "RASP · {threatLabel}"; carregando/erro em `--tg-text-2`/`--tg-error-text`. Fechar com `Escape` não existe hoje — não adicionar (escopo). Lógica de fetch intacta.
- [ ] **Step 2:** `DashboardAuthGate` → tela `bg-tg-bg`; `Card` max-w-sm: tile do logo + "TraceGuard" + "Acesso ao dashboard"; `Field label="Senha" type="password"`; erro `--tg-error-text`; `Button variant="primary"` largura total "Entrar". Lógica intacta.
- [ ] **Step 3:** Remover `levelBadgeClass`/`severityBadgeClass` de `format.ts` (e o import de `clsx` se ficar sem uso) e a paleta `surface` do Tailwind. Run `rg "surface-|bg-surface|levelBadgeClass|severityBadgeClass|emerald-|purple-|amber-|red-[0-9]|blue-[0-9]|gray-[0-9]" apps/dashboard/src` → Expected: sem resultados.
- [ ] **Step 4:** Build OK; `pnpm test` PASS.
- [ ] **Step 5:** Commit: `feat(dashboard): restyle trace drawer and auth gate, remove legacy palette`

---

### Task 9: Verificação visual final

- [ ] **Step 1:** Subir infra + `pnpm dev`, `pnpm dev:demo:stress`, `pnpm dev:demo-api`, `pnpm demo:scrape`; com `NEXT_PUBLIC_DASHBOARD_PASSWORD` definido checar a tela de senha.
- [ ] **Step 2:** Em 1440px, comparar cada aba com o `screens/*.html` correspondente (abrir os dois lado a lado); abrir o drawer de trace a partir de Eventos e Segurança.
- [ ] **Step 3:** Em ~400px: sidebar empilhada, sem scroll horizontal da página, tabelas rolando dentro do card, barras com 4–6 categorias legíveis.
- [ ] **Step 4:** Teclado: Tab percorre nav → ações → tabela com foco visível; segmentado Acionáveis/Ruído alterna com Enter/Espaço.
- [ ] **Step 5:** Estado vazio: banco sem dados (ou backend fora) não quebra nenhuma aba.
- [ ] **Step 6:** Corrigir o que divergir (commits `fix(dashboard): ...`), sem assinatura.
