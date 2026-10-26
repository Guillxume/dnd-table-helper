#!/bin/bash
# Installe (ou réinstalle) la récupération automatique des sauvegardes sur le Mac.
# Usage : bash deploy/mac/install.sh      Désinstaller : bash deploy/mac/install.sh --remove
set -euo pipefail
LABEL="fr.elamaer.jdr-helper.sauvegardes"
APP="$HOME/Library/Application Support/jdr-helper"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [ "${1:-}" = "--remove" ]; then
  rm -f "$PLIST" "$APP/pull-backups.sh"
  echo "Récupération automatique désinstallée (les copies déjà faites sont conservées)."
  exit 0
fi
mkdir -p "$APP" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
install -m 755 "$(dirname "$0")/pull-backups.sh" "$APP/pull-backups.sh"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$APP/pull-backups.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/jdr-helper-sauvegardes.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/jdr-helper-sauvegardes.log</string>
</dict>
</plist>
PLIST
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installé : $LABEL (à l'ouverture de session puis toutes les heures). Journal : ~/Library/Logs/jdr-helper-sauvegardes.log"
