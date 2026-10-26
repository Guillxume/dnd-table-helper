import type {
  CharacterKind,
  ReferenceRole,
  StyleAspect,
  SubjectType,
  TraitStatus,
} from "@/generated/prisma/enums";
import { CHARACTER_KIND_LABELS, STYLE_ASPECT_LABELS, SUBJECT_TYPE_LABELS } from "../labels";
import type { EffectiveRule } from "../style/merge-rules";

/**
 * Construction déterministe d'un brief d'illustration et du prompt associé.
 * Aucune IA n'intervient : le texte est assemblé à partir de la fiche canonique,
 * du guide artistique et des références choisies. Ce qui n'est pas renseigné
 * n'est jamais inventé.
 */

export const CANONICAL_FIELD_LABELS = {
  species: "Espèce",
  characterClass: "Classe",
  specialization: "Spécialisation",
  silhouette: "Silhouette et morphologie",
  face: "Visage et signes distinctifs",
  hairSkin: "Cheveux, peau, écailles",
  outfit: "Tenue et matières",
  equipment: "Équipement",
  palette: "Palette de couleurs",
  symbols: "Symboles et accessoires canoniques",
  personality: "Personnalité",
  visualHistory: "Histoire utile à la représentation",
  notes: "Notes",
} as const;

export type CanonicalFieldKey = keyof typeof CANONICAL_FIELD_LABELS;

/** Champs repris dans le prompt condensé (la personnalité et les notes restent dans le brief). */
const PROMPT_FIELDS: CanonicalFieldKey[] = [
  "species",
  "characterClass",
  "specialization",
  "silhouette",
  "face",
  "hairSkin",
  "outfit",
  "equipment",
  "palette",
  "symbols",
];

export type BriefCharacter = {
  name: string;
  kind: CharacterKind;
  summary: string | null;
  fields: Partial<Record<CanonicalFieldKey, string | null>>;
  traits: { status: TraitStatus; content: string; locked: boolean }[];
};

export type BriefGuide = {
  name: string;
  parentName: string | null;
  number: number;
  rules: EffectiveRule[];
};

export type BriefReferenceInput = {
  title: string;
  role: ReferenceRole;
  aspects: StyleAspect[];
  note: string | null;
};

export type BriefContext = {
  subjectType: SubjectType;
  objective: string;
  imageType: string;
  subjectDetails?: string | null;
  framing?: string | null;
  aspectRatio?: string | null;
  highlights?: string | null;
  constraints?: string | null;
  exclusions?: string | null;
  character: BriefCharacter | null;
  guide: BriefGuide | null;
  /** Dans l'ordre où elles seront jointes à ChatGPT. */
  references: BriefReferenceInput[];
};

export type BriefSections = {
  sectionObjective: string;
  sectionSubject: string;
  sectionArtDirection: string;
  sectionReferences: string;
  sectionComposition: string;
  sectionLighting: string;
  sectionMaterials: string;
  sectionConsistency: string;
  sectionForbidden: string;
  sectionOutput: string;
};

export const BRIEF_SECTION_TITLES: Record<keyof BriefSections, string> = {
  sectionObjective: "1. Objectif de l'image",
  sectionSubject: "2. Description canonique du sujet",
  sectionArtDirection: "3. Direction artistique",
  sectionReferences: "4. Références et rôle de chacune",
  sectionComposition: "5. Composition et cadrage",
  sectionLighting: "6. Éclairage et palette",
  sectionMaterials: "7. Matières et détails importants",
  sectionConsistency: "8. Contraintes de cohérence",
  sectionForbidden: "9. Éléments explicitement interdits",
  sectionOutput: "10. Format de sortie",
};

export const BRIEF_SECTION_KEYS = Object.keys(BRIEF_SECTION_TITLES) as (keyof BriefSections)[];

/** Répartition des aspects du guide entre les sections du brief. */
const ASPECT_SECTION: Record<StyleAspect, "art" | "composition" | "lighting" | "materials" | "forbidden"> = {
  PAINTING_STYLE: "art",
  REALISM: "art",
  SILHOUETTE: "art",
  ANATOMY: "art",
  SHAPES_DETAILS: "art",
  COSTUME_DESIGN: "art",
  DETAIL_DENSITY: "art",
  MAGIC_EFFECTS: "art",
  BACKGROUNDS: "art",
  READABILITY: "art",
  COMPOSITION: "composition",
  DEPTH_OF_FIELD: "composition",
  PALETTE: "lighting",
  SATURATION: "lighting",
  CONTRAST: "lighting",
  LIGHTING: "lighting",
  SHADOWS: "lighting",
  TEXTURES: "materials",
  MATERIALS: "materials",
  AVOID: "forbidden",
};

const NOT_SPECIFIED = "Non précisé.";

/**
 * Contraintes ajoutées automatiquement pour une carte de bataille : la carte sera
 * imprimée et quadrillée par le site, puis utilisée avec des figurines posées dessus.
 */
export const MAP_RULES = {
  composition: [
    "Vue strictement de dessus (plan orthogonal), sans perspective ni horizon.",
    "Décor à l'échelle d'un quadrillage de cases de 1,5 m : une porte occupe environ une case de large.",
  ],
  lighting: "Éclairage uniforme et lisible sur toute la carte ; ombres courtes qui ne masquent pas le sol.",
  forbidden: [
    "Personnages, créatures, pions ou figurines dessinés : les figurines seront posées sur la carte imprimée.",
    "Texte, légende, boussole, cadre décoratif ou quadrillage dessiné : le quadrillage est ajouté à l'impression.",
  ],
  output: "Carte exploitable jusqu'aux bords, sans vignettage ni marge décorative.",
} as const;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Fragment de prompt : sans ponctuation finale, pour un assemblage « a ; b ; c » propre. */
function fragment(text: string): string {
  return text.trim().replace(/[\s.;,]+$/, "");
}

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function joinBlocks(blocks: readonly (string | null | false | undefined)[]): string {
  const kept = blocks.filter((block): block is string => Boolean(block && block.trim()));
  return kept.length > 0 ? kept.join("\n\n") : NOT_SPECIFIED;
}

function guideRuleLines(rules: EffectiveRule[], section: (typeof ASPECT_SECTION)[StyleAspect]): string[] {
  return rules
    .filter((rule) => ASPECT_SECTION[rule.aspect] === section)
    .flatMap((rule) => {
      const label = STYLE_ASPECT_LABELS[rule.aspect];
      const lines: string[] = [];
      if (rule.common) lines.push(`${label} : ${rule.common}`);
      if (rule.specific) lines.push(`${label} (précision de la variante) : ${rule.specific}`);
      return lines;
    });
}

function traitsOf(character: BriefCharacter | null, status: TraitStatus) {
  return character?.traits.filter((trait) => trait.status === status && clean(trait.content)) ?? [];
}

function describeReference(reference: BriefReferenceInput, index: number): string {
  const aspects = reference.aspects.map((aspect) => STYLE_ASPECT_LABELS[aspect].toLowerCase());
  const aspectText = aspects.length > 0 ? ` (${aspects.join(", ")})` : "";
  const note = clean(reference.note);
  const head = `Image ${index + 1} (« ${reference.title} »)`;
  switch (reference.role) {
    case "STYLE":
      return `${head} : référence de STYLE uniquement${aspectText}. Ne reprendre ni son sujet, ni ses personnages, ni son équipement, ni ses symboles.${note ? ` ${note}` : ""}`;
    case "CONTENT":
      return `${head} : référence de CONTENU${note ? ` : ${note}` : " : reprendre le sujet représenté"}. Ne pas imiter son style s'il diffère de la direction artistique.`;
    case "STYLE_AND_CONTENT":
      return `${head} : référence de style${aspectText} ET de contenu${note ? ` : ${note}` : ""}.`;
  }
}

export function buildBrief(context: BriefContext): { sections: BriefSections; prompt: string } {
  const { character, guide } = context;
  const rules = guide?.rules ?? [];
  const subjectLabel = SUBJECT_TYPE_LABELS[context.subjectType];

  // 1. Objectif
  const sectionObjective = joinBlocks([
    clean(context.objective),
    `Type d'image : ${context.imageType.trim()}.`,
    `Sujet : ${subjectLabel.toLowerCase()}${character ? `, ${character.name}` : ""}.`,
  ]);

  // 2. Sujet : uniquement ce qui est établi.
  const filledFields = character
    ? (Object.keys(CANONICAL_FIELD_LABELS) as CanonicalFieldKey[]).flatMap((key) => {
        const value = clean(character.fields[key]);
        return value ? [`${CANONICAL_FIELD_LABELS[key]} : ${value}`] : [];
      })
    : [];
  const canonTraits = traitsOf(character, "CANON");
  const preferences = traitsOf(character, "PREFERENCE");
  const undetermined = traitsOf(character, "UNDETERMINED");
  const sectionSubject = joinBlocks([
    character &&
      `${character.name} (${CHARACTER_KIND_LABELS[character.kind]})${clean(character.summary) ? ` : ${clean(character.summary)}` : ""}`,
    filledFields.length > 0 && `Fiche canonique :\n${bulletList(filledFields)}`,
    canonTraits.length > 0 &&
      `Faits canoniques confirmés :\n${bulletList(
        canonTraits.map((trait) => (trait.locked ? `${trait.content} [intangible]` : trait.content)),
      )}`,
    preferences.length > 0 &&
      `Préférences artistiques (ajustables) :\n${bulletList(preferences.map((trait) => trait.content))}`,
    undetermined.length > 0 &&
      `Encore indéterminé, ne pas trancher de façon marquante :\n${bulletList(undetermined.map((trait) => trait.content))}`,
    clean(context.subjectDetails) && `Précisions pour cette image : ${clean(context.subjectDetails)}`,
    character && "Tout élément non mentionné ci-dessus est inconnu : ne pas inventer de signe distinctif.",
  ]);

  // 3. Direction artistique
  const artLines = guideRuleLines(rules, "art");
  const sectionArtDirection = guide
    ? joinBlocks([
        `Guide : ${guide.parentName ? `${guide.parentName} › ` : ""}${guide.name} (version ${guide.number}).`,
        artLines.length > 0 ? bulletList(artLines) : "Aucune règle de style général renseignée dans ce guide.",
      ])
    : "Aucun guide artistique sélectionné.";

  // 4. Références
  const sectionReferences =
    context.references.length > 0
      ? joinBlocks([
          "À joindre manuellement dans ChatGPT, dans cet ordre (l'outil n'a pas accès à la bibliothèque).",
          bulletList(context.references.map(describeReference)),
        ])
      : "Aucune référence visuelle jointe.";

  // 5. Composition
  const compositionLines = guideRuleLines(rules, "composition");
  const isMap = context.subjectType === "MAP";
  const sectionComposition = joinBlocks([
    isMap && bulletList(MAP_RULES.composition),
    clean(context.framing) && `Cadrage : ${clean(context.framing)}`,
    clean(context.aspectRatio) && `Format : ${clean(context.aspectRatio)}`,
    compositionLines.length > 0 && bulletList(compositionLines),
  ]);

  // 6. Éclairage et palette
  const lightingLines = guideRuleLines(rules, "lighting");
  const characterPalette = clean(character?.fields.palette);
  const sectionLighting = joinBlocks([
    isMap && MAP_RULES.lighting,
    lightingLines.length > 0 && bulletList(lightingLines),
    characterPalette && `Palette du personnage (canonique) : ${characterPalette}`,
  ]);

  // 7. Matières et détails
  const materialLines = guideRuleLines(rules, "materials");
  const sectionMaterials = joinBlocks([
    materialLines.length > 0 && bulletList(materialLines),
    clean(context.highlights) && `À mettre en avant : ${clean(context.highlights)}`,
  ]);

  // 8. Cohérence
  const lockedTraits = canonTraits.filter((trait) => trait.locked);
  const sectionConsistency = joinBlocks([
    lockedTraits.length > 0 &&
      `Éléments intangibles, à reproduire exactement :\n${bulletList(lockedTraits.map((trait) => trait.content))}`,
    clean(context.constraints) && `Contraintes : ${clean(context.constraints)}`,
    character &&
      "La cohérence avec la fiche canonique prime sur toute interprétation créative : en cas de doute, s'en tenir à la fiche.",
  ]);

  // 9. Interdits
  const excludedTraits = traitsOf(character, "EXCLUDED").map((trait) => trait.content);
  const avoidLines = guideRuleLines(rules, "forbidden");
  const hasStyleOnly = context.references.some((reference) => reference.role === "STYLE");
  const forbidden = [
    ...(isMap ? MAP_RULES.forbidden : []),
    ...(clean(context.exclusions) ? [clean(context.exclusions) as string] : []),
    ...excludedTraits,
    ...avoidLines,
    ...(hasStyleOnly ? ["Reprendre le contenu (personnages, équipement, symboles) des références de style."] : []),
  ];
  const sectionForbidden = forbidden.length > 0 ? bulletList(forbidden) : NOT_SPECIFIED;

  // 10. Sortie
  const sectionOutput = joinBlocks([
    `${context.imageType.trim()}${clean(context.aspectRatio) ? `, format ${clean(context.aspectRatio)}` : ""}.`,
    isMap && MAP_RULES.output,
  ]);

  const sections: BriefSections = {
    sectionObjective,
    sectionSubject,
    sectionArtDirection,
    sectionReferences,
    sectionComposition,
    sectionLighting,
    sectionMaterials,
    sectionConsistency,
    sectionForbidden,
    sectionOutput,
  };

  return { sections, prompt: buildPrompt(context, { lockedTraits, excludedTraits, avoidLines, hasStyleOnly }) };
}

function buildPrompt(
  context: BriefContext,
  derived: {
    lockedTraits: { content: string }[];
    excludedTraits: string[];
    avoidLines: string[];
    hasStyleOnly: boolean;
  },
): string {
  const { character, guide } = context;
  const rules = guide?.rules ?? [];
  const lines: string[] = [];

  lines.push(`${context.imageType.trim()} : ${context.objective.trim()}`);
  if (context.subjectType === "MAP") {
    lines.push(`Carte de bataille : ${[...MAP_RULES.composition, MAP_RULES.lighting, MAP_RULES.output].map(fragment).join(" ; ")}`);
  }

  if (character) {
    const traits = PROMPT_FIELDS.flatMap((key) => {
      const value = clean(character.fields[key]);
      return value ? [`${CANONICAL_FIELD_LABELS[key].toLowerCase()} : ${fragment(value)}`] : [];
    });
    const canon = traitsOf(character, "CANON").map((trait) => fragment(trait.content));
    lines.push(`Sujet : ${character.name}. ${[...traits, ...canon].join(" ; ")}`.trim());
  } else {
    lines.push(`Sujet : ${SUBJECT_TYPE_LABELS[context.subjectType].toLowerCase()}.`);
  }
  if (clean(context.subjectDetails)) lines.push(`Précisions : ${clean(context.subjectDetails)}`);

  const styleRules = rules
    .filter((rule) => !["AVOID", "COMPOSITION", "DEPTH_OF_FIELD"].includes(rule.aspect))
    .map((rule) =>
      [rule.common, rule.specific]
        .filter(Boolean)
        .map((text) => `${STYLE_ASPECT_LABELS[rule.aspect].toLowerCase()} : ${fragment(text as string)}`)
        .join(" ; "),
    );
  if (styleRules.length > 0) lines.push(`Direction artistique : ${styleRules.join(" ; ")}`);

  if (context.references.length > 0) {
    const refs = context.references.map((reference, index) => {
      const aspects = reference.aspects.map((aspect) => STYLE_ASPECT_LABELS[aspect].toLowerCase()).join(", ");
      const note = clean(reference.note);
      if (reference.role === "STYLE") {
        return `image ${index + 1} = style uniquement${aspects ? ` (${aspects})` : ""}, ne pas reprendre son contenu`;
      }
      if (reference.role === "CONTENT") return `image ${index + 1} = contenu${note ? ` (${note})` : ""}`;
      return `image ${index + 1} = style${aspects ? ` (${aspects})` : ""} et contenu${note ? ` (${note})` : ""}`;
    });
    lines.push(`Images jointes : ${refs.join(" ; ")}.`);
  }

  const composition = [
    clean(context.framing),
    ...rules
      .filter((rule) => rule.aspect === "COMPOSITION" || rule.aspect === "DEPTH_OF_FIELD")
      .flatMap((rule) => [rule.common, rule.specific].filter((text): text is string => Boolean(text))),
  ]
    .filter((text): text is string => Boolean(text))
    .map(fragment);
  if (composition.length > 0) lines.push(`Composition : ${composition.join(" ; ")}`);
  if (clean(context.highlights)) lines.push(`Mettre en avant : ${clean(context.highlights)}`);

  const imperative = [
    ...derived.lockedTraits.map((trait) => trait.content),
    ...(clean(context.constraints) ? [clean(context.constraints) as string] : []),
  ].map(fragment);
  if (imperative.length > 0) lines.push(`Impératif : ${imperative.join(" ; ")}`);

  const avoid = [
    ...(context.subjectType === "MAP" ? MAP_RULES.forbidden : []),
    ...(clean(context.exclusions) ? [clean(context.exclusions) as string] : []),
    ...derived.excludedTraits,
    ...derived.avoidLines.map((line) => line.replace(/^[^:]+ : /, "")),
  ].map(fragment);
  if (avoid.length > 0) lines.push(`À éviter : ${avoid.join(" ; ")}`);

  if (clean(context.aspectRatio)) lines.push(`Format ${clean(context.aspectRatio)}.`);

  return lines.join("\n");
}

/** Brief complet en texte, pour la copie et l'instantané archivé avec une génération. */
export function briefToText(title: string, sections: BriefSections): string {
  return [
    `# ${title}`,
    ...BRIEF_SECTION_KEYS.map((key) => `## ${BRIEF_SECTION_TITLES[key]}\n${sections[key].trim() || NOT_SPECIFIED}`),
  ].join("\n\n");
}
