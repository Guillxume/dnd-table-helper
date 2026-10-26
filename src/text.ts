/** Limite documentée par Discord pour le contenu d'un message : 2000 caractères. */
export const DISCORD_MESSAGE_LIMIT = 2000;

/** Découpe un texte en messages de longueur limitée, de préférence aux sauts de ligne ou aux espaces. */
export function splitMessage(text: string, limit: number = DISCORD_MESSAGE_LIMIT): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const index = cut > 0 ? cut : limit;
    chunks.push(rest.slice(0, index).trimEnd());
    rest = rest.slice(index).trimStart();
  }
  if (rest.length > 0) {
    chunks.push(rest);
  }
  return chunks;
}
