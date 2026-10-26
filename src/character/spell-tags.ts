import { SPELL_TEXTS, getSpell } from "../srd/index.js";

export interface SpellTags {
  /** Attaque de sort, sauvegarde (caractéristique), soins ou autre effet : lu dans le texte du SRD. */
  kind: string;
  damage?: string;
  heal?: boolean;
  range?: string;
  concentration: boolean;
  ritual: boolean;
}

/** Caractéristiques d'un sort déduites mécaniquement de sa description du SRD (aucune appréciation). */
export function spellTags(name: string): SpellTags | undefined {
  const t = SPELL_TEXTS[name];
  if (!t) return undefined;
  const s = getSpell(name);
  const text = t.text.split("\n")[0] ?? t.text;
  const save = /jet de sauvegarde (?:de |d’)(Force|Dextérité|Constitution|Intelligence|Sagesse|Charisme)/.exec(text);
  const attack = /attaque de sort|jet d’attaque de sort/.test(text);
  const dmg = /(\d+d\d+(?: \+ \d+)?) dégâts (?:de |d’)?([\p{L}]+)/u.exec(text);
  const heal = /récupère[^.]*points de vie|points de vie temporaires/.test(text);
  const kind = attack ? "Attaque de sort" : save ? `Sauvegarde de ${save[1]}` : heal ? "Soins" : "Autre effet";
  return {
    kind,
    ...(dmg ? { damage: `${dmg[1]} ${dmg[2]}` } : {}),
    ...(heal ? { heal: true } : {}),
    range: t.range,
    concentration: s?.concentration ?? /Concentration/.test(t.duration),
    ritual: s?.ritual ?? false,
  };
}

/** Résumé court pour un menu Discord (100 caractères au plus). */
export function spellTagLine(name: string): string {
  const g = spellTags(name);
  if (!g) return "";
  return [g.kind, g.damage, g.range ? `portée ${g.range}` : undefined, g.concentration ? "concentration" : undefined, g.ritual ? "rituel" : undefined]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 100);
}

/** Bilan factuel d'une sélection : combien de sorts infligent des dégâts, soignent, demandent la concentration. */
export function selectionSummary(names: string[]): string {
  if (!names.length) return "";
  const tags = names.map(spellTags).filter((x): x is SpellTags => !!x);
  const n = (f: (g: SpellTags) => boolean) => tags.filter(f).length;
  return `Ta sélection : ${n((g) => !!g.damage)} sort(s) de dégâts, ${n((g) => !!g.heal)} de soins, ${n((g) => !g.damage && !g.heal)} autre(s) effet(s), ${n((g) => g.concentration)} à concentration, ${n((g) => g.ritual)} rituel(s).`;
}
