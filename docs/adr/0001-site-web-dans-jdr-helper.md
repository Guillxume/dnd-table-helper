# ADR 0001 : le site web vit dans le dépôt jdr-helper et partage la base du bot

Date : 19/10/2026. Statut : accepté.

## Contexte

La création de personnage par les boutons Discord est pénible pour des joueurs peu à l'aise avec l'informatique. L'atelier d'illustration (application Next.js) doit aussi devenir le site de la table, à l'adresse table.example.com, en ligne le 01/11/2026, avant l'échéance de création des personnages (11/11/2026). Le bot reste en service pour les rappels, la publication des rappels, /chercher, /setup, les mentions et les tableaux de bord.

## Décision

1. Le site est dans `web/`, dans ce dépôt. Le bot et le site lisent le même état d'assistant de création : ils doivent être déployés depuis le même commit.
2. Le site réutilise le code du bot sans le copier (alias `@bot/*` vers `src/`), uniquement les modules sans discord.js. Les fonctions de présentation de l'assistant utiles aux deux interfaces sont dans `src/character/wizard-view.ts`.
3. Données de jeu : le site ouvre la base SQLite du bot (`JDR_DB_PATH`, même fichier sur le VPS, mode WAL). Un brouillon commencé sur Discord se reprend sur le site, et inversement. La bibliothèque d'illustrations reste dans PostgreSQL.
4. Connexion des joueurs par Discord (OAuth2 de l'application du bot, portée `guilds.members.read`). Les rôles Discord du joueur décident de l'accès aux campagnes, avec les mêmes règles que le bot (`permissions.ts`). Le MJ garde un compte par e-mail (rôle `admin`), seul à accéder à l'atelier.
5. Le site est construit avec webpack (`next build --webpack`) : Turbopack ne résout pas les imports `./x.js` vers des fichiers `.ts` du bot.

## Conséquences

- Deux processus écrivent dans la même base SQLite : écritures courtes, attente de verrou de better-sqlite3. Les migrations `ALTER TABLE` du bot s'exécutent aussi à l'ouverture par le site ; elles sont idempotentes.
- Tout changement du moteur de création touche les deux interfaces : les tests du bot et ceux du site doivent passer.
- Regrouper les données de jeu dans PostgreSQL reste possible après le 21/11/2026 ; ce n'est pas nécessaire pour la mise en ligne.
