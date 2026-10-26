/** Aide à la préparation du MJ : types de brouillon, formulaire et consignes au modèle. */

export const PREP_TYPES = {
  scene: "une scène",
  pnj: "un ou plusieurs PNJ",
  rencontre: "une rencontre (combat, piège ou défi)",
} as const;

export type PrepType = keyof typeof PREP_TYPES;

export function isPrepType(value: string): value is PrepType {
  return Object.hasOwn(PREP_TYPES, value);
}

export interface PrepField {
  id: string;
  label: string; // 45 caractères max (Discord)
  heading: string;
  placeholder: string; // 100 caractères max (Discord)
  maxLength: number;
  required: boolean;
}

const BRIEF = (placeholder: string, label = "Idée de départ"): PrepField => ({ id: "brief", label, heading: "Idée du MJ", placeholder, maxLength: 1500, required: true });
const PARTY: PrepField = {
  id: "party",
  label: "Groupe (nombre, niveau, composition)",
  heading: "Groupe",
  placeholder: "Ex : 5 personnages, niveau 1 : guerrier, clerc, rôdeur, magicienne, barde",
  maxLength: 300,
  required: false,
};
const TONE: PrepField = {
  id: "tone",
  label: "Ton et contraintes",
  heading: "Ton et contraintes",
  placeholder: "Ex : ambiance sombre, 45 minutes, peu de combat",
  maxLength: 300,
  required: false,
};

/** Un formulaire par type de préparation (5 champs au plus, limite de Discord). Le champ « brief » est toujours requis. */
export const PREP_FORMS: Record<PrepType, { title: string; fields: readonly PrepField[] }> = {
  scene: {
    title: "Préparer une scène",
    fields: [
      BRIEF("Ex : les héros doivent infiltrer le manoir du baron pendant un bal masqué", "Ce qui doit se passer"),
      { id: "place", label: "Lieu et ambiance", heading: "Lieu et ambiance", placeholder: "Ex : salle de bal illuminée, musique, gardes discrets aux portes", maxLength: 400, required: false },
      { id: "stakes", label: "Enjeux pour les personnages", heading: "Enjeux", placeholder: "Ex : trouver la lettre avant minuit sans se faire démasquer", maxLength: 400, required: false },
      PARTY,
      TONE,
    ],
  },
  pnj: {
    title: "Préparer un PNJ",
    fields: [
      BRIEF("Ex : le maire de Valbourg, un homme affable qui cache des dettes de jeu", "Qui est-ce ? (rôle, en une phrase)"),
      { id: "wants", label: "Ce qu’il veut, ce qu’il cache", heading: "Motivations et secrets", placeholder: "Ex : garder son poste ; il a vendu la relique aux bandits", maxLength: 400, required: false },
      { id: "meet", label: "Où et comment les héros le croisent", heading: "Rencontre avec les héros", placeholder: "Ex : à l’auberge, il leur propose un travail bien payé", maxLength: 400, required: false },
      { id: "statblock", label: "Profil du SRD (facultatif)", heading: "Profil de jeu demandé", placeholder: "Ex : noble, garde, mage, bandit", maxLength: 100, required: false },
      TONE,
    ],
  },
  rencontre: {
    title: "Préparer une rencontre",
    fields: [
      BRIEF("Ex : embuscade de gobelins sur la route de la forêt, à la tombée de la nuit", "Situation"),
      { id: "creatures", label: "Créatures (le bot calcule le budget)", heading: "Créatures choisies", placeholder: "Ex : 4 combattants gobelins, 1 chef gobelin", maxLength: 300, required: false },
      { id: "difficulty", label: "Difficulté : faible, modérée ou élevée", heading: "Difficulté visée", placeholder: "modérée", maxLength: 10, required: false },
      PARTY,
      { id: "terrain", label: "Terrain, ambiance, durée", heading: "Terrain et contraintes", placeholder: "Ex : chemin étroit, rochers, brouillard ; 30 minutes", maxLength: 300, required: false },
    ],
  },
};

/** Tous les champs, pour lire un formulaire soumis quel que soit son type. */
export const PREP_FIELDS: readonly PrepField[] = [...new Map(Object.values(PREP_FORMS).flatMap((f) => f.fields).map((f) => [f.id, f])).values()];

export const PREP_SYSTEM_PROMPT = `Tu aides le maître du jeu d'une campagne de Donjons et Dragons (édition 2024) à préparer sa séance rapidement. Tu écris un brouillon que le MJ relira et adaptera.
Règles :
- Pour l'histoire de la campagne, appuie-toi uniquement sur les rappels de séances fournis. N'invente aucun événement passé. Si le contexte manque, propose sans rien affirmer sur le passé.
- Pour les règles, des extraits du SRD 5.2.1 te sont fournis : c'est ta seule source pour les statistiques de jeu (classe d'armure, points de vie, dégâts, DD, facteur de puissance, PX). Recopie les valeurs exactement et indique la page, par exemple « (SRD p. 351) ». Une statistique absente des extraits ne doit pas être inventée : écris « à vérifier dans le SRD ».
- Pour une rencontre, si un budget calculé par le bot est fourni, reprends-le tel quel sans refaire le calcul ; sinon, appuie-toi sur les extraits « Rencontres de combat » s'ils sont fournis, et à défaut ne donne pas de calcul de difficulté.
- Écris en français, avec les accents, sans tirets longs.
- Reste concret et utilisable à la table : accroches, enjeux, ce que les personnages peuvent tenter, conséquences possibles.
- Longueur : 3000 caractères au maximum. Termine toujours ta réponse proprement, par une phrase complète, plutôt que de la laisser inachevée.`;

export interface RecapContext {
  number: number;
  recap: string;
}

export function buildPrepPrompt(
  type: PrepType,
  values: Readonly<Record<string, string>>,
  recaps: readonly RecapContext[],
  srdExtracts = "",
  style = "",
  encounter = "",
): string {
  const parts: string[] = [`Demande : prépare ${PREP_TYPES[type]}.`];
  if (style) parts.push(style);
  parts.push(srdExtracts ? `Extraits du SRD 5.2.1 trouvés pour cette demande :\n${srdExtracts}` : "Aucun extrait du SRD trouvé pour cette demande.");
  parts.push(
    recaps.length > 0
      ? `Rappels des dernières séances (du plus ancien au plus récent) :\n${recaps.map((r) => `Séance ${r.number} :\n${r.recap}`).join("\n\n")}`
      : "Aucun rappel de séance disponible pour le moment.",
  );
  for (const f of PREP_FORMS[type].fields) {
    const text = (values[f.id] ?? "").trim();
    if (text !== "") parts.push(`${f.heading} :\n${text}`);
  }
  if (encounter) parts.push(`Budget de la rencontre calculé par le bot (SRD 5.2.1, p. 213), à reprendre tel quel :\n${encounter}`);
  return parts.join("\n\n");
}
