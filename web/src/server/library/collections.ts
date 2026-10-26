import "server-only";
import { z } from "zod";
import { cleanOptional } from "@/lib/text";
import { getDb } from "../db";
import { NotFoundError } from "../errors";
import { refreshAssetSearchText } from "../search/asset-search-text";

export const collectionInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(120),
  description: z.string().max(4000).optional(),
});

export type CollectionInput = z.infer<typeof collectionInputSchema>;

export async function createCollection(input: CollectionInput) {
  return getDb().collection.create({
    data: { name: input.name, description: cleanOptional(input.description) },
    select: { id: true, name: true },
  });
}

export async function updateCollection(id: string, input: CollectionInput): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const updated = await tx.collection.updateMany({
      where: { id },
      data: { name: input.name, description: cleanOptional(input.description) },
    });
    if (updated.count === 0) throw new NotFoundError("Collection");
    const links = await tx.collectionAsset.findMany({ where: { collectionId: id }, select: { assetId: true } });
    await refreshAssetSearchText(
      tx,
      links.map((link) => link.assetId),
    );
  });
}

/** Supprime la collection, jamais les illustrations qu'elle regroupe. */
export async function deleteCollection(id: string): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const links = await tx.collectionAsset.findMany({ where: { collectionId: id }, select: { assetId: true } });
    const deleted = await tx.collection.deleteMany({ where: { id } });
    if (deleted.count === 0) throw new NotFoundError("Collection");
    await refreshAssetSearchText(
      tx,
      links.map((link) => link.assetId),
    );
  });
}

export async function addAssetsToCollection(collectionId: string, assetIds: readonly string[]): Promise<number> {
  return getDb().$transaction(async (tx) => {
    const exists = await tx.collection.count({ where: { id: collectionId } });
    if (!exists) throw new NotFoundError("Collection");
    const result = await tx.collectionAsset.createMany({
      data: assetIds.map((assetId) => ({ collectionId, assetId })),
      skipDuplicates: true,
    });
    await refreshAssetSearchText(tx, assetIds);
    return result.count;
  });
}

export async function removeAssetsFromCollection(collectionId: string, assetIds: readonly string[]): Promise<number> {
  return getDb().$transaction(async (tx) => {
    const result = await tx.collectionAsset.deleteMany({
      where: { collectionId, assetId: { in: [...assetIds] } },
    });
    await tx.collection.updateMany({
      where: { id: collectionId, coverAssetId: { in: [...assetIds] } },
      data: { coverAssetId: null },
    });
    await refreshAssetSearchText(tx, assetIds);
    return result.count;
  });
}

export async function setCollectionCover(collectionId: string, assetId: string | null): Promise<void> {
  if (assetId) {
    const member = await getDb().collectionAsset.count({ where: { collectionId, assetId } });
    if (!member) throw new NotFoundError("Illustration dans cette collection");
  }
  await getDb().collection.update({ where: { id: collectionId }, data: { coverAssetId: assetId } });
}

export async function markCollectionViewed(collectionId: string): Promise<void> {
  await getDb().collection.updateMany({ where: { id: collectionId }, data: { lastViewedAt: new Date() } });
}

/** Collections avec une vignette : la couverture choisie, sinon la dernière image ajoutée. */
export async function listCollections(options: { orderBy?: "name" | "recent"; take?: number } = {}) {
  const collections = await getDb().collection.findMany({
    orderBy:
      options.orderBy === "recent"
        ? [{ lastViewedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }]
        : { name: "asc" },
    take: options.take,
    where: options.orderBy === "recent" ? { lastViewedAt: { not: null } } : undefined,
    select: {
      id: true,
      name: true,
      description: true,
      lastViewedAt: true,
      coverAsset: { select: { id: true, dominantColor: true } },
      assets: {
        orderBy: { addedAt: "desc" },
        take: 1,
        select: { asset: { select: { id: true, dominantColor: true } } },
      },
      _count: { select: { assets: true } },
    },
  });
  return collections.map(({ assets, coverAsset, ...collection }) => ({
    ...collection,
    cover: coverAsset ?? assets[0]?.asset ?? null,
  }));
}

export async function listCollectionOptions() {
  return getDb().collection.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function getCollection(id: string) {
  return getDb().collection.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      coverAssetId: true,
      createdAt: true,
      _count: { select: { assets: true } },
    },
  });
}
