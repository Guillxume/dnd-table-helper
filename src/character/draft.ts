import type { CreationRules, Method } from "./rules.js";
import type { Ability } from "../srd/index.js";

export interface FeatChoice {
  featId: string;
  /** Doué : trois compétences ou outils ; Fabricant, Musicien : trois outils. */
  picks?: string[];
  /** Initié à la magie : liste de sorts choisie. */
  spellList?: "clerc" | "druide" | "magicien";
  /** Initié à la magie : caractéristique d'incantation. */
  ability?: Ability;
  cantrips?: string[];
  spell?: string;
}

export interface Story {
  /** Origine narrative libre (lieu, milieu, famille) : aucun effet de règle. */
  origin?: string;
  appearance?: string;
  personality?: string;
  backstory?: string;
}

/** Réponses du joueur, accumulées pas à pas. Tout est facultatif tant que le parcours n'est pas terminé. */
export interface Draft {
  name?: string;
  /** Paramètres de la campagne au début de la création (absents pour les fiches créées avant leur ajout). */
  rules?: CreationRules;
  rulesAck?: boolean;
  method?: Method;
  /** Répartition proposée par le bot (table « Valeurs standard par classe ») ou manuelle. */
  assignMode?: "suggested" | "manual";
  /** Acquisition par points : valeur achetée par caractéristique. */
  points?: Partial<Record<Ability, number>>;
  classId?: string;
  speciesId?: string;
  speciesOption?: string;
  speciesAbility?: Ability;
  size?: "M" | "P";
  speciesSkill?: string;
  speciesFeat?: FeatChoice;
  backgroundId?: string;
  /** Outil choisi quand l'historique laisse le choix (Artisan, Artiste). */
  backgroundTool?: string;
  backgroundFeat?: FeatChoice;
  gamingSet?: string;
  /** Six totaux (4d6, trois meilleurs dés), dans l'ordre du tirage. */
  rolls?: number[];
  /** Détail des dés pour affichage. */
  rollDice?: number[][];
  /** Caractéristique → indice dans `rolls`. */
  assignment?: Partial<Record<Ability, number>>;
  bonusMode?: "2-1" | "1-1-1";
  bonusPlus2?: Ability;
  bonusPlus1?: Ability;
  classSkills?: string[];
  classTools?: string[];
  order?: string;
  fightingStyle?: string;
  expertise?: string[];
  masteries?: string[];
  cantrips?: string[];
  spellbook?: string[];
  prepared?: string[];
  invocation?: string;
  pactCantrips?: string[];
  pactRituals?: string[];
  equipment?: "A" | "B" | "C";
  backgroundEquipment?: "A" | "B";
  instrument?: string;
  languages?: string[];
  extraLanguage?: string;
  alignment?: string;
  storyDone?: boolean;
  story?: Story;
}
