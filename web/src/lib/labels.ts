import type {
  AssetOrigin,
  CharacterKind,
  GenerationStatus,
  ReferenceRole,
  StyleAspect,
  SubjectType,
  TraitStatus,
} from "@/generated/prisma/enums";

/** Libellés français des énumérations du modèle, utilisés dans l'interface et les briefs. */

export const ASSET_ORIGIN_LABELS: Record<AssetOrigin, string> = {
  EXTERNAL: "Référence externe",
  GENERATED: "Génération IA",
  OWN_WORK: "Création personnelle",
  UNKNOWN: "Provenance inconnue",
};

export const CHARACTER_KIND_LABELS: Record<CharacterKind, string> = {
  PLAYER_CHARACTER: "Personnage joueur",
  NPC: "PNJ",
  CREATURE: "Créature",
  OTHER: "Autre",
};

export const TRAIT_STATUS_LABELS: Record<TraitStatus, string> = {
  CANON: "Canon confirmé",
  PREFERENCE: "Préférence artistique",
  PROPOSAL: "Proposition non validée",
  EXCLUDED: "À exclure",
  UNDETERMINED: "Encore indéterminé",
};

export const TRAIT_STATUS_HINTS: Record<TraitStatus, string> = {
  CANON: "Fait établi pour ce personnage. Cocher « intangible » s'il ne doit jamais varier d'une illustration à l'autre.",
  PREFERENCE: "Orientation souhaitée, ajustable selon l'image.",
  PROPOSAL: "Idée à l'essai. N'est jamais utilisée comme canon sans validation explicite.",
  EXCLUDED: "Ne doit pas apparaître.",
  UNDETERMINED: "Question ouverte : le générateur ne doit pas la trancher de façon marquante.",
};

export const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  CHARACTER: "Personnage",
  NPC: "PNJ",
  CREATURE: "Créature",
  ITEM: "Objet",
  ENVIRONMENT: "Environnement",
  MAP: "Carte",
  OTHER: "Autre",
};

export const REFERENCE_ROLE_LABELS: Record<ReferenceRole, string> = {
  STYLE: "Style uniquement",
  CONTENT: "Contenu uniquement",
  STYLE_AND_CONTENT: "Style et contenu",
};

export const GENERATION_STATUS_LABELS: Record<GenerationStatus, string> = {
  DRAFT: "Brouillon",
  TO_REVIEW: "À évaluer",
  VALIDATED: "Validée",
  REJECTED: "Rejetée",
};

export const STYLE_ASPECT_LABELS: Record<StyleAspect, string> = {
  PAINTING_STYLE: "Style pictural",
  REALISM: "Niveau de réalisme",
  SILHOUETTE: "Silhouettes",
  ANATOMY: "Anatomie et proportions",
  SHAPES_DETAILS: "Formes et détails",
  PALETTE: "Palette générale",
  SATURATION: "Saturation",
  CONTRAST: "Contraste",
  LIGHTING: "Éclairage",
  SHADOWS: "Ombres",
  TEXTURES: "Textures",
  MATERIALS: "Matériaux",
  COSTUME_DESIGN: "Design de costume",
  COMPOSITION: "Composition",
  DEPTH_OF_FIELD: "Profondeur de champ",
  DETAIL_DENSITY: "Densité des détails",
  MAGIC_EFFECTS: "Effets magiques",
  BACKGROUNDS: "Arrière-plans",
  READABILITY: "Lisibilité",
  AVOID: "Éléments à éviter",
};

/** Ordre d'affichage des aspects dans les formulaires et les briefs. */
export const STYLE_ASPECT_ORDER = Object.keys(STYLE_ASPECT_LABELS) as StyleAspect[];
