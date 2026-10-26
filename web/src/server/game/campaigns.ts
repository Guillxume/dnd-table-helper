import "server-only";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { applyCarnet, extractCarnet } from "@bot/carnet";
import { ALL_METHODS, type Content, type CreationRules, type Method } from "@bot/character/rules";
import type { Campaign, CarnetEntry, CarnetKind, NextSession, SessionRecord } from "@bot/db";
import { isPrepType, type PrepType } from "@bot/prep";
import { generatePrep } from "@bot/service";
import { normalizeStyle, styleBlock, type StyleGuide } from "@bot/style";
import { summarizeNotes, MAX_NOTES_LENGTH } from "@bot/summarize";
import { buildCampaignExport } from "@bot/export";
import { renderGroupSheet } from "@bot/group-sheet";
import { campaignProgress } from "@bot/tracking";
import { TIMEZONE, formatLocal, parseSessionDate } from "@bot/time";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { consumeQuota, getCompleter, runModel } from "./ai";
import { getBotStore } from "./bot-store";
import { botActor, type GameActor, isMjOf, listMemberCampaigns, requireCampaign } from "./membership";

/**
 * Espace de campagne : ce que les commandes du bot permettent au MJ (/prochaine-seance, /regles,
 * /style, /seance, /preparer, /carnet, /campagne suivi), sur la même base et avec les mêmes droits.
 * Ce qui doit apparaître sur Discord (annonce, rappel de séance) passe par la file discord_posts :
 * le bot l'envoie dans le salon de la campagne (src/publish.ts).
 */

/** Demandes de rédaction par heure pour le MJ (rappel, carnet, préparation) : plus large que pour les joueurs. */
const MJ_HOURLY_LIMIT = 40;

/** Identifiant de la personne pour le bot : son compte Discord, à défaut son compte du site. */
const actorKey = (actor: GameActor) => actor.discordId ?? `site:${actor.userId}`;

export function requireMj(actor: GameActor, campaignId: string): Campaign {
  const campaign = requireCampaign(actor, campaignId);
  if (!isMjOf(actor, campaign)) throw new DomainError(`Seul le MJ de « ${campaign.name} » peut faire cela.`);
  return campaign;
}

function requireActive(campaign: Campaign): void {
  if (campaign.archived) throw new DomainError(`« ${campaign.name} » est archivée.`);
}

/** Séance à venir, ou undefined si aucune n'est prévue (ou si elle est passée). */
function upcoming(session: NextSession | undefined, now = Date.now()): NextSession | undefined {
  return session && new Date(session.startsAt).getTime() > now ? session : undefined;
}

export type CampaignSummary = { id: string; name: string; mj: boolean; archived: boolean; nextSession: string | null };

export function listCampaignSummaries(actor: GameActor): CampaignSummary[] {
  const store = getBotStore();
  return listMemberCampaigns(actor).map((campaign) => ({
    id: campaign.channelId,
    name: campaign.name,
    mj: campaign.mj,
    archived: campaign.archived,
    nextSession: upcoming(store.getNextSession(campaign.channelId))?.startsAt ?? null,
  }));
}

export type CampaignOverview = {
  campaign: { id: string; name: string; archived: boolean };
  mj: boolean;
  nextSession: { startsAt: string; label: string; note: string } | null;
  rules: CreationRules;
  deadline: { iso: string; label: string } | null;
  sessions: Pick<SessionRecord, "number" | "recap" | "createdAt">[];
  carnet: CarnetEntry[];
  /** Note du joueur connecté pour le prochain rappel, pas encore utilisée. */
  myPendingNote: string | null;
  timezone: string;
};

export function getCampaignOverview(actor: GameActor, campaignId: string): CampaignOverview {
  const campaign = requireCampaign(actor, campaignId);
  const store = getBotStore();
  const next = upcoming(store.getNextSession(campaign.channelId));
  return {
    campaign: { id: campaign.channelId, name: campaign.name, archived: campaign.archived },
    mj: isMjOf(actor, campaign),
    nextSession: next ? { startsAt: next.startsAt, label: formatLocal(new Date(next.startsAt)), note: next.note } : null,
    rules: campaign.creationRules,
    deadline: campaign.creationDeadline ? { iso: campaign.creationDeadline, label: formatLocal(new Date(campaign.creationDeadline)) } : null,
    sessions: store
      .allSessions(campaign.channelId)
      .map(({ number, recap, createdAt }) => ({ number, recap, createdAt }))
      .reverse(),
    carnet: store.listCarnet(campaign.channelId),
    myPendingNote: actor.discordId ? (store.pendingPlayerNote(campaign.channelId, actor.discordId)?.text ?? null) : null,
    timezone: TIMEZONE,
  };
}

// ── Prochaine séance ─────────────────────────────────────────────────────────

/** Fixe la séance (le bot enverra le rappel 24 h avant) et, au choix, l'annonce dans le salon de la campagne. */
export function scheduleSession(actor: GameActor, campaignId: string, input: { date: string; time: string; note: string; announce: boolean }): string {
  const campaign = requireMj(actor, campaignId);
  requireActive(campaign);
  const parsed = parseSessionDate(input.date, input.time);
  if (!parsed.ok) throw new DomainError(parsed.error);
  const note = input.note.trim().slice(0, 500);
  const store = getBotStore();
  store.setNextSession(campaign.channelId, parsed.date.toISOString(), note);
  const label = formatLocal(parsed.date);
  if (input.announce) {
    store.queueDiscordPost({
      campaignId: campaign.channelId,
      kind: "session",
      content: `Prochaine séance de « ${campaign.name} » : ${label}.${note ? `\nNote du MJ : ${note}` : ""}`,
      mentionPlayers: true,
      requestedBy: actorKey(actor),
    });
  }
  return label;
}

export function cancelSession(actor: GameActor, campaignId: string): void {
  const campaign = requireMj(actor, campaignId);
  getBotStore().clearNextSession(campaign.channelId);
}

// ── Règles de création et échéance ───────────────────────────────────────────

export function updateCreationRules(actor: GameActor, campaignId: string, input: { methods: string[]; content: string }): void {
  const campaign = requireMj(actor, campaignId);
  requireActive(campaign);
  const methods = ALL_METHODS.filter((method) => input.methods.includes(method));
  if (methods.length === 0) throw new DomainError("Au moins une méthode de caractéristiques doit rester autorisée.");
  const content: Content = input.content === "srd" ? "srd" : "manuel";
  // Le moteur ne crée que des personnages de niveau 1 (montée de niveau à la table).
  getBotStore().setCreationRules(campaign.channelId, { level: 1, methods: methods satisfies Method[], content });
}

/** Fixe l'échéance de création (relances automatiques du bot à J-3 et J-1) ou l'efface. */
export function setCreationDeadline(actor: GameActor, campaignId: string, input: { date: string; time: string } | null): string | null {
  const campaign = requireMj(actor, campaignId);
  requireActive(campaign);
  if (!input) {
    getBotStore().setCreationDeadline(campaign.channelId, null);
    return null;
  }
  const parsed = parseSessionDate(input.date, input.time || "20:00");
  if (!parsed.ok) throw new DomainError(parsed.error);
  getBotStore().setCreationDeadline(campaign.channelId, parsed.date.toISOString());
  return formatLocal(parsed.date);
}

// ── Guide de style ───────────────────────────────────────────────────────────

export function getStyle(actor: GameActor, campaignId: string): StyleGuide {
  return requireMj(actor, campaignId).style;
}

export function updateStyle(actor: GameActor, campaignId: string, input: Record<string, string>): void {
  const campaign = requireMj(actor, campaignId);
  getBotStore().setStyle(campaign.channelId, normalizeStyle(input));
}

// ── Suivi de la création ─────────────────────────────────────────────────────

export type ProgressView = {
  done: { player: string; label: string }[];
  inProgress: { player: string; name: string }[];
  awaitingTable: { player: string; name: string }[];
  notStarted: string[];
};

/** Pseudos connus du site (joueurs déjà connectés une fois), à partir des identifiants Discord. */
async function playerNames(discordIds: string[]): Promise<Map<string, string>> {
  if (discordIds.length === 0) return new Map();
  const members = await getDb().discordMember.findMany({
    where: { discordId: { in: discordIds } },
    select: { discordId: true, displayName: true, user: { select: { name: true } } },
  });
  return new Map(members.map((member) => [member.discordId, member.displayName ?? member.user.name]));
}

const unknownPlayer = (discordId: string) => `Joueur pas encore venu sur le site (…${discordId.slice(-4)})`;

export async function getProgress(actor: GameActor, campaignId: string): Promise<ProgressView> {
  const campaign = requireMj(actor, campaignId);
  const progress = campaignProgress(getBotStore(), campaign);
  const ids = [
    ...progress.done.map((entry) => entry.userId),
    ...progress.inProgress.map((entry) => entry.userId),
    ...progress.awaitingTable.map((entry) => entry.userId),
    ...progress.notStarted,
  ];
  const names = await playerNames(ids);
  const name = (id: string) => names.get(id) ?? unknownPlayer(id);
  return {
    done: progress.done.map((entry) => ({ player: name(entry.userId), label: entry.label })),
    inProgress: progress.inProgress.map((entry) => ({ player: name(entry.userId), name: entry.name })),
    awaitingTable: progress.awaitingTable.map((entry) => ({ player: name(entry.userId), name: entry.name })),
    notStarted: progress.notStarted.map(name),
  };
}

// ── Carnet de campagne ───────────────────────────────────────────────────────

export function removeCarnetEntry(actor: GameActor, campaignId: string, kind: CarnetKind, name: string): void {
  const campaign = requireMj(actor, campaignId);
  if (!getBotStore().removeCarnet(campaign.channelId, kind, name)) throw new DomainError("Cette entrée n'existe plus.");
}

// ── Notes des joueurs ────────────────────────────────────────────────────────

/** Note d'un joueur pour le prochain rappel (remplace sa note précédente non utilisée). */
export function savePlayerNote(actor: GameActor, campaignId: string, text: string): void {
  const campaign = requireCampaign(actor, campaignId);
  requireActive(campaign);
  if (!actor.discordId) throw new DomainError("Connecte-toi avec Discord pour envoyer tes notes de séance.");
  const clean = text.trim();
  if (clean.length < 3) throw new DomainError("Ta note est vide.");
  if (clean.length > 1500) throw new DomainError("Ta note dépasse 1 500 caractères.");
  getBotStore().savePlayerNote(campaign.channelId, actor.discordId, clean);
}

// ── Rappel de séance (notes du MJ, brouillon rédigé par l'assistant, publication) ──

export type PendingPlayerNote = { player: string; text: string; createdAt: string };

export async function listPendingPlayerNotes(actor: GameActor, campaignId: string): Promise<PendingPlayerNote[]> {
  const campaign = requireMj(actor, campaignId);
  const notes = getBotStore().pendingPlayerNotes(campaign.channelId);
  const names = await playerNames(notes.map((note) => note.userId));
  return notes.map((note) => ({ player: names.get(note.userId) ?? unknownPlayer(note.userId), text: note.text, createdAt: note.createdAt }));
}

export type RecapDraftView = { id: string; notes: string; recap: string };

/** Rédige un brouillon de rappel à partir des notes du MJ (et des notes des joueurs). Rien n'est publié. */
export async function draftRecap(actor: GameActor, campaignId: string, notes: string): Promise<string> {
  const campaign = requireMj(actor, campaignId);
  requireActive(campaign);
  const clean = notes.trim();
  if (clean === "") throw new DomainError("Écris d'abord tes notes de séance.");
  if (clean.length > MAX_NOTES_LENGTH) throw new DomainError(`Les notes dépassent ${MAX_NOTES_LENGTH} caractères.`);
  getCompleter();
  consumeQuota(actor.userId, MJ_HOURLY_LIMIT);
  const playerNotes = (await listPendingPlayerNotes(actor, campaignId)).map((note) => ({ author: note.player, text: note.text }));
  const recap = await runModel("game:recap", (complete) => summarizeNotes(complete, clean, styleBlock(campaign.style), playerNotes));
  const id = randomUUID();
  getBotStore().saveRecapDraft({ id, userId: actorKey(actor), channelId: campaign.channelId, notes: clean, recap });
  return id;
}

export function getRecapDraft(actor: GameActor, campaignId: string, draftId: string): RecapDraftView | null {
  const campaign = requireMj(actor, campaignId);
  const draft = getBotStore().getRecapDraft(draftId);
  if (!draft || draft.channelId !== campaign.channelId || draft.userId !== actorKey(actor)) return null;
  return { id: draft.id, notes: draft.notes, recap: draft.recap };
}

export function discardRecapDraft(actor: GameActor, campaignId: string, draftId: string): void {
  if (getRecapDraft(actor, campaignId, draftId)) getBotStore().deleteRecapDraft(draftId);
}

/**
 * Publie le rappel (texte relu et corrigé par le MJ) : enregistré comme séance, posté sur Discord
 * par le bot, puis le carnet de campagne est mis à jour à partir de ce texte déjà public.
 */
export async function publishRecap(
  actor: GameActor,
  campaignId: string,
  draftId: string,
  recapText: string,
): Promise<{ number: number; carnet: string | null }> {
  const campaign = requireMj(actor, campaignId);
  requireActive(campaign);
  const draft = getRecapDraft(actor, campaignId, draftId);
  if (!draft) throw new DomainError("Ce brouillon n'existe plus (il expire après 7 jours). Recommence à partir de tes notes.");
  const recap = recapText.trim();
  if (recap.length < 20) throw new DomainError("Le rappel est trop court.");
  if (recap.length > 6000) throw new DomainError("Le rappel dépasse 6 000 caractères.");
  const store = getBotStore();
  const session = store.addSession(campaign.channelId, draft.notes, recap);
  store.deleteRecapDraft(draftId);
  store.markPlayerNotesUsed(campaign.channelId, session.number);
  store.queueDiscordPost({
    campaignId: campaign.channelId,
    kind: "recap",
    content: `**Rappel de la séance ${session.number}**\n\n${recap}`,
    mentionPlayers: false,
    requestedBy: actorKey(actor),
  });
  // Carnet : extrait du rappel publié (déjà lu par les joueurs), donc rien de plus n'est révélé.
  let carnet: string | null = null;
  try {
    const characters = store.listCharacters(campaign.guildId, campaign.channelId).map((character) => character.name);
    const extract = await runModel("game:carnet", (complete) => extractCarnet(complete, recap, characters));
    carnet = applyCarnet(store, campaign.channelId, extract, session.number);
  } catch {
    // Le rappel est publié ; seule la mise à jour du carnet a échoué (déjà journalisé par runModel).
    carnet = null;
  }
  return { number: session.number, carnet };
}

// ── Préparation (scène, PNJ, rencontre) ──────────────────────────────────────

export async function prepare(actor: GameActor, campaignId: string, type: string, values: Record<string, string>): Promise<string> {
  const campaign = requireMj(actor, campaignId);
  if (!isPrepType(type)) throw new DomainError("Type de préparation inconnu.");
  getCompleter();
  consumeQuota(actor.userId, MJ_HOURLY_LIMIT);
  const result = await runModel("game:prep", (complete) =>
    generatePrep(getBotStore(), complete, botActor(actor), campaign.channelId, type satisfies PrepType, values),
  );
  if (!result.ok) throw new DomainError(result.error);
  return result.value;
}

// ── Documents PDF (fiche de groupe, export de la campagne) ───────────────────

/** Les PDF du bot lisent leurs polices dans ce dossier (voir src/export.ts) ; le site les embarque. */
function configurePdfFonts(): void {
  process.env.PDF_FONTS_DIR ||= resolve(process.cwd(), "assets/pdf-fonts");
}

/** Personnages de la campagne avec le pseudo de leur joueur (personnage actif de chacun, ou tous). */
async function charactersWithPlayers(campaign: Campaign, activeOnly: boolean) {
  const characters = getBotStore().listCharacters(campaign.guildId, campaign.channelId);
  const selected = activeOnly
    ? [...characters.reduce((byPlayer, character) => {
        if (!byPlayer.has(character.userId) || character.active) byPlayer.set(character.userId, character);
        return byPlayer;
      }, new Map<string, (typeof characters)[number]>()).values()]
    : characters;
  const names = await playerNames(selected.map((character) => character.userId));
  return selected.map((character) => ({ name: character.name, player: names.get(character.userId) ?? "joueur", draft: character.draft }));
}

/** Une page à imprimer : CA, PV, initiative, perception passive… de chaque personnage actif. */
export async function groupSheetPdf(actor: GameActor, campaignId: string): Promise<{ buffer: Buffer; name: string }> {
  const campaign = requireMj(actor, campaignId);
  configurePdfFonts();
  return { buffer: await renderGroupSheet(campaign, await charactersWithPlayers(campaign, true)), name: `Groupe ${campaign.name}` };
}

/** Chronique de la campagne (tous les rappels) et, au choix, les fiches des personnages. */
export async function campaignExportPdf(actor: GameActor, campaignId: string, sheets: boolean): Promise<{ buffer: Buffer; name: string }> {
  const campaign = requireMj(actor, campaignId);
  configurePdfFonts();
  const buffer = await buildCampaignExport(campaign, getBotStore().allSessions(campaign.channelId), await charactersWithPlayers(campaign, false), { sheets });
  return { buffer, name: campaign.name };
}
