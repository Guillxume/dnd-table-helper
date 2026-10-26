import { POINT_COST, STANDARD_ARRAY } from "../srd/index.js";
import type { Method } from "./rules.js";
import {
  ABILITIES,
  SKILL_NAMES,
  BACKGROUNDS,
  CLASSES,
  getSpecies,
  type Ability,
  type Armor,
  type Background,
  type ClassData,
  type Species,
  type SpeciesOption,
  type Weapon,
} from "../srd/index.js";
import type { Draft, FeatChoice } from "./draft.js";

export function classOf(d: Draft): ClassData | undefined {
  return CLASSES.find((c) => c.id === d.classId);
}

export function speciesOf(d: Draft): Species | undefined {
  return d.speciesId ? getSpecies(d.speciesId) : undefined;
}

export function speciesOptionOf(d: Draft): SpeciesOption | undefined {
  return speciesOf(d)?.options?.find((o) => o.id === d.speciesOption);
}

export function backgroundOf(d: Draft): Background | undefined {
  return BACKGROUNDS.find((b) => b.id === d.backgroundId);
}

/** Compétences déjà maîtrisées (hors Doué), pour éviter les doublons dans les choix. */
export function heldSkills(d: Draft): string[] {
  const held: string[] = [];
  const bg = backgroundOf(d);
  if (bg) held.push(...bg.skills);
  if (d.speciesSkill) held.push(d.speciesSkill);
  for (const f of [d.speciesFeat, d.backgroundFeat]) if (f?.picks) held.push(...f.picks.filter((x) => SKILL_NAMES.includes(x)));
  if (d.classSkills) held.push(...d.classSkills);
  return [...new Set(held)];
}

/** Sorts mineurs déjà connus (espèce, dons, classe, pacte). */
export function knownCantrips(d: Draft): string[] {
  const out: string[] = [];
  const opt = speciesOptionOf(d);
  if (opt?.cantrips) out.push(...opt.cantrips);
  if (d.speciesId === "tieffelin") out.push("Thaumaturgie");
  const innate = d.speciesId ? getSpecies(d.speciesId)?.innateCantrip : undefined;
  if (innate) out.push(innate.name);
  for (const f of [d.speciesFeat, d.backgroundFeat]) if (f?.cantrips) out.push(...f.cantrips);
  if (d.cantrips) out.push(...d.cantrips);
  if (d.pactCantrips) out.push(...d.pactCantrips);
  return [...new Set(out)];
}

export function classCantripCount(d: Draft): number {
  const cls = classOf(d);
  if (!cls?.spellcasting) return 0;
  const bonus = d.order === "thaumaturge" || d.order === "mage" ? 1 : 0;
  return cls.spellcasting.cantrips + bonus;
}

const LIGHT_MARTIAL_IDS = new Set(["light", "finesse-or-light"]);

/** La classe (et son ordre) maîtrise-t-elle cette arme ? */
export function weaponProficient(d: Draft, w: Weapon): boolean {
  const cls = classOf(d);
  if (!cls) return false;
  const prof = cls.weaponProficiency;
  if (w.category === "courante") return prof.simple;
  const orderMartial = d.order === "protecteur" || d.order === "gardien";
  if (prof.martial === "all" || orderMartial) return true;
  if (!LIGHT_MARTIAL_IDS.has(prof.martial)) return false;
  if (prof.martial === "light") return w.kind === "corps à corps" && w.light;
  return w.light || w.finesse;
}

/** Formation aux armures : liste finale, avec Protecteur / Gardien. */
export function armorTrainingOf(d: Draft): string[] {
  const cls = classOf(d);
  if (!cls) return [];
  const set = new Set<string>(cls.armorTraining);
  if (d.order === "protecteur") set.add("lourde");
  if (d.order === "gardien") set.add("intermédiaire");
  const order = ["légère", "intermédiaire", "lourde", "bouclier"];
  return order.filter((o) => set.has(o));
}

export function armorTrained(d: Draft, a: Armor): boolean {
  return armorTrainingOf(d).includes(a.category);
}

/** Valeurs finales : tirage assigné + bonus d'historique. */
/** Méthode de génération des caractéristiques. Les fiches créées avant les paramètres de campagne utilisent les dés. */
export function methodOf(d: Draft): Method | undefined {
  if (!d.rules) return "des";
  if (d.method) return d.method;
  return d.rules.methods.length === 1 ? d.rules.methods[0] : undefined;
}

/** Les six valeurs à répartir (valeurs standard ou tirage). */
export function valuesOf(d: Draft): number[] | undefined {
  const m = methodOf(d);
  if (m === "standard") return [...STANDARD_ARRAY];
  if (m === "des" || m === "table") return d.rolls;
  return undefined;
}

/** Dés lancés à la table et résultats pas encore saisis : les caractéristiques sont inconnues. */
export function scoresPending(d: Draft): boolean {
  return methodOf(d) === "table" && !d.rolls;
}

export function pointsSpent(d: Draft): number {
  return ABILITIES.reduce((n, a) => n + (d.points?.[a] !== undefined ? (POINT_COST[d.points[a]!] ?? 0) : 0), 0);
}

export function finalScores(d: Draft): Record<Ability, number> {
  const out = {} as Record<Ability, number>;
  const values = valuesOf(d);
  for (const a of ABILITIES) {
    if (methodOf(d) === "points") {
      out[a] = d.points?.[a] ?? 0;
      continue;
    }
    const idx = d.assignment?.[a];
    out[a] = idx !== undefined && values ? (values[idx] ?? 0) : 0;
  }
  const bonus = (a: Ability | undefined, n: number) => {
    if (a) out[a] = Math.min(20, out[a] + n);
  };
  if (d.bonusMode === "2-1") {
    bonus(d.bonusPlus2, 2);
    bonus(d.bonusPlus1, 1);
  } else if (d.bonusMode === "1-1-1") {
    const bg = backgroundOf(d);
    for (const a of bg?.abilities ?? []) bonus(a, 1);
  }
  return out;
}

export function featName(f: FeatChoice | undefined): string | undefined {
  return f?.featId;
}


/** Outils déjà maîtrisés (historique, dons, classe). Sert à ne pas proposer deux fois le même outil. */
export function heldTools(d: Draft): string[] {
  const held: string[] = [];
  const bg = backgroundOf(d);
  if (bg?.toolChoice === "fixed") held.push(bg.tool);
  if (d.backgroundTool) held.push(d.backgroundTool);
  if (bg?.toolChoice === "gaming-set" && d.gamingSet) held.push(d.gamingSet);
  for (const f of [d.speciesFeat, d.backgroundFeat]) for (const p of f?.picks ?? []) held.push(p);
  for (const t of d.classTools ?? []) held.push(t);
  return held;
}
