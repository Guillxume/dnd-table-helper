# dnd-table-helper

A Discord bot and a companion web app for an in-person Dungeons & Dragons (2024 rules) table: session
scheduling and reminders, recaps drafted by Claude Haiku from the GM's notes, GM prep grounded on the
System Reference Document, a level-1 character creation wizard that fills a printable PDF sheet, and an
illustration workshop that turns top-down images into gridded battle maps printed to scale on A4 sheets.

```
.
├── src/        Discord bot: discord.js 14, TypeScript run by tsx, SQLite (better-sqlite3), Claude Haiku
├── web/        Website: Next.js 16, Prisma + PostgreSQL, S3-compatible storage, Better Auth
├── deploy/     VPS setup, update script, Caddy, backups
└── docs/       French bot documentation and architecture decision records
```

> The bot, the website and their in-depth docs are in French (`docs/README.fr.md`, `web/README.md`,
> `deploy/INSTALL.md`). This page is in English.

---

## What it does

### Discord bot

- **Campaign setup.** `/setup` creates a category per campaign with its channels (session reminders,
  character sheets, illustrations, GM help) and its "GM" and "Players" roles. It can be re-run without
  creating duplicates. Several campaigns can share one server; they can be archived, re-activated or
  deleted, and the bot never deletes a role it did not create.
- **Sessions.** The GM sets the next session. The bot posts a reminder the day before that mentions the
  table and repeats the previous recap. The next morning it asks players what they remember. It also
  nudges players who haven't finished their character as the deadline approaches.
- **Recaps.** The GM pastes raw notes and Claude Haiku drafts a recap, which the GM reviews before it is
  published. Each published recap updates a campaign notebook (NPCs, places, items, open threads),
  built from the published text only, so it never reveals more than the players have seen.
- **GM prep.** `/preparer` drafts a scene, an NPC or an encounter from the GM's idea, the last three recaps,
  the campaign's style guide and SRD excerpts found by full-text search (SQLite FTS5). Stat blocks must
  come from those excerpts, with their page, and the list of excerpts is appended to the draft.
  `/rencontre` computes the XP budget with the SRD 5.2.1 table and prints the stat blocks as a PDF.
- **Character creation.** A step-by-step, button-driven wizard for level-1 characters: class, species,
  background, ability scores (standard array, point buy, 4d6, or dice rolled at the table), skills,
  feats, spells, equipment, languages, alignment and backstory. Every step can show the full SRD text of
  its options. Answers are stored as a replayable history, so any step can be edited later. The final
  screen runs blocking checks before the character is saved. An optional assistant gives backstory
  ideas and spell advice, limited to the spells on offer.
- **PDF sheets.** The bot fills the French official character sheet (an AcroForm PDF that is not
  shipped here) and adds an appendix with full texts, starting equipment and the detail of every
  calculation. Values that change during play are left blank, to be kept in pencil. Without the
  template, it renders its own sheet. It also produces a one-page group sheet and a printable export
  of the whole campaign.
- **Lookup.** `/chercher` searches every source at once: SRD rules, spells, equipment, creatures, the
  glossary and the character-creation data.

### Website (`web/`)

- **Player space**, signed in with Discord. Access follows the player's Discord roles, with the same
  rules as the bot. Players create their character on the site with the bot's own engine and share the
  same draft as the Discord wizard. They download the PDF and ask the bot to post the sheet in the
  campaign channel. The campaign page shows the next session, recaps, notebook and rules. The GM also
  schedules sessions and publishes recaps to Discord from there.
- **GM workshop**, signed in with email (public sign-up is disabled). It holds an illustration library:
  import with SHA-256 duplicate detection, tags, collections, and accent-insensitive search (`pg_trgm`).
  It also has canonical character sheets, versioned art-direction guides, and a deterministic brief and
  prompt builder for ChatGPT Images. The site calls no image API: prompts are copied into ChatGPT and
  results are imported back by hand, with their prompt, references and version history.
- **Battle maps.** From a top-down image, the site lays the grid (2.5 cm or 1 inch squares) and warns
  when the image is too low-resolution for the chosen size. It then outputs a to-scale PDF split across
  A4 sheets, with an assembly plan and alignment marks.

## Architecture

- The bot and the site live in one repository and are deployed from the same commit. The site reuses the
  bot's modules through a `@bot/*` alias, limited to modules that don't import discord.js. It is built
  with webpack, because Turbopack doesn't resolve the bot's NodeNext `./x.js` imports
  ([ADR 0001](docs/adr/0001-site-web-dans-jdr-helper.md), in French).
- Game state (campaigns, character drafts) is in the bot's SQLite database, which the site opens in WAL
  mode. The illustration library is in PostgreSQL, and files are in a private S3 bucket served through an
  authenticated route. The site only uses Discord to sign players in and read their roles. It never
  posts to Discord itself: it queues requests (`publish_requests`, `discord_posts`) that the bot
  processes every 30 seconds.
- Game data is extracted from the French SRD 5.2.1 into versioned JSON (`src/srd/data/`).
  `npm run srd:verify` checks it against the official PDF.
- Production runs on a single VPS with Docker Compose. The bot container is read-only, drops all
  capabilities and publishes no port. Caddy fronts the site. GitHub Actions builds the images, pushes
  them to GHCR and runs the update script over SSH. That deploy job runs only when the repository
  variable `DEPLOY_ENABLED` is `true`, and only for pushes to this repository's `main`, never for a fork.

## Run it locally

### Bot

Requires Node 22+ and a Discord application with a bot token.

```sh
npm install
cp .env.example .env            # Discord token, application ID, server ID, Anthropic API key
npm run deploy-commands         # registers the slash commands (re-run when they change)
npm start
```

The bot needs these permissions on the server: Manage Roles, Manage Channels, Send Messages, Attach
Files and Pin Messages. Its role must sit above the campaign roles. Without the official sheet template
in `ref/`, PDFs use the built-in sheet.

### Website

Requires Node 22+, pnpm 10 and Docker. From `web/`:

```sh
cp .env.example .env            # replace each "remplacer-par-…" value (openssl rand -hex 32)
docker compose up -d            # PostgreSQL (port 5434) and SeaweedFS S3 storage (port 8334)
pnpm install
pnpm db:migrate && pnpm storage:init && pnpm db:seed
pnpm user:create --email you@example.com --name "GM"
pnpm dev                        # http://localhost:3000
```

The player space reads the bot's SQLite database (`JDR_DB_PATH`). Discord sign-in appears once
`DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are set. Full details: [`web/README.md`](web/README.md).
Server deployment: [`deploy/INSTALL.md`](deploy/INSTALL.md).

## Tests and CI

| | |
|---|---|
| Bot | `npm run typecheck`, `npm test` (Vitest). Tests use a fake Discord port. They check Discord's limits (message and description lengths, buttons per row) for every class and species. |
| Site | `pnpm lint`, `pnpm typecheck`, `pnpm test`. Unit tests, plus integration tests on a real PostgreSQL and S3 bucket kept apart from development data. |
| End to end | `pnpm test:e2e`: Playwright on the production build. Covers sign-in, library, battle maps, campaign tools and a player creating a character. |
| CI | `.github/workflows/ci.yml` runs all of the above and builds the bot image. `srd.yml` re-checks game data against the official SRD PDF. `deploy.yml` publishes and deploys, gated as described above. |

## Game content and licenses

The code is under the [MIT License](LICENSE).

The rules data comes from the SRD 5.2.1. *This work includes material from the System Reference
Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd.
The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at
https://creativecommons.org/licenses/by/4.0/legalcode.* The French statement is printed on every
character sheet (`src/srd/attribution.ts`).

A few character options are not in the SRD: the Aasimar species, 12 extra backgrounds and 6 feats from
the 2024 Player's Handbook, and the subclass orientation summaries in `src/guide/`. Their sources are
listed in `src/srd/sources.ts`, and they are marked "Manuel 2024" on the sheet. They are not covered by
the MIT License.

The PDF fonts Cinzel and EB Garamond are under the SIL Open Font License 1.1 (`web/assets/pdf-fonts/`).
The official character sheet template is not distributed with this repository.

This is unofficial fan content. It is not approved or endorsed by Wizards of the Coast. Dungeons &
Dragons and D&D are trademarks of Wizards of the Coast LLC.
