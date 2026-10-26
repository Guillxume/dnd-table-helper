import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Draft } from "./character/draft.js";
import type { WizardState } from "./character/state.js";
import { normalizeRules, type CreationRules } from "./character/rules.js";
import { normalizeStyle, type StyleGuide } from "./style.js";

export interface Campaign {
  channelId: string;
  guildId: string;
  name: string;
  mjRoleId: string;
  /** Salon d'aide à la préparation (#aide-mj), renseigné par /setup. */
  prepChannelId: string | null;
  /** Salon des fiches de personnage, renseigné par /setup. */
  sheetsChannelId: string | null;
  /** Paramètres de création de personnage fixés par le MJ. */
  creationRules: CreationRules;
  /** Rôle des joueurs de la campagne (null pour une campagne créée avant les campagnes multiples). */
  playerRoleId: string | null;
  /** Catégorie Discord de la campagne. */
  categoryId: string | null;
  archived: boolean;
  /** Salons rangés dans la catégorie Archives, avec leur nom d'origine (pour /campagne reactiver). */
  archivedChannels: ArchivedChannel[];
  /** Guide de style de la campagne (/style). */
  style: StyleGuide;
  /** Messages épinglés du tableau de bord des joueurs (salon de rappel) et de celui du MJ (#aide-mj). */
  panelMessageId: string | null;
  mjPanelMessageId: string | null;
  /** Date limite de création des personnages (ISO 8601, UTC), fixée par le MJ avec /regles echeance. */
  creationDeadline: string | null;
  /** Relances déjà envoyées pour cette échéance : 0 aucune, 1 à J-3, 2 à J-1. */
  deadlineStage: number;
  createdAt: string;
}

export interface ArchivedChannel {
  id: string;
  name: string;
}

export interface CampaignStructure {
  mjRoleId?: string;
  prepChannelId?: string;
  sheetsChannelId?: string;
  playerRoleId?: string;
  categoryId?: string;
}

export interface SessionRecord {
  id: number;
  channelId: string;
  number: number;
  notes: string;
  recap: string;
  createdAt: string;
}

export interface StoredCharacter {
  id: number;
  guildId: string;
  userId: string;
  name: string;
  draft: Draft;
  /** Campagne du personnage (salon de rappel de la campagne). */
  campaignId: string;
  /** Personnage actif du joueur dans sa campagne. */
  active: boolean;
  createdAt: string;
}

/** Demande de publication d'une fiche dans le salon des fiches (faite depuis le site, traitée par le bot). */
export interface PublishRequest {
  id: number;
  characterId: number;
  /** Identifiant Discord de la personne qui a demandé la publication. */
  requestedBy: string;
  requestedAt: string;
  publishedAt: string | null;
  error: string | null;
  attempts: number;
}

/** Au-delà, une demande en échec n'est plus retentée automatiquement (une nouvelle demande la relance). */
export const MAX_PUBLISH_ATTEMPTS = 3;

/** Message à poster dans le salon de la campagne, demandé depuis le site et envoyé par le bot. */
export type DiscordPostKind = "session" | "recap";

export interface DiscordPost {
  id: number;
  campaignId: string;
  kind: DiscordPostKind;
  content: string;
  /** Mentionne le rôle des joueurs de la campagne (annonce de séance). */
  mentionPlayers: boolean;
  requestedBy: string;
  requestedAt: string;
  sentAt: string | null;
  error: string | null;
  attempts: number;
}

/** Personnage en cours de création (assistant non terminé). */
export interface WizardEntry {
  userId: string;
  state: WizardState;
}

/** Séance fixée par le MJ, gardée après son passage pour l'appel aux notes des joueurs. */
export interface ScheduledSession {
  campaignId: string;
  startsAt: string;
}

export interface PlayerNote {
  id: number;
  campaignId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export type CarnetKind = "pnj" | "lieu" | "objet" | "fil";

/** Entrée du carnet de campagne, tirée des rappels publiés. */
export interface CarnetEntry {
  campaignId: string;
  kind: CarnetKind;
  name: string;
  detail: string;
  /** Séance où l'entrée apparaît pour la première fois, puis dernière séance qui l'a mise à jour. */
  firstSession: number;
  lastSession: number;
}

export interface NextSession {
  campaignId: string;
  /** Date et heure de début, ISO 8601 en UTC. */
  startsAt: string;
  note: string;
  reminded: boolean;
}

/** Brouillon de rappel généré par /seance, en attente de « Publier » ou « Annuler ». */
export interface RecapDraft {
  id: string;
  userId: string;
  channelId: string;
  notes: string;
  recap: string;
}

/** Un brouillon non publié est supprimé au bout de 7 jours. */
export const RECAP_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface Store {
  /** Retourne undefined si une campagne existe déjà pour ce salon. */
  createCampaign(input: { channelId: string; guildId: string; name: string; mjRoleId: string }): Campaign | undefined;
  getCampaign(channelId: string): Campaign | undefined;
  /** Campagne dont le salon de rappel OU le salon d'aide à la préparation est ce salon. */
  findCampaignForChannel(channelId: string): Campaign | undefined;
  setPrepChannel(campaignChannelId: string, prepChannelId: string): void;
  setSheetsChannel(campaignChannelId: string, sheetsChannelId: string): void;
  /** Première campagne non archivée du serveur. */
  campaignForGuild(guildId: string): Campaign | undefined;
  /** Campagnes du serveur, par date de création. */
  listCampaigns(guildId: string, includeArchived?: boolean): Campaign[];
  setCampaignStructure(channelId: string, structure: CampaignStructure): void;
  setArchived(channelId: string, archived: boolean): void;
  setArchivedChannels(channelId: string, channels: ArchivedChannel[]): void;
  setStyle(channelId: string, style: StyleGuide): void;
  /** Supprime la campagne et ses données (rappels, personnages, séance prévue). Les salons Discord sont gérés par archive.ts. */
  deleteCampaign(channelId: string): void;
  setCreationRules(channelId: string, rules: CreationRules): void;
  getWizard(guildId: string, userId: string): WizardState | undefined;
  saveWizard(guildId: string, userId: string, state: WizardState): void;
  deleteWizard(guildId: string, userId: string): void;
  addCharacter(guildId: string, userId: string, campaignId: string, name: string, draft: Draft): StoredCharacter;
  getCharacter(id: number): StoredCharacter | undefined;
  latestCharacter(guildId: string, userId: string, campaignId?: string): StoredCharacter | undefined;
  /** Personnages du serveur, ou d'une seule campagne. */
  listCharacters(guildId: string, campaignId?: string): StoredCharacter[];
  deleteCharacter(id: number): void;
  /** Rend ce personnage actif pour son joueur dans sa campagne (les autres de la campagne deviennent inactifs). */
  setActiveCharacter(id: number): void;
  activeCharacter(guildId: string, userId: string, campaignId: string): StoredCharacter | undefined;
  setNextSession(campaignId: string, startsAt: string, note: string): NextSession;
  getNextSession(campaignId: string): NextSession | undefined;
  clearNextSession(campaignId: string): void;
  /** Séances à venir qui commencent avant `untilIso` et dont le rappel n'est pas encore parti. */
  dueReminders(nowIso: string, untilIso: string): NextSession[];
  markReminded(campaignId: string): void;
  /** Tous les rappels publiés d'une campagne, dans l'ordre. */
  allSessions(channelId: string): SessionRecord[];
  /** Les derniers rappels publiés, du plus ancien au plus récent. */
  recentSessions(channelId: string, limit: number): SessionRecord[];
  addSession(channelId: string, notes: string, recap: string): SessionRecord;
  latestSession(channelId: string): SessionRecord | undefined;
  setPanels(channelId: string, panels: { panelMessageId?: string | null; mjPanelMessageId?: string | null }): void;
  /** Fixe (ou efface, avec null) l'échéance de création des personnages ; remet les relances à zéro. */
  setCreationDeadline(channelId: string, iso: string | null): void;
  setDeadlineStage(channelId: string, stage: number): void;
  /** Campagnes actives avec une échéance de création. */
  campaignsWithDeadline(): Campaign[];
  /** Joueurs ajoutés avec /campagne ajouter-joueur (le bot ne peut pas lister les membres d'un rôle sans intent privilégié). */
  addPlayer(campaignId: string, userId: string): void;
  removePlayer(campaignId: string, userId: string): void;
  listPlayers(campaignId: string): string[];
  listWizards(guildId: string): WizardEntry[];
  /** Demande la publication d'une fiche ; réutilise une demande encore en attente. */
  requestPublication(characterId: number, requestedBy: string): PublishRequest;
  /** Demandes à traiter : non publiées et sous le nombre maximal d'essais. */
  pendingPublications(): PublishRequest[];
  latestPublication(characterId: number): PublishRequest | undefined;
  markPublished(id: number): void;
  markPublicationFailed(id: number, error: string): void;
  /** Demande au bot de poster un message dans le salon de la campagne. */
  queueDiscordPost(input: { campaignId: string; kind: DiscordPostKind; content: string; mentionPlayers: boolean; requestedBy: string }): DiscordPost;
  /** Messages à envoyer : non envoyés et sous le nombre maximal d'essais. */
  pendingDiscordPosts(): DiscordPost[];
  /** Derniers messages demandés pour une campagne, du plus récent au plus ancien. */
  recentDiscordPosts(campaignId: string, limit: number): DiscordPost[];
  markDiscordPostSent(id: number): void;
  markDiscordPostFailed(id: number, error: string): void;
  /** Séances commencées avant `beforeIso` et après `sinceIso`, dont l’appel aux notes des joueurs n’est pas encore parti. */
  dueNoteCalls(beforeIso: string, sinceIso: string): ScheduledSession[];
  markNotesCalled(campaignId: string, startsAt: string): void;
  /** Note d'un joueur pour le prochain rappel ; remplace sa note précédente encore non utilisée. */
  savePlayerNote(campaignId: string, userId: string, text: string): void;
  pendingPlayerNote(campaignId: string, userId: string): PlayerNote | undefined;
  pendingPlayerNotes(campaignId: string): PlayerNote[];
  /** Rattache les notes en attente au rappel publié. */
  markPlayerNotesUsed(campaignId: string, sessionNumber: number): void;
  /** Ajoute ou met à jour une entrée du carnet (même nom, sans tenir compte des accents ni de la casse). */
  upsertCarnet(campaignId: string, kind: Exclude<CarnetKind, "fil">, name: string, detail: string, sessionNumber: number): void;
  /** Remplace les fils ouverts par ceux du dernier rappel. */
  replaceOpenThreads(campaignId: string, threads: { name: string; detail: string }[], sessionNumber: number): void;
  listCarnet(campaignId: string): CarnetEntry[];
  /** Retourne true si une entrée a été retirée. */
  removeCarnet(campaignId: string, kind: CarnetKind, name: string): boolean;
  /** Enregistre un brouillon de rappel (survit aux redémarrages) et supprime les brouillons de plus de 7 jours. */
  saveRecapDraft(draft: RecapDraft, now?: Date): void;
  getRecapDraft(id: string): RecapDraft | undefined;
  deleteRecapDraft(id: string): void;
  close(): void;
}

interface CampaignRow {
  channel_id: string;
  guild_id: string;
  name: string;
  mj_role_id: string;
  prep_channel_id: string | null;
  sheets_channel_id: string | null;
  creation_rules: string | null;
  player_role_id: string | null;
  category_id: string | null;
  archived: number;
  archived_channels: string | null;
  style_guide: string | null;
  panel_message_id: string | null;
  mj_panel_message_id: string | null;
  creation_deadline: string | null;
  deadline_stage: number;
  created_at: string;
}

interface CharacterRow {
  id: number;
  guild_id: string;
  user_id: string;
  name: string;
  draft: string;
  campaign_id: string;
  active: number;
  created_at: string;
}

const toCharacter = (r: CharacterRow): StoredCharacter => ({
  id: r.id,
  guildId: r.guild_id,
  userId: r.user_id,
  name: r.name,
  draft: JSON.parse(r.draft) as Draft,
  campaignId: r.campaign_id,
  active: r.active === 1,
  createdAt: r.created_at,
});

interface SessionRow {
  id: number;
  channel_id: string;
  number: number;
  notes: string;
  recap: string;
  created_at: string;
}

const toCampaign = (r: CampaignRow): Campaign => ({
  channelId: r.channel_id,
  guildId: r.guild_id,
  name: r.name,
  mjRoleId: r.mj_role_id,
  prepChannelId: r.prep_channel_id,
  sheetsChannelId: r.sheets_channel_id,
  creationRules: normalizeRules(r.creation_rules ? JSON.parse(r.creation_rules) : undefined),
  playerRoleId: r.player_role_id,
  categoryId: r.category_id,
  archived: r.archived === 1,
  archivedChannels: r.archived_channels ? (JSON.parse(r.archived_channels) as ArchivedChannel[]) : [],
  style: normalizeStyle(r.style_guide ? JSON.parse(r.style_guide) : undefined),
  panelMessageId: r.panel_message_id,
  mjPanelMessageId: r.mj_panel_message_id,
  creationDeadline: r.creation_deadline,
  deadlineStage: r.deadline_stage,
  createdAt: r.created_at,
});

/** Clé de comparaison des noms du carnet : sans accents, sans casse, espaces réduites. */
export const carnetKey = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const toSession = (r: SessionRow): SessionRecord => ({
  id: r.id,
  channelId: r.channel_id,
  number: r.number,
  notes: r.notes,
  recap: r.recap,
  createdAt: r.created_at,
});

export function openStore(path: string): Store {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      channel_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mj_role_id TEXT NOT NULL,
      prep_channel_id TEXT,
      sheets_channel_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL REFERENCES campaigns(channel_id),
      number INTEGER NOT NULL,
      notes TEXT NOT NULL,
      recap TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (channel_id, number)
    );
    CREATE TABLE IF NOT EXISTS character_wizards (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      state TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS next_sessions (
      campaign_id TEXT PRIMARY KEY,
      starts_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      reminded INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      draft TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS campaign_players (
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      added_at TEXT NOT NULL,
      PRIMARY KEY (campaign_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS scheduled_sessions (
      campaign_id TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      notes_called INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (campaign_id, starts_at)
    );
    CREATE TABLE IF NOT EXISTS player_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      session_number INTEGER
    );
    CREATE TABLE IF NOT EXISTS carnet (
      campaign_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      name_key TEXT NOT NULL,
      name TEXT NOT NULL,
      detail TEXT NOT NULL,
      first_session INTEGER NOT NULL,
      last_session INTEGER NOT NULL,
      PRIMARY KEY (campaign_id, kind, name_key)
    );
    CREATE TABLE IF NOT EXISTS publish_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      published_at TEXT,
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS discord_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      mention_players INTEGER NOT NULL DEFAULT 0,
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      sent_at TEXT,
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS recap_drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      notes TEXT NOT NULL,
      recap TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const charColumns = db.prepare("PRAGMA table_info(characters)").all() as { name: string }[];
  if (!charColumns.some((c) => c.name === "active")) db.exec("ALTER TABLE characters ADD COLUMN active INTEGER NOT NULL DEFAULT 0");

  // Migration : bases créées avant l'ajout du salon d'aide à la préparation.
  const columns = db.prepare("PRAGMA table_info(campaigns)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "prep_channel_id")) {
    db.exec("ALTER TABLE campaigns ADD COLUMN prep_channel_id TEXT");
  }
  if (!columns.some((c) => c.name === "sheets_channel_id")) {
    db.exec("ALTER TABLE campaigns ADD COLUMN sheets_channel_id TEXT");
  }
  if (!columns.some((c) => c.name === "creation_rules")) {
    db.exec("ALTER TABLE campaigns ADD COLUMN creation_rules TEXT");
  }
  // Migration : campagnes multiples.
  if (!columns.some((c) => c.name === "player_role_id")) db.exec("ALTER TABLE campaigns ADD COLUMN player_role_id TEXT");
  if (!columns.some((c) => c.name === "category_id")) db.exec("ALTER TABLE campaigns ADD COLUMN category_id TEXT");
  if (!columns.some((c) => c.name === "archived")) db.exec("ALTER TABLE campaigns ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  if (!columns.some((c) => c.name === "archived_channels")) db.exec("ALTER TABLE campaigns ADD COLUMN archived_channels TEXT");
  if (!columns.some((c) => c.name === "style_guide")) db.exec("ALTER TABLE campaigns ADD COLUMN style_guide TEXT");
  // Migration : tableaux de bord et échéance de création.
  if (!columns.some((c) => c.name === "panel_message_id")) db.exec("ALTER TABLE campaigns ADD COLUMN panel_message_id TEXT");
  if (!columns.some((c) => c.name === "mj_panel_message_id")) db.exec("ALTER TABLE campaigns ADD COLUMN mj_panel_message_id TEXT");
  if (!columns.some((c) => c.name === "creation_deadline")) db.exec("ALTER TABLE campaigns ADD COLUMN creation_deadline TEXT");
  if (!columns.some((c) => c.name === "deadline_stage")) db.exec("ALTER TABLE campaigns ADD COLUMN deadline_stage INTEGER NOT NULL DEFAULT 0");
  if (!(db.prepare("PRAGMA table_info(characters)").all() as { name: string }[]).some((c) => c.name === "campaign_id")) {
    db.exec("ALTER TABLE characters ADD COLUMN campaign_id TEXT NOT NULL DEFAULT ''");
    // Les personnages existants rejoignent la première campagne de leur serveur.
    db.exec(
      "UPDATE characters SET campaign_id = COALESCE((SELECT channel_id FROM campaigns c WHERE c.guild_id = characters.guild_id ORDER BY created_at LIMIT 1), '')",
    );
  }

  type PublishRow = {
    id: number;
    character_id: number;
    requested_by: string;
    requested_at: string;
    published_at: string | null;
    error: string | null;
    attempts: number;
  };
  const toPublish = (r: PublishRow): PublishRequest => ({
    id: r.id,
    characterId: r.character_id,
    requestedBy: r.requested_by,
    requestedAt: r.requested_at,
    publishedAt: r.published_at,
    error: r.error,
    attempts: r.attempts,
  });
  const selectPendingPublishFor = db.prepare(
    `SELECT * FROM publish_requests WHERE character_id = ? AND published_at IS NULL AND attempts < ${MAX_PUBLISH_ATTEMPTS} ORDER BY id DESC LIMIT 1`,
  );
  const insertPublish = db.prepare("INSERT INTO publish_requests (character_id, requested_by, requested_at) VALUES (?, ?, ?)");
  const selectPublish = db.prepare("SELECT * FROM publish_requests WHERE id = ?");
  const selectPendingPublish = db.prepare(
    `SELECT * FROM publish_requests WHERE published_at IS NULL AND attempts < ${MAX_PUBLISH_ATTEMPTS} ORDER BY id`,
  );
  const selectLatestPublish = db.prepare("SELECT * FROM publish_requests WHERE character_id = ? ORDER BY id DESC LIMIT 1");
  const updatePublished = db.prepare("UPDATE publish_requests SET published_at = ?, error = NULL, attempts = attempts + 1 WHERE id = ?");
  const deletePublishFor = db.prepare("DELETE FROM publish_requests WHERE character_id = ?");
  const updatePublishFailed = db.prepare("UPDATE publish_requests SET error = ?, attempts = attempts + 1 WHERE id = ?");

  type PostRow = {
    id: number;
    campaign_id: string;
    kind: DiscordPostKind;
    content: string;
    mention_players: number;
    requested_by: string;
    requested_at: string;
    sent_at: string | null;
    error: string | null;
    attempts: number;
  };
  const toPost = (r: PostRow): DiscordPost => ({
    id: r.id,
    campaignId: r.campaign_id,
    kind: r.kind,
    content: r.content,
    mentionPlayers: r.mention_players === 1,
    requestedBy: r.requested_by,
    requestedAt: r.requested_at,
    sentAt: r.sent_at,
    error: r.error,
    attempts: r.attempts,
  });
  const insertPost = db.prepare(
    "INSERT INTO discord_posts (campaign_id, kind, content, mention_players, requested_by, requested_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const selectPost = db.prepare("SELECT * FROM discord_posts WHERE id = ?");
  const selectPendingPosts = db.prepare(`SELECT * FROM discord_posts WHERE sent_at IS NULL AND attempts < ${MAX_PUBLISH_ATTEMPTS} ORDER BY id`);
  const selectRecentPosts = db.prepare("SELECT * FROM discord_posts WHERE campaign_id = ? ORDER BY id DESC LIMIT ?");
  const updatePostSent = db.prepare("UPDATE discord_posts SET sent_at = ?, error = NULL, attempts = attempts + 1 WHERE id = ?");
  const updatePostFailed = db.prepare("UPDATE discord_posts SET error = ?, attempts = attempts + 1 WHERE id = ?");

  const insertCampaign = db.prepare(
    "INSERT OR IGNORE INTO campaigns (channel_id, guild_id, name, mj_role_id, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const selectCampaign = db.prepare("SELECT * FROM campaigns WHERE channel_id = ?");
  const selectCampaignForChannel = db.prepare(
    "SELECT * FROM campaigns WHERE channel_id = ? OR prep_channel_id = ? OR sheets_channel_id = ? OR category_id = ? LIMIT 1",
  );
  const selectCampaigns = db.prepare("SELECT * FROM campaigns WHERE guild_id = ? AND (archived = 0 OR ?) ORDER BY created_at");
  const updateStructure = db.prepare(
    "UPDATE campaigns SET mj_role_id = COALESCE(?, mj_role_id), prep_channel_id = COALESCE(?, prep_channel_id), sheets_channel_id = COALESCE(?, sheets_channel_id), player_role_id = COALESCE(?, player_role_id), category_id = COALESCE(?, category_id) WHERE channel_id = ?",
  );
  const updateArchived = db.prepare("UPDATE campaigns SET archived = ? WHERE channel_id = ?");
  const updateArchivedChannels = db.prepare("UPDATE campaigns SET archived_channels = ? WHERE channel_id = ?");
  const updateStyle = db.prepare("UPDATE campaigns SET style_guide = ? WHERE channel_id = ?");
  const deleteCampaignTx = db.transaction((channelId: string) => {
    db.prepare("DELETE FROM sessions WHERE channel_id = ?").run(channelId);
    db.prepare("DELETE FROM publish_requests WHERE character_id IN (SELECT id FROM characters WHERE campaign_id = ?)").run(channelId);
    db.prepare("DELETE FROM characters WHERE campaign_id = ?").run(channelId);
    db.prepare("DELETE FROM next_sessions WHERE campaign_id = ?").run(channelId);
    db.prepare("DELETE FROM recap_drafts WHERE channel_id = ?").run(channelId);
    for (const t of ["campaign_players", "scheduled_sessions", "player_notes", "carnet", "discord_posts"]) db.prepare(`DELETE FROM ${t} WHERE campaign_id = ?`).run(channelId);
    db.prepare("DELETE FROM campaigns WHERE channel_id = ?").run(channelId);
  });
  const updatePrepChannel = db.prepare("UPDATE campaigns SET prep_channel_id = ? WHERE channel_id = ?");
  const updateSheetsChannel = db.prepare("UPDATE campaigns SET sheets_channel_id = ? WHERE channel_id = ?");
  const updateRules = db.prepare("UPDATE campaigns SET creation_rules = ? WHERE channel_id = ?");
  const selectCampaignForGuild = db.prepare("SELECT * FROM campaigns WHERE guild_id = ? AND archived = 0 ORDER BY created_at LIMIT 1");
  const selectWizard = db.prepare("SELECT state FROM character_wizards WHERE guild_id = ? AND user_id = ?");
  const upsertWizard = db.prepare(
    "INSERT INTO character_wizards (guild_id, user_id, state, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (guild_id, user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at",
  );
  const removeWizard = db.prepare("DELETE FROM character_wizards WHERE guild_id = ? AND user_id = ?");
  const insertCharacter = db.prepare(
    "INSERT INTO characters (guild_id, user_id, campaign_id, name, draft, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const selectCharacter = db.prepare("SELECT * FROM characters WHERE id = ?");
  const selectLatestCharacter = db.prepare(
    "SELECT * FROM characters WHERE guild_id = ? AND user_id = ? AND (? IS NULL OR campaign_id = ?) ORDER BY id DESC LIMIT 1",
  );
  const selectCharacters = db.prepare(
    "SELECT * FROM characters WHERE guild_id = ? AND (? IS NULL OR campaign_id = ?) ORDER BY name COLLATE NOCASE",
  );
  const removeCharacter = db.prepare("DELETE FROM characters WHERE id = ?");
  const clearActive = db.prepare("UPDATE characters SET active = 0 WHERE guild_id = ? AND user_id = ? AND campaign_id = ?");
  const markActive = db.prepare("UPDATE characters SET active = 1 WHERE id = ?");
  const selectActive = db.prepare(
    "SELECT * FROM characters WHERE guild_id = ? AND user_id = ? AND campaign_id = ? AND active = 1 LIMIT 1",
  );
  const upsertNext = db.prepare(
    "INSERT INTO next_sessions (campaign_id, starts_at, note, reminded) VALUES (?, ?, ?, 0) ON CONFLICT (campaign_id) DO UPDATE SET starts_at = excluded.starts_at, note = excluded.note, reminded = 0",
  );
  const selectNext = db.prepare("SELECT * FROM next_sessions WHERE campaign_id = ?");
  const removeNext = db.prepare("DELETE FROM next_sessions WHERE campaign_id = ?");
  const selectDue = db.prepare("SELECT * FROM next_sessions WHERE reminded = 0 AND starts_at > ? AND starts_at <= ?");
  const markRemindedStmt = db.prepare("UPDATE next_sessions SET reminded = 1 WHERE campaign_id = ?");
  const selectAllSessions = db.prepare("SELECT * FROM sessions WHERE channel_id = ? ORDER BY number");
  const toNext = (r: { campaign_id: string; starts_at: string; note: string; reminded: number }): NextSession => ({
    campaignId: r.campaign_id,
    startsAt: r.starts_at,
    note: r.note,
    reminded: r.reminded === 1,
  });
  const selectRecent = db.prepare("SELECT * FROM sessions WHERE channel_id = ? ORDER BY number DESC LIMIT ?");
  const nextNumber = db.prepare(
    "SELECT COALESCE(MAX(number), 0) + 1 AS n FROM sessions WHERE channel_id = ?",
  );
  const insertSession = db.prepare(
    "INSERT INTO sessions (channel_id, number, notes, recap, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const selectLatest = db.prepare(
    "SELECT * FROM sessions WHERE channel_id = ? ORDER BY number DESC LIMIT 1",
  );
  const selectSession = db.prepare("SELECT * FROM sessions WHERE id = ?");
  const insertDraft = db.prepare(
    "INSERT OR REPLACE INTO recap_drafts (id, user_id, channel_id, notes, recap, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const purgeDrafts = db.prepare("DELETE FROM recap_drafts WHERE created_at < ?");
  const selectDraft = db.prepare("SELECT * FROM recap_drafts WHERE id = ?");
  const removeDraft = db.prepare("DELETE FROM recap_drafts WHERE id = ?");
  const updatePanels = db.prepare(
    "UPDATE campaigns SET panel_message_id = COALESCE(?, panel_message_id), mj_panel_message_id = COALESCE(?, mj_panel_message_id) WHERE channel_id = ?",
  );
  const updateDeadline = db.prepare("UPDATE campaigns SET creation_deadline = ?, deadline_stage = 0 WHERE channel_id = ?");
  const updateDeadlineStage = db.prepare("UPDATE campaigns SET deadline_stage = ? WHERE channel_id = ?");
  const selectWithDeadline = db.prepare("SELECT * FROM campaigns WHERE archived = 0 AND creation_deadline IS NOT NULL");
  const insertPlayer = db.prepare("INSERT OR IGNORE INTO campaign_players (campaign_id, user_id, added_at) VALUES (?, ?, ?)");
  const deletePlayer = db.prepare("DELETE FROM campaign_players WHERE campaign_id = ? AND user_id = ?");
  const selectPlayers = db.prepare("SELECT user_id FROM campaign_players WHERE campaign_id = ? ORDER BY added_at");
  const selectWizards = db.prepare("SELECT user_id, state FROM character_wizards WHERE guild_id = ?");
  const insertScheduled = db.prepare("INSERT OR IGNORE INTO scheduled_sessions (campaign_id, starts_at) VALUES (?, ?)");
  const deleteFutureScheduled = db.prepare("DELETE FROM scheduled_sessions WHERE campaign_id = ? AND starts_at > ?");
  const selectNoteCalls = db.prepare(
    "SELECT campaign_id, starts_at FROM scheduled_sessions WHERE notes_called = 0 AND starts_at <= ? AND starts_at > ? ORDER BY starts_at",
  );
  const updateNotesCalled = db.prepare("UPDATE scheduled_sessions SET notes_called = 1 WHERE campaign_id = ? AND starts_at = ?");
  const deletePendingNote = db.prepare("DELETE FROM player_notes WHERE campaign_id = ? AND user_id = ? AND session_number IS NULL");
  const insertNote = db.prepare("INSERT INTO player_notes (campaign_id, user_id, text, created_at) VALUES (?, ?, ?, ?)");
  const selectPendingNote = db.prepare("SELECT * FROM player_notes WHERE campaign_id = ? AND user_id = ? AND session_number IS NULL");
  const selectPendingNotes = db.prepare("SELECT * FROM player_notes WHERE campaign_id = ? AND session_number IS NULL ORDER BY created_at");
  const updateNotesUsed = db.prepare("UPDATE player_notes SET session_number = ? WHERE campaign_id = ? AND session_number IS NULL");
  const upsertCarnetStmt = db.prepare(
    "INSERT INTO carnet (campaign_id, kind, name_key, name, detail, first_session, last_session) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (campaign_id, kind, name_key) DO UPDATE SET detail = CASE WHEN excluded.detail = '' THEN carnet.detail ELSE excluded.detail END, last_session = excluded.last_session",
  );
  const deleteThreads = db.prepare("DELETE FROM carnet WHERE campaign_id = ? AND kind = 'fil'");
  const selectCarnet = db.prepare("SELECT * FROM carnet WHERE campaign_id = ? ORDER BY kind, name");
  const deleteCarnet = db.prepare("DELETE FROM carnet WHERE campaign_id = ? AND kind = ? AND name_key = ?");
  type NoteRow = { id: number; campaign_id: string; user_id: string; text: string; created_at: string };
  const toNote = (r: NoteRow): PlayerNote => ({ id: r.id, campaignId: r.campaign_id, userId: r.user_id, text: r.text, createdAt: r.created_at });

  const addSessionTx = db.transaction((channelId: string, notes: string, recap: string) => {
    const { n } = nextNumber.get(channelId) as { n: number };
    const info = insertSession.run(channelId, n, notes, recap, new Date().toISOString());
    return toSession(selectSession.get(info.lastInsertRowid) as SessionRow);
  });

  return {
    createCampaign(input) {
      const createdAt = new Date().toISOString();
      const info = insertCampaign.run(input.channelId, input.guildId, input.name, input.mjRoleId, createdAt);
      if (info.changes === 0) return undefined;
      return {
        ...input,
        prepChannelId: null,
        sheetsChannelId: null,
        creationRules: normalizeRules(undefined),
        playerRoleId: null,
        categoryId: null,
        archived: false,
        archivedChannels: [],
        style: {},
        panelMessageId: null,
        mjPanelMessageId: null,
        creationDeadline: null,
        deadlineStage: 0,
        createdAt,
      };
    },
    getCampaign(channelId) {
      const row = selectCampaign.get(channelId) as CampaignRow | undefined;
      return row ? toCampaign(row) : undefined;
    },
    findCampaignForChannel(channelId) {
      const row = selectCampaignForChannel.get(channelId, channelId, channelId, channelId) as CampaignRow | undefined;
      return row ? toCampaign(row) : undefined;
    },
    setPrepChannel(campaignChannelId, prepChannelId) {
      updatePrepChannel.run(prepChannelId, campaignChannelId);
    },
    setCreationRules(channelId, rules) {
      updateRules.run(JSON.stringify(rules), channelId);
    },
    setSheetsChannel(campaignChannelId, sheetsChannelId) {
      updateSheetsChannel.run(sheetsChannelId, campaignChannelId);
    },
    listCampaigns(guildId, includeArchived = false) {
      return (selectCampaigns.all(guildId, includeArchived ? 1 : 0) as CampaignRow[]).map(toCampaign);
    },
    setCampaignStructure(channelId, st) {
      updateStructure.run(st.mjRoleId ?? null, st.prepChannelId ?? null, st.sheetsChannelId ?? null, st.playerRoleId ?? null, st.categoryId ?? null, channelId);
    },
    setArchived(channelId, archived) {
      updateArchived.run(archived ? 1 : 0, channelId);
    },
    setArchivedChannels(channelId, channels) {
      updateArchivedChannels.run(channels.length ? JSON.stringify(channels) : null, channelId);
    },
    setStyle(channelId, style) {
      updateStyle.run(JSON.stringify(normalizeStyle(style)), channelId);
    },
    deleteCampaign(channelId) {
      deleteCampaignTx(channelId);
    },
    campaignForGuild(guildId) {
      const row = selectCampaignForGuild.get(guildId) as CampaignRow | undefined;
      return row ? toCampaign(row) : undefined;
    },
    getWizard(guildId, userId) {
      const row = selectWizard.get(guildId, userId) as { state: string } | undefined;
      return row ? (JSON.parse(row.state) as WizardState) : undefined;
    },
    saveWizard(guildId, userId, state) {
      upsertWizard.run(guildId, userId, JSON.stringify(state), new Date().toISOString());
    },
    deleteWizard(guildId, userId) {
      removeWizard.run(guildId, userId);
    },
    addCharacter(guildId, userId, campaignId, name, draft) {
      const info = insertCharacter.run(guildId, userId, campaignId, name, JSON.stringify(draft), new Date().toISOString());
      // Le premier personnage d'un joueur dans une campagne devient son personnage actif.
      if (!selectActive.get(guildId, userId, campaignId)) markActive.run(info.lastInsertRowid);
      return toCharacter(selectCharacter.get(info.lastInsertRowid) as CharacterRow);
    },
    getCharacter(id) {
      const row = selectCharacter.get(id) as CharacterRow | undefined;
      return row ? toCharacter(row) : undefined;
    },
    latestCharacter(guildId, userId, campaignId) {
      const c = campaignId ?? null;
      const row = selectLatestCharacter.get(guildId, userId, c, c) as CharacterRow | undefined;
      return row ? toCharacter(row) : undefined;
    },
    listCharacters(guildId, campaignId) {
      const c = campaignId ?? null;
      return (selectCharacters.all(guildId, c, c) as CharacterRow[]).map(toCharacter);
    },
    deleteCharacter(id) {
      db.transaction(() => {
        deletePublishFor.run(id);
        removeCharacter.run(id);
      })();
    },
    setActiveCharacter(id) {
      const row = selectCharacter.get(id) as CharacterRow | undefined;
      if (!row) return;
      db.transaction(() => {
        clearActive.run(row.guild_id, row.user_id, row.campaign_id);
        markActive.run(id);
      })();
    },
    activeCharacter(guildId, userId, campaignId) {
      const row = selectActive.get(guildId, userId, campaignId) as CharacterRow | undefined;
      return row ? toCharacter(row) : undefined;
    },
    setNextSession(campaignId, startsAt, note) {
      upsertNext.run(campaignId, startsAt, note);
      // Une seule séance à venir par campagne : une nouvelle date remplace l'ancienne, les séances passées restent.
      deleteFutureScheduled.run(campaignId, new Date().toISOString());
      insertScheduled.run(campaignId, startsAt);
      return toNext(selectNext.get(campaignId) as Parameters<typeof toNext>[0]);
    },
    getNextSession(campaignId) {
      const r = selectNext.get(campaignId) as Parameters<typeof toNext>[0] | undefined;
      return r ? toNext(r) : undefined;
    },
    clearNextSession(campaignId) {
      removeNext.run(campaignId);
      deleteFutureScheduled.run(campaignId, new Date().toISOString());
    },
    dueReminders(nowIso, untilIso) {
      return (selectDue.all(nowIso, untilIso) as Parameters<typeof toNext>[0][]).map(toNext);
    },
    markReminded(campaignId) {
      markRemindedStmt.run(campaignId);
    },
    allSessions(channelId) {
      return (selectAllSessions.all(channelId) as SessionRow[]).map(toSession);
    },
    recentSessions(channelId, limit) {
      return (selectRecent.all(channelId, limit) as SessionRow[]).map(toSession).reverse();
    },
    addSession: (channelId, notes, recap) => addSessionTx(channelId, notes, recap),
    latestSession(channelId) {
      const row = selectLatest.get(channelId) as SessionRow | undefined;
      return row ? toSession(row) : undefined;
    },
    saveRecapDraft(d, now = new Date()) {
      purgeDrafts.run(new Date(now.getTime() - RECAP_DRAFT_TTL_MS).toISOString());
      insertDraft.run(d.id, d.userId, d.channelId, d.notes, d.recap, now.toISOString());
    },
    getRecapDraft(id) {
      const r = selectDraft.get(id) as { id: string; user_id: string; channel_id: string; notes: string; recap: string } | undefined;
      return r ? { id: r.id, userId: r.user_id, channelId: r.channel_id, notes: r.notes, recap: r.recap } : undefined;
    },
    deleteRecapDraft(id) {
      removeDraft.run(id);
    },
    setPanels(channelId, panels) {
      updatePanels.run(panels.panelMessageId ?? null, panels.mjPanelMessageId ?? null, channelId);
    },
    setCreationDeadline(channelId, iso) {
      updateDeadline.run(iso, channelId);
    },
    setDeadlineStage(channelId, stage) {
      updateDeadlineStage.run(stage, channelId);
    },
    campaignsWithDeadline() {
      return (selectWithDeadline.all() as CampaignRow[]).map(toCampaign);
    },
    addPlayer(campaignId, userId) {
      insertPlayer.run(campaignId, userId, new Date().toISOString());
    },
    removePlayer(campaignId, userId) {
      deletePlayer.run(campaignId, userId);
    },
    listPlayers(campaignId) {
      return (selectPlayers.all(campaignId) as { user_id: string }[]).map((r) => r.user_id);
    },
    listWizards(guildId) {
      return (selectWizards.all(guildId) as { user_id: string; state: string }[]).map((r) => ({ userId: r.user_id, state: JSON.parse(r.state) as WizardState }));
    },
    dueNoteCalls(beforeIso, sinceIso) {
      return (selectNoteCalls.all(beforeIso, sinceIso) as { campaign_id: string; starts_at: string }[]).map((r) => ({ campaignId: r.campaign_id, startsAt: r.starts_at }));
    },
    markNotesCalled(campaignId, startsAt) {
      updateNotesCalled.run(campaignId, startsAt);
    },
    savePlayerNote(campaignId, userId, text) {
      db.transaction(() => {
        deletePendingNote.run(campaignId, userId);
        insertNote.run(campaignId, userId, text, new Date().toISOString());
      })();
    },
    pendingPlayerNote(campaignId, userId) {
      const r = selectPendingNote.get(campaignId, userId) as NoteRow | undefined;
      return r ? toNote(r) : undefined;
    },
    pendingPlayerNotes(campaignId) {
      return (selectPendingNotes.all(campaignId) as NoteRow[]).map(toNote);
    },
    markPlayerNotesUsed(campaignId, sessionNumber) {
      updateNotesUsed.run(sessionNumber, campaignId);
    },
    upsertCarnet(campaignId, kind, name, detail, sessionNumber) {
      const clean = name.trim();
      if (!clean) return;
      upsertCarnetStmt.run(campaignId, kind, carnetKey(clean), clean, detail.trim(), sessionNumber, sessionNumber);
    },
    replaceOpenThreads(campaignId, threads, sessionNumber) {
      db.transaction(() => {
        deleteThreads.run(campaignId);
        for (const t of threads) if (t.name.trim()) upsertCarnetStmt.run(campaignId, "fil", carnetKey(t.name), t.name.trim(), t.detail.trim(), sessionNumber, sessionNumber);
      })();
    },
    listCarnet(campaignId) {
      return (
        selectCarnet.all(campaignId) as { campaign_id: string; kind: CarnetKind; name: string; detail: string; first_session: number; last_session: number }[]
      ).map((r) => ({ campaignId: r.campaign_id, kind: r.kind, name: r.name, detail: r.detail, firstSession: r.first_session, lastSession: r.last_session }));
    },
    removeCarnet(campaignId, kind, name) {
      return deleteCarnet.run(campaignId, kind, carnetKey(name)).changes > 0;
    },
    requestPublication(characterId, requestedBy) {
      const pending = selectPendingPublishFor.get(characterId) as PublishRow | undefined;
      if (pending) return toPublish(pending);
      const id = Number(insertPublish.run(characterId, requestedBy, new Date().toISOString()).lastInsertRowid);
      return toPublish(selectPublish.get(id) as PublishRow);
    },
    pendingPublications() {
      return (selectPendingPublish.all() as PublishRow[]).map(toPublish);
    },
    latestPublication(characterId) {
      const row = selectLatestPublish.get(characterId) as PublishRow | undefined;
      return row ? toPublish(row) : undefined;
    },
    markPublished(id) {
      updatePublished.run(new Date().toISOString(), id);
    },
    markPublicationFailed(id, error) {
      updatePublishFailed.run(error.slice(0, 500), id);
    },
    queueDiscordPost({ campaignId, kind, content, mentionPlayers, requestedBy }) {
      const id = Number(insertPost.run(campaignId, kind, content, mentionPlayers ? 1 : 0, requestedBy, new Date().toISOString()).lastInsertRowid);
      return toPost(selectPost.get(id) as PostRow);
    },
    pendingDiscordPosts() {
      return (selectPendingPosts.all() as PostRow[]).map(toPost);
    },
    recentDiscordPosts(campaignId, limit) {
      return (selectRecentPosts.all(campaignId, limit) as PostRow[]).map(toPost);
    },
    markDiscordPostSent(id) {
      updatePostSent.run(new Date().toISOString(), id);
    },
    markDiscordPostFailed(id, error) {
      updatePostFailed.run(error.slice(0, 500), id);
    },
    close() {
      db.close();
    },
  };
}
