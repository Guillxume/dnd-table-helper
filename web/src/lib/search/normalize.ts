/**
 * Normalisation des termes de recherche, alignée sur la fonction SQL
 * `jdr_normalize` (lower + unaccent) qui alimente `Asset.searchText`.
 * Un test d'intégration compare les deux sur un jeu de chaînes accentuées.
 */
const LIGATURES: Record<string, string> = {
  œ: "oe",
  Œ: "OE",
  æ: "ae",
  Æ: "AE",
  ß: "ss",
  ø: "o",
  Ø: "O",
  đ: "d",
  Đ: "D",
  ł: "l",
  Ł: "L",
  "’": "'",
  "‘": "'",
};

export function normalizeForSearch(input: string): string {
  return input
    .replace(/[œŒæÆßøØđĐłŁ’‘]/g, (char) => LIGATURES[char] ?? char)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export const MAX_SEARCH_TERMS = 8;
const MAX_TERM_LENGTH = 100;

/** Découpe une requête en termes normalisés ; tous doivent correspondre (ET). */
export function searchTerms(query: string | null | undefined): string[] {
  if (!query) return [];
  return normalizeForSearch(query)
    .split(/\s+/)
    .map((term) => term.trim().slice(0, MAX_TERM_LENGTH))
    .filter((term) => term.length > 0)
    .slice(0, MAX_SEARCH_TERMS);
}

/** Échappe les jokers LIKE pour une recherche de sous-chaîne littérale. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
