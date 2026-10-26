#!/usr/bin/env bash
# Déploiement manuel depuis le Mac : lance le workflow Deploy de GitHub (construction de l'image, puis mise à jour
# du conteneur sur le VPS) et suit son exécution. Le code déployé est celui de la branche main sur GitHub.
set -euo pipefail
gh workflow run deploy.yml --ref main
sleep 5
run="$(gh run list --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run watch "$run" --exit-status
