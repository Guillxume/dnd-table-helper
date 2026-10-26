# CLAUDE.md : jdr-helper

Ce fichier donne à Claude Code le contexte du projet. Il complète `docs/README.fr.md` (commandes et installation) sans le répéter.

## Le projet en bref

Bot Discord en français pour des campagnes de JdR : D&D 5e version 2024, séances en présentiel, une table de 5 joueurs et 1 MJ. Discord sert à la logistique de la table. Objectif : passer moins de temps sur le répétitif, surtout la création des personnages et le rappel de la séance précédente. Un site web (`web/`) prolonge le bot : création de personnage, atelier d'illustration, outils du MJ.

- Modèle IA : Claude Haiku (`claude-haiku-5-5`, variable `ANTHROPIC_MODEL`). Budget visé : environ 10 $/mois d'API.
- Hébergement : un VPS, dans des conteneurs Docker (voir « Déploiement »). Une seule instance du bot à la fois : deux instances donneraient deux réponses à chaque commande.

## Règles de travail

- Toujours dire la vérité. Ne jamais inventer, extrapoler ou deviner. Si une information n'est pas vérifiable, écrire « Je ne sais pas. »
- Chaque affirmation factuelle (règle de jeu, prix, doc d'outil) s'appuie sur une source crédible et récente, citée (auteur, date, lien). Expliquer le raisonnement ou le calcul quand une donnée peut se discuter.
- L'exactitude passe avant la vitesse et le style.
- Textes en français, accents compris. Pas de tirets longs. Pas de texte qui sonne IA.
- Ne pas réduire le périmètre pour cause de charge de travail.
- Les PDF de `ref/` (guides d'orientation, référentiel d'origines) sont des sources à utiliser.
- Ne jamais lire ni afficher les secrets du `.env`. Ne jamais committer `.env`, `ref/`, `data/`, `backups/`.

## Périmètre décidé

Plan d'origine en 6 incréments :

1. Réglages Discord (catégories, salons, rôles) : **fait**.
2. Rappel de séance : **fait**.
3. Aide à la préparation du MJ : **fait**.
4. Fiche de personnage : **fait**.
5. Écran de table et illustrations : **abandonné** en tant que fonctions du bot ; les illustrations et les cartes de bataille imprimables sont faites par le site (`web/`, voir plus bas).
6. Bande son : **abandonné**, géré en live à la table.

Décisions qui en découlent :

- Personnages de **niveau 1 uniquement** (`MAX_SUPPORTED_LEVEL = 1`). La montée de niveau se fait à la table, sans le bot : pas de moteur de niveaux à développer.
- Contenu : Manuel des joueurs 2024 uniquement (pas de 2014, pas de suppléments).
- Méthodes de caractéristiques au choix du MJ par campagne : valeurs standard, achat par 27 points, 4d6 tiré par le bot, dés lancés à la table (option `table` de `/regles`, demandée par un MJ). Avec cette dernière, la saisie des six totaux et la répartition viennent en fin de parcours (étape `tableRolls`) ; d'ici là, « Fiche à cases vides » donne un PDF où tout ce qui dépend des caractéristiques est vide, avec les formules dans l'annexe (`computeSheet(d, { pendingScores: true })`, `Sheet.scoresPending`). Le suivi et les relances d'échéance comptent ces joueurs à part (`awaitingTable`).
- Aide IA optionnelle, limitée aux idées d'historique et de personnalité, et aux conseils de sorts parmi les sorts proposés.
- Fiche PDF : la feuille française de gdfl.be (`ref/DD5-eFeuillePersoDD5.pdf`), remplie par le bot. Les valeurs qui changent en jeu restent **vides** pour être tenues au crayon : PV actuels et temporaires, dés de vie restants, jets contre la mort, inspiration, emplacements utilisés, pièces, trésor, équipement.
- On stocke les **choix** du joueur (historique rejouable), jamais les valeurs calculées. Les règles sont séparées des commandes.
- Plusieurs campagnes par serveur : une campagne correspond à une catégorie Discord plus les rôles « MJ <nom> » et « Joueurs <nom> ».

## Site web (`web/`)

- Décision et conséquences : `docs/adr/0001-site-web-dans-jdr-helper.md`. Suivi : `web/PLAN.md`, documentation : `web/README.md`.
- Joueurs : connexion Discord (OAuth2 de l'application du bot), création de personnage sur le site avec le moteur du bot, même brouillon que Discord (table `character_wizards`), PDF, publication demandée au bot (table `publish_requests`). MJ : connexion par e-mail, atelier d'illustration, briefs ChatGPT Images, cartes de bataille A4.
- Le site réutilise `src/` par l'alias `@bot/*`, **uniquement les modules sans discord.js**. Next.js 16 construit avec webpack (`--webpack`) : Turbopack ne résout pas les imports `./x.js` vers `.ts`.
- Aides de l'assistant (« Idées », « Conseil » de sorts) : consignes communes dans `src/character/assist.ts`, appelées par le bot et par le site (`web/src/server/game/assistant.ts`, clé `ANTHROPIC_API_KEY` de `.env.web`, facultative, plafond `ASSISTANT_HOURLY_LIMIT` par joueur). Pas de génération d'images : les joueurs utilisent leur propre compte ChatGPT avec les prompts du site.
- Design system du site dans `web/design/` (thème, icônes, logos). Icônes : modifier les SVG puis `node scripts/build-icons.mjs` (dans `web/`), jamais `rpg-icons.tsx` à la main.
- Le site ouvre la même base SQLite (`JDR_DB_PATH`). Toute modification du moteur de création ou de `db.ts` doit garder les tests du bot **et** du site au vert (`cd web && pnpm test`).
- Commandes du site (dans `web/`, pnpm) : `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`. Services de dev : `docker compose up -d` dans `web/`.

## Stack

- Node 22 ou plus en local (fin de maintenance le 30/04/2027), Node 24 sur le serveur et dans la CI. TypeScript strict exécuté par `tsx` (pas de build). `tsconfig` : `strict`, `noUncheckedIndexedAccess`, `module NodeNext` (imports en `.js`).
- discord.js 14, better-sqlite3 (base `data/jdr.sqlite`, index FTS5 en mémoire pour le SRD), @anthropic-ai/sdk, vitest.
- PDF : pdf-lib 1.17 (feuille officielle à champs AcroForm), pdfkit 0.20 (annexe, fiche maison, export de campagne), polices @fontsource/cinzel et @fontsource/eb-garamond (OFL).

## Commandes utiles

```bash
npm start                 # lance le bot (lit .env)
npm run deploy-commands   # à relancer dès qu'une commande slash change (nom, description, options)
npm run typecheck
npm test                  # 3 tests sont sautés si ref/DD5-eFeuillePersoDD5.pdf est absent
npm run srd:verify        # compare les données au PDF du SRD (poppler requis, PDF dans ref/ ou SRD_PDF=...)
npm run backup            # sauvegarde SQLite
npx tsx scripts/render-official.ts magicien elfe sage /tmp/fiche.pdf   # fiche d'exemple
```

## Carte du code

- `src/index.ts` : client Discord (`allowedMentions: { parse: [] }`, écouteurs d'erreurs), routage des interactions, rappels automatiques (toutes les 5 min), surveillance `HEARTBEAT_URL` (`src/heartbeat.ts`).
- `src/commands.ts` : liste des commandes slash et type `Deps`. `src/deploy-commands.ts` : enregistrement.
- `src/config.ts` : variables d'environnement (n'affiche jamais les valeurs).
- `src/db.ts` : `Store` SQLite et migrations par `ALTER TABLE` (ajouter une colonne = une ligne de migration plus `toCampaign`).
- `src/campaigns.ts` : `resolveCampaign`, dans cet ordre : option `campagne`, salon ou catégorie de la commande (hors campagnes archivées), seule campagne du membre, seule campagne active du serveur, sinon erreur.
- `src/campaign-commands.ts` : `/setup`, `/campagne`, `/prochaine-seance`, `/style`, boutons `camp:` (confirmation d'archivage et de suppression).
- `src/setup.ts` : `runSetup` (idempotent, réutilise par nom) et l'interface `GuildPort`. `src/guild-port.ts` : son adaptation discord.js. Les tests utilisent un faux `GuildPort`.
- `src/archive.ts` : archivage, réactivation et suppression côté Discord (voir plus bas).
- `src/notes.ts`, `src/summarize.ts` : `/seance` et `/rappel` (brouillon Haiku, `completeWithRetry`). Les brouillons sont en base (`recap_drafts`, 7 jours).
- `src/prep.ts`, `src/service.ts` : `/preparer` (extraits du SRD trouvés par `src/srd/search.ts`, guide de style, 3 derniers rappels).
- `src/panel.ts` : tableaux de bord épinglés (boutons `panel:`, `mj:`, formulaires `panelm:`, `mjm:`, PDF de rencontre `enc:`), message d'accueil, échéance. Les réponses sont toujours éphémères : le message épinglé n'est jamais modifié.
- `src/tracking.ts` (suivi des personnages ; joueurs connus = `campaign_players` + créations, faute d'intent GuildMembers), `src/carnet.ts` (extraction Haiku en JSON depuis le rappel publié), `src/group-sheet.ts` (fiche de groupe), `src/encounter.ts` + `src/srd/creatures.ts` (budget de PX, SRD p. 213 ; FP et PX lus dans les blocs), `src/statblocks.ts`, `src/lookup.ts` (`/chercher` : SRD, données de création, documents du MJ via `src/guide/ref-index.json`), `src/srd/subclasses.ts` (les 12 sous-classes du SRD, repérées par une table explicite car les titres d'extraits sont irréguliers, avec leur nom court des documents du MJ).
- `src/schedule.ts` : rappel de la veille (avec le rappel précédent), appel aux notes des joueurs (14 h après le début, table `scheduled_sessions`), relances J-3 et J-1 de l'échéance.
- `src/style.ts` : `/style`. `src/schedule.ts` : dates, fuseau `Europe/Paris`, horodatages Discord. `src/export.ts` : PDF d'export de campagne. `src/help.ts` : `/aide` selon le rôle. `src/permissions.ts` : `canManageCampaign` (admin ou rôle MJ de la campagne).
- `src/character/` : création de personnage.
  - `state.ts` (historique de réponses rejouable, `editStep`/`cancelEdit`), `steps.ts` (`nextStep`/`applyAnswer`), `draft.ts`, `helpers.ts`.
  - `sheet.ts` (`computeSheet`, avec le détail des `calculations`), `validate.ts` (contrôles bloquants, récapitulatif), `rules.ts` (paramètres de campagne).
  - `wizard-ui.ts` (écrans Discord, `navRow`), `handlers.ts` (`/personnage`, interactions `pc:`), `explain.ts`, `spell-tags.ts`.
  - `official-sheet.ts` (remplissage pdf-lib), `pdf.ts` (annexe), `render.ts` (feuille officielle si le modèle existe, sinon fiche maison).
- `src/character/wizard-view.ts` : présentation de l'assistant sans discord.js (libellés d'étapes, résumé, tirage), partagée par `wizard-ui.ts` et le site.
- `src/site.ts` : `SITE_URL` et boutons-liens vers le site (aucun lien si la variable est absente). `src/publish.ts` : publication d'une fiche dans le salon des fiches, utilisée par le bouton Discord et par la file `publish_requests` (vérifiée toutes les 30 s, `startPublications`).
- `vitest.config.ts` : limite `npm test` aux tests du bot (`tests/`), le site a les siens.
- `src/srd/` : données de jeu. `data/*.json|ts` (classes, espèces dont l'Aasimar, 16 historiques, dons, sorts, textes des sorts, matériel, `srd-chunks.json` pour la recherche), `sources.ts` (sources hors SRD), `attribution.ts` (mention CC-BY-4.0 obligatoire), `items.ts` (`/objet`), `search.ts`.
- `src/guide/` : `/guide` (données extraites des PDF d'orientation par `scripts/guide/build_guide.py`) et `ref-index.json` (274 entrées tirées de tous les PDF de `ref/` pour `/chercher`, par `scripts/guide/build_ref_index.py` ; pdfplumber requis, à relancer si les PDF changent).
- `scripts/srd/` : extraction du SRD (non rejouable telle quelle, voir son README) et `verify.ts`.
- `Dockerfile` (Node 24, `npm ci --omit=dev`, utilisateur `node` uid 1000, code lisible par tous via `chmod -R a+rX`), `compose.yaml` (lecture seule, `cap_drop: ALL`, 768 Mo, volumes `data/`, `backups/`, `ref/` en lecture seule, aucun port publié).
- `deploy/` : `INSTALL.md` (étapes 0 à 5), `server/bootstrap.sh` (préparation du VPS, rejouable : Docker officiel en `docker.sources`, journaux limités, utilisateur `deploy`, ufw SSH seul, mises à jour automatiques, échange 2 Go, SSH par clé via `00-durcissement.conf`), `update.sh` (sur le serveur : pull de l'image, commandes Discord, redémarrage, attente de « Connecté en tant que »), `deploy.sh` (lance le workflow Deploy depuis un poste de travail).
- `.github/workflows/` : `ci.yml` (typecheck et tests, Node 24, construction de l'image sans publication), `srd.yml` (vérification SRD sur le PDF officiel téléchargé, seulement si les données changent ; ne bloque pas le déploiement), `deploy.yml` (après CI verte sur un push dans `main` de ce dépôt et si `DEPLOY_ENABLED` vaut `true` : image publiée sur `ghcr.io/guillxume/dnd-table-helper` avec le tag du commit et `latest`, puis `update.sh` par SSH ; le jeton GitHub du job sert au pull et passe par l'entrée standard).

## Sources et licences du contenu de jeu

- Base : SRD 5.2.1 FR, Wizards of the Coast, CC-BY-4.0 (https://www.dndbeyond.com/srd). La mention figure sur la fiche.
- Le SRD n'a qu'une sous-classe par classe : c'est normal, c'est un extrait du Manuel des joueurs 2024.
- Hors SRD, toujours tracé dans `src/srd/sources.ts` et marqué « Manuel 2024 » : 12 historiques (référentiel d'origines du MJ dans `ref/`), 6 dons (article D&D Beyond), Aasimar (fiche Roll20 du Player's Handbook 2024, noms de traits traduits par le bot).
- Origine de `ref/` : le référentiel d'origines, le guide d'orientation et les 13 trajectoires sont des PDF générés avec ChatGPT (`Author: OpenAI`, ReportLab), vérifiés par le MJ sur le site officiel. Seuls `FR_SRD_CC_v5.2.1.pdf` (WotC) et la feuille gdfl.be sont des documents d'origine.
- Pas d'extraction complète des livres 2024 (scanner les pages est exclu). Créatures, objets magiques, sorts de niveau 2 et plus et règles viennent du seul SRD 5.2.1. Les manques ponctuels peuvent venir des livres du MJ. L'assistant refuse d'extraire des données de copies non autorisées, quelle que soit la règle de ce fichier.
- Toute nouvelle donnée de jeu doit avoir une source citée. Après modification des données : `npm run srd:verify`.

## Pièges connus

- `.gitignore` et les exclusions rsync sont **ancrés à la racine** (`/data/`, `/ref/`) : `src/srd/data/` doit rester versionné. Ne pas écrire `data/` sans slash initial.
- Feuille officielle : le PDF de gdfl.be commence par un préfixe `<meta…>` à retirer avant pdf-lib. Certains champs sont orphelins (`attachOrphanFields`) ou sans `/DA` (apparence par défaut à poser). Les champs de compétences 9 à 13 sont décalés par rapport aux libellés imprimés : la table `SKILL_ROWS` fait la correspondance.
- Limites Discord : 100 caractères par description de commande ou d'option, 2000 caractères par message, 5 boutons par rangée (`navRow` découpe en plusieurs rangées), 50 salons par catégorie. Des tests vérifient ces limites pour toutes les classes et espèces.
- Imports circulaires : `campaign-commands.ts` charge `panel.ts` et `tracking.ts` par `await import(...)`, car `panel.ts` importe le module personnage, qui utilise `campaignOption` dès son chargement.
- `/aide` doit couvrir toutes les commandes et rester sous 4000 caractères (test) : textes d'aide courts.
- Réponses éphémères (`MessageFlags.Ephemeral`) par défaut. `allowedMentions: { parse: [] }` est posé sur le client (`src/index.ts`) : un message qui doit notifier un rôle le déclare lui-même (`allowedMentions: { roles }`).
- Haiku peut renvoyer une réponse vide : passer par `completeWithRetry` (`src/summarize.ts`).
- better-sqlite3 se compile pour la machine : ne jamais copier un `node_modules` d'une machine à l'autre.
- `tsx` est une dépendance de production (le bot tourne sans build). Ne jamais installer avec `--omit=optional` : esbuild, utilisé par tsx, reçoit son binaire Linux par une dépendance optionnelle.
- Docker : les volumes `data/` et `backups/` du serveur doivent appartenir à l'uid 1000 (`node` dans l'image). Un port publié par compose contourne ufw. Mémoire mesurée : environ 300 Mo en génération de PDF.
- `/setup` réutilise un salon commun (#général, #calendrier) de même nom n'importe où sur le serveur ; les salons de campagne, eux, sont cherchés dans la catégorie de la campagne.
- Équipement : pluriels gérés par `pluralFr` (pas de « 2 bâton de combats »).
- Le site importe des modules de `src/` : ne pas y ajouter d'import de discord.js dans un module déjà utilisé par le site (par exemple `wizard-view.ts`, `state.ts`, `steps.ts`, `validate.ts`, `render.ts`, `db.ts`, `permissions.ts`, `label.ts`, `explain.ts`…). Le typecheck du site le détecte.
- Les textes d'aide des étapes (`steps.ts`) renvoient à Discord (« Détails des options », `/guide`) : le site les adapte (`web/src/server/game/wizard-view.ts`, test par classe). Un nouveau renvoi à une commande doit y être ajouté.
- Profil Compose `web` : `update.sh` l'active seulement si `/srv/jdr-helper/.env.web` existe. Sans ce fichier, le serveur ne fait tourner que le bot.

## Archivage et suppression des campagnes

- `/campagne archiver` (MJ ou admin, confirmation) : les salons de la catégorie de la campagne vont dans la catégorie commune « Archives », renommés `<slug-campagne>-<salon>`. Ils sont en lecture seule pour tout le serveur, sauf `#aide-mj` qui n'est visible que des administrateurs. La catégorie et les rôles « MJ <nom> » et « Joueurs <nom> » sont supprimés, la séance prévue est annulée. Les données du bot sont conservées et la liste des salons archivés est stockée (`campaigns.archived_channels`).
- `/campagne reactiver` (admin) : recrée les rôles et la catégorie, remet les salons (noms et droits d'origine), puis `runSetup` complète ce qui manque.
- `/campagne supprimer` (admin, confirmation) : supprime salons (archivés compris), catégorie, rôles, puis les données. Si Discord échoue, les données sont gardées pour pouvoir relancer.
- Garde-fous : un rôle dont le nom n'est pas exactement « MJ <nom> » ou « Joueurs <nom> » n'est jamais supprimé, et une campagne sans catégorie propre garde ses salons en place.
- Pas encore testé sur un vrai serveur Discord.

## Données manquantes connues

À relever dans les manuels :

- l'option A d'équipement des 11 historiques hors SRD (seul le Voyageur est connu ; les autres reçoivent 50 po) ;
- les noms officiels français des traits de l'Aasimar ;
- la table de fabrication rapide du don Fabricant ;
- la récupération des points du don Chanceux.

## Déploiement

- VPS Linux préparé par `deploy/server/bootstrap.sh`. Accès SSH par clé uniquement, `root` interdit.
- Utilisateur `deploy` : déploiements de GitHub Actions (clé enregistrée dans les secrets `VPS_*`), groupe docker. Pare-feu ufw : SSH seul (plus 80/443 quand le site est en service).
- Bot : `/srv/jdr-helper` (`compose.yaml`, `update.sh`, `.env` en 600 lisible par `deploy` seul, `data/` et `backups/` à l'uid 1000, `ref/`). Commandes manuelles : `sudo -u deploy docker compose …` (voir `deploy/INSTALL.md`).
- Déploiement automatique quand la variable de dépôt `DEPLOY_ENABLED` vaut `true` (environnement `production`) : chaque fusion sur `main` redémarre le bot avec la nouvelle image.
- Sauvegarde : crontab de `deploy`, 4 h 15, dans `/srv/jdr-helper/backups` (14 jours), journal `journalctl -t jdr-backup`.
- Copie hors serveur : tâche launchd d'un Mac (`deploy/mac/`) qui récupère ces copies à l'ouverture de session puis toutes les heures (90 jours).
- API Anthropic : crédits prépayés sans rechargement automatique, donc dépense bornée par le crédit. Crédit épuisé : seules les fonctions Haiku (rappel, préparation, idées, conseil de sorts, carnet) affichent une erreur.
