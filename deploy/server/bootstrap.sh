#!/usr/bin/env bash
# Préparation d'un VPS Debian 12/13 ou Ubuntu 24.04 pour héberger des projets en conteneurs Docker.
# Rejouable sans risque. Usage, en root : bash bootstrap.sh <utilisateur_admin>
#   <utilisateur_admin> : l'utilisateur qui se connecte en SSH (par exemple « debian » ou « ubuntu » selon l'hébergeur).
#
# Ce que fait le script :
#   1. système à jour, fuseau Europe/Paris ;
#   2. Docker Engine et Compose depuis le dépôt officiel de Docker, journaux des conteneurs limités ;
#   3. utilisateur « deploy » pour les déploiements automatiques (groupe docker) ;
#   4. /srv/<projet> comme emplacement commun des projets ;
#   5. pare-feu : seul SSH est ouvert ;
#   6. mises à jour de sécurité automatiques ;
#   7. fichier d'échange de 2 Go s'il n'y en a pas ;
#   8. SSH par clé uniquement, si l'admin a bien une clé autorisée (sinon rien n'est changé).
set -euo pipefail
ADMIN="${1:?Indique l’utilisateur d’administration, par exemple : bash bootstrap.sh debian}"
[ "$(id -u)" -eq 0 ] || { echo "À lancer en root : sudo bash bootstrap.sh $ADMIN"; exit 1; }
id "$ADMIN" >/dev/null
. /etc/os-release
export DEBIAN_FRONTEND=noninteractive
# Ubuntu : needrestart redémarre seul les services touchés au lieu d'attendre une réponse.
export NEEDRESTART_MODE=a
step() { printf '\n== %s\n' "$*"; }

step "1. Système à jour"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl ufw unattended-upgrades sqlite3 rsync
timedatectl set-timezone Europe/Paris

step "2. Docker (dépôt officiel, https://docs.docker.com/engine/install/$ID/)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/$ID
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Journaux des conteneurs : 5 fichiers de 10 Mo au plus par conteneur, sinon ils grossissent sans limite.
DAEMON='{ "log-driver": "local", "log-opts": { "max-size": "10m", "max-file": "5" } }'
if [ "$(cat /etc/docker/daemon.json 2>/dev/null)" != "$DAEMON" ]; then
  echo "$DAEMON" > /etc/docker/daemon.json
  systemctl restart docker
fi
systemctl enable --now docker >/dev/null

step "3. Utilisateurs"
# Attention : le groupe docker donne l'équivalent des droits root. Il est réservé à l'admin et à « deploy ».
usermod -aG docker "$ADMIN"
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

step "4. Projets dans /srv/<projet>"
install -d -m 755 -o deploy -g deploy /srv

step "5. Pare-feu (SSH seulement)"
# Un port publié par Docker (« ports: » dans compose) contourne ufw : ne rien publier hors du futur proxy web.
ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null
ufw status | head -5

step "6. Mises à jour de sécurité automatiques"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

step "7. Fichier d'échange"
if ! swapon --show --noheadings | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
swapon --show

step "8. SSH par clé uniquement"
home="$(getent passwd "$ADMIN" | cut -d: -f6)"
if [ -s "$home/.ssh/authorized_keys" ]; then
  # Préfixe 00 : sshd garde la première valeur lue, et les images cloud ont souvent un 50-cloud-init.conf
  # qui autorise les mots de passe.
  root_login="no"
  [ "$ADMIN" = root ] && root_login="prohibit-password"
  cat > /etc/ssh/sshd_config.d/00-durcissement.conf <<EOF
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin $root_login
EOF
  sshd -t
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
  echo "Connexion par mot de passe désactivée. Garde ta session ouverte et vérifie une nouvelle connexion par clé."
else
  echo "Aucune clé dans $home/.ssh/authorized_keys : mots de passe laissés actifs (ajoute d'abord ta clé)."
fi

step "Terminé"
docker --version
docker compose version
