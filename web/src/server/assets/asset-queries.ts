import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AssetSort, LibraryFilters } from "@/lib/library-filters";
import { searchTerms } from "@/lib/search/normalize";
import { getDb } from "../db";

export const GALLERY_PAGE_SIZE = 48;

/** Champs nécessaires à une vignette : jamais le fichier lui-même. */
export const assetCardSelect = {
  id: true,
  title: true,
  width: true,
  height: true,
  dominantColor: true,
  isFavorite: true,
  origin: true,
} satisfies Prisma.AssetSelect;

export type AssetCard = Prisma.AssetGetPayload<{ select: typeof assetCardSelect }>;

function startOfDayUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function buildAssetWhere(filters: LibraryFilters): Prisma.AssetWhereInput {
  const and: Prisma.AssetWhereInput[] = [];
  for (const term of searchTerms(filters.q)) {
    and.push({ searchText: { contains: term } });
  }
  for (const tagId of filters.tagIds) {
    and.push({ tags: { some: { tagId } } });
  }
  if (filters.categoryId) and.push({ categoryId: filters.categoryId });
  if (filters.collectionId) and.push({ collections: { some: { collectionId: filters.collectionId } } });
  if (filters.favorite) and.push({ isFavorite: true });
  if (filters.origin) and.push({ origin: filters.origin });
  if (filters.importedFrom) and.push({ createdAt: { gte: startOfDayUtc(filters.importedFrom) } });
  if (filters.importedTo) {
    const nextDay = startOfDayUtc(filters.importedTo);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    and.push({ createdAt: { lt: nextDay } });
  }
  return and.length > 0 ? { AND: and } : {};
}

/** L'identifiant termine chaque tri pour un ordre total et stable entre deux pages. */
export function buildAssetOrderBy(sort: AssetSort): Prisma.AssetOrderByWithRelationInput[] {
  switch (sort) {
    case "imported-asc":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "title-asc":
      return [{ title: "asc" }, { id: "asc" }];
    case "title-desc":
      return [{ title: "desc" }, { id: "desc" }];
    case "created-desc":
      return [{ creationDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }];
    case "created-asc":
      return [{ creationDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }];
    case "imported-desc":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

export async function listAssets(
  filters: LibraryFilters,
  page: { offset: number; limit?: number },
): Promise<{ items: AssetCard[]; total: number }> {
  const db = getDb();
  const where = buildAssetWhere(filters);
  const [items, total] = await Promise.all([
    db.asset.findMany({
      where,
      orderBy: buildAssetOrderBy(filters.sort),
      skip: page.offset,
      take: page.limit ?? GALLERY_PAGE_SIZE,
      select: assetCardSelect,
    }),
    db.asset.count({ where }),
  ]);
  return { items, total };
}

/** Plafond de la navigation précédente/suivante dans une vue filtrée. */
const NEIGHBOR_SCAN_LIMIT = 10_000;

/**
 * Illustrations précédente et suivante dans la vue filtrée courante.
 * Ne lit que les identifiants, dans l'ordre de tri : quelques dizaines de Ko
 * même pour une grande bibliothèque.
 */
export async function getAssetNeighbors(filters: LibraryFilters, assetId: string) {
  const ids = await getDb().asset.findMany({
    where: buildAssetWhere(filters),
    orderBy: buildAssetOrderBy(filters.sort),
    take: NEIGHBOR_SCAN_LIMIT,
    select: { id: true },
  });
  const index = ids.findIndex((row) => row.id === assetId);
  if (index === -1) return { previousId: null, nextId: null, position: null, total: ids.length };
  return {
    previousId: ids[index - 1]?.id ?? null,
    nextId: ids[index + 1]?.id ?? null,
    position: index + 1,
    total: ids.length,
  };
}

export async function getAssetDetail(id: string) {
  return getDb().asset.findUnique({
    where: { id },
    select: {
      ...assetCardSelect,
      description: true,
      notes: true,
      artistName: true,
      sourceUrl: true,
      creationDate: true,
      originalFilename: true,
      mimeType: true,
      byteSize: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      tags: { orderBy: { tag: { name: "asc" } }, select: { tag: { select: { id: true, name: true } } } },
      collections: {
        orderBy: { collection: { name: "asc" } },
        select: { collection: { select: { id: true, name: true } } },
      },
      characterLinks: {
        select: { validated: true, character: { select: { id: true, name: true } } },
      },
      styleGuideLinks: { select: { aspects: true, styleGuide: { select: { id: true, name: true } } } },
      generationResult: { select: { id: true, title: true, status: true } },
      _count: { select: { briefReferences: true, generationReferences: true, battleMaps: true } },
    },
  });
}

export type AssetDetail = NonNullable<Awaited<ReturnType<typeof getAssetDetail>>>;

/** Recherche légère pour le sélecteur de références (dialogue). */
export async function searchAssetsForPicker(query: string, offset: number, limit = 36) {
  return listAssets({ q: query, tagIds: [], favorite: false, sort: "imported-desc" }, { offset, limit });
}

/** Illustrations à comparer, dans l'ordre demandé. */
export async function getAssetsForComparison(ids: string[]) {
  const assets = await getDb().asset.findMany({
    where: { id: { in: ids } },
    select: {
      ...assetCardSelect,
      artistName: true,
      category: { select: { name: true } },
      tags: { orderBy: { tag: { name: "asc" } }, select: { tag: { select: { name: true } } } },
    },
  });
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

export async function getAssetFileKeys(id: string) {
  return getDb().asset.findUnique({
    where: { id },
    select: { originalKey: true, thumbnailKey: true, previewKey: true, mimeType: true, originalFilename: true },
  });
}

export async function getLibraryStats() {
  const db = getDb();
  const [assets, favorites, collections, characters, generations, styleGuides] = await Promise.all([
    db.asset.count(),
    db.asset.count({ where: { isFavorite: true } }),
    db.collection.count(),
    db.character.count(),
    db.generationRecord.count(),
    db.styleGuide.count(),
  ]);
  return { assets, favorites, collections, characters, generations, styleGuides };
}
