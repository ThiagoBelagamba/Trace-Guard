# ADR 003 — Stack do Dashboard (Next.js + Tailwind + Recharts)

**Status:** Aceito  
**Data:** 2026-06-24  
**Fase:** 2 — Dashboard em Tempo Real

## Contexto

O dashboard precisa de uma interface visual para tabela de eventos ao vivo e gráficos de agregação temporal. O escopo do TCC define Next.js, Tailwind CSS e integração WebSocket.

## Decisão

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Framework | Next.js 15 App Router | Já presente no monorepo; SSR para bootstrap inicial |
| Estilização | Tailwind CSS 3 | Utility-first; tema escuro rápido para UIs de observabilidade |
| Gráficos | Recharts | Composable, React-native, adequado para line/bar charts acadêmicos |
| Tipos | `@traceguard/shared` | Contrato único entre backend, SDK e dashboard |
| Estado WS | Hook custom `useTelemetrySocket` | Sem dependência extra (SWR/React Query desnecessários para PoC) |

Componentes client-side (`"use client"`) isolados em `components/` e `hooks/`; `page.tsx` permanece Server Component mínimo.

## Consequências

**Positivas:**
- Consistência visual com padrões Grafana/Datadog (tema escuro)
- Recharts integra nativamente com React 19
- Tipos compartilhados evitam drift entre API e UI

**Negativas:**
- Recharts aumenta bundle do cliente (~200KB gzip)
- Tailwind requer PostCSS no pipeline de build

## Alternativas rejeitadas

- **Chart.js / D3 direto:** mais verboso; Recharts abstrai eixos e tooltips
- **shadcn/ui:** excelente DX, mas adiciona muitos arquivos para escopo acadêmico mínimo
- **Vue/Nuxt:** inconsistente com stack Node.js/TypeScript do restante do monorepo
