import type { StyleAspect } from "@/generated/prisma/enums";
import { STYLE_ASPECT_ORDER } from "../labels";

export type RuleMap = Partial<Record<StyleAspect, string>>;

export type EffectiveRule = {
  aspect: StyleAspect;
  /** Règle commune, héritée du guide principal. */
  common?: string;
  /** Règle propre à la variante, qui complète la règle commune sans l'effacer. */
  specific?: string;
};

export function rulesToMap(rules: readonly { aspect: StyleAspect; content: string }[]): RuleMap {
  const map: RuleMap = {};
  for (const rule of rules) {
    const content = rule.content.trim();
    if (content) map[rule.aspect] = content;
  }
  return map;
}

/**
 * Règles effectives d'un guide.
 *
 * - Guide principal : ses propres règles (`common`).
 * - Variante : les règles du guide principal restent présentes (`common`) et la
 *   variante y ajoute ses précisions (`specific`). Une variante ne peut donc
 *   jamais faire disparaître une règle de cohérence commune.
 */
export function mergeGuideRules(common: RuleMap, specific: RuleMap | null): EffectiveRule[] {
  const result: EffectiveRule[] = [];
  for (const aspect of STYLE_ASPECT_ORDER) {
    const commonRule = common[aspect];
    const specificRule = specific?.[aspect];
    if (!commonRule && !specificRule) continue;
    result.push({
      aspect,
      ...(commonRule ? { common: commonRule } : {}),
      ...(specificRule ? { specific: specificRule } : {}),
    });
  }
  return result;
}

export function sameRules(a: RuleMap, b: RuleMap): boolean {
  return STYLE_ASPECT_ORDER.every((aspect) => (a[aspect] ?? "") === (b[aspect] ?? ""));
}

/** Aspects modifiés entre deux versions, pour l'historique. */
export function changedAspects(previous: RuleMap, next: RuleMap): StyleAspect[] {
  return STYLE_ASPECT_ORDER.filter((aspect) => (previous[aspect] ?? "") !== (next[aspect] ?? ""));
}
