import { ButtonBuilder, ButtonStyle } from "discord.js";

/**
 * Site web de la table (création de personnage plus simple, fiches, outils).
 * Facultatif : sans SITE_URL, le bot fonctionne comme avant, sans aucun lien.
 */
export function siteUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env["SITE_URL"]?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Bouton-lien Discord vers une page du site, ou null si le site n'est pas configuré. */
export function siteButton(label: string, path: string, base: string | null = siteUrl()): ButtonBuilder | null {
  if (!base) return null;
  return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(`${base}${path}`);
}
