/**
 * Dates affichées dans le fuseau de l'utilisateur, indépendamment du fuseau
 * du serveur (un conteneur tourne en UTC).
 */
export const DISPLAY_TIME_ZONE = "Europe/Paris";

export function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: DISPLAY_TIME_ZONE });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: DISPLAY_TIME_ZONE });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: DISPLAY_TIME_ZONE });
}
