import { normalizeForSearch } from "./search/normalize";

/** Identifiant d'URL lisible : « Fiches de personnages » → « fiches-de-personnages ». */
export function slugify(input: string): string {
  return normalizeForSearch(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Espaces superflus retirés ; chaîne vide → null (« inconnu » reste inconnu). */
export function cleanOptional(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Titre par défaut d'une illustration : nom de fichier sans extension, séparateurs remplacés. */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const title = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (title || "Sans titre").slice(0, 200);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("fr-FR")} ${count > 1 ? plural : singular}`;
}
