import "server-only";
import { z } from "zod";
import { AssetOrigin } from "@/generated/prisma/enums";
import { cleanOptional } from "@/lib/text";
import { getDb } from "../db";
import { logError, NotFoundError } from "../errors";
import { assertCategoryExists } from "../library/categories";
import { refreshAssetSearchText } from "../search/asset-search-text";
import { getStorage } from "../storage";

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === "" || /^https?:\/\//i.test(value), "L'URL doit commencer par http:// ou https://.");

export const assetMetadataSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(200),
  description: z.string().max(10_000).optional(),
  notes: z.string().max(10_000).optional(),
  artistName: z.string().max(200).optional(),
  sourceUrl: optionalUrl.optional(),
  origin: z.enum(AssetOrigin),
  categoryId: z.union([z.uuid(), z.literal("")]).optional(),
  creationDate: z.union([z.iso.date(), z.literal("")]).optional(),
});

export type AssetMetadataInput = z.infer<typeof assetMetadataSchema>;

export async function updateAssetMetadata(id: string, input: AssetMetadataInput): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const categoryId = input.categoryId || null;
    await assertCategoryExists(tx, categoryId);
    const updated = await tx.asset.updateMany({
      where: { id },
      data: {
        title: input.title,
        description: cleanOptional(input.description),
        notes: cleanOptional(input.notes),
        artistName: cleanOptional(input.artistName),
        sourceUrl: cleanOptional(input.sourceUrl),
        origin: input.origin,
        categoryId,
        creationDate: input.creationDate ? new Date(`${input.creationDate}T00:00:00.000Z`) : null,
      },
    });
    if (updated.count === 0) throw new NotFoundError("Illustration");
    await refreshAssetSearchText(tx, [id]);
  });
}

export async function setAssetsFavorite(ids: readonly string[], isFavorite: boolean): Promise<number> {
  const result = await getDb().asset.updateMany({ where: { id: { in: [...ids] } }, data: { isFavorite } });
  return result.count;
}

export async function setAssetsCategory(ids: readonly string[], categoryId: string | null): Promise<number> {
  return getDb().$transaction(async (tx) => {
    await assertCategoryExists(tx, categoryId);
    const result = await tx.asset.updateMany({ where: { id: { in: [...ids] } }, data: { categoryId } });
    await refreshAssetSearchText(tx, ids);
    return result.count;
  });
}

/** Ce que la suppression va détacher, affiché dans la confirmation. */
export async function getAssetUsage(ids: readonly string[]) {
  const db = getDb();
  const where = { assetId: { in: [...ids] } };
  const [collections, characters, styleGuides, briefs, generationReferences, generationResults, battleMaps] = await Promise.all([
    db.collectionAsset.count({ where }),
    db.characterAsset.count({ where }),
    db.styleGuideAsset.count({ where }),
    db.briefReference.count({ where }),
    db.generationReference.count({ where }),
    db.generationRecord.count({ where }),
    db.battleMap.count({ where }),
  ]);
  return { collections, characters, styleGuides, briefs, generationReferences, generationResults, battleMaps };
}

/**
 * Supprime les illustrations puis leurs fichiers.
 *
 * La base est la source de vérité : les lignes sont supprimées d'abord, en
 * transaction. Si la suppression des fichiers échoue ensuite, il reste des
 * fichiers orphelins (sans conséquence fonctionnelle, à nettoyer avec
 * `pnpm storage:orphans`) plutôt que des lignes pointant vers des fichiers absents.
 */
export async function deleteAssets(ids: readonly string[]): Promise<number> {
  const db = getDb();
  const assets = await db.asset.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, originalKey: true, thumbnailKey: true, previewKey: true },
  });
  if (assets.length === 0) return 0;

  await db.asset.deleteMany({ where: { id: { in: assets.map((asset) => asset.id) } } });

  const keys = assets.flatMap((asset) => [asset.originalKey, asset.thumbnailKey, asset.previewKey]);
  try {
    await getStorage().deleteMany(keys);
  } catch (error) {
    logError("assets:delete-files", error);
  }
  return assets.length;
}
