# jdr-helper

Bot Discord pour les campagnes de JDR. Rappel de séance, aide à la préparation du MJ et fiches de personnage de niveau 1 (D&D 2024, SRD 5.2.1 en français).

## Tableaux de bord

Pour les joueurs peu à l'aise avec les commandes, tout passe par des boutons. `/setup` publie et épingle deux messages (republiables avec `/campagne panneau`) :

- dans le salon de rappel, le tableau de bord des joueurs : Mon personnage (créer, reprendre, voir la fiche, PDF), Dernier rappel, Prochaine séance, Carnet, Mes notes, Chercher ;
- dans `#aide-mj`, celui du MJ : Notes de séance, Fixer la séance, Échéance des personnages, Préparer une scène, un PNJ ou une rencontre (un formulaire propre à chaque type ; groupe pré-rempli d'après les personnages ; pour une rencontre, le bot calcule le budget de PX des créatures indiquées et propose leurs blocs de statistiques), Fiche de groupe (PDF), Suivi des personnages, Chercher une règle.

Les réponses sont éphémères (visibles de la seule personne qui clique). `/campagne ajouter-joueur` publie un message d'accueil qui mentionne le joueur, avec un bouton « Créer mon personnage ».

Automatismes (vérifiés toutes les 5 minutes) :

- la veille de la séance, le rappel mentionne MJ et joueurs, dit quoi apporter (fiche, crayon, gomme, dés) et recopie le rappel de la séance précédente ;
- le lendemain matin (14 h après le début), un message invite les joueurs à noter ce qu'ils ont retenu ; ces notes complètent celles du MJ dans le brouillon de `/seance`, et le MJ les voit avant de publier ;
- à la publication d'un rappel, le carnet de campagne (PNJ, lieux, objets, fils ouverts) est mis à jour à partir du rappel publié, donc sans rien révéler de plus ;
- à J-3 puis à J-1 de l'échéance des personnages, une relance mentionne ceux qui n'ont pas fini.

## Commandes

- `/aide` : les commandes que la personne peut utiliser, selon son rôle (joueur, MJ, administrateur).
- `/setup nom:<nom> [mj:@membre] [public]` (administrateur) : crée une campagne, avec sa catégorie au nom de la campagne (rappel-de-séance, fiches-personnages, illustrations, aide-mj), ses rôles « MJ <nom> » et « Joueurs <nom> », et des salons réservés à la table (sauf `public`). La catégorie « Table » (#général, #calendrier) est commune ; un salon de ce nom déjà présent ailleurs sur le serveur est réutilisé. Relançable sans doublons.
- `/prochaine-seance [date heure note annuler campagne]` : sans option, affiche la prochaine séance (horodatage Discord, dans le fuseau de chacun). Le MJ la fixe (date JJ/MM/AAAA, heure 20:30, fuseau `CAMPAIGN_TIMEZONE`, Europe/Paris par défaut) : annonce dans le salon de rappel, puis rappel automatique 24 h avant, qui mentionne les rôles MJ et Joueurs. Le bot vérifie les rappels toutes les 5 minutes ; s'il était éteint, un rappel en retard part au redémarrage tant que la séance n'a pas commencé.
- `/campagne exporter [fiches]` (MJ) : un PDF à imprimer d'une traite, avec couverture, rappels de toutes les séances, puis la fiche de chaque personnage (feuille aplatie et annexe). Au-delà de 10 Mo (limite d'envoi de Discord), relancer avec `fiches:false`. Mise en page des chroniques : polices Cinzel et EB Garamond (licence SIL Open Font License 1.1, paquets `@fontsource`).
- `/campagne creer nom:<nom> [mj] [public]` (administrateur) : même chose que `/setup`, depuis n'importe quel salon. `/campagne supprimer` (administrateur, avec confirmation) supprime tout : salons (archivés compris), catégorie, rôles « MJ <nom> » et « Joueurs <nom> », rappels et personnages.
- `/campagne archiver` (MJ ou administrateur, avec confirmation) : les salons de la campagne partent dans la catégorie commune « Archives », renommés `<nom-de-campagne>-<salon>`, en lecture seule pour tout le serveur (sauf `#aide-mj`, visible des seuls administrateurs) ; la catégorie et les rôles de la campagne sont supprimés, la séance prévue est annulée. Les rappels et personnages restent dans le bot. `/campagne reactiver` (administrateur) recrée les rôles et la catégorie et y remet les salons ; il faut ensuite redonner les rôles. Un rôle rattaché à une campagne mais portant un autre nom (rôle partagé d'une ancienne campagne) n'est jamais supprimé. Discord limite une catégorie à 50 salons, soit 12 campagnes archivées de 4 salons.
- `/campagne liste|infos|ajouter-joueur|retirer-joueur|configurer|exporter|archiver|reactiver` : gestion des campagnes. Toutes les commandes liées à une campagne acceptent l'option `campagne` ; sans elle, le bot prend la campagne (non archivée) du salon ou de sa catégorie, puis la seule campagne dont la personne fait partie, puis la seule campagne du serveur.
- `/seance` (MJ ou administrateur) : formulaire de notes en vrac (4000 caractères max), brouillon généré par Claude Haiku, boutons Publier / Annuler. Le brouillon est gardé en base 7 jours (il survit à un redémarrage du bot).
- `/rappel` : affiche le dernier rappel publié.
- `/preparer type:<scène|PNJ|rencontre> [campagne]` (MJ) : formulaire guidé (idée, groupe, ton, éléments du SRD à utiliser), brouillon privé généré par Haiku à partir de l'idée du MJ, des 3 derniers rappels, du guide de style et des extraits du SRD trouvés par recherche plein texte (blocs de statistiques des créatures, règles de rencontre, pièges, objets…). Les statistiques doivent venir de ces extraits, avec la page ; la liste des extraits fournis est ajoutée à la fin du brouillon. Index : `src/srd/data/srd-chunks.json`, construit par `scripts/srd/build_chunks.py`.
- `/style voir|modifier|effacer [campagne]` : guide de style de la campagne (ton, univers et vocabulaire, noms propres, à éviter, exemple), suivi par l'assistant pour les rappels, `/preparer` et les idées de personnage. Il ne lève jamais la consigne de ne rien inventer.
- `/regles` (MJ ou administrateur) : paramètres de création de la campagne (niveau de départ, contenu autorisé, méthodes de caractéristiques : valeurs standard, achat par 27 points, 4d6, dés lancés à la table). Sans option : affiche les paramètres.
- `/personnage creer [nom]` : création pas à pas (paramètres, classe, espèce, historique, caractéristiques avec répartition suggérée par le SRD, compétences, dons, sorts, équipement, langues, alignement, origine et histoire). Chaque étape a un bouton « Détails des options » (textes du SRD ou source citée) ; pour les sorts, chaque option affiche le type d'effet, les dégâts et la portée lus dans le SRD, avec un bilan de la sélection et un bouton « Conseil de l'assistant » (Haiku, limité aux sorts proposés), un retour arrière, et la création se reprend plus tard. L'écran final affiche un récapitulatif avec contrôles bloquants et « Modifier une étape » (les choix suivants sont conservés tant qu'ils restent valides).
- `/personnage voir|fiche|liste|actif|supprimer` : fiche dans Discord avec le détail des calculs, PDF, liste, personnage actif, suppression avec confirmation. La fiche d'un autre joueur est réservée au MJ et aux administrateurs.
- `/objet nom` : arme, armure, outil ou matériel du SRD (autocomplétion).
- `/chercher terme` : recherche unique dans toutes les sources du bot : SRD 5.2.1 (sorts de niveau 0 et 1, équipement, créatures, glossaire comme « Agrippé », puis texte intégral), données de création (espèces dont l'Aasimar, 16 historiques, classes, dons), sous-classes (les 48 des documents du MJ, et le texte officiel des 12 du SRD, retrouvé aussi par le nom court : « Berserker », « Main ouverte ») et documents du MJ de `ref/` (référentiel d'origines, guide d'orientation, trajectoires des 12 classes, indexés dans `src/guide/ref-index.json` par `scripts/guide/build_ref_index.py`).
- `/rencontre creatures [difficulte niveau personnages]` (MJ) : budget de PX selon la table du SRD 5.2.1 (p. 213), difficulté atteinte, conseils du SRD (plus de deux créatures par personnage, FP supérieur au niveau, plus de trois profils), puis PDF des blocs de statistiques. Un nom ambigu (« gobelins ») n'est jamais deviné.
- `/carnet voir|retirer` : carnet de campagne ; le MJ peut retirer une entrée erronée.
- `/campagne panneau|groupe|suivi` (MJ) : republier les tableaux de bord ; fiche de groupe sur une page A4 paysage (CA, PV max, initiative, vitesse, Perception passive, sauvegardes, DD et attaque de sorts par source, sens, résistances, langues) ; avancement de la création des personnages.
- `/regles echeance:<JJ/MM/AAAA>` (MJ) : échéance de création des personnages, ou `aucune`.
- `/guide [classe]` : guide d'orientation (comparaison des 12 classes, sous-classes, jalons jusqu'au niveau 20). Données issues des PDF d'orientation fournis par le MJ (`ref/`, extraits par `scripts/guide/build_guide.py` vers `src/guide/guide.json`). Résumés hors SRD.

## Fiche PDF

Le PDF est la feuille de personnage D&D 5 en français fournie par le MJ (`ref/DD5-eFeuillePersoDD5.pdf`, non versionnée, « permission to photocopy for personal use »), remplie par le bot, suivie d'une annexe (textes complets, équipement de départ à recopier, détail des calculs, licences). Les valeurs qui changent en jeu restent vides pour être tenues au crayon : PV actuels et temporaires, dés de vie restants, jets contre la mort, inspiration, emplacements utilisés, pièces, trésor, équipement. Autre emplacement du modèle : variable `SHEET_TEMPLATE`. Sans modèle, le bot produit sa fiche maison. Exemple : `npx tsx scripts/render-official.ts magicien elfe sage /tmp/fiche.pdf`.

## Contenu de jeu et licence

Les règles viennent du SRD 5.2.1 (Wizards of the Coast LLC, CC-BY-4.0, https://www.dndbeyond.com/srd). La mention exigée figure sur la fiche PDF (`src/srd/attribution.ts`). Le SRD est un extrait du Manuel des joueurs 2024. Les 12 historiques supplémentaires viennent du référentiel d'origine du MJ et les effets des 6 dons associés de l'article D&D Beyond cité dans `src/srd/sources.ts` ; ils sont marqués « Manuel 2024 » sur la fiche. L'option A d'équipement de ces historiques n'est connue que pour le Voyageur (les autres reçoivent 50 po). L'Aasimar vient de la fiche Roll20 du « Player's Handbook (2024) » (source dans `src/srd/sources.ts`), avec des noms de traits traduits par le bot. Le référentiel d'origines et les guides d'orientation de `ref/` ont été générés avec ChatGPT (métadonnées des PDF) puis vérifiés par le MJ sur le site officiel. Les créatures, sorts de plus haut niveau, objets magiques et règles consultables viennent du seul SRD 5.2.1. `npm run srd:verify` (poppler requis) compare les données au PDF placé dans `ref/` (hors git).

## Installation (sur le Mac qui fera tourner le bot)

1. Node 22 ou plus : `node -v` (Node 24 sur le serveur et dans la CI ; Node 22 n'est plus maintenu après le 30/04/2027).
2. `npm install` (inclut pdfkit et pdf-lib pour les PDF) (compile better-sqlite3 pour votre machine, ne copiez pas un node_modules d'ailleurs).
3. Copiez `.env.example` vers `.env` et remplissez-le (jamais commité).
4. `npm run deploy-commands` (une fois, et à chaque changement de commandes).
   Droits du bot sur le serveur : Gérer les rôles, Gérer les salons, Envoyer des messages, Joindre des fichiers, Épingler des messages (tableaux de bord). Son rôle doit être au-dessus des rôles de campagne.
5. `npm start`.

## Hébergement

Le bot tourne sur un VPS dans un conteneur Docker (`Dockerfile`, `compose.yaml`) : voir `deploy/INSTALL.md` (préparation du serveur par `deploy/server/bootstrap.sh`, image construite par GitHub Actions et publiée sur ghcr.io, mise à jour par `deploy/update.sh`, sauvegarde quotidienne vérifiée, surveillance facultative par `HEARTBEAT_URL`).

## Vérifications

`npm run typecheck`, `npm test` et `npm run srd:verify`. Non testés automatiquement : la connexion réelle à Discord et l'appel réel à l'API Anthropic. Après une mise à jour : `npm run deploy-commands`. Pour une campagne créée avant les campagnes multiples : `/campagne configurer joueurs:@Joueur` dans son salon de rappel.

Les notes et rappels sont stockés dans `data/jdr.sqlite` (hors git).
