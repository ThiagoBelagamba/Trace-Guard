# Redesign do dashboard — correções pendentes da revisão — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver os 9 itens menores que a revisão final do redesign deixou para depois, sem mudar dados nem lógica de domínio.

**Architecture:** Duas funções puras novas em `apps/dashboard/src/lib/view.ts` (topo do eixo Y e rótulo de monitores ativos), cobertas por Vitest. O resto são ajustes de marcação e acessibilidade nos componentes do redesign e a troca das fontes do Google por arquivos locais.

**Tech Stack:** Next 15, React 19, Tailwind 3.4, Recharts 2.15, Vitest 3.2, `next/font/local`.

**Spec:** `docs/superpowers/specs/2026-10-27-dashboard-redesign-design.md` (redesign original) + a lista de itens adiados da revisão final, reproduzida abaixo como fonte deste plano.

| # | Item adiado | Task |
|---|---|---|
| 1 | Badge de Alertas (lista carregada) diverge do cabeçalho (`alertStats.fired`, 24h) | 3 |
| 2 | Último ponto do gráfico de linha cortado quando está no topo do eixo Y | 1 |
| 3 | Controle segmentado usa `tablist`/`tab` sem `tabpanel` nem setas | 3 |
| 4 | Barra com valor 0 não mostra "0" nem "0%" | 1 |
| 5 | Meta "N de N" dos monitores pode mostrar "3 de 2" até as stats atualizarem | 2 |
| 6 | Foco não entra no formulário de monitor ao abrir nem volta ao botão ao fechar | 2 |
| 7 | `next/font/google` exige internet na build | 5 |
| 8 | Botões de trace ID com área clicável de ~18px | 4 |
| 9 | `truncate` direto em `<td>` pode não gerar reticências | 4 |

## Global Constraints

- Trabalhar na branch existente `feature/dashboard-redesign`.
- Não tocar: `apps/dashboard/src/lib/api.ts`, `apps/dashboard/src/hooks/useTelemetrySocket.ts`, `packages/**`, `apps/backend/**`.
- Nenhuma dependência npm nova (o pacote `geist` só é baixado para extrair os `.woff2`; não entra no `package.json`).
- Nenhuma informação nova na tela; só derivados de dados existentes.
- Valores visuais só via tokens `--tg-*`; alvos clicáveis ≥ 40px de altura.
- **Não rodar `next build`**: ele sobrescreve o `.next` do `pnpm dev` do usuário. Checagem de tipos: `pnpm --filter @traceguard/dashboard exec tsc --noEmit`. Checagem visual: no dev server em `http://localhost:3000` (hot reload), com o script de print em CDP usado no redesign.
- Commits **sem** linhas de assinatura/atribuição (`Co-Authored-By`, "Generated with…").
- Copy em pt-BR, sentence case.

## Review Focus

- Gráfico com todos os valores 0 (ex.: latência 0 em todos os checks) → eixo Y com topo 1, linha no chão, marcador visível → teste `chartYMax(0)` (Task 1).
- Lista de monitores vazia ou toda pausada → rótulo "0 de N ativos" sem quebrar → teste `activeMonitorsLabel` com lista vazia e todos pausados (Task 2).
- Cancelar o formulário com teclado (Tab até "Cancelar" + Enter) devolve o foco ao botão "Novo monitor" → verificação via CDP `document.activeElement` (Task 2).
- Badge com 0 alertas nas 24h some, em vez de mostrar "0" → verificação visual com `alertStats.fired === 0` (Task 3, inspeção do código: condição `> 0` mantida).
- Build sem internet: fontes carregam de arquivo local → `rg "next/font/google" apps/dashboard/src` vazio (Task 5).

---

## File Structure

```
apps/dashboard/src/lib/view.ts              MODIFY  + chartYMax, activeMonitorsLabel
apps/dashboard/src/lib/view.test.ts         MODIFY  testes das duas funções
apps/dashboard/src/components/ui/LineChartCard.tsx   MODIFY  domínio do eixo Y
apps/dashboard/src/components/ui/VerticalBars.tsx    MODIFY  rótulo para valor 0
apps/dashboard/src/components/ui/Controls.tsx        MODIFY  SegmentedControl → aria-pressed
apps/dashboard/src/components/UptimePanel.tsx        MODIFY  meta "N de N ativos"
apps/dashboard/src/components/UptimeMonitorForm.tsx  MODIFY  id + autoFocus
apps/dashboard/src/components/DashboardView.tsx      MODIFY  badge = alertStats.fired; foco de volta ao botão
apps/dashboard/src/components/EventTable.tsx         MODIFY  hit area trace; truncate em div
apps/dashboard/src/components/RaspPanel.tsx          MODIFY  hit area trace; truncate em div
apps/dashboard/src/app/fonts/*.woff2 + OFL.txt       CREATE  Geist e Geist Mono variáveis
apps/dashboard/src/app/layout.tsx                    MODIFY  next/font/local
```

---

### Task 1: Gráficos e barras (itens 2 e 4)

**Files:**
- Modify: `apps/dashboard/src/lib/view.ts`, `apps/dashboard/src/lib/view.test.ts`, `apps/dashboard/src/components/ui/LineChartCard.tsx`, `apps/dashboard/src/components/ui/VerticalBars.tsx`

**Interfaces:**
- Produces: `chartYMax(dataMax: number): number` — topo do eixo Y com 15% de folga, arredondado para cima; `dataMax <= 0` → `1`.

- [ ] **Step 1: Testes** em `view.test.ts`:

```ts
describe("chartYMax", () => {
  it("dá 15% de folga e arredonda para cima", () => expect(chartYMax(15)).toBe(18));
  it("valor exato no topo ganha folga", () => expect(chartYMax(20)).toBe(23));
  it("sem dados vira 1", () => { expect(chartYMax(0)).toBe(1); expect(chartYMax(-3)).toBe(1); });
});
```

- [ ] **Step 2:** Run `pnpm test -- apps/dashboard/src/lib/view.test.ts` → Expected: FAIL (`chartYMax is not a function`).
- [ ] **Step 3:** Implementar `chartYMax` em `view.ts`. No `LineChartCard`, passar `domain={[0, chartYMax]}` ao `YAxis` (o Recharts chama a função com o `dataMax`).
- [ ] **Step 4:** No `VerticalBars`, quando `item.value === 0` e `total > 0`, renderizar no fundo do trilho (sem preenchimento) um bloco com o mesmo padding mostrando `0` (cor `--tg-text-3`, mesmo `fontSize` de `barValueFontSize`) e `0%` em mono 12px `--tg-text-3`.
- [ ] **Step 5:** Run `pnpm test` → Expected: todas PASS. Run `pnpm --filter @traceguard/dashboard exec tsc --noEmit` → Expected: sem erros.
- [ ] **Step 6:** Print da aba Eventos em `http://localhost:3000` (1440px) → Expected: o último ponto aparece inteiro, com halo, abaixo do topo do gráfico.
- [ ] **Step 7:** Commit: `fix(dashboard): add y-axis headroom and label zero-value bars`

---

### Task 2: Uptime — contador de monitores e foco do formulário (itens 5 e 6)

**Files:**
- Modify: `apps/dashboard/src/lib/view.ts`, `apps/dashboard/src/lib/view.test.ts`, `apps/dashboard/src/components/UptimePanel.tsx`, `apps/dashboard/src/components/UptimeMonitorForm.tsx`, `apps/dashboard/src/components/DashboardView.tsx`

**Interfaces:**
- Produces: `activeMonitorsLabel(monitors: Array<{ enabled: boolean }>): string` → `"{ativos} de {total} ativos"`.
- `UptimeMonitorForm` passa a renderizar `<form id="uptime-monitor-form">`; props inalteradas.

- [ ] **Step 1: Testes:**

```ts
describe("activeMonitorsLabel", () => {
  it("conta ativos sobre o total", () =>
    expect(activeMonitorsLabel([{ enabled: true }, { enabled: false }, { enabled: true }])).toBe("2 de 3 ativos"));
  it("todos pausados", () => expect(activeMonitorsLabel([{ enabled: false }])).toBe("0 de 1 ativos"));
  it("lista vazia", () => expect(activeMonitorsLabel([])).toBe("0 de 0 ativos"));
});
```

- [ ] **Step 2:** Run o teste → Expected: FAIL.
- [ ] **Step 3:** Implementar `activeMonitorsLabel`. No `UptimePanel`, a meta do card "Monitores" passa a ser `<Meta>{activeMonitorsLabel(monitors)}</Meta>`. Ela usa só a lista local, então não fica defasada em relação a `stats`.
- [ ] **Step 4:** Foco:
  - `UptimeMonitorForm`: `id="uptime-monitor-form"` no `<form>` e `autoFocus` no campo Nome.
  - `DashboardView`: `const newMonitorButtonRef = useRef<HTMLButtonElement>(null)`; o botão "Novo monitor" ganha `ref` e `aria-controls="uptime-monitor-form"`.
  - O `onClose` do form vira `closeMonitorForm()`, que chama `setMonitorFormOpen(false)` e depois `requestAnimationFrame(() => newMonitorButtonRef.current?.focus())`.
  - `Button` precisa repassar `ref`: no React 19, `ref` chega como prop comum. Basta incluir `ref?: Ref<HTMLButtonElement>` em `ButtonProps` e espalhar `...rest` no `<button>`, o que já acontece.
- [ ] **Step 5:** Run `pnpm test` e o `tsc --noEmit` → Expected: PASS, sem erros.
- [ ] **Step 6:** Via CDP em `:3000`, aba Uptime:
  - clicar em "Novo monitor" → `document.activeElement.labels[0].textContent === "Nome"`;
  - clicar em "Cancelar" → `document.activeElement.textContent.includes("Novo monitor")`.
- [ ] **Step 7:** Commit: `fix(dashboard): accurate monitor count and focus handling for monitor form`

---

### Task 3: Alertas — fonte do badge e controle segmentado (itens 1 e 3)

**Files:**
- Modify: `apps/dashboard/src/components/DashboardView.tsx`, `apps/dashboard/src/components/ui/Controls.tsx`

- [ ] **Step 1:** Badge:
  - No `DashboardView`, `actionableAlerts` passa a ser `alertStats.fired`: o mesmo número do cabeçalho ("N acionáveis…24h") e do stat "Acionáveis · 24h". Remover o `useMemo` antigo.
  - As contagens dentro do controle segmentado continuam contando a lista carregada (descrevem a fila exibida), como já fazem.
- [ ] **Step 1b (pedido do usuário):** para o badge acompanhar a fila ao vivo:
  - No `DashboardView`, tirar `fetchAlertStats` do intervalo de 30s.
  - Criar um `setInterval` próprio, também condicionado a `connected`, com `const ALERT_STATS_REFRESH_MS = 10_000` no topo do arquivo, chamando `fetchAlertStats().then(setAlertStats).catch(console.error)`.
  - As demais stats continuam a cada 30s.
- [ ] **Step 2:** `SegmentedControl`:
  - Trocar `role="tablist"` por `role="group"` com o mesmo `aria-label`.
  - Os botões perdem `role="tab"`/`aria-selected` e ganham `aria-pressed={active}`.
  - Visual e props inalterados.
- [ ] **Step 3:** Run o `tsc --noEmit` → sem erros. Run `rg "role=\"tab" apps/dashboard/src` → Expected: vazio.
- [ ] **Step 4:** Print da aba Alertas em `:3000` → Expected: o badge da sidebar igual ao número em negrito de "acionáveis" no cabeçalho; o segmentado com a mesma aparência.
- [ ] **Step 5:** Commit: `fix(dashboard): align alerts badge with 24h stats and use toggle buttons in segmented control`

---

### Task 4: Tabelas — área clicável do trace e reticências (itens 8 e 9)

**Files:**
- Modify: `apps/dashboard/src/components/EventTable.tsx`, `apps/dashboard/src/components/RaspPanel.tsx`, `apps/dashboard/src/components/UptimePanel.tsx`

- [ ] **Step 1:** Botões de trace ID nas duas tabelas:
  - Adicionar `inline-block py-[11px] -my-[11px] px-1 -mx-1`. A área clicável fica com ≥ 40px de altura e o layout da linha não muda.
  - Manter `title` e o `onClick`.
- [ ] **Step 2:** Reticências:
  - Tirar `max-w-* truncate` dos `<td>` e envolver o conteúdo em `<div className="max-w-md truncate">` (mensagem em Eventos) e `<div className="max-w-[260px] truncate">` (path em Segurança).
  - O `UptimePanel` (URL) recebe o mesmo tratamento: `<div className="max-w-[240px] truncate">`.
- [ ] **Step 3:** Run o `tsc --noEmit` → sem erros.
- [ ] **Step 4:** Via CDP em `:3000`, aba Eventos:
  - `document.querySelector('main table button').getBoundingClientRect().height >= 40`;
  - print 1440 → linhas com a mesma altura de antes.
- [ ] **Step 5:** Commit (inclui `UptimePanel.tsx`): `fix(dashboard): larger trace id hit area and reliable cell truncation`

---

### Task 5: Fontes locais (item 7)

**Files:**
- Create: `apps/dashboard/src/app/fonts/Geist-Variable.woff2`, `apps/dashboard/src/app/fonts/GeistMono-Variable.woff2`, `apps/dashboard/src/app/fonts/OFL.txt`
- Modify: `apps/dashboard/src/app/layout.tsx`

- [ ] **Step 1:** Num diretório vazio do scratchpad:
  - `npm pack geist@1.8.2`, depois extrair o `.tgz`.
  - Copiar `package/dist/fonts/geist-sans/Geist-Variable.woff2`, `package/dist/fonts/geist-mono/GeistMono-Variable.woff2` e o `LICENSE.txt`/`OFL.txt` do pacote para `apps/dashboard/src/app/fonts/`. Os nomes exatos dentro do tarball são conferidos com `tar -tzf`. A licença é a SIL OFL 1.1, que permite redistribuir.
  - O pacote **não** entra no `package.json`.
- [ ] **Step 2:** `layout.tsx`:
  - `import localFont from "next/font/local"`.
  - `localFont({ src: "./fonts/Geist-Variable.woff2", variable: "--font-geist", weight: "100 900", display: "swap" })`.
  - `localFont({ src: "./fonts/GeistMono-Variable.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" })`.
  - Remover o import de `next/font/google`.
- [ ] **Step 3:** Run `rg "next/font/google" apps/dashboard/src` → Expected: vazio. Run o `tsc --noEmit` → sem erros.
- [ ] **Step 4:** Print de qualquer aba em `:3000` → Expected: o texto continua em Geist e os dados em Geist Mono, iguais aos prints anteriores. Checar também `document.fonts.check("12px 'Geist Mono'")` via CDP ou um `getComputedStyle(...).fontFamily` com o nome gerado pelo `next/font`.
- [ ] **Step 5:** Commit (inclui os binários): `build(dashboard): self-host geist fonts for offline builds`

---

### Task 6: Verificação final

- [ ] **Step 1:** Run `pnpm test` → Expected: todas PASS (67 + 6 novos = 73).
- [ ] **Step 2:** Prints em `:3000` das 4 abas em 1440px e de Eventos/Segurança em 400px → Expected: `scrollWidth` igual à largura da janela e nenhuma regressão visual contra os prints do redesign.
- [ ] **Step 3:** `git log main..HEAD --format=%B | rg -i "co-authored|generated with"` → Expected: vazio.
