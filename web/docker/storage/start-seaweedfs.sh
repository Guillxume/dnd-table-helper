#!/bin/sh
# Démarre SeaweedFS avec une passerelle S3 dont l'unique identité est construite
# à partir des variables d'environnement : aucun identifiant n'est écrit dans le dépôt.
set -eu
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID manquant}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY manquant}"

umask 077
cat > /tmp/s3.json <<JSON
{
  "identities": [
    {
      "name": "app",
      "credentials": [{ "accessKey": "${S3_ACCESS_KEY_ID}", "secretKey": "${S3_SECRET_ACCESS_KEY}" }],
      "actions": ["Admin", "Read", "List", "Tagging", "Write"]
    }
  ]
}
JSON

# -volume.max=0 : nombre de volumes calculé d'après l'espace disque libre. La valeur
# par défaut (8) est épuisée dès le deuxième bucket, chaque bucket réservant
# plusieurs volumes d'avance.
exec weed server -dir=/data -ip.bind=0.0.0.0 -s3 -s3.port=8333 -s3.config=/tmp/s3.json \
  -master.volumeSizeLimitMB=1024 -volume.max=0
