import type { Store, Campaign, SessionRecord } from "./db.js";
import { canManageCampaign, type Actor } from "./permissions.js";
import { buildPrepPrompt, PREP_SYSTEM_PROMPT, type PrepType } from "./prep.js";
import { formatChunks, searchSrd } from "./srd/search.js";
import { styleBlock } from "./style.js";
import { parseCreatureList, parseDifficulty, renderEncounter } from "./encounter.js";
import { MAX_NOTES_LENGTH, summarizeNotes, type Completer, type PlayerNoteInput } from "./summarize.js";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function createCampaign(
  store: Store,
  actor: Actor,
  input: { channelId: string; guildId: string; name: string; mjRoleId: string },
): Result<Campaign> {
  if (!actor.isAdministrator) return fail("Seul un administrateur du serveur peut créer une campagne.");
  const name = input.name.trim();
  if (name === "") return fail("Le nom de la campagne est vide.");
  const campaign = store.createCampaign({ ...input, name });
  return campaign ? { ok: true, value: campaign } : fail("Une campagne existe déjà dans ce salon.");
}

export async function generateRecap(
  store: Store,
  complete: Completer,
  actor: Actor,
  channelId: string,
  notes: string,
  playerNotes: readonly PlayerNoteInput[] = [],
): Promise<Result<string>> {
  const campaign = store.getCampaign(channelId);
  if (!campaign) return fail("Aucune campagne dans ce salon. Utilisez /campagne creer.");
  if (!canManageCampaign(actor, campaign)) return fail("Seuls le MJ de la campagne ou un administrateur peuvent faire cela.");
  if (notes.trim() === "") return fail("Les notes sont vides.");
  if (notes.length > MAX_NOTES_LENGTH) return fail(`Les notes dépassent ${MAX_NOTES_LENGTH} caractères.`);
  try {
    return { ok: true, value: await summarizeNotes(complete, notes, styleBlock(campaign.style), playerNotes) };
  } catch (e) {
    return fail(`La génération du rappel a échoué : ${e instanceof Error ? e.message : "erreur inconnue"}`);
  }
}

export function publishRecap(
  store: Store,
  actor: Actor,
  channelId: string,
  notes: string,
  recap: string,
): Result<SessionRecord> {
  const campaign = store.getCampaign(channelId);
  if (!campaign) return fail("Aucune campagne dans ce salon.");
  if (!canManageCampaign(actor, campaign)) return fail("Seuls le MJ de la campagne ou un administrateur peuvent faire cela.");
  return { ok: true, value: store.addSession(channelId, notes, recap) };
}

export function lastRecap(store: Store, channelId: string): Result<SessionRecord> {
  if (!store.getCampaign(channelId)) return fail("Aucune campagne dans ce salon.");
  const s = store.latestSession(channelId);
  return s ? { ok: true, value: s } : fail("Aucun rappel publié pour le moment.");
}

/** « 5 personnages, niveau 3 » → { players: 5, level: 3 } ; valeurs par défaut sinon (niveau 1). */
export function partyFromText(text: string, defaultPlayers: number): { players: number; level: number } {
  const players = Number(/(\d+)\s*(?:personnages?|joueurs?|pj|aventuriers?)/i.exec(text)?.[1] ?? defaultPlayers);
  const level = Number(/niv(?:eau|\.)?\s*(\d+)/i.exec(text)?.[1] ?? 1);
  return { players: players >= 1 && players <= 12 ? players : defaultPlayers, level: level >= 1 && level <= 20 ? level : 1 };
}

export const PREP_MAX_TOKENS = 3500;
export const PREP_CONTEXT_SESSIONS = 3;
export const PREP_SRD_EXTRACTS = 8;
export const PREP_SRD_BUDGET = 12000;

export async function generatePrep(
  store: Store,
  complete: Completer,
  actor: Actor,
  channelId: string,
  type: PrepType,
  values: Readonly<Record<string, string>>,
): Promise<Result<string>> {
  const campaign = store.findCampaignForChannel(channelId);
  if (!campaign) return fail("Aucune campagne liée à ce salon. Utilisez /preparer dans #aide-mj.");
  if (!canManageCampaign(actor, campaign)) return fail("Seuls le MJ de la campagne ou un administrateur peuvent faire cela.");
  if ((values["brief"] ?? "").trim() === "") return fail("L'idée de départ est vide.");
  const recaps = store.recentSessions(campaign.channelId, PREP_CONTEXT_SESSIONS).map((s) => ({ number: s.number, recap: s.recap }));
  // Rencontre avec des créatures : le budget est calculé par le bot (table du SRD), pas par le modèle.
  let encounter = "";
  if (type === "rencontre" && (values["creatures"] ?? "").trim()) {
    const { picks, unknown } = parseCreatureList(values["creatures"]!);
    if (picks.length) {
      const active = store.listCharacters(campaign.guildId, campaign.channelId).filter((c) => c.active).length;
      const party = partyFromText(values["party"] ?? "", active || 4);
      encounter = renderEncounter(picks, unknown, party.level, party.players, parseDifficulty(values["difficulty"]) ?? "moderee");
    }
  }
  // Recherche dans le SRD à partir de la demande du MJ (idée, créatures ou profil demandés, type de préparation).
  const wanted = [values["creatures"], values["statblock"], values["srd"]].filter(Boolean).join(" ");
  const extracts = searchSrd([wanted, values["brief"] ?? "", type === "rencontre" ? "rencontres de combat difficulté" : ""].join(" "), {
    limit: PREP_SRD_EXTRACTS,
    budget: PREP_SRD_BUDGET,
  });
  try {
    const text = (
      await complete(PREP_SYSTEM_PROMPT, buildPrepPrompt(type, values, recaps, formatChunks(extracts), styleBlock(campaign.style), encounter), PREP_MAX_TOKENS)
    ).trim();
    if (text === "") return fail("Le modèle n'a renvoyé aucun texte.");
    const sources = extracts.length ? `\n\n**Extraits du SRD fournis à l’assistant** : ${extracts.map((c) => `${c.title} (p. ${c.page})`).join(", ")}.` : "";
    return { ok: true, value: (encounter ? `${encounter}\n\n**Brouillon de l’assistant**\n\n` : "") + text + sources };
  } catch (e) {
    return fail(`La génération a échoué : ${e instanceof Error ? e.message : "erreur inconnue"}`);
  }
}
