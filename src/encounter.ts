import { matchCreature, type Creature } from "./srd/creatures.js";

export type Difficulty = "faible" | "moderee" | "elevee";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { faible: "faible", moderee: "modérée", elevee: "élevée" };

/**
 * Budget de PX par personnage selon le niveau du groupe et la difficulté.
 * Source : SRD 5.2.1 FR, « Difficulté d’une rencontre de combat », table « Budget de PX par personnage », p. 213.
 */
export const XP_BUDGET: Record<number, [number, number, number]> = {
  1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500], 5: [500, 750, 1100],
  6: [600, 1000, 1400], 7: [750, 1300, 1700], 8: [1000, 1700, 2100], 9: [1300, 2000, 2600], 10: [1600, 2300, 3100],
  11: [1900, 2900, 4100], 12: [2200, 3700, 4700], 13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800],
  16: [3800, 6100, 9800], 17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000],
};

const INDEX: Record<Difficulty, number> = { faible: 0, moderee: 1, elevee: 2 };

export function parseDifficulty(text: string | null | undefined): Difficulty | undefined {
  const t = (text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (!t) return undefined;
  if (t.startsWith("fai")) return "faible";
  if (t.startsWith("mod")) return "moderee";
  if (t.startsWith("ele") || t.startsWith("dif") || t.startsWith("dur")) return "elevee";
  return undefined;
}

export function budget(level: number, players: number, difficulty: Difficulty): number {
  const row = XP_BUDGET[Math.min(20, Math.max(1, Math.round(level)))]!;
  return row[INDEX[difficulty]]! * players;
}

export interface Pick {
  creature: Creature;
  count: number;
}

/** Lit « 2 gobelins, Loup x3, chef gobelin » : nombre avant ou après (x3, ×3), 1 par défaut. */
export function parseCreatureList(text: string): { picks: Pick[]; unknown: string[] } {
  const picks: Pick[] = [];
  const unknown: string[] = [];
  for (const raw of text.split(/[,;\n]| et /)) {
    const part = raw.trim();
    if (!part) continue;
    let count = 1;
    let name = part;
    const before = /^(\d+)\s*[x×]?\s+(.+)$/i.exec(part);
    const after = /^(.+?)\s*[x×]\s*(\d+)$/i.exec(part);
    if (before) [count, name] = [Number(before[1]), before[2]!];
    else if (after) [name, count] = [after[1]!, Number(after[2])];
    const m = matchCreature(name);
    if (!("creature" in m) || count < 1) {
      const c = "candidates" in m ? m.candidates : [];
      unknown.push(c.length ? `${part} (préciser : ${c.slice(0, 6).map((x) => x.name).join(", ")}${c.length > 6 ? "…" : ""})` : part);
      continue;
    }
    const creature = m.creature;
    const existing = picks.find((p) => p.creature.name === creature.name);
    if (existing) existing.count += count;
    else picks.push({ creature, count });
  }
  return { picks, unknown };
}

export interface EncounterReport {
  budget: number;
  total: number;
  /** Difficulté atteinte : la plus haute dont le budget couvre le total, ou « au-delà ». */
  reached: Difficulty | "sous" | "au-dela";
  warnings: string[];
}

export function evaluate(picks: Pick[], level: number, players: number, difficulty: Difficulty): EncounterReport {
  const total = picks.reduce((a, p) => a + p.creature.xp * p.count, 0);
  const b = (d: Difficulty) => budget(level, players, d);
  const reached: EncounterReport["reached"] =
    total > b("elevee") ? "au-dela" : total > b("moderee") ? "elevee" : total > b("faible") ? "moderee" : total > 0 ? "faible" : "sous";
  const warnings: string[] = [];
  const count = picks.reduce((a, p) => a + p.count, 0);
  // Conseils de la section « Résolution de problèmes », SRD 5.2.1 p. 213.
  if (count > 2 * players) warnings.push("Plus de deux créatures par personnage : le SRD conseille d’inclure des monstres fragiles, rapides à éliminer, surtout aux niveaux 1 et 2 (p. 213).");
  const strong = picks.filter((p) => p.creature.crValue > level);
  if (strong.length)
    warnings.push(
      `FP supérieur au niveau du groupe (${strong.map((p) => `${p.creature.name}, FP ${p.creature.cr}`).join(" ; ")}) : une seule action peut mettre un ou plusieurs personnages hors de combat (p. 213).`,
    );
  if (picks.length > 3) warnings.push("Plus de trois profils différents : le SRD signale que c’est vite rébarbatif à mener (p. 213).");
  return { budget: b(difficulty), total, reached, warnings };
}

export function renderEncounter(picks: Pick[], unknown: string[], level: number, players: number, difficulty: Difficulty): string {
  const r = evaluate(picks, level, players, difficulty);
  const lines = [
    `**Rencontre de difficulté ${DIFFICULTY_LABELS[difficulty]}** pour ${players} personnage(s) de niveau ${level} : budget de **${r.budget} PX**.`,
    `Budgets : faible ${budget(level, players, "faible")}, modérée ${budget(level, players, "moderee")}, élevée ${budget(level, players, "elevee")} PX (SRD 5.2.1, p. 213).`,
    "",
    ...picks.map((p) => `• ${p.count} × ${p.creature.name} (FP ${p.creature.cr}, ${p.creature.xp} PX) = ${p.count * p.creature.xp} PX, SRD p. ${p.creature.page}`),
    "",
    `Total : **${r.total} PX**. ${
      r.total <= r.budget
        ? `Dans le budget (reste ${r.budget - r.total} PX).`
        : `Dépasse le budget de ${r.total - r.budget} PX.`
    } ${
      r.reached === "au-dela"
        ? "Au-delà du budget de difficulté élevée."
        : r.reached === "sous"
          ? ""
          : `Difficulté atteinte : ${DIFFICULTY_LABELS[r.reached]}.`
    }`,
  ];
  if (unknown.length) lines.push(`Non trouvé dans le SRD : ${unknown.join(", ")}. Vérifie l’orthographe (l’autocomplétion propose les noms).`);
  if (r.warnings.length) lines.push("", ...r.warnings.map((w) => `Attention : ${w}`));
  return lines.join("\n");
}
