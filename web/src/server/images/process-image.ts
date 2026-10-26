import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS } from "@/lib/upload-rules";

export const THUMBNAIL_WIDTH = 640;
export const PREVIEW_MAX_SIZE = 2048;

export type ProcessedImage = {
  sha256: string;
  width: number;
  height: number;
  dominantColor: string;
  thumbnail: Buffer;
  preview: Buffer;
};

export class ImageProcessingError extends Error {}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0");
}

/**
 * Produit les dérivés affichables d'une illustration. L'original n'est jamais
 * modifié : il est stocké tel quel et reste la source de vérité.
 */
export async function processImage(bytes: Buffer): Promise<ProcessedImage> {
  const source = () =>
    sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "error" })
      // Applique l'orientation EXIF pour que miniature et aperçu soient droits.
      .rotate();

  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  } catch {
    throw new ImageProcessingError("Image illisible ou corrompue.");
  }
  if (!metadata.width || !metadata.height) {
    throw new ImageProcessingError("Dimensions de l'image introuvables.");
  }
  if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
    throw new ImageProcessingError(
      `Image trop grande (${metadata.width}×${metadata.height} px, maximum ${MAX_IMAGE_DIMENSION} px par côté).`,
    );
  }

  // Les orientations EXIF 5 à 8 échangent largeur et hauteur.
  const swapsAxes = (metadata.orientation ?? 1) >= 5;
  const width = swapsAxes ? metadata.height : metadata.width;
  const height = swapsAxes ? metadata.width : metadata.height;

  try {
    const [thumbnail, preview, stats] = await Promise.all([
      source()
        .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer(),
      source()
        .resize({
          width: PREVIEW_MAX_SIZE,
          height: PREVIEW_MAX_SIZE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer(),
      sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS }).stats(),
    ]);
    const { r, g, b } = stats.dominant;
    return {
      sha256: sha256(bytes),
      width,
      height,
      dominantColor: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      thumbnail,
      preview,
    };
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError("Le traitement de l'image a échoué (fichier corrompu ou format non pris en charge).");
  }
}
