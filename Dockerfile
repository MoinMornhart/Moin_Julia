# syntax=docker/dockerfile:1
# Ein Dockerfile, drei Ziele: bot, dashboard, migrate (DB-Migrationen)

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    NEXT_TELEMETRY_DISABLED=1
# OpenSSL braucht Prisma für die Migrationen (sonst Warnung „failed to detect libssl“)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /app

# ---- Abhängigkeiten (gecacht, solange sich keine package.json ändert) ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/bot/package.json apps/bot/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
COPY . .
RUN pnpm --filter @moin/db generate \
 && pnpm --filter @moin/shared build \
 && pnpm --filter @moin/db build \
 && pnpm --filter @moin/bot build \
 && pnpm --filter @moin/dashboard build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @moin/bot deploy --prod --legacy /out/bot

# ---- Migrationen: läuft einmal vor Bot und Dashboard ----
FROM deps AS migrate
COPY packages/db/prisma packages/db/prisma
COPY packages/db/prisma.config.ts packages/db/
WORKDIR /app/packages/db
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ---- Bot ----
FROM node:24-bookworm-slim AS bot
ENV NODE_ENV=production
# ffmpeg für das Musik-Modul (holt Radio-Streams/Audio-Links und wandelt sie in Ogg/Opus um)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out/bot ./
COPY VERSION ./VERSION
USER node
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=4 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]

# ---- Dashboard ----
FROM node:24-bookworm-slim AS dashboard
# Commit für die Versionsanzeige (übergibt moin-julia beim Bauen)
ARG GIT_COMMIT=
ENV GIT_COMMIT=$GIT_COMMIT
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DOCS_DIR=/app/docs
WORKDIR /app
COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
# Öffentliche Dateien (z. B. /branding/bot-avatar.png) – gehören nicht automatisch zum Standalone-Build
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
COPY docs ./docs
COPY VERSION ./VERSION
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=4 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/dashboard/server.js"]
