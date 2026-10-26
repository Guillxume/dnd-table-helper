import {
  ABILITY_NAMES,
  ALIGNMENT_SOURCE,
  ALIGNMENT_TEXTS,
  FEATS,
  INVOCATIONS,
  MASTERIES,
  SKILLS,
  SPELL_TEXTS,
  STANDARD_BY_CLASS,
  formatMeters,
  getBackground,
  getClass,
  getSpecies,
  getSpell,
  getWeapon,
} from "../srd/index.js";
import { guideClass } from "../guide/index.js";
import type { Draft } from "./draft.js";
import { METHOD_NAMES, type Method } from "./rules.js";
import type { Step } from "./steps.js";

const feat = (id: string) => FEATS.find((f) => f.id === id);

export function featText(id: string): string | undefined {
  const f = feat(id);
  if (!f) return undefined;
  const body = f.traits.length ? f.traits.map((t) => `**${t.name}.** ${t.text}`).join("\n") : f.summary;
  return `**${f.name}** (don ${f.category === "Origines" ? "d’origine" : "de style de combat"})\n${body}${f.source ? `\n_Source : ${f.source}_` : ""}`;
}

export function spellText(name: string): string | undefined {
  const t = SPELL_TEXTS[name];
  const s = getSpell(name);
  if (!t) return undefined;
  const flags = [s?.school, s?.concentration ? "concentration" : null, s?.ritual ? "rituel" : null].filter(Boolean).join(", ");
  return [
    `**${name}**${flags ? ` (${flags})` : ""}`,
    `Temps d’incantation : ${t.casting} · Portée : ${t.range}`,
    `Composantes : ${t.components} · Durée : ${t.duration}`,
    t.text,
  ].join("\n");
}

export function weaponText(name: string): string | undefined {
  const w = getWeapon(name);
  if (!w) return undefined;
  return [
    `**${w.name}** (arme ${w.category === "courante" ? "courante" : "de guerre"}, ${w.kind})`,
    `Dégâts : ${w.damage} ${w.damageType}${w.versatile ? ` (${w.versatile} à deux mains)` : ""}`,
    `Propriétés : ${w.properties || "aucune"}`,
    `Botte : **${w.mastery}**. ${MASTERIES[w.mastery] ?? ""}`,
  ].join("\n");
}

/** Description d'une option de l'étape en cours, à partir des données du SRD (ou de la source citée). */
export function explainOption(step: Step, value: string, d: Draft): string {
  const id = step.id;
  const fallback = step.kind === "select" || step.kind === "multi" ? step.options.find((o) => o.value === value) : undefined;

  if (id === "class") return classText(value) ?? "Classe inconnue.";
  if (id === "species") return speciesText(value) ?? "Espèce inconnue.";
  if (id === "speciesOption") {
    const sp = getSpecies(d.speciesId ?? "");
    const o = sp?.options?.find((x) => x.id === value);
    return o ? `**${o.name}**\n${o.text}` : "Option inconnue.";
  }
  if (id === "background") return backgroundText(value) ?? "Historique inconnu.";
  return explainOther(step, id, value, fallback);
}

/** Classe : dé de vie, sauvegardes, armures, répartition conseillée, et rôle et sous-classes du guide d'orientation. */
export function classText(value: string): string | undefined {
    const c = getClass(value);
    const g = guideClass(value);
    if (!c) return undefined;
    const sug = STANDARD_BY_CLASS[value];
    return [
      `**${c.name}** : dé de vie d${c.hitDie}, sauvegardes ${c.saves.map((a) => ABILITY_NAMES[a]).join(" et ")}`,
      `Armures : ${c.armorTraining.join(", ") || "aucune"}`,
      sug ? `Répartition standard conseillée par le SRD : ${Object.entries(sug).map(([a, v]) => `${a} ${v}`).join(", ")}` : "",
      g ? `\n${g.role}\n${g.axes}` : "",
      g ? `Sous-classes (niveau 3) : ${g.sousClasses.map((s) => s.nom).join(", ")}. Détail : /guide classe:${c.name}` : "",
      g ? "_Rôle et sous-classes : guide d’orientation du MJ (hors SRD)._" : "",
    ]
      .filter(Boolean)
      .join("\n");
}

/** Espèce : taille, vitesse, vision, traits, options (lignées, héritages) et source hors SRD le cas échéant. */
export function speciesText(value: string, withOptions = false): string | undefined {
    const sp = getSpecies(value);
    if (!sp) return undefined;
    return [
      `**${sp.name}** : taille ${sp.sizeText}, vitesse ${formatMeters(sp.speed)}${sp.darkvision ? `, vision dans le noir ${formatMeters(sp.darkvision)}` : ""}`,
      ...sp.traits.map((t) => `**${t.name}.** ${t.text}`),
      ...(withOptions && sp.options?.length ? ["", "**Options**", ...sp.options.map((o) => `**${o.name}.** ${o.text}`)] : []),
      sp.source ? `_Source : ${sp.source}_` : "_Source : SRD 5.2.1_",
    ].join("\n");
}

/** Historique : caractéristiques, compétences, outil, équipement, don d'origine et source. */
export function backgroundText(value: string): string | undefined {
    const b = getBackground(value);
    if (!b) return undefined;
    return [
      `**${b.name}**`,
      `Caractéristiques : ${b.abilities.map((a) => ABILITY_NAMES[a]).join(", ")} (+2 et +1, ou +1 aux trois)`,
      `Compétences : ${b.skills.join(", ")} · Outil : ${b.tool}`,
      `Équipement : ${b.equipmentA ? `(A) ${b.equipmentA.join(", ")} et ${b.goldA} po, ou (B) ${b.goldB} po` : `option A absente des sources, (B) ${b.goldB} po`}`,
      "",
      featText(b.featId) ?? "",
      b.source ? `_Historique : ${b.source}_` : "_Historique : SRD 5.2.1_",
    ]
      .filter((x) => x !== undefined)
      .join("\n");
}

function explainOther(step: Step, id: string, value: string, fallback: { label: string; description?: string } | undefined): string {
  if (id === "speciesFeat" || id === "fightingStyle") return featText(value) ?? "Don inconnu.";
  if (id === "method") return METHOD_NAMES[value as Method] ?? value;
  if (id === "alignment") {
    const t = ALIGNMENT_TEXTS[value];
    return t ? `**${value}** : ${t}\nL’alignement est un repère de jeu de rôle : il ne donne aucun bonus.\n_Source : ${ALIGNMENT_SOURCE}_` : `**${value}**`;
  }
  if (id === "invocation") return INVOCATIONS[value] ? `**${value}**\n${INVOCATIONS[value]}` : value;
  if (id === "masteries") return weaponText(value) ?? value;
  if (/cantrips$|spellbook|prepared|spell$|pactCantrips|pactRituals/.test(id)) return spellText(value) ?? `${value} : description non disponible.`;
  if (/[Ss]kills?$|expertise/.test(id) || SKILLS.some((s) => s.name === value)) {
    const sk = SKILLS.find((s) => s.name === value);
    if (sk) return `**${sk.name}** : compétence liée à la ${ABILITY_NAMES[sk.ability]}.`;
  }
  if (id === "speciesAbility" || id.endsWith(".ability")) return `${ABILITY_NAMES[value as keyof typeof ABILITY_NAMES] ?? value} : caractéristique d’incantation de ces sorts.`;
  return fallback ? `**${fallback.label}**${fallback.description ? `\n${fallback.description}` : ""}` : value;
}
