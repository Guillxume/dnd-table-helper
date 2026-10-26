#!/bin/sh
# Crée la base dédiée aux tests d'intégration à côté de la base de développement.
# Exécuté une seule fois, à la création du volume PostgreSQL.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE DATABASE ${POSTGRES_DB}_test OWNER ${POSTGRES_USER};
SQL
