import Database from "better-sqlite3";
import chunksJson from "./data/srd-chunks.json" with { type: "json" };

/** Extrait du SRD 5.2.1 (texte brut du PDF, découpé par scripts/srd/build_chunks.py). */
export interface SrdChunk {
  id: number;
  title: string;
  kind: "règle" | "créature";
  page: number;
  text: string;
}

const CHUNKS = chunksJson as unknown as SrdChunk[];

const STOP = new Set(
  "a au aux avec ce ces cet cette dans de des du elle en et eux il ils je la le les leur leurs lui ma mais me mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous y est sont doit doivent faire fait peut peuvent etre être avoir ont plus moins très tres tout tous toute toutes comme dont où ou alors aussi bien encore entre puis sans sous vers chez lors après avant pendant depuis quand ainsi donc car si leur héros heros joueurs joueur groupe personnages personnage séance seance mj scène scene rencontre pnj idée idee niveau ex exemple".split(" "),
);

let db: Database.Database | undefined;

function index(): Database.Database {
  if (db) return db;
  db = new Database(":memory:");
  db.exec("CREATE VIRTUAL TABLE chunks USING fts5(title, body, kind UNINDEXED, page UNINDEXED, tokenize = 'unicode61 remove_diacritics 2')");
  const insert = db.prepare("INSERT INTO chunks (rowid, title, body, kind, page) VALUES (?, ?, ?, ?, ?)");
  db.transaction(() => {
    for (const c of CHUNKS) insert.run(c.id, c.title, c.text, c.kind, c.page);
  })();
  return db;
}

/** Mots utiles d'une demande, en requête FTS5 (préfixes pour couvrir pluriels et accords). */
export function searchQuery(text: string): string {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
  const uniq = [...new Set(words)].slice(0, 24);
  // Préfixe sans la marque du pluriel (« loups » → loup*), pour retrouver singulier, pluriel et dérivés.
  return uniq
    .map((w) => {
      const base = w.replace(/(es|s|x)$/, "");
      return base.length >= 4 ? `${base}*` : `"${w}"`;
    })
    .join(" OR ");
}

export interface SearchOptions {
  limit?: number;
  /** Nombre maximal de caractères renvoyés au total. */
  budget?: number;
}

/** Extraits du SRD les plus pertinents pour un texte libre (classement BM25, titres favorisés). */
export function searchSrd(text: string, opts: SearchOptions = {}): SrdChunk[] {
  const q = searchQuery(text);
  if (!q) return [];
  const rows = index()
    .prepare("SELECT rowid AS id FROM chunks WHERE chunks MATCH ? ORDER BY bm25(chunks, 8.0, 1.0) LIMIT ?")
    .all(q, (opts.limit ?? 6) * 2) as { id: number }[];
  const out: SrdChunk[] = [];
  let used = 0;
  const budget = opts.budget ?? 9000;
  for (const r of rows) {
    const c = CHUNKS[r.id];
    if (!c || out.some((o) => o.id === c.id)) continue;
    if (used + c.text.length > budget && out.length > 0) continue;
    out.push(c);
    used += c.text.length;
    if (out.length >= (opts.limit ?? 6)) break;
  }
  return out;
}

export function formatChunks(chunks: SrdChunk[]): string {
  return chunks.map((c) => `[SRD p. ${c.page} · ${c.title}${c.kind === "créature" ? " (créature)" : ""}]\n${c.text}`).join("\n\n");
}
