import "server-only";
import { assetCardSelect, getLibraryStats } from "./assets/asset-queries";
import { getDb } from "./db";
import { listCollections } from "./library/collections";
import { listGenerations } from "./generations/generations";

export async function getDashboard() {
  const db = getDb();
  const [stats, recent, favorites, collections, generations, categories, briefs] = await Promise.all([
    getLibraryStats(),
    db.asset.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 12, select: assetCardSelect }),
    db.asset.findMany({ where: { isFavorite: true }, orderBy: { updatedAt: "desc" }, take: 8, select: assetCardSelect }),
    listCollections({ orderBy: "recent", take: 6 }),
    listGenerations({}, 6),
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, _count: { select: { assets: true } } },
    }),
    db.brief.count(),
  ]);
  return { stats: { ...stats, briefs }, recent, favorites, collections, generations, categories };
}
