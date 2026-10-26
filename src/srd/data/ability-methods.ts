import type { Ability } from "../types.js";

/** SRD 5.2.1, « Étape 3. Valeurs de caractéristique ». */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
export const POINT_BUDGET = 27;
/** Table « Coût des valeurs de caractéristique ». */
export const POINT_COST: Readonly<Record<number, number>> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

/** Table « Valeurs standard par classe » (For, Dex, Con, Int, Sag, Cha). */
const T = (FOR: number, DEX: number, CON: number, INT: number, SAG: number, CHA: number): Record<Ability, number> => ({ FOR, DEX, CON, INT, SAG, CHA });
export const STANDARD_BY_CLASS: Readonly<Record<string, Record<Ability, number>>> = {
  barbare: T(15, 13, 14, 10, 12, 8),
  barde: T(8, 14, 12, 13, 10, 15),
  clerc: T(14, 8, 13, 10, 15, 12),
  druide: T(8, 12, 14, 13, 15, 10),
  ensorceleur: T(10, 13, 14, 8, 12, 15),
  guerrier: T(15, 14, 13, 8, 10, 12),
  magicien: T(8, 12, 13, 15, 14, 10),
  moine: T(12, 15, 13, 10, 14, 8),
  occultiste: T(8, 14, 13, 12, 10, 15),
  paladin: T(15, 10, 13, 8, 12, 14),
  rodeur: T(12, 15, 13, 8, 14, 10),
  roublard: T(12, 15, 13, 14, 10, 8),
};
