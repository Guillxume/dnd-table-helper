import { ABILITIES, ABILITY_NAMES, POINT_BUDGET, SKILL_NAMES, signed } from "../srd/index.js";
import type { Draft } from "./draft.js";
import { backgroundOf, finalScores, methodOf, pointsSpent } from "./helpers.js";
import { computeSheet, type Sheet } from "./sheet.js";
import { nextStep } from "./steps.js";

export interface Validation {
  /** Bloquants : la fiche ne peut pas être enregistrée. */
  errors: string[];
  /** À signaler sans bloquer (armure non maîtrisée, points non dépensés…). */
  warnings: string[];
  sheet?: Sheet;
}

/** Contrôles avant l'enregistrement d'une fiche. */
export function validateDraft(d: Draft): Validation {
  const errors: string[] = [];
  const step = nextStep(d);
  if (step.kind !== "done") errors.push(`Choix obligatoire manquant : ${step.kind === "name" ? "nom" : step.title}.`);

  const scores = finalScores(d);
  for (const a of ABILITIES)
    if (scores[a] < 3 || scores[a] > 20) errors.push(`${ABILITY_NAMES[a]} hors limites (${scores[a]}) : une valeur va de 3 à 20.`);
  if (methodOf(d) === "points" && pointsSpent(d) > POINT_BUDGET) errors.push(`Achat par points : ${pointsSpent(d)} points dépensés sur ${POINT_BUDGET}.`);

  // Une même compétence ne doit pas être accordée deux fois (le bot ne la propose pas, ce contrôle protège les anciennes fiches).
  const sources: string[] = [...(backgroundOf(d)?.skills ?? [])];
  if (d.speciesSkill) sources.push(d.speciesSkill);
  for (const f of [d.speciesFeat, d.backgroundFeat]) for (const p of f?.picks ?? []) if (SKILL_NAMES.includes(p)) sources.push(p);
  sources.push(...(d.classSkills ?? []));
  const dup = sources.filter((s, i) => sources.indexOf(s) !== i);
  if (dup.length) errors.push(`Compétence accordée deux fois : ${[...new Set(dup)].join(", ")}.`);

  let sheet: Sheet | undefined;
  if (!errors.length) {
    try {
      sheet = computeSheet(d);
    } catch (e) {
      errors.push(`Calcul impossible : ${e instanceof Error ? e.message : "erreur inconnue"}.`);
    }
  }
  return { errors, warnings: sheet?.warnings ?? [], ...(sheet ? { sheet } : {}) };
}

/** Récapitulatif court affiché avant l'enregistrement. */
export function recapText(s: Sheet): string {
  const prof = s.skills.filter((k) => k.proficient || k.expertise).map((k) => `${k.name} ${signed(k.bonus)}${k.expertise ? " (expertise)" : ""}`);
  const lines = [
    `**${s.name}** : ${s.className} 1, ${s.speciesName}${s.speciesDetail ? ` (${s.speciesDetail})` : ""}, ${s.backgroundName}, ${s.alignment}`,
    `PV ${s.hp} · CA ${s.ac} · Initiative ${signed(s.initiative)} · Vitesse ${s.speed} · Perception passive ${s.passivePerception}`,
    ABILITIES.map((a) => `${a} ${s.scores[a].score} (${signed(s.scores[a].mod)})`).join(" · "),
    `Sauvegardes maîtrisées : ${s.saves.filter((x) => x.proficient).map((x) => `${x.ability} ${signed(x.bonus)}`).join(", ") || "aucune"}`,
    `Compétences : ${prof.join(", ") || "aucune"}`,
    `Attaques : ${s.attacks.slice(0, 4).map((a) => `${a.name} ${a.attack} (${a.damage})`).join(" ; ")}`,
  ];
  for (const b of s.spellBlocks)
    lines.push(`${b.title} : DD ${b.dc}, mineurs ${b.cantrips.join(", ") || "aucun"}${b.prepared.length ? ` ; préparés ${b.prepared.join(", ")}` : ""}`);
  lines.push(`Équipement de départ : ${s.equipment.length} objets et ${s.gold} po (liste dans l’annexe du PDF).`);
  return lines.join("\n");
}

/** Fiche complète lisible dans Discord (découpée ensuite en messages de 2000 caractères). */
export function sheetDiscordText(s: Sheet): string {
  const armor = s.armorTraining.length ? s.armorTraining.map((a) => (a === "bouclier" ? "boucliers" : `armures ${a}s`)).join(", ") : "aucune";
  return [
    recapText(s),
    "",
    "**Détail des calculs**",
    ...s.calculations.map((c) => `• ${c.label} : ${c.value} = ${c.detail}`),
    "",
    "**Maîtrises et langues**",
    `Armures : ${armor} · Armes : ${s.weaponProficiency || "aucune"} · Outils : ${s.tools.join(", ") || "aucun"}`,
    `Langues : ${s.languages.join(", ")}${s.darkvision ? ` · Vision dans le noir ${s.darkvision}` : ""}${s.resistances.length ? ` · Résistances : ${s.resistances.join(", ")}` : ""}`,
    "",
    "**Aptitudes, traits et dons**",
    ...s.features.map((f) => `• ${f.name} (${f.source})`),
    "",
    "**Équipement de départ**",
    ...s.equipment.map((e) => `• ${e}`),
    `• ${s.gold} po`,
    ...(s.warnings.length ? ["", "**À noter**", ...s.warnings.map((w) => `• ${w}`)] : []),
  ].join("\n");
}
