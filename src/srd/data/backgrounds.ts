import type { Ability } from "../types.js";
import { SRC_DDB_FEATS, SRC_ORIGINES_MJ } from "../sources.js";

/** fixed : outil imposé ; sinon le joueur choisit un outil dans la catégorie. */
export type ToolChoice = "fixed" | "gaming-set" | "artisan" | "instrument";

export interface Background {
  id: string;
  name: string;
  abilities: [Ability, Ability, Ability];
  featId: string;
  /** Si le don dépend d'une liste de sorts imposée (Initié à la magie). */
  featSpellList?: "clerc" | "druide" | "magicien";
  skills: [string, string];
  tool: string;
  toolChoice: ToolChoice;
  /** Équipement de l'option A (hors pièces d'or). Absent si aucune source disponible ne le donne. */
  equipmentA?: string[];
  /** Armes de l'option A, pour le calcul des attaques. */
  weaponsA: { name: string; qty?: number }[];
  goldA: number;
  goldB: number;
  /** Source si l'historique ne vient pas du SRD 5.2.1. */
  source?: string;
  /** Source de l'équipement, s'il diffère de la source principale. */
  equipmentSource?: string;
}

/** Historiques du Manuel 2024 hors SRD : caractéristiques, compétences, outil et don d'après le référentiel du MJ.
 * Noms des compétences et outils alignés sur le SRD français (Perspicacité = Intuition, Kit de déguisement =
 * Accessoires de déguisement, Kit d'herboriste = Matériel d'herboriste, Outils de navigateur = Instruments de navigateur,
 * Matériel de calligraphie = Matériel de calligraphe, Alerte = Vigilant). L'option B (50 po) suit la règle générale
 * citée par l'article D&D Beyond ; l'option A n'est connue que pour le Voyageur. */
const phb = (b: Omit<Background, "source" | "weaponsA" | "goldA" | "goldB"> & Partial<Pick<Background, "weaponsA" | "goldA">>): Background => ({
  weaponsA: [],
  goldA: 0,
  goldB: 50,
  source: SRC_ORIGINES_MJ,
  equipmentSource: SRC_DDB_FEATS,
  ...b,
});

export const BACKGROUNDS: Background[] = [
  {
    id: "acolyte",
    name: "Acolyte",
    abilities: ["INT", "SAG", "CHA"],
    featId: "initie-magie",
    featSpellList: "clerc",
    skills: ["Intuition", "Religion"],
    tool: "Matériel de calligraphe",
    toolChoice: "fixed",
    equipmentA: ["Matériel de calligraphe", "Livre (de prières)", "Symbole sacré", "Parchemin (10 feuilles)", "Robe"],
    weaponsA: [],
    goldA: 8,
    goldB: 50,
  },
  {
    id: "criminel",
    name: "Criminel",
    abilities: ["DEX", "CON", "INT"],
    featId: "vigilant",
    skills: ["Discrétion", "Escamotage"],
    tool: "Outils de voleur",
    toolChoice: "fixed",
    equipmentA: ["2 dagues", "Outils de voleur", "2 bourses", "Pied-de-biche", "Tenue de voyage"],
    weaponsA: [{ name: "Dague", qty: 2 }],
    goldA: 16,
    goldB: 50,
  },
  {
    id: "sage",
    name: "Sage",
    abilities: ["CON", "INT", "SAG"],
    featId: "initie-magie",
    featSpellList: "magicien",
    skills: ["Arcanes", "Histoire"],
    tool: "Matériel de calligraphe",
    toolChoice: "fixed",
    equipmentA: ["Bâton de combat", "Matériel de calligraphe", "Livre (d’histoire)", "Parchemin (8 feuilles)", "Robe"],
    weaponsA: [{ name: "Bâton de combat" }],
    goldA: 8,
    goldB: 50,
  },
  {
    id: "soldat",
    name: "Soldat",
    abilities: ["FOR", "DEX", "CON"],
    featId: "sauvagerie-martiale",
    skills: ["Athlétisme", "Intimidation"],
    tool: "Boîte de jeux (au choix)",
    toolChoice: "gaming-set",
    equipmentA: ["Arc court + 20 flèches", "Carquois", "Lance", "Boîte de jeux (du même type que ci-dessus)", "Trousse de soins", "Tenue de voyage"],
    weaponsA: [{ name: "Arc court" }, { name: "Lance" }],
    goldA: 14,
    goldB: 50,
  },
  phb({ id: "artisan", name: "Artisan", abilities: ["FOR", "DEX", "INT"], featId: "fabricant", skills: ["Investigation", "Persuasion"], tool: "Outil d’artisan (au choix)", toolChoice: "artisan" }),
  phb({ id: "charlatan", name: "Charlatan", abilities: ["DEX", "CON", "CHA"], featId: "doue", skills: ["Tromperie", "Escamotage"], tool: "Accessoires de déguisement", toolChoice: "fixed" }),
  phb({ id: "artiste", name: "Artiste", abilities: ["FOR", "DEX", "CHA"], featId: "musicien", skills: ["Acrobaties", "Représentation"], tool: "Instrument de musique (au choix)", toolChoice: "instrument" }),
  phb({ id: "garde", name: "Garde", abilities: ["FOR", "INT", "SAG"], featId: "vigilant", skills: ["Athlétisme", "Perception"], tool: "Boîte de jeux (au choix)", toolChoice: "gaming-set" }),
  phb({ id: "fermier", name: "Fermier", abilities: ["FOR", "CON", "SAG"], featId: "robuste", skills: ["Dressage", "Nature"], tool: "Outils de menuisier", toolChoice: "fixed" }),
  phb({ id: "guide", name: "Guide", abilities: ["DEX", "CON", "SAG"], featId: "initie-magie", featSpellList: "druide", skills: ["Discrétion", "Survie"], tool: "Outils de cartographe", toolChoice: "fixed" }),
  phb({ id: "ermite", name: "Ermite", abilities: ["CON", "SAG", "CHA"], featId: "guerisseur", skills: ["Médecine", "Religion"], tool: "Matériel d’herboriste", toolChoice: "fixed" }),
  phb({ id: "marchand", name: "Marchand", abilities: ["CON", "INT", "CHA"], featId: "chanceux", skills: ["Dressage", "Persuasion"], tool: "Instruments de navigateur", toolChoice: "fixed" }),
  phb({ id: "noble", name: "Noble", abilities: ["FOR", "INT", "CHA"], featId: "doue", skills: ["Histoire", "Persuasion"], tool: "Boîte de jeux (au choix)", toolChoice: "gaming-set" }),
  phb({ id: "marin", name: "Marin", abilities: ["FOR", "DEX", "SAG"], featId: "bagarreur", skills: ["Acrobaties", "Perception"], tool: "Instruments de navigateur", toolChoice: "fixed" }),
  phb({ id: "scribe", name: "Scribe", abilities: ["DEX", "INT", "SAG"], featId: "doue", skills: ["Investigation", "Perception"], tool: "Matériel de calligraphe", toolChoice: "fixed" }),
  phb({
    id: "voyageur",
    name: "Voyageur",
    abilities: ["DEX", "SAG", "CHA"],
    featId: "chanceux",
    skills: ["Intuition", "Discrétion"],
    tool: "Outils de voleur",
    toolChoice: "fixed",
    equipmentA: ["2 dagues", "Outils de voleur", "Boîte de jeux (au choix)", "Sac de couchage", "2 bourses", "Tenue de voyage"],
    weaponsA: [{ name: "Dague", qty: 2 }],
    goldA: 16,
  }),
];

export function getBackground(id: string): Background | undefined {
  return BACKGROUNDS.find((b) => b.id === id);
}
