import weaponsJson from "./data/weapons.json" with { type: "json" };
import armorsJson from "./data/armors.json" with { type: "json" };
import spellsJson from "./data/spells.json" with { type: "json" };
import type { Armor, Spell, SpellListId, Weapon } from "./types.js";

export * from "./types.js";
export * from "./rules.js";
export * from "./data/basics.js";
export * from "./data/backgrounds.js";
export * from "./data/feats.js";
export * from "./data/species.js";
export * from "./data/classes.js";
export * from "./data/ability-methods.js";
export * from "./data/alignments.js";

export const WEAPONS = weaponsJson as Weapon[];
export const ARMORS = armorsJson as Armor[];
export const SPELLS = spellsJson as Spell[];

export function getWeapon(name: string): Weapon | undefined {
  return WEAPONS.find((w) => w.name === name);
}

export function getArmor(name: string): Armor | undefined {
  return ARMORS.find((a) => a.name === name);
}

/** Sorts d'une liste de classe pour un niveau donné (0 = sorts mineurs), triés par nom. */
export function spellsFor(list: SpellListId, level: number): Spell[] {
  return SPELLS.filter((s) => s.class === list && s.level === level).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Union dédoublonnée (par nom) des sorts de toutes les classes pour un niveau. */
export function allSpells(level: number, ritualOnly = false): Spell[] {
  const seen = new Map<string, Spell>();
  for (const s of SPELLS) {
    if (s.level !== level || (ritualOnly && !s.ritual)) continue;
    if (!seen.has(s.name)) seen.set(s.name, s);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

import spellTexts from "./data/spell-texts.json" with { type: "json" };

export interface SpellText {
  casting: string;
  range: string;
  components: string;
  duration: string;
  text: string;
}
/** Description des sorts de niveau 0 et 1 (SRD 5.2.1, extraite par scripts/srd/spell_texts.py). */
export const SPELL_TEXTS = spellTexts as Record<string, SpellText>;

export function getSpell(name: string, level?: number): Spell | undefined {
  return SPELLS.find((s) => s.name === name && (level === undefined || s.level === level));
}
