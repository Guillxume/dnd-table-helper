import { ABILITIES, ABILITY_NAMES, getBackground, getClass, getSpecies } from "../srd/index.js";
import type { Draft } from "./draft.js";
import type { WizardState } from "./state.js";
import type { Option } from "./steps.js";
import { methodOf, valuesOf } from "./helpers.js";

/**
 * Présentation de l'assistant indépendante de l'interface : utilisée par les écrans
 * Discord (wizard-ui.ts) et par le site web. Ne doit pas importer discord.js.
 */

export const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export const isSpellStep = (id: string) => /(^|\.)(cantrips|spellbook|prepared|spell|pactCantrips|pactRituals)$/.test(id);

export const STEP_NAMES: Record<string, string> = {
  rules: "Paramètres",
  class: "Classe",
  species: "Espèce",
  speciesOption: "Option d’espèce",
  speciesAbility: "Caractéristique d’incantation d’espèce",
  size: "Taille",
  background: "Historique",
  backgroundTool: "Outil d’historique",
  speciesSkill: "Compétence d’espèce",
  speciesFeat: "Don d’espèce",
  gamingSet: "Boîte de jeux",
  method: "Méthode de caractéristiques",
  tableRolls: "Résultats des dés lancés à la table",
  assignMode: "Répartition",
  bonusMode: "Bonus d’historique",
  bonusPlus2: "Bonus +2",
  bonusPlus1: "Bonus +1",
  order: "Ordre",
  fightingStyle: "Style de combat",
  classSkills: "Compétences de classe",
  classTools: "Outils de classe",
  expertise: "Expertise",
  masteries: "Bottes d’arme",
  cantrips: "Sorts mineurs",
  spellbook: "Grimoire",
  prepared: "Sorts préparés",
  invocation: "Manifestation occulte",
  equipment: "Équipement de classe",
  instrument: "Instrument",
  backgroundEquipment: "Équipement d’historique",
  languages: "Langues",
  extraLanguage: "Langue supplémentaire",
  alignment: "Alignement",
  story: "Origine et histoire",
};

export function valueLabel(id: string, values: string[]): string {
  if (id === "class") return getClass(values[0] ?? "")?.name ?? values.join(", ");
  if (id === "species") return getSpecies(values[0] ?? "")?.name ?? values.join(", ");
  if (id === "background") return getBackground(values[0] ?? "")?.name ?? values.join(", ");
  if (id === "story") return "texte";
  if (id === "rules") return "lus";
  return values.join(", ");
}

/** Étapes déjà répondues, pour « Modifier une étape ». La répartition des caractéristiques compte pour une seule entrée. */
export function editOptions(state: WizardState): Option[] {
  const out: Option[] = [];
  let scoresSeen = false;
  state.history.forEach((h, i) => {
    if (h.id === "rules") return;
    if (/^(assign|pb)\./.test(h.id)) {
      if (scoresSeen) return;
      scoresSeen = true;
      out.push({ value: String(i), label: "Valeurs des caractéristiques" });
      return;
    }
    const base = h.id.replace(/^(speciesFeat|backgroundFeat)\./, "$1 ");
    const name = STEP_NAMES[h.id] ?? (base.startsWith("speciesFeat") ? "Don d’espèce (détail)" : base.startsWith("backgroundFeat") ? "Don d’historique (détail)" : h.id);
    out.push({ value: String(i), label: cut(`${name} : ${valueLabel(h.id, h.values)}`, 100) });
  });
  return out;
}

export function summary(d: Draft): string {
  const parts: string[] = [];
  const cls = d.classId ? getClass(d.classId)?.name : undefined;
  const sp = d.speciesId ? getSpecies(d.speciesId) : undefined;
  const opt = sp?.options?.find((o) => o.id === d.speciesOption)?.name;
  const bg = d.backgroundId ? getBackground(d.backgroundId)?.name : undefined;
  if (cls) parts.push(`Classe : ${cls}`);
  if (sp) parts.push(`Espèce : ${sp.name}${opt ? ` (${opt})` : ""}`);
  if (bg) parts.push(`Historique : ${bg}`);
  return parts.join("  ·  ");
}

export function rollsText(d: Draft): string {
  const values = valuesOf(d);
  if (!values) return "";
  const m = methodOf(d);
  const lines = m === "des" ? values.map((v, i) => `${v} (dés ${d.rollDice?.[i]?.join(", ") ?? "?"})`) : values.map(String);
  const assigned = ABILITIES.filter((a) => d.assignment?.[a] !== undefined).map((a) => `${ABILITY_NAMES[a]} ${values[d.assignment![a]!]}`);
  const label = m === "des" ? "Tirage" : m === "table" ? "Dés lancés à la table" : "Valeurs";
  return `${label} : ${lines.join(" ; ")}.${assigned.length ? `\nDéjà assigné : ${assigned.join(", ")}.` : ""}`;
}


/**
 * Les textes d'aide du moteur sont neutres. Chaque interface y ajoute ses propres renvois
 * (commandes Discord, boutons du site) : ils ne sont écrits qu'ici.
 */
export type WizardInterface = "discord" | "web";

const INTERFACE_HINTS: Record<string, Record<WizardInterface, string>> = {
  rules: {
    discord: "Le MJ les modifie avec /campagne regles.",
    web: "Le MJ les modifie depuis son espace de campagne.",
  },
  class: {
    discord: "« Détails des options » présente chaque classe ; /guide montre sa trajectoire jusqu’au niveau 20.",
    web: "« En savoir plus » présente chaque classe.",
  },
  equipment: {
    discord: "Pour le détail d’un objet, utilise /objet.",
    web: "Pour le détail d’un objet, tape /objet sur le serveur Discord de la table.",
  },
};

/** Texte d'aide d'une étape, complété des renvois propres à l'interface. */
export function helpFor(stepId: string, help: string | undefined, ui: WizardInterface): string {
  const hint = INTERFACE_HINTS[stepId]?.[ui];
  return [help, hint].filter(Boolean).join(" ");
}
