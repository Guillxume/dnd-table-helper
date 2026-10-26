import { ABILITIES, type Ability } from "./types.js";

/** Modificateur de caractéristique (SRD 5.2.1, table des modificateurs : (valeur - 10) / 2, arrondi à l'inférieur). */
export function modifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Bonus de maîtrise au niveau 1. */
export const PROFICIENCY_BONUS = 2;

/** Tirage 4d6, on garde les 3 plus hauts (SRD 5.2.1, génération aléatoire). */
export function rollAbilityScore(rng: () => number = Math.random): { dice: number[]; total: number } {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(rng() * 6));
  const kept = [...dice].sort((a, b) => b - a).slice(0, 3);
  return { dice, total: kept.reduce((a, b) => a + b, 0) };
}

export function rollAbilityScores(rng: () => number = Math.random) {
  return Array.from({ length: 6 }, () => rollAbilityScore(rng));
}

export type ScoreMap = Record<Ability, number>;

export function emptyScores(): ScoreMap {
  return Object.fromEntries(ABILITIES.map((a) => [a, 0])) as ScoreMap;
}

/** Distance en mètres, écrite comme dans le SRD : « 9 m », « 10,50 m ». */
export function formatMeters(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} m`;
}
