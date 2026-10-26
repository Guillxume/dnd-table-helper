import "server-only";
import { randomUUID } from "node:crypto";
import type { AssetOrigin } from "@/generated/prisma/enums";
import { titleFromFilename } from "@/lib/text";
import { getDb } from "../db";
import { DomainError, isUniqueViolation, logError } from "../errors";
import { getUploadMaxBytes } from "../env";
import { ImageProcessingError, processImage, sha256 } from "../images/process-image";
import { validateUpload } from "../images/validate-upload";
import { assertCategoryExists } from "../library/categories";
import { findOrCreateTags } from "../library/tags";
import { refreshAssetSearchText } from "../search/asset-search-text";
import { assetObjectKeys, getStorage } from "../storage";

export type ImportAssetInput = {
  filename: string;
  declaredType: string;
  bytes: Buffer;
  origin?: AssetOrigin;
  title?: string;
  categoryId?: string | null;
  collectionId?: string | null;
  tagNames?: string[];
};

export type ImportAssetResult =
  | { status: "created"; asset: { id: string; title: string } }
  | { status: "duplicate"; asset: { id: string; title: string } }
  | { status: "rejected"; reason: string };

/**
 * Importe une illustration : validation, déduplication, dérivés, stockage, base.
 *
 * Ordre choisi : fichiers d'abord, base ensuite. Une ligne en base pointe ainsi
 * toujours vers des fichiers existants ; si l'écriture en base échoue, les
 * fichiers déjà envoyés sont supprimés (compensation).
 */
export async function importAsset(input: ImportAssetInput): Promise<ImportAssetResult> {
  const db = getDb();
  const validation = validateUpload(
    { filename: input.filename, declaredType: input.declaredType, bytes: input.bytes },
    getUploadMaxBytes(),
  );
  if (!validation.ok) return { status: "rejected", reason: validation.reason };

  const hash = sha256(input.bytes);
  const existing = await db.asset.findUnique({ where: { sha256: hash }, select: { id: true, title: true } });
  if (existing) return { status: "duplicate", asset: existing };

  let processed;
  try {
    processed = await processImage(input.bytes);
  } catch (error) {
    if (error instanceof ImageProcessingError) return { status: "rejected", reason: error.message };
    throw error;
  }

  const id = randomUUID();
  const keys = assetObjectKeys(id, validation.extension);
  const storage = getStorage();
  const uploadedKeys: string[] = [];
  try {
    await storage.put(keys.originalKey, input.bytes, validation.mimeType);
    uploadedKeys.push(keys.originalKey);
    await storage.put(keys.thumbnailKey, processed.thumbnail, "image/webp");
    uploadedKeys.push(keys.thumbnailKey);
    await storage.put(keys.previewKey, processed.preview, "image/webp");
    uploadedKeys.push(keys.previewKey);

    const title = input.title?.trim().slice(0, 200) || titleFromFilename(input.filename);
    await db.$transaction(async (tx) => {
      await assertCategoryExists(tx, input.categoryId);
      await tx.asset.create({
        data: {
          id,
          title,
          origin: input.origin ?? "UNKNOWN",
          categoryId: input.categoryId ?? null,
          originalFilename: input.filename.slice(0, 255),
          mimeType: validation.mimeType,
          byteSize: input.bytes.byteLength,
          width: processed.width,
          height: processed.height,
          sha256: hash,
          dominantColor: processed.dominantColor,
          ...keys,
        },
      });
      if (input.tagNames?.length) {
        const tags = await findOrCreateTags(tx, input.tagNames);
        await tx.assetTag.createMany({ data: tags.map((tag) => ({ assetId: id, tagId: tag.id })) });
      }
      if (input.collectionId) {
        const collectionExists = await tx.collection.count({ where: { id: input.collectionId } });
        if (!collectionExists) throw new DomainError("La collection choisie n'existe plus.");
        await tx.collectionAsset.create({ data: { assetId: id, collectionId: input.collectionId } });
      }
      await refreshAssetSearchText(tx, [id]);
    });
    return { status: "created", asset: { id, title } };
  } catch (error) {
    await storage.deleteMany(uploadedKeys).catch((cleanupError) => logError("import:cleanup", cleanupError));
    // Deux imports simultanés du même fichier : le second perd la course sur l'index unique.
    if (isUniqueViolation(error)) {
      const winner = await db.asset.findUnique({ where: { sha256: hash }, select: { id: true, title: true } });
      if (winner) return { status: "duplicate", asset: winner };
    }
    if (error instanceof DomainError) return { status: "rejected", reason: error.message };
    throw error;
  }
}
