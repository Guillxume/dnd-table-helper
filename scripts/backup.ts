/** Sauvegarde cohérente de la base SQLite (même bot en marche), vérification de la copie et suppression des copies
 * de plus de 14 jours. Usage : npm run backup  (variables : DB_PATH, BACKUP_DIR, BACKUP_KEEP_DAYS) */
import Database from "better-sqlite3";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const dbPath = process.env.DB_PATH?.trim() || "./data/jdr.sqlite";
const dir = process.env.BACKUP_DIR?.trim() || "./backups";
// Une valeur vide ou invalide garde 14 jours (Number("") vaut 0 et effacerait la copie qu'on vient de faire).
const requested = Number(process.env.BACKUP_KEEP_DAYS?.trim() || 14);
const keepDays = Number.isFinite(requested) && requested >= 1 ? requested : 14;
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const target = join(dir, `jdr-${stamp}.sqlite`);
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
await db.backup(target);
db.close();

// Une copie illisible ne doit pas passer pour une sauvegarde : on la vérifie avant de supprimer les anciennes.
// La copie hérite du mode WAL de la base : on la repasse en journal classique pour qu'elle tienne en un seul
// fichier (sans -wal ni -shm à côté, que le nettoyage ci-dessous ne supprimerait pas).
const copy = new Database(target);
copy.pragma("journal_mode = DELETE");
const check = copy.pragma("integrity_check", { simple: true });
copy.close();
if (check !== "ok") {
  console.error(`Sauvegarde ${target} corrompue (integrity_check : ${String(check)}). Anciennes copies conservées.`);
  process.exit(1);
}

const limit = Date.now() - keepDays * 24 * 3600 * 1000;
for (const f of readdirSync(dir)) {
  const p = join(dir, f);
  if (f.startsWith("jdr-") && f.endsWith(".sqlite") && p !== target && statSync(p).mtimeMs < limit) unlinkSync(p);
}
console.log(`Sauvegarde vérifiée : ${target} (copies conservées ${keepDays} jours)`);
