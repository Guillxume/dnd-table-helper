/**
 * Règles d'import partagées entre le navigateur (retour immédiat) et le serveur
 * (seul juge). Le serveur revérifie tout, y compris le contenu réel du fichier.
 */
export const ACCEPTED_IMAGE_TYPES = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
} as const satisfies Record<string, readonly string[]>;

export type AcceptedMimeType = keyof typeof ACCEPTED_IMAGE_TYPES;

export const ACCEPT_ATTRIBUTE = [
  ...Object.keys(ACCEPTED_IMAGE_TYPES),
  ...Object.values(ACCEPTED_IMAGE_TYPES)
    .flat()
    .map((extension) => `.${extension}`),
].join(",");

/** Plus grand côté accepté, garde-fou contre les images « bombes » de décompression. */
export const MAX_IMAGE_DIMENSION = 20_000;
export const MAX_IMAGE_PIXELS = 150_000_000;

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function isAcceptedMimeType(value: string): value is AcceptedMimeType {
  return Object.hasOwn(ACCEPTED_IMAGE_TYPES, value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
