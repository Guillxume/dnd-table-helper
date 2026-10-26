import type { Ability, SpellListId, Trait } from "../types.js";
import traitsJson from "./class-traits.json" with { type: "json" };

export type EquipItem =
  | { kind: "weapon"; name: string; qty?: number; note?: string }
  | { kind: "armor"; name: string }
  | { kind: "pack"; pack: string }
  | { kind: "item"; name: string; qty?: number }
  | { kind: "choice"; what: "instrument" | "artisan-or-instrument" };

export interface EquipmentOption {
  id: "A" | "B" | "C";
  items: EquipItem[];
  gold: number;
}

export interface Spellcasting {
  list: SpellListId;
  ability: Ability;
  cantrips: number;
  prepared: number;
  slots: number;
  /** Magie de pacte : emplacements récupérés après un repos court ou long. */
  pact?: boolean;
  /** Le Magicien prépare à partir d'un grimoire de 6 sorts. */
  spellbook?: number;
  /** Sorts toujours préparés. */
  alwaysPrepared?: string[];
  /** Cantrips supplémentaires selon un choix de classe (Thaumaturge, Mage). */
  abilityText: string;
  focusText: string;
}

export interface WeaponMasteryRule {
  count: number;
  /** melee : armes de corps à corps ; proficient : armes dont la classe a la maîtrise ; any : toute arme courante ou de guerre. */
  from: "melee" | "proficient" | "any";
}

export interface ClassData {
  id: string;
  name: string;
  hitDie: number;
  saves: [Ability, Ability];
  skills: { count: number; from: string[] | null };
  weaponProficiency: { simple: boolean; martial: "all" | "light" | "finesse-or-light" | "none" };
  armorTraining: ("légère" | "intermédiaire" | "lourde" | "bouclier")[];
  /** Maîtrise d'outils : liste fixe ou choix. */
  tools: { fixed: string[]; choose?: "instruments-3" | "artisan-or-instrument" };
  spellcasting?: Spellcasting;
  weaponMastery?: WeaponMasteryRule;
  fightingStyle?: boolean;
  /** Ordre divin (Clerc) ou primitif (Druide). */
  order?: "divin" | "primitif";
  expertise?: number;
  invocation?: boolean;
  equipment: EquipmentOption[];
  traits: Trait[];
  /** Indications chiffrées du niveau 1, tirées de la table d'aptitudes de la classe. */
  levelOneNotes: string[];
}

const jsonTraits = traitsJson.traits as unknown as Record<string, [string, string][]>;

/** Textes bruts, avec « ¶ » aux coupures d'extraction (utilisé par le contrôle contre le PDF). */
export const RAW_CLASS_TRAITS = jsonTraits;

function traitsOf(id: string): Trait[] {
  return (jsonTraits[id] ?? []).map(([name, text]) => ({ name, text: text.replace(/ ¶ /g, " ") }));
}

export const INVOCATIONS: Record<string, string> = traitsJson.invocations as Record<string, string>;

const w = (name: string, qty?: number, note?: string): EquipItem => ({ kind: "weapon", name, ...(qty ? { qty } : {}), ...(note ? { note } : {}) });
const a = (name: string): EquipItem => ({ kind: "armor", name });
const p = (pack: string): EquipItem => ({ kind: "pack", pack });
const i = (name: string, qty?: number): EquipItem => ({ kind: "item", name, ...(qty ? { qty } : {}) });

const caster = (
  list: SpellListId,
  ability: Ability,
  abilityText: string,
  focusText: string,
  n: { cantrips: number; prepared: number; slots: number },
  extra: Partial<Spellcasting> = {},
): Spellcasting => ({ list, ability, abilityText, focusText, ...n, ...extra });

export const CLASSES: ClassData[] = [
  {
    id: "barbare",
    name: "Barbare",
    hitDie: 12,
    saves: ["FOR", "CON"],
    skills: { count: 2, from: ["Athlétisme", "Dressage", "Intimidation", "Nature", "Perception", "Survie"] },
    weaponProficiency: { simple: true, martial: "all" },
    armorTraining: ["légère", "intermédiaire", "bouclier"],
    tools: { fixed: [] },
    weaponMastery: { count: 2, from: "melee" },
    equipment: [
      { id: "A", items: [w("Hache à deux mains"), w("Hachette", 4), p("explorateur")], gold: 15 },
      { id: "B", items: [], gold: 75 },
    ],
    traits: traitsOf("barbare"),
    levelOneNotes: ["Rages par jour : 2", "Dégâts de Rage : +2"],
  },
  {
    id: "barde",
    name: "Barde",
    hitDie: 8,
    saves: ["DEX", "CHA"],
    skills: { count: 3, from: null },
    weaponProficiency: { simple: true, martial: "none" },
    armorTraining: ["légère"],
    tools: { fixed: [], choose: "instruments-3" },
    spellcasting: caster(
      "barde",
      "CHA",
      "Caractéristique d’incantation. Le Charisme est la caractéristique d’incantation de vos sorts de Barde.",
      "Focaliseur d’incantation. Vous pouvez vous servir d’un instrument de musique comme focaliseur d’incantation de vos sorts de Barde.",
      { cantrips: 2, prepared: 4, slots: 2 },
    ),
    equipment: [
      { id: "A", items: [a("Armure de cuir"), w("Dague", 2), { kind: "choice", what: "instrument" }, p("artiste")], gold: 19 },
      { id: "B", items: [], gold: 90 },
    ],
    traits: traitsOf("barde"),
    levelOneNotes: ["Dé d’Inspiration bardique : d6"],
  },
  {
    id: "clerc",
    name: "Clerc",
    hitDie: 8,
    saves: ["SAG", "CHA"],
    skills: { count: 2, from: ["Histoire", "Intuition", "Médecine", "Persuasion", "Religion"] },
    weaponProficiency: { simple: true, martial: "none" },
    armorTraining: ["légère", "intermédiaire", "bouclier"],
    tools: { fixed: [] },
    order: "divin",
    spellcasting: caster(
      "clerc",
      "SAG",
      "Caractéristique d’incantation. La Sagesse est la caractéristique d’incantation de vos sorts de clerc.",
      "Focaliseur d’incantation. Vous pouvez vous servir d’un symbole sacré comme focaliseur d’incantation de vos sorts de clerc.",
      { cantrips: 3, prepared: 4, slots: 2 },
    ),
    equipment: [
      {
        id: "A",
        items: [a("Chemise de mailles"), a("Bouclier"), w("Masse d’armes"), i("Symbole sacré"), p("ecclésiastique")],
        gold: 7,
      },
      { id: "B", items: [], gold: 110 },
    ],
    traits: traitsOf("clerc"),
    levelOneNotes: [],
  },
  {
    id: "druide",
    name: "Druide",
    hitDie: 8,
    saves: ["INT", "SAG"],
    skills: { count: 2, from: ["Arcanes", "Dressage", "Intuition", "Médecine", "Nature", "Perception", "Religion", "Survie"] },
    weaponProficiency: { simple: true, martial: "none" },
    armorTraining: ["légère", "bouclier"],
    tools: { fixed: ["Matériel d’herboriste"] },
    order: "primitif",
    spellcasting: caster(
      "druide",
      "SAG",
      "Caractéristique d’incantation. La Sagesse est la caractéristique d’incantation de vos sorts de druide.",
      "Focaliseur d’incantation. Vous pouvez vous servir d’un focaliseur druidique comme focaliseur d’incantation de vos sorts de druide.",
      { cantrips: 2, prepared: 4, slots: 2 },
      { alwaysPrepared: ["Communication avec les animaux"] },
    ),
    equipment: [
      {
        id: "A",
        items: [a("Armure de cuir"), a("Bouclier"), w("Serpe"), w("Bâton de combat", 1, "focaliseur druidique"), p("explorateur"), i("Matériel d’herboriste")],
        gold: 9,
      },
      { id: "B", items: [], gold: 50 },
    ],
    traits: traitsOf("druide"),
    levelOneNotes: [],
  },
  {
    id: "ensorceleur",
    name: "Ensorceleur",
    hitDie: 6,
    saves: ["CON", "CHA"],
    skills: { count: 2, from: ["Arcanes", "Intimidation", "Intuition", "Persuasion", "Religion", "Tromperie"] },
    weaponProficiency: { simple: true, martial: "none" },
    armorTraining: [],
    tools: { fixed: [] },
    spellcasting: caster(
      "ensorceleur",
      "CHA",
      "Caractéristique d’incantation. Le Charisme est la caractéristique d’incantation de vos sorts d’Ensorceleur.",
      "Focaliseur d’incantation. Vous pouvez vous servir d’un focaliseur arcanique comme focaliseur d’incantation de vos sorts d’Ensorceleur.",
      { cantrips: 4, prepared: 2, slots: 2 },
    ),
    equipment: [
      {
        id: "A",
        items: [w("Lance"), w("Dague", 2), i("Focaliseur arcanique (cristal)"), p("exploration souterraine")],
        gold: 28,
      },
      { id: "B", items: [], gold: 50 },
    ],
    traits: traitsOf("ensorceleur"),
    levelOneNotes: ["Utilisations de Sorcellerie innée : 2"],
  },
  {
    id: "guerrier",
    name: "Guerrier",
    hitDie: 10,
    saves: ["FOR", "CON"],
    skills: {
      count: 2,
      from: ["Acrobaties", "Athlétisme", "Dressage", "Histoire", "Intuition", "Intimidation", "Perception", "Persuasion", "Survie"],
    },
    weaponProficiency: { simple: true, martial: "all" },
    armorTraining: ["légère", "intermédiaire", "lourde", "bouclier"],
    tools: { fixed: [] },
    fightingStyle: true,
    weaponMastery: { count: 3, from: "any" },
    equipment: [
      {
        id: "A",
        items: [a("Cotte de mailles"), w("Épée à deux mains"), w("Fléau d’armes"), w("Javeline", 8), p("exploration souterraine")],
        gold: 4,
      },
      {
        id: "B",
        items: [
          a("Armure de cuir clouté"),
          w("Cimeterre"),
          w("Épée courte"),
          w("Arc long"),
          i("Flèches", 20),
          i("Carquois"),
          p("exploration souterraine"),
        ],
        gold: 11,
      },
      { id: "C", items: [], gold: 155 },
    ],
    traits: traitsOf("guerrier"),
    levelOneNotes: ["Utilisations de Second souffle : 2"],
  },
  {
    id: "magicien",
    name: "Magicien",
    hitDie: 6,
    saves: ["INT", "SAG"],
    skills: { count: 2, from: ["Arcanes", "Histoire", "Intuition", "Investigation", "Médecine", "Nature", "Religion"] },
    weaponProficiency: { simple: true, martial: "none" },
    armorTraining: [],
    tools: { fixed: [] },
    spellcasting: caster(
      "magicien",
      "INT",
      "Caractéristique d’incantation. L’Intelligence est la caractéristique d’incantation de vos sorts de Magicien.",
      "Focaliseur d’incantation. Vous pouvez vous servir d’un focaliseur arcanique ou de votre grimoire comme focaliseur d’incantation de vos sorts de Magicien.",
      { cantrips: 3, prepared: 4, slots: 2 },
      { spellbook: 6 },
    ),
    equipment: [
      {
        id: "A",
        items: [w("Dague", 2), w("Bâton de combat", 1, "focaliseur arcanique"), i("Robe"), i("Grimoire"), p("érudit")],
        gold: 5,
      },
      { id: "B", items: [], gold: 55 },
    ],
    traits: traitsOf("magicien"),
    levelOneNotes: [],
  },
  {
    id: "moine",
    name: "Moine",
    hitDie: 8,
    saves: ["FOR", "DEX"],
    skills: { count: 2, from: ["Acrobaties", "Athlétisme", "Discrétion", "Histoire", "Intuition", "Religion"] },
    weaponProficiency: { simple: true, martial: "light" },
    armorTraining: [],
    tools: { fixed: [], choose: "artisan-or-instrument" },
    equipment: [
      {
        id: "A",
        items: [w("Lance"), w("Dague", 5), { kind: "choice", what: "artisan-or-instrument" }, p("explorateur")],
        gold: 11,
      },
      { id: "B", items: [], gold: 50 },
    ],
    traits: traitsOf("moine"),
    levelOneNotes: ["Dé d’Arts martiaux : 1d6"],
  },
  {
    id: "occultiste",
    name: "Occultiste",
    hitDie: 8,
    saves: ["SAG", "CHA"],
    skills: { count: 2, from: ["Arcanes", "Histoire", "Intimidation", "Investigation", "Nature", "Religion", "Tromperie"] },
    weaponProficiency: { simple: true, martial: "none" },
    armorTraining: ["légère"],
    tools: { fixed: [] },
    invocation: true,
    spellcasting: caster(
      "occultiste",
      "CHA",
      "Caractéristique d’incantation. Le Charisme est la caractéristique d’incantation de vos sorts d’Occultiste.",
      "Focaliseur d’incantation. Vous pouvez vous servir d’un focaliseur arcanique comme focaliseur d’incantation de vos sorts d’Occultiste.",
      { cantrips: 2, prepared: 2, slots: 1 },
      { pact: true },
    ),
    equipment: [
      {
        id: "A",
        items: [a("Armure de cuir"), w("Serpe"), w("Dague", 2), i("Focaliseur arcanique (orbe)"), i("Livre (savoir occulte)"), p("érudit")],
        gold: 15,
      },
      { id: "B", items: [], gold: 100 },
    ],
    traits: traitsOf("occultiste"),
    levelOneNotes: ["Manifestations occultes : 1", "Emplacements de sort de Magie de pacte : 1 (niveau 1)"],
  },
  {
    id: "paladin",
    name: "Paladin",
    hitDie: 10,
    saves: ["SAG", "CHA"],
    skills: { count: 2, from: ["Athlétisme", "Intimidation", "Intuition", "Médecine", "Persuasion", "Religion"] },
    weaponProficiency: { simple: true, martial: "all" },
    armorTraining: ["légère", "intermédiaire", "lourde", "bouclier"],
    tools: { fixed: [] },
    weaponMastery: { count: 2, from: "proficient" },
    spellcasting: caster(
      "paladin",
      "CHA",
      "Caractéristique d’incantation. Le Charisme est la caractéristique d’incantation de vos sorts de paladin.",
      "Focaliseur d’incantation. Vous pouvez vous servir d’un symbole sacré comme focaliseur d’incantation de vos sorts de paladin",
      { cantrips: 0, prepared: 2, slots: 2 },
    ),
    equipment: [
      {
        id: "A",
        items: [a("Cotte de mailles"), a("Bouclier"), w("Épée longue"), w("Javeline", 6), i("Symbole sacré"), p("ecclésiastique")],
        gold: 9,
      },
      { id: "B", items: [], gold: 150 },
    ],
    traits: traitsOf("paladin"),
    levelOneNotes: ["Réserve d’Imposition des mains : 5 points de vie (5 × niveau de Paladin)"],
  },
  {
    id: "rodeur",
    name: "Rôdeur",
    hitDie: 10,
    saves: ["FOR", "DEX"],
    skills: {
      count: 3,
      from: ["Athlétisme", "Discrétion", "Dressage", "Intuition", "Investigation", "Nature", "Perception", "Survie"],
    },
    weaponProficiency: { simple: true, martial: "all" },
    armorTraining: ["légère", "intermédiaire", "bouclier"],
    tools: { fixed: [] },
    weaponMastery: { count: 2, from: "proficient" },
    spellcasting: caster(
      "rodeur",
      "SAG",
      "Caractéristique d’incantation. La Sagesse est la caractéristique d’incantation de vos sorts de Rôdeur.",
      "Focaliseur d’incantation. Vous pouvez vous servir d’un focaliseur druidique comme focaliseur d’incantation de vos sorts de Rôdeur",
      { cantrips: 0, prepared: 2, slots: 2 },
      { alwaysPrepared: ["Marque du chasseur"] },
    ),
    equipment: [
      {
        id: "A",
        items: [
          a("Armure de cuir clouté"),
          w("Cimeterre"),
          w("Épée courte"),
          w("Arc long"),
          i("Flèches", 20),
          i("Carquois"),
          i("Focaliseur druidique (branche de gui)"),
          p("explorateur"),
        ],
        gold: 7,
      },
      { id: "B", items: [], gold: 150 },
    ],
    traits: traitsOf("rodeur"),
    levelOneNotes: ["Utilisations gratuites de Marque du chasseur : 2"],
  },
  {
    id: "roublard",
    name: "Roublard",
    hitDie: 8,
    saves: ["DEX", "INT"],
    skills: {
      count: 4,
      from: ["Acrobaties", "Athlétisme", "Discrétion", "Escamotage", "Intimidation", "Intuition", "Investigation", "Perception", "Persuasion", "Tromperie"],
    },
    weaponProficiency: { simple: true, martial: "finesse-or-light" },
    armorTraining: ["légère"],
    tools: { fixed: ["Outils de voleur"] },
    expertise: 2,
    weaponMastery: { count: 2, from: "proficient" },
    equipment: [
      {
        id: "A",
        items: [a("Armure de cuir"), w("Dague", 2), w("Épée courte"), w("Arc court"), i("Flèches", 20), i("Carquois"), i("Outils de voleur"), p("cambrioleur")],
        gold: 8,
      },
      { id: "B", items: [], gold: 100 },
    ],
    traits: traitsOf("roublard"),
    levelOneNotes: ["Attaque sournoise : 1d6"],
  },
];

export function getClass(id: string): ClassData | undefined {
  return CLASSES.find((c) => c.id === id);
}
