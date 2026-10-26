import { MAX_NOTES_LENGTH } from "./summarize.js";

/** Un champ du formulaire /seance. Limites Discord : 5 champs max, label 45 caractères, placeholder 100. */
export interface NoteField {
  id: string;
  label: string;
  /** Titre de la rubrique dans le texte envoyé au modèle. */
  heading: string;
  placeholder: string;
  maxLength: number;
  required: boolean;
}

export const NOTE_FIELDS: readonly NoteField[] = [
  {
    id: "events",
    label: "Ce qui s'est passé (dans l'ordre)",
    heading: "Déroulement de la séance",
    placeholder: "Ex : arrivée à Valbourg, embuscade de bandits, négociation avec le maire...",
    maxLength: 1400,
    required: true,
  },
  {
    id: "npcs",
    label: "PNJ rencontrés (nom, rôle, attitude)",
    heading: "PNJ rencontrés",
    placeholder: "Ex : Maître Orin, forgeron, méfiant mais prêt à aider",
    maxLength: 550,
    required: false,
  },
  {
    id: "places",
    label: "Lieux visités ou découverts",
    heading: "Lieux",
    placeholder: "Ex : la crypte sous la chapelle, le marché de Valbourg",
    maxLength: 550,
    required: false,
  },
  {
    id: "loot",
    label: "Objets, indices et récompenses obtenus",
    heading: "Objets, indices et récompenses",
    placeholder: "Ex : une clé en bronze, une carte incomplète, 120 pièces d'or",
    maxLength: 550,
    required: false,
  },
  {
    id: "open",
    label: "Ce qui reste à résoudre / prochaine étape",
    heading: "Fils ouverts et prochaine étape",
    placeholder: "Ex : trouver qui a volé la relique, rejoindre le col avant la neige",
    maxLength: 550,
    required: false,
  },
];

/** Assemble les réponses en un texte par rubrique ; les rubriques vides sont omises. */
export function formatNotes(values: Readonly<Record<string, string>>): string {
  return NOTE_FIELDS.flatMap((f) => {
    const text = (values[f.id] ?? "").trim();
    return text === "" ? [] : [`${f.heading} :\n${text}`];
  }).join("\n\n");
}

/** Longueur maximale possible du texte assemblé : doit rester sous MAX_NOTES_LENGTH. */
export function maxFormattedLength(): number {
  const sections = NOTE_FIELDS.map((f) => `${f.heading} :\n`.length + f.maxLength);
  return sections.reduce((a, b) => a + b, 0) + 2 * (NOTE_FIELDS.length - 1);
}

export { MAX_NOTES_LENGTH };
