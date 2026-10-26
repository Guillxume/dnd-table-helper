/**
 * Données de règles issues du SRD 5.2.1 (français, Wizards of the Coast LLC, CC-BY-4.0).
 * Chaque champ `text` est une citation du SRD, contrôlée par `npm run srd:verify`.
 */
export const ABILITIES = ["FOR", "DEX", "CON", "INT", "SAG", "CHA"] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_NAMES: Record<Ability, string> = {
  FOR: "Force",
  DEX: "Dextérité",
  CON: "Constitution",
  INT: "Intelligence",
  SAG: "Sagesse",
  CHA: "Charisme",
};

export interface Skill {
  name: string;
  ability: Ability;
}

export interface Trait {
  name: string;
  /** Citation du SRD. */
  text: string;
  /** Niveau de personnage requis (1 par défaut). Les traits de niveau > 1 ne sont pas affichés. */
  level?: number;
}

export type SpellListId =
  | "barde"
  | "clerc"
  | "druide"
  | "ensorceleur"
  | "magicien"
  | "occultiste"
  | "paladin"
  | "rodeur";

export interface Spell {
  class: SpellListId;
  level: number;
  name: string;
  school: string;
  concentration: boolean;
  ritual: boolean;
  /** Composante matérielle coûteuse (marque « M » des listes de sorts du SRD). */
  costlyMaterial: boolean;
}

export interface Weapon {
  name: string;
  category: "courante" | "guerre";
  kind: "corps à corps" | "distance";
  damage: string;
  damageType: "contondants" | "perforants" | "tranchants";
  properties: string;
  versatile: string | null;
  finesse: boolean;
  light: boolean;
  heavy: boolean;
  twoHanded: boolean;
  thrown: boolean;
  ammunition: boolean;
  mastery: string;
  weight: string;
  price: string;
}

export interface Armor {
  name: string;
  category: "légère" | "intermédiaire" | "lourde" | "bouclier";
  baseAc: number;
  addDex: boolean;
  dexMax: number | null;
  minStrength: number | null;
  stealthDisadvantage: boolean;
  weight: string;
  price: string;
}
