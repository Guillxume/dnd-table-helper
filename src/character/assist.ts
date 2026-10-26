import { SPELL_TEXTS, getBackground, getClass, getSpecies } from "../srd/index.js";
import type { Completer } from "../summarize.js";
import type { Draft } from "./draft.js";
import { finalScores, scoresPending } from "./helpers.js";
import type { Step } from "./steps.js";

/**
 * Aides rédigées par le modèle pendant la création (idées d'histoire, conseil de sorts).
 * Sans discord.js : utilisées par l'assistant Discord et par le site.
 */

/** Étape de choix de sorts, seule étape où le conseil est proposé. */
export type SpellChoiceStep = Extract<Step, { kind: "multi" | "select" }>;

export const IDEAS_SYSTEM = `Tu aides un joueur de jeu de rôle à trouver des idées pour son personnage de niveau 1.
Règles :
- Propose des pistes d'apparence, de personnalité (traits, idéal, lien, défaut) et d'historique, adaptées à la classe, à l'espèce et à l'historique donnés.
- N'invente aucune règle, aucune capacité, aucune statistique ni aucun chiffre de jeu. Ne cite pas de règles.
- Ce sont des suggestions que le joueur reformulera : reste bref, concret, sans lieux ou personnages issus d'univers publiés.
- Écris en français, avec les accents, sans tirets longs, sans émojis.
- Longueur maximale : environ 1400 caractères. Termine toujours ta dernière phrase.`;

export const SPELL_ADVICE_SYSTEM = `Tu conseilles un joueur débutant de jeu de rôle qui choisit des sorts pour un personnage de niveau 1.
Règles :
- Choisis uniquement parmi les sorts de la liste fournie, en recopiant leur nom exact. N'invente aucun sort ni aucun effet.
- Appuie-toi seulement sur les informations données pour chaque sort (type d'effet, dégâts, portée, concentration, rituel, début de description).
- Propose une sélection du nombre demandé, puis explique en une phrase par sort pourquoi il est utile à ce personnage (combat, soutien, exploration, social).
- Signale les équilibres utiles (au moins une option offensive à distance si possible, attention aux sorts à concentration qui ne se cumulent pas).
- Écris en français, avec les accents, sans tirets longs, sans émojis, en moins de 1200 caractères. Termine toujours ta dernière phrase.`;

export function spellAdvicePrompt(d: Draft, step: SpellChoiceStep): string {
  const cls = d.classId ? getClass(d.classId)?.name : undefined;
  const sp = d.speciesId ? getSpecies(d.speciesId)?.name : undefined;
  const bg = d.backgroundId ? getBackground(d.backgroundId)?.name : undefined;
  const scores = finalScores(d);
  const count = step.kind === "multi" ? (step.min === step.max ? `${step.max}` : `${step.min} à ${step.max}`) : "1";
  const list = step.options
    .map((o) => {
      const t = SPELL_TEXTS[o.value];
      const first = t ? (t.text.split(/(?<=\.)\s/)[0] ?? "").slice(0, 160) : "";
      return `- ${o.value} : ${o.description ?? ""}. ${first}`;
    })
    .join("\n");
  return [
    `Personnage : ${cls ?? "?"}, ${sp ?? "?"}, historique ${bg ?? "?"}.`,
    scoresPending(d)
      ? "Caractéristiques : pas encore connues (dés lancés plus tard à la table)."
      : `Caractéristiques : ${Object.entries(scores).map(([a, v]) => `${a} ${v}`).join(", ")}.`,
    d.story?.personality ? `Personnalité : ${d.story.personality.slice(0, 300)}` : "",
    `Étape : ${step.title}. Nombre à choisir : ${count}.`,
    `Sorts disponibles :\n${list}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function ideasPrompt(d: Draft): string {
  const cls = d.classId ? getClass(d.classId)?.name : undefined;
  const sp = d.speciesId ? getSpecies(d.speciesId)?.name : undefined;
  const bg = d.backgroundId ? getBackground(d.backgroundId)?.name : undefined;
  return [
    `Nom : ${d.name ?? "non précisé"}`,
    `Classe : ${cls ?? "non précisée"}`,
    `Espèce : ${sp ?? "non précisée"}`,
    `Historique : ${bg ?? "non précisé"}`,
    `Alignement : ${d.alignment ?? "non précisé"}`,
  ].join("\n");
}

/** Pistes d'apparence, de personnalité et d'histoire, dans le style de la campagne s'il y en a un. */
export async function characterIdeas(complete: Completer, d: Draft, style = ""): Promise<string> {
  return (await complete(IDEAS_SYSTEM, `${style ? `${style}\n\n` : ""}${ideasPrompt(d)}`, 1500)).trim();
}

/** Sélection de sorts commentée, choisie dans la liste de l'étape. */
export async function spellAdvice(complete: Completer, d: Draft, step: SpellChoiceStep): Promise<string> {
  return (await complete(SPELL_ADVICE_SYSTEM, spellAdvicePrompt(d, step), 1500)).trim();
}
