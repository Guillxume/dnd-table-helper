import type { Campaign, Store } from "./db.js";
import { characterLabel } from "./character/label.js";
import { discordTime } from "./time.js";
import { draftOf, type WizardState } from "./character/state.js";
import { nextStep } from "./character/steps.js";

/** Où en est chaque joueur de la campagne dans la création de son personnage. */
export interface Progress {
  done: { userId: string; label: string }[];
  inProgress: { userId: string; name: string }[];
  /** Création finie sauf les caractéristiques : dés à lancer à la table. Pas de relance d'échéance. */
  awaitingTable: { userId: string; name: string }[];
  notStarted: string[];
}

/** La création n'attend plus que les résultats des dés lancés à la table. */
function waitsForTable(state: WizardState): boolean {
  try {
    return nextStep(draftOf(state)).kind === "table";
  } catch {
    return false;
  }
}

/**
 * Joueurs connus du bot : ajoutés avec /campagne ajouter-joueur, ou qui ont commencé ou fini un personnage.
 * Un rôle donné à la main n'est pas visible : le bot n'a pas l'intent privilégié qui permet de lister les membres.
 */
export function campaignProgress(store: Store, c: Campaign): Progress {
  const chars = store.listCharacters(c.guildId, c.channelId);
  const wizards = store.listWizards(c.guildId).filter((w) => w.state.campaignId === c.channelId);
  const done = new Map<string, string>();
  for (const ch of chars) if (!done.has(ch.userId) || ch.active) done.set(ch.userId, characterLabel(ch));
  const open = wizards.filter((w) => !done.has(w.userId));
  const inProgress = open.filter((w) => !waitsForTable(w.state)).map((w) => ({ userId: w.userId, name: w.state.name }));
  const awaitingTable = open.filter((w) => waitsForTable(w.state)).map((w) => ({ userId: w.userId, name: w.state.name }));
  const known = new Set([...store.listPlayers(c.channelId), ...done.keys(), ...wizards.map((w) => w.userId)]);
  const notStarted = [...known].filter((u) => !done.has(u) && !open.some((p) => p.userId === u));
  return { done: [...done].map(([userId, label]) => ({ userId, label })), inProgress, awaitingTable, notStarted };
}

export function renderProgress(c: Campaign, p: Progress): string {
  const lines = [`**Personnages de « ${c.name} »**`];
  if (c.creationDeadline) lines.push(`Échéance : ${discordTime(new Date(c.creationDeadline))}. Relances automatiques à J-3 et J-1 pour ceux qui n’ont pas fini.`);
  else lines.push("Pas d’échéance fixée (bouton « Échéance des personnages » du tableau de bord MJ, ou /regles echeance).");
  lines.push(
    "",
    `**Terminés (${p.done.length})**`,
    ...(p.done.length ? p.done.map((d) => `• <@${d.userId}> : ${d.label}`) : ["• personne pour l’instant"]),
    "",
    `**En cours (${p.inProgress.length})**`,
    ...(p.inProgress.length ? p.inProgress.map((d) => `• <@${d.userId}> : ${d.name}`) : ["• personne"]),
    "",
    ...(p.awaitingTable.length
      ? [`**Prêts, caractéristiques à tirer à la table (${p.awaitingTable.length})**`, ...p.awaitingTable.map((d) => `• <@${d.userId}> : ${d.name}`), ""]
      : []),
    `**Pas commencés (${p.notStarted.length})**`,
    ...(p.notStarted.length ? p.notStarted.map((u) => `• <@${u}>`) : ["• personne"]),
    "",
    "_Seuls apparaissent les joueurs ajoutés avec /campagne ajouter-joueur ou qui ont commencé un personnage._",
  );
  return lines.join("\n");
}
