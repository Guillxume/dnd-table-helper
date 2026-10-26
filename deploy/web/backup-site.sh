#!/usr/bin/env bash
# Sauvegarde nuitière du site, sur le serveur (crontab de deploy, après celle du bot) :
#   - base PostgreSQL (pg_dump, format custom) ;
#   - volume du stockage des images (archive tar, stockage arrêté le temps de la copie).
# Les copies sont vérifiées avant de supprimer les anciennes (14 jours conservés), dans backups-site/.
# Usage : bash backup-site.sh     (variables : JDR_DIR, COMPOSE_PROJECT, BACKUP_KEEP_DAYS)
set -euo pipefail
cd "${JDR_DIR:-/srv/jdr-helper}"
[ -f .env.web ] || { echo "Site non configuré (.env.web absent) : rien à sauvegarder."; exit 0; }
export COMPOSE_PROFILES=web
PROJECT="${COMPOSE_PROJECT:-jdr-helper}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
DEST="backups-site"
STAMP="$(date -u +%Y-%m-%d-%H-%M)"
compose() { docker compose -p "$PROJECT" "$@"; }

mkdir -p "$DEST"
db_file="$DEST/site-$STAMP.dump"
images_file="$DEST/site-$STAMP-images.tgz"

compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$db_file.part"
# Vérification : pg_restore doit savoir lire la table des matières de la copie.
compose exec -T db pg_restore --list < "$db_file.part" > /dev/null
mv "$db_file.part" "$db_file"

compose stop storage
trap 'compose start storage >/dev/null' EXIT
docker run --rm -v "${PROJECT}_storage-data:/data:ro" -v "$PWD/$DEST:/backup" busybox:1.37 \
  sh -c "tar czf /backup/$(basename "$images_file").part -C /data . && tar tzf /backup/$(basename "$images_file").part > /dev/null"
compose start storage
trap - EXIT
docker run --rm -v "$PWD/$DEST:/backup" busybox:1.37 \
  sh -c "mv /backup/$(basename "$images_file").part /backup/$(basename "$images_file") && chown $(id -u):$(id -g) /backup/$(basename "$images_file")"

find "$DEST" -name 'site-*' -mtime +"$KEEP_DAYS" -delete
echo "Sauvegarde du site vérifiée : $db_file ($(du -h "$db_file" | cut -f1)), $images_file ($(du -h "$images_file" | cut -f1))"
