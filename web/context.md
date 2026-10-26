# Mission : développer une bibliothèque privée d'inspiration artistique pour le JDR

Tu es un développeur full-stack senior, architecte logiciel et spécialiste UX/UI. Tu dois concevoir et développer une application web complète, maintenable, sécurisée et évolutive permettant de gérer une bibliothèque privée d'illustrations de fantasy et de jeu de rôle sur table (JDR).

Ne te contente pas de proposer une architecture ou de générer des exemples de code. Tu dois travailler directement dans le dépôt, examiner l'environnement existant, prendre les décisions techniques appropriées, implémenter l'application, tester les fonctionnalités et documenter son installation.

Travaille de manière autonome. Ne me demande pas de valider chaque décision technique. Pose une question uniquement lorsqu'une information réellement indispensable est manquante et ne peut pas être raisonnablement déduite.

---

## 1. Vision du produit

Je souhaite disposer de ma propre bibliothèque d'inspiration artistique accessible depuis un navigateur, sur ordinateur et mobile, avec un accès privé et authentifié.

Cette bibliothèque doit me permettre de :

- Importer et organiser de nombreuses illustrations de fantasy et de JDR.
- Retrouver rapidement des références grâce à des tags, des catégories, des collections et une recherche.
- Comparer des illustrations et identifier celles qui représentent le mieux ma direction artistique.
- Construire un guide de style visuel cohérent à partir de références sélectionnées.
- Conserver des fiches canoniques de mes personnages et de mon univers.
- Préparer des briefs d'illustration et des prompts destinés à ChatGPT Images.
- Archiver les images générées, leurs prompts, leurs références et leurs différentes versions.
- Maintenir une cohérence visuelle entre les personnages, les portraits, les fiches de personnages illustrées, les PNJ, les monstres, les objets, les environnements et les cartes de bataille.

L'application constitue la source de vérité de ma bibliothèque artistique. Elle ne doit pas dépendre d'une galerie publique externe.

**Important :** ne suppose pas que l'API ou le générateur d'images de ChatGPT peut accéder automatiquement aux images privées de mon application. Prévois un workflow explicite permettant de sélectionner les références, de préparer un brief et de récupérer les résultats, sans prétendre automatiser une intégration qui n'est pas réellement disponible.

## 2. Stack technique

Utilise par défaut les technologies suivantes :

- Next.js avec App Router.
- React.
- TypeScript en mode strict.
- Tailwind CSS.
- Une bibliothèque de composants accessible et maintenable, par exemple shadcn/ui si elle est compatible avec le projet.
- PostgreSQL pour les données relationnelles.
- Prisma ORM, ou une alternative moderne équivalente si un obstacle technique réel le justifie.
- Stockage d'images compatible S3, idéalement MinIO pour un déploiement auto-hébergé.
- Une solution d'authentification adaptée à Next.js.
- Docker Compose pour faciliter le déploiement et le développement local.
- Un outil de validation de données côté serveur et côté client, par exemple Zod.
- Un gestionnaire de formulaires adapté lorsque nécessaire.

Utilise des versions stables et compatibles des dépendances au moment du développement. Vérifie les documentations officielles si tu disposes d'un accès Internet.

N'ajoute pas de Symfony : le backend initial doit être intégré à Next.js. Évite de multiplier les services, les abstractions et les dépendances sans justification concrète.

Le projet doit rester simple à maintenir par un développeur qui connaît PHP et Symfony et souhaite progresser sur React, Next.js et TypeScript.

## 3. Commencer par inspecter le projet

Avant de modifier des fichiers :

1. Examine le dépôt, son arborescence, son état Git, les fichiers de configuration et les éventuels développements déjà présents.
2. Identifie les contraintes de l'environnement et les services déjà disponibles.
3. Si le dépôt contient déjà une application, conserve ce qui est pertinent et évite de détruire le travail existant.
4. Définis une architecture adaptée à la taille réelle du projet.
5. Crée un fichier `PLAN.md` résumant les étapes, les décisions techniques et les critères de validation.
6. Commence ensuite l'implémentation sans attendre une validation intermédiaire.

Ne remplace pas arbitrairement une architecture existante si elle est saine.

## 4. Fonctionnalités principales

### 4.1. Tableau de bord

Créer une page d'accueil présentant :

- Les dernières illustrations importées.
- Les favoris.
- Les collections récemment consultées.
- Les dernières générations archivées.
- Des raccourcis vers les catégories principales.
- Quelques statistiques utiles : nombre d'images, de collections, de personnages et de générations.

L'interface doit rester utile même lorsque la bibliothèque est vide.

### 4.2. Bibliothèque d'illustrations

Créer une galerie visuelle avec une grille d'images adaptative, proche d'un outil de curation artistique professionnel.

Fonctionnalités :

- Affichage en mosaïque responsive.
- Pagination ou chargement progressif réellement maîtrisé.
- Recherche textuelle.
- Filtres combinables par catégorie, tags, collection, favori, origine et date.
- Tri par date d'import, titre et date de création lorsque disponible.
- Sélection multiple.
- Ajout et retrait des favoris.
- Vue détaillée avec image en grand format.
- Navigation entre les images.
- Zoom adapté aux illustrations détaillées.
- Édition des métadonnées.
- Suppression avec confirmation.
- Actions en masse pour les tags et les collections.

Ne charge jamais tous les fichiers originaux en mémoire simplement pour afficher la galerie. Utilise des miniatures optimisées et un chargement adapté au volume.

### 4.3. Import des images

Permettre l'import de plusieurs fichiers depuis l'ordinateur.

Formats initiaux acceptés : JPEG, PNG et WebP. Ajouter AVIF uniquement si l'ensemble de la chaîne de traitement le supporte correctement.

Pour chaque image, conserver au minimum :

- Le fichier original.
- Une miniature optimisée.
- Le nom du fichier d'origine.
- Le titre.
- La description.
- Les tags.
- La catégorie.
- La ou les collections.
- La date d'import.
- La provenance ou l'URL source, si connue.
- Le nom de l'artiste, si connu.
- Les notes personnelles.
- Le statut de favori.

Fonctionnalités d'import :

- Glisser-déposer.
- Sélection multiple.
- Indicateur de progression.
- Gestion des erreurs par fichier.
- Détection des doublons, idéalement par empreinte cryptographique.
- Possibilité de compléter les métadonnées après l'import.
- Limites de taille et validations côté serveur.

Ne rends pas obligatoire la saisie d'informations inconnues. La provenance doit pouvoir être marquée comme inconnue.

Ne récupère pas automatiquement des images depuis des sites tiers sans action explicite de l'utilisateur. Pour le MVP, l'import manuel est suffisant.

### 4.4. Catégories, tags et collections

Prévoir des catégories configurables, avec des exemples initiaux :

- Portraits.
- Personnages complets.
- Fiches de personnages illustrées.
- PNJ.
- Créatures et monstres.
- Armes et équipements.
- Objets magiques.
- Effets magiques.
- Environnements.
- Villes et architectures.
- Donjons.
- Cartes de bataille.
- Compositions.
- Palettes et éclairages.
- Textures et techniques picturales.

Les catégories proposées ne doivent pas être figées dans le code.

Les tags doivent être réutilisables, recherchables et modifiables.

Les collections doivent permettre de regrouper des références selon un objectif artistique, un personnage, un univers ou un projet.

Exemples de collections :

- Direction artistique principale.
- Portraits de référence.
- Personnages en pied.
- Clercs et magie divine.
- Occultistes et magie sombre.
- Matières et textures.
- Cartes de donjons.
- Références pour Rek'tal.
- Références pour Elamaer.

Une illustration peut appartenir à plusieurs collections.

### 4.5. Fiches canoniques des personnages

Créer un espace dédié aux personnages de mon univers JDR.

Chaque personnage possède une fiche avec :

- Nom.
- Description physique canonique.
- Espèce.
- Classe et spécialisation, si pertinentes.
- Silhouette et morphologie.
- Visage et caractéristiques distinctives.
- Cheveux, écailles, peau et autres particularités.
- Tenue et matières.
- Équipement.
- Palette de couleurs.
- Symboles et accessoires canoniques.
- Personnalité.
- Histoire utile à la représentation visuelle.
- Éléments qui ne doivent jamais être modifiés.
- Éléments encore indéterminés.
- Illustrations de référence validées.
- Historique des illustrations générées.

Prévoir des champs structurés et des notes libres.

Une information inconnue doit rester inconnue. Ne transforme jamais une hypothèse artistique en élément canonique sans validation explicite.

Pour chaque personnage, distinguer clairement :

1. Les faits canoniques confirmés.
2. Les préférences artistiques.
3. Les propositions non validées.
4. Les éléments à exclure.

La cohérence du personnage prime sur la créativité du générateur.

### 4.6. Guide de direction artistique

Créer un espace permettant de définir la direction artistique globale et ses éventuelles variantes.

Le guide doit pouvoir documenter :

- Style pictural.
- Niveau de réalisme.
- Traitement des silhouettes.
- Anatomie et proportions.
- Formes et détails.
- Palette générale.
- Saturation.
- Contraste.
- Éclairage.
- Ombres.
- Textures.
- Traitement des matériaux.
- Composition.
- Profondeur de champ.
- Densité des détails.
- Effets magiques.
- Traitement des arrière-plans.
- Principes de lisibilité.
- Éléments à éviter.

Les références doivent pouvoir être associées à un ou plusieurs aspects précis du guide : texture, éclairage, composition, palette, anatomie, design de costume, etc.

Ne réduis pas la direction artistique à un simple prompt générique. Le but est de construire un référentiel réutilisable et progressivement améliorable.

Prévois la possibilité de créer des variantes du guide, par exemple :

- Fantasy peinte principale.
- Fantasy sombre.
- Illustrations de personnages.
- Cartes de bataille.
- Illustrations de lieux.

Une variante ne doit pas faire disparaître les règles de cohérence communes.

### 4.7. Atelier de préparation des illustrations

Créer un assistant de préparation de briefs sans dépendance obligatoire à une API payante d'IA.

L'utilisateur choisit :

- Le sujet : personnage, PNJ, créature, objet, environnement, carte ou autre.
- La fiche canonique concernée, si applicable.
- Le type d'image souhaité.
- Le guide artistique.
- Les références visuelles.
- Les contraintes et exclusions.
- Le format ou le cadrage souhaité.
- Les éléments à mettre en avant.

L'application génère un brief structuré et un prompt prêt à copier dans ChatGPT Images.

Le brief doit contenir :

1. Objectif de l'image.
2. Description canonique du sujet.
3. Direction artistique.
4. Références sélectionnées et rôle de chacune.
5. Composition et cadrage.
6. Éclairage et palette.
7. Matières et détails importants.
8. Contraintes de cohérence.
9. Éléments explicitement interdits.
10. Format de sortie souhaité.

Prévoir une distinction explicite entre les références de style et les références de contenu.

Exemple : une image peut servir uniquement de référence pour la texture picturale, sans reprendre son personnage, son équipement ou ses symboles.

L'utilisateur doit pouvoir modifier le brief avant de le copier.

Fournir une fonction de copie du prompt et, si possible, un export JSON du brief et de ses références.

### 4.8. Archivage des générations

Créer un espace pour enregistrer les images produites avec ChatGPT Images ou un autre outil.

Chaque génération archivée contient :

- L'image obtenue.
- Le prompt utilisé.
- Le brief complet.
- Les références sélectionnées.
- Le guide artistique utilisé et sa version.
- Le personnage concerné, le cas échéant.
- La date.
- Les notes de révision.
- Le statut : brouillon, à évaluer, validée ou rejetée.
- Un lien éventuel vers la génération originale.

Permettre de relancer une nouvelle version en conservant le lien avec la version précédente.

Ne prétends pas récupérer automatiquement les images ou l'historique de ChatGPT sans intégration officiellement disponible. L'import manuel des résultats est acceptable pour le MVP.

### 4.9. Recherche et navigation

La recherche doit fonctionner sur les titres, descriptions, noms de personnages, notes, tags et noms de collections.

Elle doit être rapide et utilisable sur une bibliothèque conséquente.

Utilise les fonctionnalités de PostgreSQL adaptées avant d'ajouter un moteur de recherche externe.

Prévois des URL stables pour les fiches, les collections et les illustrations.

## 5. Modèle de données

Conçois un modèle relationnel propre, avec des contraintes et des index appropriés.

Entités initiales à évaluer :

- User.
- Asset.
- Tag.
- AssetTag.
- Collection.
- CollectionAsset.
- CharacterReference.
- CharacterAsset.
- StyleGuide.
- StyleGuideVersion.
- StyleGuideAsset.
- GenerationRecord.
- GenerationReference.
- Category.

Tu peux ajuster ce modèle si cela améliore réellement la cohérence de l'application.

Utilise des identifiants stables, des relations explicites et des suppressions maîtrisées.

Évite les relations polymorphes mal contrôlées et le stockage de données structurées dans des champs texte lorsque des tables relationnelles sont plus adaptées.

Les migrations doivent être versionnées.

## 6. Sécurité et confidentialité

L'application est privée par défaut.

Exigences :

- Authentification obligatoire pour accéder aux données.
- Aucune galerie publique par défaut.
- Contrôle d'accès côté serveur, pas uniquement dans l'interface.
- Protection des fichiers originaux et des miniatures.
- Validation stricte des fichiers importés.
- Contrôle des types MIME et des extensions.
- Limites de taille.
- Protection contre les accès directs non autorisés aux fichiers.
- URLs temporaires signées pour accéder au stockage privé lorsque nécessaire.
- Secrets et identifiants uniquement dans les variables d'environnement.
- Aucun secret dans le dépôt Git.
- Protection adaptée contre les attaques web courantes.
- Journalisation des erreurs sans divulguer de secrets.
- Suppression cohérente des fichiers et de leurs métadonnées.
- Documentation de la sauvegarde et de la restauration.

Si l'application est déployée pour un seul utilisateur, privilégie une authentification simple et robuste. Ne développe pas inutilement un système complexe de rôles et de permissions.

Le stockage auto-hébergé est un objectif, mais ne présume pas que le serveur ou le domaine sont déjà disponibles. Documente les prérequis.

**Confidentialité externe :** les images envoyées à ChatGPT pour générer une illustration quittent le stockage privé de l'application. Explique ce point dans la documentation. Le caractère privé du stockage ne garantit pas à lui seul la confidentialité du traitement effectué par un service externe.

## 7. UX/UI et direction visuelle de l'application

L'application doit elle-même être soignée, mais son interface ne doit pas concurrencer les illustrations.

Direction générale :

- Interface sombre, sobre et élégante.
- Atmosphère d'atelier artistique ou d'archive fantasy contemporaine.
- Fond neutre.
- Typographie lisible.
- Couleurs d'accent limitées.
- Images mises au premier plan.
- Cartes discrètes.
- Espacements cohérents.
- Icônes compréhensibles.
- Animations minimales.
- Aucune surcharge décorative.
- Pas d'emojis comme substituts aux icônes d'interface.

L'interface doit rester fonctionnelle sur mobile, tablette et ordinateur.

Prévoir :

- Navigation latérale sur grand écran.
- Navigation mobile adaptée.
- États de chargement.
- États vides utiles.
- Messages d'erreur compréhensibles.
- Confirmations pour les opérations destructives.
- Navigation clavier.
- Contrastes suffisants.
- Libellés accessibles.
- Formulaires validés et cohérents.

Évite le rendu d'un dashboard générique constitué uniquement de cartes statistiques. La galerie d'illustrations doit être l'élément central du produit.

## 8. Architecture et qualité du code

Respecte les principes suivants :

- TypeScript strict.
- Composants React réutilisables, mais sans abstraction prématurée.
- Séparation claire entre interface, logique métier, accès aux données et stockage.
- Validation des entrées côté serveur.
- Gestion cohérente des erreurs.
- Pagination et requêtes efficaces.
- Pas de duplication évitable.
- Pas de fonctions factices présentées comme fonctionnelles.
- Pas de boutons sans action.
- Pas de données de démonstration affichées comme si elles étaient réelles.
- Pas de dépendances lourdes sans justification.
- Pas de secrets codés en dur.
- Pas de désactivation générale de TypeScript ou d'ESLint pour contourner des problèmes.

Les routes API doivent appliquer les mêmes règles de sécurité que les pages.

Les opérations de stockage doivent être isolées derrière un service afin de pouvoir changer de fournisseur sans réécrire toute l'application.

Utilise des composants serveur Next.js lorsque c'est pertinent et des composants client uniquement lorsque l'interactivité le justifie.

Ne construis pas une architecture distribuée prématurée. Le projet doit pouvoir être déployé comme une application unique avec PostgreSQL et un stockage objet.

## 9. Tests et critères de validation

Ajoute des tests adaptés à la taille du projet :

- Tests unitaires pour les fonctions métier importantes.
- Tests d'intégration pour les accès aux données et les opérations sensibles.
- Tests des validations d'import.
- Tests d'accès non autorisé.
- Tests du workflow de préparation de briefs.
- Tests de composants ou tests end-to-end pour les parcours essentiels.

À minima, vérifie les scénarios suivants :

1. Un utilisateur non authentifié ne peut pas accéder à la bibliothèque.
2. Un utilisateur authentifié peut importer une image.
3. L'image et sa miniature sont stockées correctement.
4. L'image apparaît dans la galerie.
5. Les tags et collections peuvent être associés à l'image.
6. La recherche et les filtres fonctionnent.
7. Une fiche personnage peut être créée et liée à des références.
8. Un guide artistique peut être créé et associé à des références.
9. Un brief peut être préparé, modifié, copié et archivé.
10. Une génération peut être importée puis liée à son prompt et à ses références.
11. Un fichier non autorisé est rejeté.
12. Les fichiers privés ne sont pas accessibles sans autorisation.

Exécute les tests, le lint, le contrôle TypeScript et le build de production.

Corrige les erreurs réellement liées au projet. Ne prétends jamais qu'une commande a réussi si tu ne l'as pas exécutée.

## 10. Documentation et déploiement

Fournis :

- `README.md` avec les objectifs et les fonctionnalités.
- Instructions d'installation locale.
- Instructions de configuration des variables d'environnement.
- Procédure de lancement avec Docker Compose.
- Procédure de migrations de base de données.
- Procédure de sauvegarde et de restauration.
- Instructions de création du premier compte.
- Architecture générale du projet.
- Description du modèle de données.
- Procédure de déploiement sur un serveur.
- Limites connues et fonctionnalités restant à développer.

Fournis un fichier `.env.example` sans aucun secret réel.

Prévois un stockage persistant pour PostgreSQL et les fichiers.

La configuration de développement doit être distincte de la configuration de production.

## 11. Ordre d'exécution

Travaille dans cet ordre :

### Phase 1 : inspection et architecture
- Examiner le dépôt.
- Définir l'architecture.
- Créer `PLAN.md`.
- Définir les variables d'environnement et les services.

### Phase 2 : socle fonctionnel
- Initialiser ou adapter Next.js.
- Configurer TypeScript, Tailwind et les composants.
- Mettre en place PostgreSQL et l'ORM.
- Mettre en place l'authentification.
- Préparer le stockage objet.
- Créer les migrations.

### Phase 3 : bibliothèque
- Galerie.
- Import multiple.
- Miniatures.
- Fiches détaillées.
- Tags.
- Collections.
- Favoris.
- Recherche et filtres.

### Phase 4 : référentiel artistique
- Fiches canoniques des personnages.
- Guides artistiques et versions.
- Association des références.
- Gestion des contraintes et exclusions.

### Phase 5 : workflow de génération
- Préparation des briefs.
- Génération de prompts.
- Copie et export.
- Archivage des générations.
- Historique des versions.

### Phase 6 : validation
- Tests.
- Sécurité.
- Responsive.
- Performance.
- Accessibilité.
- Build de production.
- Documentation finale.

Tu peux réorganiser ces phases si le dépôt ou des contraintes techniques le justifient, mais conserve les objectifs.

## 12. Gestion des priorités

Le MVP doit fournir une véritable bibliothèque utilisable, et non une maquette.

Priorité absolue :

1. Authentification.
2. Import et stockage privé.
3. Galerie avec miniatures.
4. Métadonnées, tags, collections et recherche.
5. Fiches canoniques des personnages.
6. Guide artistique.
7. Préparation et export de briefs.
8. Archivage des générations.

Ne commence pas par une intégration IA payante, un moteur de recherche externe ou une architecture complexe.

Si une fonctionnalité ne peut pas être terminée raisonnablement, implémente d'abord une version simple, fonctionnelle et documentée. Indique clairement ce qui reste à faire.

## 13. Comportement attendu de Claude Code

Tu dois agir comme un développeur responsable du résultat final.

- Inspecte avant de modifier.
- Prends des décisions techniques justifiées.
- Implémente réellement les fonctionnalités.
- Vérifie les résultats.
- Corrige les erreurs.
- Ne t'arrête pas après avoir créé quelques fichiers.
- Ne remplace pas une fonctionnalité par un simple placeholder sans le signaler.
- Ne prétends pas qu'un service fonctionne sans l'avoir vérifié.
- Si un service externe nécessite des identifiants indisponibles, implémente son intégration de manière configurable et indique précisément ce qui nécessite une intervention.
- Maintiens `PLAN.md` à jour.
- Ne supprime aucune donnée existante sans autorisation explicite.

À la fin, fournis un compte rendu concis comprenant :

1. Les fonctionnalités effectivement terminées.
2. Les choix architecturaux importants.
3. Les commandes à exécuter pour démarrer le projet.
4. Les variables d'environnement à renseigner.
5. Les tests exécutés et leurs résultats réels.
6. Les éventuelles limitations restantes.
7. Les prochaines étapes prioritaires.

**Commence maintenant par inspecter le dépôt et son environnement, puis passe à l'implémentation.**