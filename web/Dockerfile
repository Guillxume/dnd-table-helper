# syntax=docker/dockerfile:1.7
# Image du site, construite depuis la RACINE du dépôt (le site réutilise le code du bot, src/) :
#   docker build -f web/Dockerfile -t jdr-helper-web .
# Exclusions : web/Dockerfile.dockerignore (celui de la racine exclut web/ pour l'image du bot).
#
# Cibles :
#   - runner : serveur Next.js autonome, utilisateur node (uid 1000, comme le bot : la base
#     SQLite partagée lui appartient) ;
#   - tools  : dépendances complètes pour migrations, initialisation et création de compte.

FROM node:24-bookworm-slim AS base
# COREPACK_HOME partagé : pnpm installé une fois, utilisable par l'utilisateur node (image tools).
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 COREPACK_HOME=/usr/local/share/corepack
# OpenSSL : moteur de migration Prisma. Outils de compilation : better-sqlite3 sans binaire précompilé.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate && chmod -R a+rX /usr/local/share/corepack
WORKDIR /app/web

FROM base AS deps
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml web/prisma.config.ts ./
COPY web/prisma ./prisma
# `prisma generate` (postinstall) exige une URL : valeur factice, aucune connexion.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm install --frozen-lockfile

FROM deps AS build
COPY src /app/src
COPY web ./
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm build

FROM build AS tools
ENV NODE_ENV=production JDR_DB_PATH=/app/data/jdr.sqlite SHEET_TEMPLATE=/app/ref/DD5-eFeuillePersoDD5.pdf
USER node
CMD ["pnpm", "db:deploy"]

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    JDR_DB_PATH=/app/data/jdr.sqlite SHEET_TEMPLATE=/app/ref/DD5-eFeuillePersoDD5.pdf
WORKDIR /app/web
COPY --from=build --chown=node:node /app/web/.next/standalone ./
# data/ (base partagée avec le bot) et ref/ (feuille de personnage) sont des volumes.
RUN mkdir -p /app/data /app/ref && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "server.js"]
