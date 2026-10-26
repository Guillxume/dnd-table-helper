import "server-only";
import { getDb } from "../db";

/** Listes de choix des filtres et des formulaires de la bibliothèque. */
export async function getLibraryOptions() {
  const db = getDb();
  const [categories, collections, tags] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.collection.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { categories, collections, tags };
}
