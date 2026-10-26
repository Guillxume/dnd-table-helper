/**
 * Dates des séances : fuseau de la campagne, saisie et affichage.
 * Sans discord.js : utilisé par le bot et par le site.
 */

/** Fuseau horaire des dates saisies par le MJ (variable CAMPAIGN_TIMEZONE, par défaut Europe/Paris). */
export const TIMEZONE = process.env.CAMPAIGN_TIMEZONE?.trim() || "Europe/Paris";
/** Le rappel part 24 heures avant le début de la séance. */
export const REMINDER_AHEAD_MS = 24 * 60 * 60 * 1000;

/** Décalage (ms) entre l'heure locale du fuseau et l'UTC à l'instant donné. */
function offsetAt(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Convertit une date et une heure locales du fuseau en instant UTC (gère le changement d'heure). */
export function localToUtc(y: number, m: number, d: number, h: number, min: number, timeZone = TIMEZONE): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let utc = guess - offsetAt(guess, timeZone);
  utc = guess - offsetAt(utc, timeZone);
  return new Date(utc);
}

export type ParseResult = { ok: true; date: Date } | { ok: false; error: string };

/**
 * Lit « JJ/MM/AAAA » ou « JJ/MM » (l'année la plus proche dans le futur) et « 20:30 », « 20h30 » ou « 20h ».
 * Refuse une date passée.
 */
export function parseSessionDate(dateText: string, timeText: string, now = new Date(), timeZone = TIMEZONE): ParseResult {
  const dm = /^\s*(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\s*$/.exec(dateText);
  if (!dm) return { ok: false, error: "Date illisible : écris-la sous la forme JJ/MM/AAAA, par exemple 04/11/2026." };
  const tm = /^\s*(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?\s*$/i.exec(timeText);
  if (!tm) return { ok: false, error: "Heure illisible : écris-la sous la forme 20:30 ou 20h30." };
  const d = Number(dm[1]);
  const m = Number(dm[2]);
  const h = Number(tm[1]);
  const min = Number(tm[2] ?? 0);
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) return { ok: false, error: "Date ou heure impossible." };
  let y = dm[3] ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : Number(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(now));
  let date = localToUtc(y, m, d, h, min, timeZone);
  if (!dm[3] && date.getTime() <= now.getTime()) {
    y += 1;
    date = localToUtc(y, m, d, h, min, timeZone);
  }
  // Une date comme le 31/02 déborde sur le mois suivant : on la refuse.
  const check = new Intl.DateTimeFormat("fr-FR", { timeZone, day: "numeric", month: "numeric" }).formatToParts(date);
  if (Number(check.find((p) => p.type === "day")?.value) !== d || Number(check.find((p) => p.type === "month")?.value) !== m)
    return { ok: false, error: "Cette date n’existe pas." };
  if (date.getTime() <= now.getTime()) return { ok: false, error: "Cette date est déjà passée." };
  return { ok: true, date };
}

/** « mardi 4 novembre 2026 à 20:30 » dans le fuseau de la campagne. */
export function formatLocal(date: Date, timeZone = TIMEZONE): string {
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day} à ${time}`;
}

/** Horodatage Discord : chaque personne le voit dans son propre fuseau. */
export const discordTime = (date: Date) => {
  const t = Math.floor(date.getTime() / 1000);
  return `<t:${t}:F> (<t:${t}:R>)`;
};
