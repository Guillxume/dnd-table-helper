#!/bin/bash
# Copie hors serveur des sauvegardes du bot : récupère /srv/jdr-helper/backups du VPS (alias SSH « vps ») dans un
# dossier du Mac. Lancé par launchd à l'ouverture de session puis toutes les heures (voir install.sh).
# Le serveur garde 14 jours de copies ; le Mac les garde 90 jours. Rien n'est supprimé côté serveur.
set -euo pipefail
DEST="${JDR_BACKUP_DIR:-$HOME/Documents/jdr-helper-sauvegardes}"
mkdir -p "$DEST"
/usr/bin/rsync -a -e "/usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=20" vps:/srv/jdr-helper/backups/ "$DEST/"
/usr/bin/find "$DEST" -name 'jdr-*.sqlite' -mtime +90 -delete
# Sauvegardes du site (base et images), si le site est en service sur le serveur.
mkdir -p "$DEST/site"
/usr/bin/rsync -a -e "/usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=20" vps:/srv/jdr-helper/backups-site/ "$DEST/site/" 2>/dev/null || true
/usr/bin/find "$DEST/site" -name 'site-*' -mtime +90 -delete
echo "$(date '+%Y-%m-%d %H:%M') : $(ls "$DEST"/jdr-*.sqlite 2>/dev/null | wc -l | tr -d ' ') copies du bot, $(ls "$DEST"/site/site-*.dump 2>/dev/null | wc -l | tr -d ' ') du site dans $DEST"
