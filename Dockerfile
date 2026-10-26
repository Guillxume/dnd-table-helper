# Image du bot jdr-helper : Node 24, TypeScript exécuté par tsx (pas d'étape de build), utilisateur non root.
# Construite par GitHub Actions (linux/amd64) et récupérée par le serveur ; voir deploy/INSTALL.md.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
# Outils de compilation, au cas où better-sqlite3 n'a pas de binaire précompilé pour la plateforme.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# tsx est une dépendance de production. Ne pas ajouter --omit=optional : esbuild (utilisé par tsx)
# reçoit son binaire Linux par une dépendance optionnelle.
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    DB_PATH=/app/data/jdr.sqlite \
    BACKUP_DIR=/app/backups \
    SHEET_TEMPLATE=/app/ref/DD5-eFeuillePersoDD5.pdf
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY scripts/backup.ts ./scripts/backup.ts
# Code lisible par tous (certains fichiers peuvent être en 600 sur le poste qui construit), modifiable par root seul.
# data/ et backups/ sont des volumes ; ref/ (feuille de personnage) est monté en lecture seule.
RUN chmod -R a+rX /app && mkdir -p data backups ref && chown node:node data backups
USER node
CMD ["node", "--import", "tsx", "src/index.ts"]
