import chunksJson from "./data/srd-chunks.json" with { type: "json" };
import type { SrdChunk } from "./search.js";

/** Créature du SRD 5.2.1 avec son facteur de puissance et ses PX, lus dans son bloc de statistiques. */
export interface Creature {
  name: string;
  /** Facteur de puissance tel qu'écrit dans le SRD (« 1/4 », « 10 »). */
  cr: string;
  /** Valeur numérique du FP (1/4 → 0,25), pour comparer au niveau du groupe. */
  crValue: number;
  xp: number;
  page: number;
  text: string;
}

export const normName = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const toNumber = (s: string) => Number(s.replace(/[\s  ]/g, ""));

/** « FP 10 (5 900 PX… » ou « FP 14 (PX 11 500… ». Les créatures invoquées (« FP aucun ») sont écartées. */
const CR_RE = /FP (\d+(?:\/\d+)?) \((?:([\d\s  ]+) PX|PX ([\d\s  ]+))/;

export function parseCreature(c: SrdChunk): Creature | undefined {
  const m = CR_RE.exec(c.text);
  if (!m) return undefined;
  const cr = m[1]!;
  const [num, den] = cr.split("/").map(Number);
  return { name: c.title, cr, crValue: den ? num! / den : num!, xp: toNumber(m[2] ?? m[3] ?? "0"), page: c.page, text: c.text };
}

let cache: Creature[] | undefined;

export function creatures(): Creature[] {
  cache ??= (chunksJson as unknown as SrdChunk[])
    .filter((c) => c.kind === "créature")
    .flatMap((c) => parseCreature(c) ?? [])
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return cache;
}

export type CreatureMatch = { creature: Creature } | { candidates: Creature[] };

/**
 * Retrouve une créature par son nom, au singulier ou au pluriel (« loups », « combattants gobelins »).
 * Un nom ambigu (« gobelin » : chef, combattant, sbire) renvoie les candidats au lieu d'en choisir un.
 */
export function matchCreature(query: string): CreatureMatch {
  const q = normName(query);
  if (!q) return { candidates: [] };
  const all = creatures();
  const singular = q
    .split(" ")
    .map((w) => (w.length > 3 ? w.replace(/(s|x)$/, "") : w))
    .join(" ");
  const exact = all.find((c) => normName(c.name) === q) ?? all.find((c) => normName(c.name) === singular);
  if (exact) return { creature: exact };
  for (const test of [
    (n: string) => n.startsWith(singular),
    (n: string) => new RegExp(`(^| )${singular.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(n),
  ]) {
    const found = all.filter((c) => test(normName(c.name)));
    if (found.length === 1) return { creature: found[0]! };
    if (found.length > 1) return { candidates: found };
  }
  return { candidates: [] };
}

export function findCreature(query: string): Creature | undefined {
  const m = matchCreature(query);
  return "creature" in m ? m.creature : undefined;
}

/** Noms pour l'autocomplétion (25 au plus). */
export function searchCreatures(query: string, limit = 25): Creature[] {
  const q = normName(query);
  const all = creatures();
  if (!q) return all.slice(0, limit);
  const starts = all.filter((c) => normName(c.name).startsWith(q));
  const contains = all.filter((c) => !normName(c.name).startsWith(q) && normName(c.name).includes(q));
  return [...starts, ...contains].slice(0, limit);
}
