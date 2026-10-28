# Redesign do dashboard TraceGuard — design

Data: 2026-10-27 · Escopo: `apps/dashboard` (somente front-end)

## Intenção

Aplicar ao dashboard Next.js o novo visual entregue em `traceguard-redesign/` (DESIGN.md, tokens.css, screens/*.html). O redesign é de apresentação: a aplicação continua buscando os mesmos dados, das mesmas rotas, com o mesmo WebSocket e o mesmo estado. A nova linguagem também é estendida às telas que as referências não desenham.

## Objetivos

- As quatro abas (Eventos, Alertas, Segurança, Uptime) seguem visualmente `screens/*.html`.
- `tokens.css` é a fonte única de cores, raios e fontes.
- Drawer de trace, tela de senha, carregamento, estados vazios e formulário de novo monitor recebem a mesma linguagem.
- Requisitos de acessibilidade do DESIGN.md: contraste 4.5:1, `role="img"` e `aria-label` nos gráficos, ícones decorativos `aria-hidden`, alvos ≥ 40px, foco de teclado visível.

## Não-objetivos

- Nenhuma mudança em `lib/api.ts`, `hooks/useTelemetrySocket.ts`, `packages/shared`, backend ou SDK.
- Nenhuma rota nova. A navegação continua sendo o estado `tab` do `DashboardView`.
- Nenhuma informação nova na tela (regra principal do DESIGN.md).

## Anti-objetivos (falha mesmo que "funcione")

- Copiar números fixos das referências em vez de ligar ao dado real.
- Barras e gráficos que quebram com 1, 3, 4 ou 6 categorias, ou com zero dados.
- Gradiente, glow ou sombra decorativa; cor em títulos e números que não indiquem status.

## Restrições

- Next 15, React 19, Tailwind 3.4, Recharts 2.15 (já instalados). Nenhuma dependência nova.
- Ícones em SVG inline (os mesmos paths das referências). Sem biblioteca de ícones.

## Abordagens consideradas

| | Abordagem | Troca |
|---|---|---|
| A | Todos os gráficos à mão (SVG/CSS) | Máxima fidelidade; perde tooltip, responsividade e escala automática nas linhas |
| B | Tudo em Recharts restilizado | Mantém a lib; barras com hachura e número interno ficam complexas e menos fiéis |
| **C** | **Misto: barras e proporções em HTML/CSS; linhas em Recharts restilizado** | **Escolhida.** Fiel nas barras, preserva tooltip e resize existentes nas linhas |

Escolhida pelo usuário: **C**.

## Decisões tomadas

### Fundação
- `globals.css` recebe as variáveis `--tg-*` de `tokens.css` (sem o `@import` de fontes), as classes `.tg-pill*`, `body { background: var(--tg-bg); color: var(--tg-text) }`, um estilo de `:focus-visible` e `prefers-reduced-motion`.
- `tailwind.config.js`: cores `tg.*` mapeadas para `var(--tg-*)`, `fontFamily.sans/mono` para as variáveis de fonte e `borderRadius` sm/md/lg/xl. A paleta antiga `surface` é removida quando nada mais a usar.
- Fontes: `Geist` e `Geist_Mono` via `next/font/google` no `layout.tsx`, expostas como `--font-geist` e `--font-geist-mono`, e `--tg-font`/`--tg-mono` apontando para elas.

### Layout (DashboardView)
- Wrapper `flex flex-wrap`: `<nav>` da sidebar (flex 1 1 232px) e `<main>` (flex 999 1 560px). Abaixo de ~800px a sidebar empilha.
- Novo componente `Sidebar`: logo, nome e tagline; quatro botões de navegação que chamam `setTab` (`aria-current="page"` no ativo); badge em Alertas com a contagem de alertas acionáveis (`alerts.filter(a => !a.suppressed).length`, o mesmo número do controle segmentado); no rodapé, o `ConnectionStatus` reestilizado como card (ponto verde/vermelho, "WebSocket conectado"/"Reconectando…", "Eventos recebidos" com o número atual `filteredEvents.length` e a mensagem de erro quando houver).
- Novo `PageHeader`: breadcrumb (ícone + seção; Segurança mostra "Segurança / RASP"), H1 de 28px, linha de resumo e um slot de ações à direita.
- Linhas de resumo (só dados existentes):
  - Eventos: `N eventos na sessão · N erros · N info` → contagens de `filteredEvents` por nível; só aparecem os níveis com contagem > 0.
  - Alertas: `{fired} acionáveis · {suppressed} suprimidos por cooldown nas últimas 24h` (de `alertStats`).
  - Segurança: `{soma byThreatType} ameaças nas últimas 24h · {blocked} bloqueadas`.
  - Uptime: `{monitors} monitor(es) · {down} fora do ar`. *(Decisão minha: tirei o "ativo" da referência, porque `stats.monitors` não distingue os pausados.)*

### Primitivas compartilhadas (`components/ui/`)
- `Card`, `CardHeader` (título 14/500 + meta/chip), `TableCard` (padding 0, cabeçalho com borda, classe `.tg-table` com o estilo de `th`/`td`/hover das referências).
- `Chip` (período, com ícone de relógio), `Pill` (error / threat / warn / info / neutral; variante `level` em mono), `Button` (primary / secondary / destructive, altura 40; ações de tabela 32px dentro de uma linha ≥ 40px).
- `VerticalBars`: recebe `{label, value, tone}[]`. Trilho com hachura e preenchimento com altura `value/max`. O máximo é o maior valor ×1.07, para sobrar folga como na referência, e o preenchimento tem altura mínima de 76px para caber o número quando o valor for maior que zero. Valor grande no topo, `%` mono embaixo (valor/total). Funciona com 1 a 6 barras; com 5–6, a fonte e o padding diminuem e o rótulo pode quebrar em duas linhas. Recebe `role="img"` com `aria-label` gerado.
- `ProportionBar`: segmentos `{value, variant: 'hatch' | 'solid' | tone}` com gap de 4px e `aria-label`.
- `Icon`: conjunto de SVGs inline copiados das referências (pulse, bell, shield, activity, clock, chevron, plus etc.), `aria-hidden`.
- `EmptyState`: texto em `--tg-text-2` dentro do card, com o comando em `<code>` mono quando houver.
- `LineChartCard` (Recharts): `AreaChart`/`Area` com `fill="url(#hatch)"` (`<pattern>` em `<defs>`), stroke 2px `--tg-chart-line`, `CartesianGrid` com `strokeDasharray="3 5"` vertical=false, ticks em mono 11px `--tg-text-3`, eixo com `--tg-chart-axis`, `dot` customizado só no último ponto, tooltip escuro com tokens, `aria-label` no wrapper.

### Por tela
- **Eventos**: `FiltersBar` vira dois `<select>` estilizados com chevron no slot de ações do header. Card "Eventos por período" (flex 2) com chip "24h", destaque "{último count} eventos no último período" e "anterior: {penúltimo}" (do `stats.timeline`; some se houver menos de 2 pontos), seguido do `LineChartCard`. Card "Distribuição por nível" (flex 1) com meta "{total} eventos" e `VerticalBars` sobre `stats.byLevel` (tons: error → error, warn → warn, info → info, debug → neutral). `EventTable` vira `TableCard` "Eventos recentes" com o indicador "Ao vivo" (verde se `connected`, cinza com "Pausado" se não). Pill de nível em mono uppercase. Serviço com quadradinho cinza. Trace id mono e clicável (abre o drawer, como hoje). Mensagem: se casar com `^HTTP (\w+) (.*)$`, mostra a tag mono "HTTP {método}" e o restante; senão, a mensagem inteira. `ms` mono à direita. A altura máxima com rolagem interna (420px) e o cabeçalho sticky continuam.
- **Alertas**: `AlertStatsBanner` vira o card "Mitigação de fadiga", com `{suppressionRate}%` a 44px, stats Suprimidos e "Acionáveis · 24h" e um `ProportionBar` (suprimidos hachurado × acionáveis sólido `#D6D6DA`). O estado sem alertas usa o mesmo card com um `EmptyState`. `AlertsPanel` vira o card "Fila de alertas", com controle segmentado (`role="tablist"`) Acionáveis/Ruído filtrado e as contagens. Cada item tem: tile de ícone por origem (`metadata.monitorId` → pulse; `metadata.raspCount` → shield; outros → alerta/triângulo), pill da severidade (critical → error, warning → warn), título, mensagem, "Regra: {ruleName} · {eventCount} eventos", chip `{service}` e hora mono à direita. Itens suprimidos aparecem com opacidade reduzida e a pill neutra "suprimido".
- **Segurança**: chip "Últimas 24h" no header. Card "Ameaças por tipo" com meta "{total} total" e `VerticalBars` (Varredura → threat; os demais → neutral, como na referência; `prompt_injection` e `secret_leak` → threat, porque são ameaças semânticas; rótulos de `THREAT_LABELS`, deduplicados num único módulo `lib/labels.ts`). Card "Bloqueados vs registrados": dois stats com quadradinho error/info, número a 36px e `%` mono, seguidos de um `ProportionBar` (error-fill e info-fill com borda line) e escala mono `0 / meio / total`. O `PieChart` sai. O `RaspPanel` vira o card de tabela "Detecções RASP": hora, IP mono, pill threat com o rótulo, ação (blocked → pill error com ícone de escudo; logged → pill info), score mono com mini barra (largura = score/100, porque o score é limitado a 100 no detector), método e path mono, trace clicável.
- **Uptime**: o botão primário "Novo monitor" vai para as ações do header. Ao clicar, o `UptimeMonitorForm` abre como card logo abaixo do header. O estado de UI `open` sobe para o `DashboardView` (`monitorFormOpen`), e o form recebe `onClose`, que é chamado ao cancelar e depois de um submit bem-sucedido. O `onSubmit` não muda. *(Decisão minha: é o menor ajuste que permite o botão ficar no header.)* Quatro stat cards (Monitors, Up com ponto verde, Down com cor de erro e tile vermelho, Latência média "Nms"). Card de tabela "Monitores" com meta "{n} de {n}", nome com ponto de status (up → ok, degraded → warn, down → error, sem check → cinza), URL mono, pill de status, latência mono, uptime 24h em `%` mono com mini barra, último check mono e botões Pausar/Ativar (secundário) e Remover (destrutivo). Card "Latência dos probes" ("Últimos checks", legenda com os nomes dos monitores presentes) com o `LineChartCard` sobre os mesmos dados de hoje (últimos 30, latência).

### Telas não desenhadas
- **Carregando**: o mesmo layout com o texto "Carregando dashboard…" em `--tg-text-2`, centralizado.
- **DashboardAuthGate**: card centralizado em `--tg-bg`, com logo, "TraceGuard", "Acesso ao dashboard", input de 40px com tokens, botão primário "Entrar" e erro em `--tg-error-text`.
- **TraceDrawer**: painel em `--tg-surface` com borda esquerda e overlay `rgb(0 0 0 / .6)`. Cabeçalho com "Trace", id mono, meta (spans · ms · RASP) e botão secundário "Fechar". Itens APM em cards `--tg-surface-2` com pill de nível. Itens RASP com borda `--tg-threat-line` e pill threat. Detalhes técnicos em mono.
- **UptimeMonitorForm**: card com título "Novo monitor HTTP", inputs de 40px com tokens e labels visíveis (Nome, URL, Intervalo em segundos), botões primário "Criar monitor" e secundário "Cancelar".

## Fica a critério de quem implementa
- Divisão exata dos arquivos em `components/ui/`.
- Ajuste fino de espaçamentos quando o dado real diferir das referências (textos longos, muitas linhas).
- Ordem das barras: a ordem atual dos objetos vindos da API, exceto nos níveis, que seguem error, warn, info, debug.

## Verificação
- `pnpm --filter @traceguard/dashboard build` sem erros de tipo.
- `pnpm test` continua verde (nenhum teste é do dashboard, mas `shared` não deve ser tocado).
- Inspeção visual das quatro abas com dados reais (`pnpm dev` + `pnpm dev:demo` / `dev:demo-api` + `demo:scrape`), comparadas lado a lado com `screens/*.html`, em largura desktop e em ~400px.
