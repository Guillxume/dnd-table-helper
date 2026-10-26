#!/usr/bin/env bash
# Restauration du site à partir de deux fichiers de backups-site/ (même horodatage).
#   bash restore-site.sh backups-site/site-AAAA-MM-JJ-HH-MM.dump backups-site/site-AAAA-MM-JJ-HH-MM-images.tgz
# ATTENTION : remplace la base et les images actuelles du site. La base SQLite du bot n'est pas concernée.
set -euo pipefail
cd "${JDR_DIR:-/srv/jdr-helper}"
DB_FILE="${1:?Fichier .dump attendu}"
IMAGES_FILE="${2:?Archive -images.tgz attendue}"
export COMPOSE_PROFILES=web
PROJECT="${COMPOSE_PROJECT:-jdr-helper}"
compose() { docker compose -p "$PROJECT" "$@"; }

if [ "${ASSUME_YES:-}" != "1" ]; then
  read -r -p "Remplacer la base et les images du site ? Tapez « restaurer » : " answer
  [ "$answer" = "restaurer" ] || { echo "Annulé."; exit 1; }
fi
compose stop web storage
compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$DB_FILE"
docker run --rm -v "${PROJECT}_storage-data:/data" -v "$PWD/$(dirname "$IMAGES_FILE"):/backup:ro" busybox:1.37 \
  sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf /backup/$(basename "$IMAGES_FILE") -C /data"
compose start storage web
echo "Site restauré depuis $DB_FILE et $IMAGES_FILE."
