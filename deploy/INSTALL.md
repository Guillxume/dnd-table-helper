# Héberger le bot et le site sur le VPS (Docker)

Le VPS fait tourner chaque projet dans des conteneurs Docker, rangés dans `/srv/<projet>`. Le bot n'a besoin d'aucun port ouvert : il se connecte lui-même à Discord et à l'API Anthropic. Une seule instance doit tourner à la fois : arrête le bot sur le Mac avant de démarrer celui du serveur.

## Organisation du serveur

| Élément | Rôle |
|---|---|
| `deploy/server/bootstrap.sh` | Préparation du VPS, une fois (rejouable) : Docker officiel, pare-feu, mises à jour de sécurité, échange, SSH par clé |
| Utilisateur admin (`debian` ou `ubuntu` selon l'hébergeur) | Administration, avec sudo |
| Utilisateur `deploy` | Déploiements de GitHub Actions, groupe docker, sans mot de passe |
| `/srv/<projet>/` | Un dossier par projet : `compose.yaml`, `.env` (600), données |
| Image `ghcr.io/guillxume/dnd-table-helper` | Construite par GitHub Actions, paquet privé ; le serveur la récupère au déploiement |
| Images `ghcr.io/guillxume/dnd-table-helper-web` et `-web-tools` | Le site et ses outils (migrations, création de compte), même commit que le bot |

Le groupe docker donne l'équivalent des droits root : ne l'accorde qu'à l'admin et à `deploy`. Un port publié par un conteneur (`ports:` dans compose) contourne le pare-feu ufw : seul Caddy (proxy HTTPS du site) publie des ports, 80 et 443.

## 0. Avant de commencer

- Console Claude, page Billing (https://platform.claude.com/settings/billing), section « Spend limits » : fixe un plafond mensuel (par exemple 15 $).
- Facultatif, pour être prévenu si le bot tombe : un contrôle gratuit sur https://healthchecks.io (offre Hobbyist), période de 5 minutes ; son URL de ping ira dans `HEARTBEAT_URL`.

## 1. Accès et préparation du VPS (une fois)

Depuis le Mac, une clé réservée au VPS (tu tapes le mot de passe reçu de l'hébergeur une seule fois) :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/vps -N ""
ssh-copy-id -i ~/.ssh/vps.pub ADMIN@IP_DU_VPS
```

Puis, dans `~/.ssh/config` :

```
Host vps
  HostName IP_DU_VPS
  User ADMIN
  IdentityFile ~/.ssh/vps
```

Préparation du serveur :

```bash
scp deploy/server/bootstrap.sh vps:
ssh vps 'sudo bash bootstrap.sh ADMIN'
```

À la fin, le script désactive la connexion par mot de passe : vérifie dans un autre terminal que `ssh vps` fonctionne toujours avant de fermer ta session.

## 2. Installer le bot (une fois)

```bash
ssh vps 'sudo install -d -o deploy -g deploy /srv/jdr-helper && sudo install -d -o 1000 -g 1000 /srv/jdr-helper/data /srv/jdr-helper/backups && sudo install -d -o deploy -g deploy /srv/jdr-helper/ref'
scp .env vps:/tmp/jdr.env && ssh vps 'sudo install -m 600 -o deploy -g deploy /tmp/jdr.env /srv/jdr-helper/.env && rm /tmp/jdr.env'
scp ref/DD5-eFeuillePersoDD5.pdf vps:/tmp/ && ssh vps 'sudo install -m 644 -o deploy -g deploy /tmp/DD5-eFeuillePersoDD5.pdf /srv/jdr-helper/ref/ && rm /tmp/DD5-eFeuillePersoDD5.pdf'
```

`data/` et `backups/` appartiennent à l'utilisateur 1000 : c'est l'utilisateur `node` du conteneur. Pour reprendre la base du Mac : arrêter le bot local, faire `npm run backup`, envoyer la copie dans `/srv/jdr-helper/data/jdr.sqlite` (propriétaire 1000).

## 3. Déploiement automatique depuis GitHub

À chaque push sur `main`, la CI (typage, tests, construction de l'image) tourne ; si elle est verte, le workflow « Deploy » construit l'image, la publie sur ghcr.io, puis lance `deploy/update.sh` sur le serveur : récupération de l'image, mise à jour des commandes Discord, redémarrage, attente du message « Connecté en tant que » (60 s au plus, sinon il affiche les journaux et échoue).

1. Clé réservée aux déploiements : `ssh-keygen -t ed25519 -f ~/.ssh/jdr-deploy -N ""`, puis l'autoriser pour `deploy` : `cat ~/.ssh/jdr-deploy.pub | ssh vps 'sudo tee -a /home/deploy/.ssh/authorized_keys'`.
2. Empreinte du serveur : `ssh-keyscan IP_DU_VPS`.
3. Dans GitHub, Settings du dépôt :
   - Secrets and variables > Actions > Secrets : `VPS_HOST` (IP), `VPS_USER` (`deploy`), `VPS_SSH_KEY` (contenu de `~/.ssh/jdr-deploy`), `VPS_KNOWN_HOSTS` (sortie de `ssh-keyscan`).
   - Variables : `DEPLOY_ENABLED` = `true`.
   - Environments : `production` (tu peux y exiger ton approbation avant chaque déploiement).

Déploiement à la main depuis le Mac : `./deploy/deploy.sh` (lance le même workflow et suit son exécution).

## 4. Sauvegardes

Sur le serveur, `sudo crontab -u deploy -e` :

```
15 4 * * * cd /srv/jdr-helper && docker compose exec -T bot node --import tsx scripts/backup.ts 2>&1 | logger -t jdr-backup
```

Une copie vérifiée de la base est faite chaque nuit dans `/srv/jdr-helper/backups/` (14 jours conservés). Journal : `journalctl -t jdr-backup`.

Copie hors serveur : le Mac récupère ces copies à l'ouverture de session puis toutes les heures, dans `~/Documents/jdr-helper-sauvegardes` (90 jours conservés). Installation : `bash deploy/mac/install.sh` (tâche launchd `fr.elamaer.jdr-helper.sauvegardes`, journal `~/Library/Logs/jdr-helper-sauvegardes.log`) ; désinstallation : `bash deploy/mac/install.sh --remove`. Le serveur gardant 14 jours de copies, il suffit que le Mac soit allumé une fois dans ce délai.

## 5. Mettre le site en service (une fois)

Le site (création de personnage pour les joueurs, atelier du MJ, cartes de bataille) tourne dans le même projet Compose que le bot. Caddy ne reçoit aucun secret, seulement le domaine, profil `web` : base PostgreSQL, stockage des images (SeaweedFS), site, et Caddy qui obtient seul le certificat HTTPS. Il partage `data/` (base SQLite du bot) et `ref/` (feuille de personnage). Tant que `.env.web` n'existe pas, `update.sh` ne déploie que le bot.

1. **DNS** : chez le registraire du domaine, un enregistrement A `table.example.com` vers l'IP du VPS (et `www` si vous le souhaitez, à ajouter alors au Caddyfile). Vérifier avec `dig +short table.example.com` avant l'étape 4 : Caddy a besoin du DNS pour obtenir le certificat.
2. **Pare-feu** : `ssh vps 'sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp'`. (Docker publie ces ports même sans cette règle ; elle rend l'ouverture explicite.)
3. **Discord** : portail développeur, application du bot, OAuth2 > Redirects : `https://table.example.com/api/auth/callback/discord`. Générer le Client Secret sur la même page.
4. **Configuration** : copier `deploy/web/env.web.example` en `.env.web`, remplacer chaque valeur à générer (`openssl rand -hex 32`), renseigner `DISCORD_GUILD_ID`, `DISCORD_CLIENT_ID` (mêmes valeurs que pour le bot) et `DISCORD_CLIENT_SECRET`, et, pour l'assistant de création, `ANTHROPIC_API_KEY` (facultatif), puis :
   ```bash
   scp .env.web vps:/tmp/jdr.env.web && ssh vps 'sudo install -m 600 -o deploy -g deploy /tmp/jdr.env.web /srv/jdr-helper/.env.web && rm /tmp/jdr.env.web'
   ```
5. **Déploiement** : relancer le workflow Deploy (`./deploy/deploy.sh`). `update.sh` voit `.env.web`, récupère les images du site, applique les migrations, démarre le site et Caddy, attend que le site réponde, et transmet au bot l'adresse du site (`SITE_URL`) pour ses boutons.
6. **Compte du MJ** (connexion par e-mail, accès à l'atelier) :
   ```bash
   ssh -t vps 'cd /srv/jdr-helper && sudo -u deploy COMPOSE_PROFILES=web docker compose run --rm web-tools pnpm user:create --email vous@example.com'
   ```
7. **Tableaux de bord** : dans Discord, `/campagne panneau` pour republier les tableaux de bord avec le bouton « Ouvrir le site ».
8. **Sauvegarde du site**, ajoutée à la crontab de `deploy` (`sudo crontab -u deploy -e`), après celle du bot :
   ```
   30 4 * * * cd /srv/jdr-helper && bash backup-site.sh 2>&1 | logger -t jdr-backup-site
   ```
   Base et images du site, vérifiées, dans `/srv/jdr-helper/backups-site/` (14 jours). Le stockage des images est arrêté quelques secondes pendant la copie. Le Mac les récupère aussi (dossier `site/` des sauvegardes), après une nouvelle installation de la tâche : `bash deploy/mac/install.sh`. Restauration : `sudo -u deploy bash restore-site.sh backups-site/site-<date>.dump backups-site/site-<date>-images.tgz`. Les deux scripts sont copiés sur le serveur à chaque déploiement.

Mémoire mesurée en local le 20/10/2026, au repos après quelques requêtes : site 183 Mo, PostgreSQL 35 Mo, stockage 34 Mo, Caddy 19 Mo. Le pic pendant le traitement d'images et les PDF de cartes reste à mesurer sur le serveur.

## Au quotidien

Connecté en `ubuntu` (`ssh vps`), dans `/srv/jdr-helper`. `.env` n'est lisible que par `deploy` : les commandes passent par `sudo -u deploy`.

| Besoin | Commande |
|---|---|
| État | `sudo -u deploy docker compose ps` |
| Journaux | `sudo -u deploy docker compose logs -f --tail 100 bot` |
| Redémarrer | `sudo -u deploy docker compose restart bot` |
| Revenir à une version précédente | `sudo -u deploy bash update.sh <tag>` (tags : commits courts, visibles dans GitHub, onglet Packages ; le paquet étant privé, le pull à la main demande une connexion à ghcr.io) |
| Restaurer une sauvegarde du bot | `sudo -u deploy docker compose stop bot web`, `sudo cp backups/<fichier> data/jdr.sqlite`, `sudo -u deploy docker compose start bot web` (le site lit la même base) |
| Journaux du site | `sudo -u deploy COMPOSE_PROFILES=web docker compose logs -f --tail 100 web` |

Le bot répond deux fois : une autre instance tourne encore (le Mac ?).

## Ajouter un autre projet

Créer `/srv/<projet>/` (propriétaire `deploy`), y mettre son `compose.yaml` et son `.env` en 600, et le déployer de la même façon (image sur ghcr.io, script de mise à jour lancé par SSH). Un autre site web passerait par le Caddy existant (nouveau bloc dans le Caddyfile) plutôt que de publier ses propres ports.
