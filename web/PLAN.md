# PLAN : Bibliothèque privée d'inspiration artistique JDR

Document de pilotage. Mis à jour au fil de l'implémentation : l'état de chaque étape est indiqué par `[x]` (fait et vérifié), `[~]` (partiel, voir note) ou `[ ]` (à faire).

## 1. Constat initial (inspection du 2026-10-19)

- Dépôt Git vide (aucun commit), seul `context.md` présent : pas d'existant à préserver.
- Machine : Node 22.19, pnpm 10.28, Docker 29 + Compose v5. Ports hôtes déjà occupés par d'autres projets : 5432, 5433, 6379, 7700, 9002, 80, 443, 3100, 5000, 7000.
  → ports retenus : PostgreSQL **5434**, stockage S3 **8334**, application **3000**.
- **MinIO n'est plus distribué en image Docker** : `minio/minio` renvoie `denied` sur Docker Hub et `quay.io/minio/minio` n'a plus de manifeste. Un compose basé sur MinIO ne démarrerait pas.
  → stockage S3 auto-hébergé avec **SeaweedFS 4.48** (`chrislusf/seaweedfs:4.48`, maintenu, API S3). L'application ne parle que l'API S3 via le SDK AWS : MinIO (build source), Garage, Cloudflare R2 ou AWS S3 restent utilisables en changeant les variables `S3_*`.

## 2. Décisions techniques

| Sujet | Choix | Raison |
|---|---|---|
| Framework | Next.js 16.3.8 (App Router, Turbopack), React 19.2 | Imposé ; version stable publiée depuis plus de deux semaines. |
| Langage | TypeScript 5.9 strict | TS 6/7 non supportés par `typescript-eslint` (pair `<6.1`) ; TS 5.9 est la version installée par create-next-app. |
| UI | Tailwind 4 + shadcn/ui (base Radix) + lucide-react | Composants accessibles copiés dans le dépôt, donc modifiables sans dépendre d'une librairie opaque. |
| Base de données | PostgreSQL 17 + Prisma 7.10 (adaptateur `pg`) | Prisma 8 n'existe qu'en RC ; 7.10.0 est la dernière stable. |
| Recherche | Colonne `searchText` normalisée (minuscules, sans accents via `unaccent`) + index GIN `pg_trgm` | Recherche par sous-chaîne tolérante aux accents (« elamaer » trouve « Élamaër »), sans moteur externe. |
| Auth | Better Auth 1.7 (email + mot de passe, sessions en base), inscription publique **désactivée** | Solution maintenue et intégrée à Next.js, limitation de débit et vérification d'origine incluses. Le compte est créé en ligne de commande. |
| Modèle d'accès | Mono-bibliothèque : tout compte authentifié accède à toute la bibliothèque | Besoin mono-utilisateur ; pas de système de rôles (cf. §6 du cahier des charges). |
| Stockage | Service `ObjectStorage` (interface) + implémentation S3 ; bucket privé jamais exposé | Changement de fournisseur sans toucher au métier. |
| Accès aux fichiers | Route `/api/files/[assetId]/[variant]` authentifiée qui relaie le flux S3 | Un seul service exposé (l'app) ; contrôle d'accès à chaque requête. Les URL signées S3 ne sont pas nécessaires tant que le stockage n'est pas exposé publiquement. |
| Images | `sharp` : miniature WebP 640 px, aperçu WebP 2048 px, original conservé intact ; couleur dominante pour les placeholders | Ne jamais charger les originaux dans la galerie. |
| Validation | Zod 4 côté serveur (actions, routes) ; contrôle des octets magiques + MIME + extension pour les fichiers | Le type déclaré par le navigateur n'est pas fiable. |
| Formulaires | Server Actions + `useActionState`, pas de librairie de formulaires | Formulaires majoritairement plats ; la validation vit côté serveur (Zod). À reconsidérer si un formulaire devient très dynamique. |
| Upload | Route handler `POST /api/assets` (un fichier par requête, XHR pour la progression) | Les Server Actions passent par le proxy Next qui met en mémoire tampon 10 Mo max ; la route upload est exclue du proxy. |
| Pagination galerie | Offset + bouton « Charger plus » (48 par page), total affiché | Tri sur colonnes nullables (date de création de l'œuvre) incompatible avec un curseur simple ; volume visé (milliers d'images) sans problème en offset. |
| Tests | Vitest (unitaires + intégration sur vraie base et vrai S3) ; Playwright (E2E sur build de production) | Les scénarios critiques (accès non autorisé, stockage) se vérifient sur l'infrastructure réelle. |
| Déploiement | Dev : `web/docker-compose.yml` (Postgres + S3). Production : `compose.yaml` du dépôt, profil `web` (site, Postgres, S3, Caddy), à côté du bot | Une seule machine, un seul projet Compose ; seul Caddy publie des ports. |

## 3. Modèle de données (résumé)

- **Auth** (format Better Auth) : `user`, `session`, `account`, `verification`.
- **Category** (configurable, seedée une seule fois si vide) → `Asset.categoryId` (SET NULL).
- **Asset** : fichier original + miniature + aperçu, métadonnées, `origin` (EXTERNAL / GENERATED / OWN_WORK / UNKNOWN), `sha256` unique (doublons), `searchText` dénormalisé.
- **Tag** (nom unique insensible à la casse) ⟷ **AssetTag**.
- **Collection** (+ `lastViewedAt`) ⟷ **CollectionAsset**.
- **Character** : champs canoniques structurés + **CharacterTrait** (statut CANON / PREFERENCE / PROPOSAL / EXCLUDED / UNDETERMINED, `locked` = ne jamais modifier) + **CharacterAsset** (référence, `validated`).
- **StyleGuide** (`parentId` pour les variantes, un seul niveau) → **StyleGuideVersion** (append-only, numérotée) → **StyleGuideRule** (aspect × contenu) ; **StyleGuideAsset** (références associées à un ou plusieurs aspects).
- **Brief** : paramètres + 10 sections éditables + prompt ; **BriefReference** (rôle STYLE / CONTENT / STYLE_AND_CONTENT, aspects, note, ordre).
- **GenerationRecord** : image (Asset d'origine GENERATED), prompt, instantané du brief, version de guide, personnage, statut, notes, URL d'origine, `previousId` (chaîne de versions) ; **GenerationReference**.

## 4. Étapes

### Phase 1 : Inspection et architecture
- [x] Inspection du dépôt et de l'environnement
- [x] Choix techniques et PLAN.md
- [x] Variables d'environnement (`.env.example`) et services (`docker-compose.yml`)

### Phase 2 : Socle
- [x] Next.js 16, TypeScript strict, Tailwind 4, shadcn/ui (Radix)
- [x] PostgreSQL + Prisma 7 + migration versionnée (extensions `pg_trgm`, `unaccent`, fonction `jdr_normalize`)
- [x] Authentification Better Auth, inscription fermée, création de compte en CLI, limitation des tentatives
- [x] Stockage objet (interface + S3, initialisation du bucket avec reprise)

### Phase 3 : Bibliothèque
- [x] Import multiple (glisser-déposer, progression, erreurs par fichier, doublons SHA-256)
- [x] Miniatures/aperçus WebP et route de fichiers protégée
- [x] Galerie (mosaïque, filtres dans l'URL, tris, sélection multiple, actions en masse, comparaison)
- [x] Fiche illustration (zoom plein écran, navigation ← →, édition, suppression avec bilan)
- [x] Tags, collections (couverture, consultations récentes), catégories configurables, favoris
- [x] Recherche (galerie + recherche transverse)

### Phase 4 : Référentiel artistique
- [x] Fiches personnages (champs canoniques, éléments typés, validation explicite des propositions, références validées)
- [x] Guides artistiques, variantes, versions immuables, références par aspect

### Phase 5 : Workflow de génération
- [x] Atelier de brief (10 sections + prompt déterministes, édition, copie, export JSON, images à joindre)
- [x] Archivage des générations (import manuel, statuts, chaîne de versions)

### Phase 6 : Validation
- [x] Tests unitaires et d'intégration (vraie base, vrai stockage)
- [x] Tests E2E (Playwright, build de production)
- [x] Lint, typecheck, build de production
- [x] Image Docker de production vérifiée (migrations, compte, connexion, import, fichiers, healthcheck)
- [x] Sauvegarde/restauration vérifiées sur une pile de production locale
- [x] README et documentation d'exploitation

### Écarts et ajustements en cours de route
- MinIO remplacé par SeaweedFS (images MinIO indisponibles) ; `-volume.max=0` nécessaire, la valeur par défaut (8 volumes) étant épuisée dès le deuxième bucket.
- Entités du cahier des charges renommées : `CharacterReference` → `Character` (+ `CharacterTrait`), ajout de `StyleGuideRule` et `Brief`/`BriefReference` (le brief vit indépendamment des générations, chaque génération en garde une copie).
- Ajout d'une vue de comparaison (2 à 4 images), prévue dans la vision produit.

## 5. Critères de validation

Les 12 scénarios du §9 du cahier des charges, chacun couvert par au moins un test automatisé (tableau de correspondance dans le README une fois les tests écrits), plus : `pnpm lint`, `pnpm typecheck`, `pnpm build` sans erreur.

## 6. Hypothèses à valider

- Un seul utilisateur réel (ou un petit cercle de confiance qui partage la même bibliothèque).
- Volume visé : quelques milliers d'images, fichiers jusqu'à 40 Mo. Au-delà, revoir la pagination (curseur) et passer l'upload en direct vers S3 via URL signée.
- Le prompt produit est rédigé en français (ChatGPT Images le comprend) ; les références sont jointes manuellement dans ChatGPT dans l'ordre indiqué par le brief.

## 7. Fusion avec jdr-helper (décidée le 2026-10-19)

Décision et conséquences : `../docs/adr/0001-site-web-dans-jdr-helper.md`.

- [x] Atelier déplacé dans `web/` du dépôt jdr-helper (branche `atelier-web`), tests du bot isolés (`vitest.config.ts` racine), image du bot sans `web/`
- [x] Build webpack, code du bot réutilisé (`@bot/*`), base SQLite partagée (`JDR_DB_PATH`)
- [x] Rôles : MJ (`admin`, atelier) et joueur (`player`, espace des personnages) ; connexion Discord (OAuth2, rôles lus avec le jeton du joueur)
- [x] Assistant de création web (même moteur et même brouillon que Discord), fiche détaillée, PDF, fiche à cases vides
- [x] Tests : création complète par le service, refus d'accès, rôle non falsifiable, textes d'aide adaptés au site, parcours E2E d'une joueuse
- [ ] Configuration Discord réelle : URL de retour OAuth2, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`
- [x] Bot : boutons-liens vers le site (`SITE_URL`) et publication des fiches demandée depuis le site (table `publish_requests`, traitée toutes les 30 s)
- [x] Déploiement préparé et testé sur une copie locale du serveur : image du site, `compose.yaml` (profil `web`), Caddy, `update.sh`, CI et workflow Deploy, sauvegarde et restauration du site
- [ ] Mise en service réelle sur le VPS (DNS, ufw, `.env.web`)
- [x] Direction artistique fournie (design system « La Table de l'Étoile ») : thème, polices, logo, favicon, 52 icônes (classes, espèces, écoles, caractéristiques, navigation), avis de quête, d20 de chargement, appliqués à l'espace joueurs et à l'atelier
- [x] Animation du tirage des caractéristiques (4d6 qui roulent, dé écarté, total révélé ; immobile si l'animation est réduite) ; traits des icônes affinés à 1,5
- [x] Thème clair « parchemin » : bouton soleil ou lune (en-tête des joueurs, barre de l'atelier), choix gardé dans un cookie et appliqué côté serveur (pas de flash)
- [x] Espace de campagne (`/campagnes`) : prochaine séance, rappels, carnet, règles et note de séance pour les joueurs ; pour le MJ, séance (annonce et rappels du bot), rappel rédigé par l'assistant puis publié sur Discord, carnet mis à jour, préparation (scène, PNJ, rencontre), règles, échéance, guide de style, suivi de la création. Messages Discord via la file `discord_posts` envoyée par le bot.
- [x] Documents du MJ sur le site : fiche de groupe et chronique de la campagne (PDF du bot, polices embarquées dans `web/assets/pdf-fonts`, OFL)
- [x] Génération validée promue en référence validée du personnage, en un clic
- [x] Textes d'aide du moteur neutres ; renvois propres à chaque interface dans `helpFor` (`src/character/wizard-view.ts`)
- [x] Cartes de bataille : modèle de brief « Carte », quadrillage posé par le site, PDF à l'échelle sur feuilles A4 (plan d'assemblage, repères, voisines), alerte de netteté
- [x] Textes du site : tirets longs retirés (règle du dépôt)
- [x] Assistant de création : « Idées de l'assistant » et « Conseil de l'assistant » sur le site, mêmes consignes que Discord (`src/character/assist.ts`), plafond par joueur, sans clé les boutons sont masqués
- [ ] Clé `ANTHROPIC_API_KEY` du site dans `.env.web` (une clé dédiée au site est recommandée)
