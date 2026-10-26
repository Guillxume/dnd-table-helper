# La Table de l'Étoile : le site

Site web de la table, dans le dépôt jdr-helper (dossier `web/`), à côté du bot Discord dont il réutilise le code et la base. Deux espaces :

- **l'espace des joueurs** (connexion avec Discord) : création de personnage pas à pas, fiche détaillée, fiche PDF officielle, publication dans le salon des fiches ;
- **l'atelier du MJ** (connexion par e-mail) : bibliothèque d'illustrations, référentiel artistique (fiches canoniques, guides de direction artistique), briefs pour ChatGPT Images, archives des générations, cartes de bataille quadrillées à imprimer.

Choix d'architecture : [ADR 0001](../docs/adr/0001-site-web-dans-jdr-helper.md). Mise en service sur le VPS : [deploy/INSTALL.md, section 5](../deploy/INSTALL.md).

L'application est la source de vérité de la bibliothèque. Elle n'appelle aucune API d'IA : les prompts se copient dans ChatGPT et les résultats se réimportent à la main (voir [Workflow ChatGPT Images](#workflow-chatgpt-images)).

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Démarrage en local](#démarrage-en-local)
- [Variables d'environnement](#variables-denvironnement)
- [Commandes](#commandes)
- [Tests](#tests)
- [Architecture](#architecture)
- [Modèle de données](#modèle-de-données)
- [Sécurité et confidentialité](#sécurité-et-confidentialité)
- [Workflow ChatGPT Images](#workflow-chatgpt-images)
- [Mise en service et sauvegardes](#mise-en-service-et-sauvegardes)
- [Limites connues et suites](#limites-connues-et-suites)

## Fonctionnalités

| Espace | Ce qu'on peut faire |
|---|---|
| Espace des joueurs | Connexion avec Discord, accès selon les rôles du serveur (mêmes règles que le bot). Création de personnage une question par écran, avec aide détaillée, retour arrière, modification d'une étape et reprise ; brouillon partagé avec l'assistant Discord. Fiche détaillée, PDF officiel, fiche à cases vides pour les dés lancés à la table, publication dans le salon des fiches (faite par le bot). Le MJ y voit aussi les personnages de ses campagnes. |
| Cartes de bataille | À partir d'une image vue du dessus : quadrillage posé par le site (cases de 2,5 cm ou d'un pouce), aperçu du découpage, alerte de netteté, PDF à l'échelle sur feuilles A4 avec plan d'assemblage et repères. Modèle de brief « Carte » (vue de dessus, sans figurines ni quadrillage dessinés). |
| Tableau de bord | Derniers imports, favoris, collections récemment consultées, dernières générations, raccourcis par catégorie, compteurs, étapes de démarrage tant que la bibliothèque est incomplète. |
| Bibliothèque | Mosaïque responsive à miniatures WebP, chargement progressif (« Charger plus », 48 par page), recherche plein texte, filtres combinables (catégorie, tags, collection, favori, origine, dates d'import), tris (import, titre, date de création de l'œuvre), sélection multiple (Maj + clic pour une plage), actions en masse (favoris, tags, collections, catégorie, suppression), comparaison côte à côte de 2 à 4 images. |
| Fiche illustration | Aperçu grand format, visionneuse plein écran avec zoom (molette, pincement, glisser, double-clic, pleine résolution), navigation ← → dans la vue filtrée, édition des métadonnées, tags, collections, usages, téléchargement de l'original, suppression avec bilan des liens retirés. |
| Import | Glisser-déposer ou sélection multiple, JPEG / PNG / WebP / AVIF, progression et erreur par fichier, détection des doublons par empreinte SHA-256, métadonnées communes facultatives (provenance pouvant rester « inconnue »). |
| Organisation | Catégories configurables (15 suggestions à l'installation, modifiables et supprimables), tags renommables, collections avec couverture. |
| Personnages | Fiche canonique structurée (un champ vide reste « Inconnu »), éléments typés : canon (dont « intangible »), préférences, propositions non validées, exclusions, questions ouvertes. Une proposition ne devient canonique que par validation explicite. Références validées, historique des générations. |
| Direction artistique | Guides par aspect (20 aspects : style pictural, éclairage, matières, composition, éléments à éviter…), variantes qui héritent des règles communes sans pouvoir les effacer, versions immuables et historique des changements, références associées à un ou plusieurs aspects. |
| Atelier de briefs | Brief en 10 sections et prompt générés de façon déterministe à partir de la fiche, du guide et des références (rôle *style* / *contenu* / *les deux*), entièrement modifiables, copie du prompt ou du brief, export JSON, liste ordonnée des images à joindre avec téléchargement. |
| Générations | Archivage de l'image obtenue, du prompt réellement utilisé, d'une copie du brief, des références, de la version du guide, du personnage, du statut (brouillon, à évaluer, validée, rejetée), des notes et du lien d'origine ; nouvelles versions chaînées à la précédente. |
| Recherche | Recherche transverse (illustrations, personnages, collections, générations, briefs, tags), insensible aux accents et à la casse. |

## Démarrage en local

Prérequis : Node.js 22 (20.9 minimum), pnpm 10, Docker avec Compose. Toutes les commandes se lancent dans `web/`.

```bash
cp .env.example .env
# Remplacer chaque « remplacer-par-… » par une valeur générée (openssl rand -hex 32),
# en recopiant POSTGRES_PASSWORD dans DATABASE_URL et TEST_DATABASE_URL.

docker compose up -d            # PostgreSQL (port 5434) + stockage S3 SeaweedFS (port 8334)
pnpm install                    # génère aussi le client Prisma
pnpm db:migrate                 # applique les migrations sur la base de développement
pnpm storage:init               # crée le bucket
pnpm db:seed                    # catégories initiales (une seule fois, si la table est vide)
pnpm user:create --email vous@example.com --name "Votre nom"
pnpm dev                        # http://localhost:3000 (build webpack, voir l'ADR 0001)
```

L'espace des joueurs lit la base SQLite du bot (`JDR_DB_PATH`, par défaut `../data/jdr.sqlite`) : en local, utiliser une copie de travail, jamais la base du serveur. La connexion Discord n'apparaît que si `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET` sont renseignés, avec l'adresse de retour `http://localhost:3000/api/auth/callback/discord` déclarée dans le portail développeur Discord.

**Créer le premier compte** : l'inscription publique est désactivée. `pnpm user:create` demande le mot de passe (12 caractères minimum) dans le terminal, sans écho. En contexte non interactif, il le lit dans `INITIAL_USER_PASSWORD`. Il n'est jamais accepté en argument, pour ne pas finir dans l'historique du shell.

Le stockage S3 met une quinzaine de secondes à accepter des requêtes après `docker compose up` ; `pnpm storage:init` réessaie automatiquement.

## Variables d'environnement

Toutes sont validées au premier accès (`src/server/env.ts`) ; une valeur invalide arrête l'application avec le nom de la variable (jamais sa valeur).

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL de l'application et de Prisma. |
| `TEST_DATABASE_URL` | Base des tests (vidée par les tests). Doit différer de `DATABASE_URL`. |
| `BETTER_AUTH_SECRET` | Secret de signature des sessions, 32 caractères minimum. |
| `BETTER_AUTH_URL` | URL publique exacte (`https://…` en production). |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | Stockage objet. `S3_ENDPOINT` vide = AWS S3. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Identifiants S3 (SeaweedFS les reçoit au démarrage, ils ne sont écrits dans aucun fichier du dépôt). |
| `S3_FORCE_PATH_STYLE` | `true` pour SeaweedFS, MinIO, Garage. |
| `S3_TEST_BUCKET` | Bucket des tests (vidé par les tests). |
| `UPLOAD_MAX_MB` | Taille maximale d'un fichier importé (défaut 40). |
| `JDR_DB_PATH` | Base SQLite du bot, partagée (campagnes, brouillons, personnages, demandes de publication). |
| `DISCORD_GUILD_ID` | Serveur Discord de la table (même valeur que pour le bot). |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Application Discord du bot, pour la connexion des joueurs (OAuth2, portée `guilds.members.read`). |
| `ANTHROPIC_API_KEY` | Facultatif. Active « Idées de l'assistant » (étape de l'histoire) et « Conseil de l'assistant » (choix des sorts), avec les mêmes consignes que le bot. Modèle : `ANTHROPIC_MODEL`, par défaut celui du bot. |
| `ASSISTANT_HOURLY_LIMIT` | Demandes à l'assistant par joueur et par heure glissante (12 par défaut). Compteur en mémoire, remis à zéro au redémarrage. |
| `SHEET_TEMPLATE` | Chemin absolu de la feuille de personnage officielle (sinon fiche maison). |
| `POSTGRES_*`, `POSTGRES_HOST_PORT`, `S3_HOST_PORT` | Services Docker de développement. |

Le détail commenté est dans [.env.example](.env.example). `.env` est ignoré par Git ; en production, la configuration est dans `/srv/jdr-helper/.env.web` (modèle : `deploy/web/env.web.example`).

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | Serveur de développement. |
| `pnpm build` / `pnpm start` | Build de production (sortie autonome) / démarrage de ce build. |
| `pnpm lint`, `pnpm typecheck` | ESLint, contrôle TypeScript (après génération des types de routes). |
| `pnpm test` | Tests unitaires et d'intégration (Vitest). |
| `pnpm test:e2e` | Tests de bout en bout (Playwright, sur un build de production). |
| `pnpm db:migrate` | Développement : crée et applique une migration après modification de `prisma/schema.prisma`. |
| `pnpm db:deploy` | Production : applique les migrations versionnées existantes, sans en créer. |
| `pnpm db:seed` | Catégories initiales si aucune n'existe. |
| `pnpm storage:init` | Crée le bucket s'il n'existe pas. |
| `pnpm storage:orphans [--delete]` | Liste (ou supprime) les fichiers du stockage sans illustration correspondante. |
| `pnpm user:create --email … [--name …]` | Crée un compte. |

**Migrations** : elles sont versionnées dans `prisma/migrations/`. Workflow : modifier `schema.prisma`, lancer `pnpm db:migrate --name description`, relire le SQL généré, le committer. En production, `pnpm db:deploy` (exécuté automatiquement par le service `web-migrate` du `compose.yaml` de production). Une migration déjà appliquée ne se modifie jamais : on en ajoute une nouvelle.

## Tests

```bash
docker compose up -d                 # les tests utilisent la base jdr_library_test et le bucket S3_TEST_BUCKET
pnpm test                            # unitaires + intégration
pnpm exec playwright install chromium   # une fois
pnpm test:e2e                        # build de production + navigateur
```

Les tests d'intégration et E2E tournent sur la vraie base et le vrai stockage (pas de simulation), dans des ressources de test distinctes ; ils refusent de démarrer si celles-ci sont identiques à celles de développement.

Correspondance avec les scénarios de validation :

| # | Scénario | Couvert par |
|---|---|---|
| 1 | Non authentifié : pas d'accès à la bibliothèque | `tests/e2e/library.spec.ts` (redirection, 401 fichiers et import), `tests/integration/access-control.test.ts` |
| 2 | Import d'une image | `tests/integration/import-asset.test.ts`, `tests/e2e/library.spec.ts` |
| 3 | Original et miniature stockés | `tests/integration/import-asset.test.ts` (lecture des objets S3, dimensions et format vérifiés) |
| 4 | L'image apparaît dans la galerie | `tests/integration/import-asset.test.ts`, `tests/e2e/library.spec.ts` (miniature réellement chargée) |
| 5 | Tags et collections | `tests/integration/library.test.ts`, `tests/e2e/library.spec.ts` |
| 6 | Recherche et filtres | `tests/integration/library.test.ts`, `tests/unit/search-and-filters.test.ts`, `tests/e2e/library.spec.ts` |
| 7 | Fiche personnage liée à des références | `tests/integration/art-reference.test.ts`, `tests/e2e/workflow.spec.ts` |
| 8 | Guide artistique et références | `tests/integration/art-reference.test.ts`, `tests/e2e/workflow.spec.ts` |
| 9 | Brief préparé, modifié, copié, archivé | `tests/unit/build-brief.test.ts`, `tests/integration/art-reference.test.ts`, `tests/e2e/workflow.spec.ts` (copie vérifiée dans le presse-papiers, export JSON) |
| 10 | Génération importée et liée à son prompt et à ses références | `tests/integration/art-reference.test.ts`, `tests/e2e/workflow.spec.ts` |
| 11 | Fichier non autorisé rejeté | `tests/unit/validate-upload.test.ts`, `tests/integration/import-asset.test.ts`, `tests/integration/access-control.test.ts` (SVG), `tests/e2e/library.spec.ts` |
| 12 | Fichiers privés inaccessibles sans autorisation | `tests/integration/access-control.test.ts` (sans cookie et cookie forgé → 401), `tests/e2e/library.spec.ts` |

## Architecture

Une seule application Next.js (App Router) ; PostgreSQL et un stockage S3 à côté. Pas de backend séparé.

```
src/
  app/
    (app)/…            pages protégées (layout = contrôle de session + navigation)
      */actions.ts     Server Actions (mutations) : session → validation Zod → service
    login/             connexion
    api/
      assets/          POST import (un fichier par requête, progression côté client)
      files/[assetId]/[variant]/   GET fichiers, après contrôle de session
      briefs/[briefId]/export/     GET export JSON
      auth/[...all]/   Better Auth
  proxy.ts             redirection optimiste vers /login (ancien « middleware »)
  server/              code serveur uniquement
    env.ts, db.ts, auth.ts, session.ts, action-utils.ts
    storage/           interface ObjectStorage + implémentation S3
    images/            validation des fichiers (octets magiques) et dérivés (sharp)
    assets/, library/, characters/, style-guides/, briefs/, generations/, search/
                       services métier et requêtes Prisma
  lib/                 code pur partagé (filtres, libellés, constructeur de brief, règles de style)
  components/          composants React (ui/ = shadcn, le reste par domaine)
prisma/                schéma, migrations versionnées, seed
design/                design system livré (theme.css, icônes, logos) : la source de vérité visuelle
public/brand/          logos servis tels quels (accessibles sans connexion, pour la page de connexion)
scripts/               création de compte, bucket, orphelins, sauvegarde/restauration, génération des icônes
tests/                 unit/, integration/, e2e/, support/
```

Repères pour un développeur Symfony :

| Symfony | Ici |
|---|---|
| Contrôleur + Twig | Page (`page.tsx`), composant serveur : lit les données et rend le HTML. |
| Action de formulaire / contrôleur POST | Server Action (`actions.ts`), appelée par `<form action>` ; route handler (`route.ts`) pour l'import et les fichiers. |
| Form + Validator | Schéma Zod côté serveur (dans le service), `useActionState` côté client pour afficher les erreurs. |
| Firewall / Voter | `requireUser()` en tête de chaque page et action (`runAction`), `getUserFromRequest()` dans les routes. |
| Doctrine + migrations | Prisma (`schema.prisma`, `prisma/migrations`) ; SQL brut via `$queryRaw` pour la recherche. |
| Services | `src/server/**` : fonctions métier sans dépendance à l'interface, testées directement. |
| Flysystem | `ObjectStorage` (`src/server/storage`). |

Choix et raisons détaillés : [PLAN.md](PLAN.md).

### Espace de campagne

`/campagnes` reprend les outils MJ du bot sur la même base SQLite et avec les mêmes droits (`web/src/server/game/campaigns.ts`). Tout ce qui doit paraître sur Discord (annonce de séance, rappel publié) est écrit dans la table `discord_posts` ; le bot l'envoie dans le salon de la campagne toutes les 30 secondes (`src/publish.ts`). Ce qui crée ou modifie des salons et des rôles (`/setup`, archivage, ajout de joueur) reste dans le bot.

### Design system

- Thème : `design/theme.css` recopié dans `src/app/globals.css` (sombre « taverne » par défaut, `class="dark"` sur `<html>` ; clair « parchemin » au choix du visiteur, cookie `theme` lu par le layout racine). Toute modification de couleur se fait dans les deux fichiers.
- Polices : Atkinson Hyperlegible Next (texte) et Cinzel (titres), auto-hébergées par `next/font` dans `src/app/layout.tsx`.
- Icônes : `node scripts/build-icons.mjs` génère `src/components/icons/rpg-icons.tsx` depuis `design/icones` (métadonnées de provenance retirées, identifiants de masque rendus uniques). Utilisation : `<RpgIcon name="classe-clerc" className="size-6" />`. La correspondance avec le moteur (classes, espèces, écoles, caractéristiques) est dans `src/components/icons/icon-names.ts`, vérifiée par `tests/unit/icon-names.test.ts`.
- Classes utilitaires : `quest-card` (avis de quête épinglé), `wood-panel`, `on-wood` (anneau de focus lisible sur le bois), couleurs d'état `text-success`, `bg-warning-bg`, etc. Chargement : `<D20Loader />` (d20 qui roule, immobile si l'animation est réduite).

## Modèle de données

- **Better Auth** : `user`, `session`, `account`, `verification`.
- **Asset** : une illustration. Trois objets dans le stockage (`assets/<id>/original.<ext>`, `thumbnail.webp` 640 px, `preview.webp` 2048 px). Empreinte `sha256` unique pour les doublons. `origin` : EXTERNAL, GENERATED, OWN_WORK, UNKNOWN. `searchText` : texte normalisé (sans accents) agrégeant titre, description, notes, artiste, catégorie, tags, collections et personnages liés, indexé en trigrammes (GIN `pg_trgm`).
- **Category** (SET NULL à la suppression), **Tag** + **AssetTag**, **Collection** + **CollectionAsset** (CASCADE sur les liens uniquement).
- **Character** (champs canoniques) + **CharacterTrait** (statut CANON / PREFERENCE / PROPOSAL / EXCLUDED / UNDETERMINED, `locked`) + **CharacterAsset** (`validated`).
- **StyleGuide** (`parentId` : variante, un niveau) → **StyleGuideVersion** (numérotée, immuable) → **StyleGuideRule** (aspect × texte) ; **StyleGuideAsset** (aspects illustrés).
- **Brief** (paramètres + 10 sections + prompt) + **BriefReference** (rôle, aspects, note, ordre).
- **GenerationRecord** (image, prompt, copie du brief, version de guide, personnage, statut, `previousId` pour la chaîne de versions) + **GenerationReference**.

Suppressions : supprimer une illustration retire ses liens (collections, fiches, guides, briefs, références de générations) et laisse une génération dont elle était le résultat sans image ; la confirmation affiche ce bilan. Supprimer un brief, un guide ou un personnage ne supprime aucune image ni génération.

## Sécurité et confidentialité

- Toutes les pages, Server Actions et routes vérifient la session côté serveur. Le proxy ne fait qu'une redirection de confort.
- Deux rôles. MJ (`admin`, comptes créés en ligne de commande, connexion par e-mail) : tout le site. Joueur (`player`, connexion Discord) : uniquement l'espace des personnages, limité aux campagnes autorisées par ses rôles Discord. Le rôle est attribué par le serveur et n'est jamais modifiable par le client (testé). Aucune inscription publique par e-mail.
- Connexion limitée à 5 tentatives par minute et par adresse IP (limiteur en mémoire de Better Auth, vérifié : la 6e tentative reçoit 429) ; message d'erreur identique pour un e-mail inconnu ou un mauvais mot de passe. Voir la note sur `X-Forwarded-For` dans [Déploiement](#déploiement-sur-un-serveur).
- Fichiers : bucket privé jamais exposé ; la route `/api/files` est l'unique accès. Réponses `Cache-Control: private, no-cache` (revalidées à chaque affichage, donc refusées après déconnexion) et `X-Content-Type-Options: nosniff`.
- Import : contrôle des octets magiques, de l'extension et du type annoncé, taille maximale, plafond de pixels contre les images « bombes ». SVG, GIF et tout autre format sont refusés.
- En-têtes : CSP (production), `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` (les liens vers les sources externes ne révèlent pas l'adresse de la bibliothèque), `Permissions-Policy`.
- Les Server Actions vérifient l'origine des requêtes (protection CSRF intégrée à Next.js) ; les cookies de session sont `HttpOnly`, `SameSite=Lax`, et `Secure` dès que `BETTER_AUTH_URL` est en HTTPS.
- Journalisation : messages d'erreur sans configuration ni secrets.
- Les fichiers originaux sont conservés intacts, **métadonnées EXIF comprises** (dont une éventuelle position GPS). Ils restent privés, mais ces métadonnées partent avec le fichier si vous le téléchargez pour le joindre à ChatGPT.

**Confidentialité externe.** ChatGPT n'a aucun accès à la bibliothèque. Une image jointe à ChatGPT quitte le stockage privé : elle est alors traitée par OpenAI selon ses propres conditions et paramètres de compte (historique, entraînement). Le caractère privé de cette bibliothèque ne protège que ce qu'elle stocke, pas ce que vous envoyez ailleurs.

## Workflow ChatGPT Images

1. Créer ou compléter la fiche du personnage et le guide artistique.
2. Atelier → *Nouveau brief* : sujet, fiche, guide, références (pour chacune : style seul, contenu seul ou les deux ; aspects à reprendre), cadrage, contraintes, exclusions.
3. Relire et retoucher les 10 sections et le prompt, puis *Copier le prompt*.
4. Télécharger les images listées dans « Images à joindre » et les joindre dans ChatGPT **dans l'ordre indiqué** (le prompt y fait référence en « image 1 », « image 2 »…).
5. Télécharger l'image obtenue, puis *Archiver une génération* depuis le brief : l'image, le prompt et les références sont préremplis ; collez le prompt exact si vous l'avez ajusté dans ChatGPT.
6. Évaluer (statut), noter les corrections, puis *Nouvelle version* pour itérer en gardant le lien avec la précédente. Une génération validée peut ensuite être ajoutée comme référence validée sur la fiche du personnage.

## Mise en service et sauvegardes

Le site tourne sur le VPS avec le bot, dans le même projet Compose (profil `web`) : voir [deploy/INSTALL.md, section 5](../deploy/INSTALL.md). Image : `web/Dockerfile`, construite depuis la racine du dépôt (`docker build -f web/Dockerfile .`). Sauvegarde nuitière vérifiée de la base et des images : `deploy/web/backup-site.sh`, restauration : `deploy/web/restore-site.sh` (scénario testé de bout en bout sur une copie locale du serveur le 20/10/2026).

Stockage : SeaweedFS est fourni parce que les images Docker officielles de MinIO ne sont plus distribuées (constaté le 19/10/2026). Le site ne dépend que de l'API S3 : MinIO compilé, Garage, Cloudflare R2 ou AWS S3 restent possibles en changeant les variables `S3_*`.
## Limites connues et suites

Limites actuelles :
- La connexion Discord réelle n'a pas pu être testée de bout en bout sans l'application Discord configurée : les tests simulent un joueur dont les rôles sont déjà connus.
- Les rôles Discord d'un joueur sont relus au plus toutes les 10 minutes (ou avec « Vérifier à nouveau mes accès ») : un retrait de rôle n'est pas immédiat.
- Une fiche publiée depuis le site apparaît sur Discord dans les 30 secondes (le bot traite les demandes à ce rythme).
- Pas de récupération automatique depuis ChatGPT ni d'appel à une API d'image : import manuel, faute d'intégration officielle permettant d'accéder aux images privées.
- Netteté des cartes : une image générée étalée sur une grande carte imprime flou ; les seuils d'alerte (100 et 60 points par pouce) sont à valider sur une première impression.
- Pagination par décalage, adaptée à quelques milliers d'images ; navigation ← → limitée aux 10 000 premiers résultats d'une vue filtrée.
- Dans la mosaïque, l'ordre de tabulation suit les colonnes et non les lignes.
- Limiteur de tentatives de connexion en mémoire (une seule instance du site).
- Les métadonnées EXIF des originaux ne sont pas retirées.

Prochaines étapes suggérées :
1. ~~Direction artistique du site, appliquée en priorité à l'espace des joueurs.~~ Fait (design system dans `design/`).
2. ~~Promotion d'une génération validée en référence validée du personnage, en un clic.~~ Fait (bouton sur la page d'une génération validée).
3. Lien entre les fiches de règles (bot) et les fiches canoniques d'illustration (atelier).
4. Outils du MJ du bot repris dans le site (carnet, séances, préparation, suivi) après le 21/11.
