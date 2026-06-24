FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/dashboard/package.json ./apps/dashboard/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY pnpm-workspace.yaml package.json ./
COPY apps/dashboard ./apps/dashboard
WORKDIR /app/apps/dashboard
RUN pnpm build

FROM base AS runner
WORKDIR /app/apps/dashboard
ENV NODE_ENV=production
COPY --from=build /app/apps/dashboard ./
EXPOSE 3000
CMD ["pnpm", "start"]
