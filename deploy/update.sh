#!/usr/bin/env bash
# Sur le serveur, dans /srv/jdr-helper (lancé par le workflow Deploy, ou à la main) :
# récupère les images demandées, met à jour les commandes Discord, redémarre le bot et attend sa connexion,
# puis, si le site est configuré (.env.web présent), met à jour le site et attend qu'il réponde.
# Usage : bash update.sh <tag>      (tag = commit court, ou « latest »)
# Si un jeton ghcr.io arrive sur l'entrée standard (workflow), il sert au pull puis la session est fermée.
set -euo pipefail
cd /srv/jdr-helper
export IMAGE_TAG="${1:?Indique le tag de l’image, par exemple latest}"

if [ -f .env.web ]; then
  # Active les services du site pour toutes les commandes compose ci-dessous.
  export COMPOSE_PROFILES=web
  # Dernière ligne SITE_DOMAIN=…, guillemets et espaces retirés. Absente : arrêt explicite
  # (et non silencieux, comme le ferait grep sous set -e).
  SITE_DOMAIN="$(sed -n 's/^[[:space:]]*SITE_DOMAIN=//p' .env.web | tail -n 1 | tr -d "\"' \r")"
  if [ -z "$SITE_DOMAIN" ]; then
    echo "SITE_DOMAIN manque dans .env.web : impossible de configurer le site." >&2
    exit 1
  fi
  export SITE_DOMAIN
  export SITE_URL="https://${SITE_DOMAIN}"
fi

if [ ! -t 0 ]; then
  docker login ghcr.io -u "${GHCR_USER:?}" --password-stdin >/dev/null
  trap 'docker logout ghcr.io >/dev/null' EXIT
fi

docker compose pull bot
if [ -f .env.web ]; then docker compose pull web web-migrate; fi
docker compose run --rm bot node --import tsx src/deploy-commands.ts

since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose up -d --remove-orphans bot
connected=false
for _ in $(seq 1 30); do
  if docker compose logs --since "$since" bot 2>&1 | grep -q "Connecté en tant que"; then
    echo "Bot ${IMAGE_TAG} démarré et connecté à Discord."
    connected=true
    break
  fi
  sleep 2
done
if [ "$connected" != true ]; then
  echo "Le bot ne s'est pas connecté à Discord en 60 s. Derniers journaux :"
  docker compose logs --since "$since" --tail 50 bot || true
  exit 1
fi

if [ -f .env.web ]; then
  # web-migrate (migrations, bucket) s'exécute avant le redémarrage du site (depends_on).
  docker compose up -d --remove-orphans web caddy
  for _ in $(seq 1 45); do
    if [ "$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q web)")" = "healthy" ]; then
      echo "Site ${IMAGE_TAG} démarré : ${SITE_URL}"
      docker image prune -f >/dev/null
      exit 0
    fi
    sleep 2
  done
  echo "Le site n'est pas prêt en 90 s. Derniers journaux :"
  docker compose logs --tail 50 web-migrate web || true
  exit 1
fi
docker image prune -f >/dev/null
