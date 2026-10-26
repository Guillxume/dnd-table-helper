/** Thème d'affichage : sombre « taverne » (par défaut) ou clair « parchemin ». Choix mémorisé dans un cookie. */
export type Theme = "dark" | "light";

export const THEME_COOKIE = "theme";

/** Valeur du cookie, ou thème par défaut si elle est absente ou inconnue. */
export function parseTheme(value: string | undefined): Theme {
  return value === "light" ? "light" : "dark";
}
