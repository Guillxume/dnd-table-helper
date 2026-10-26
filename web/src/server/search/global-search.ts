import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { escapeLike, searchTerms } from "@/lib/search/normalize";
import { type AssetCard, listAssets } from "../assets/asset-queries";
import { getDb } from "../db";

/**
 * Recherche transverse. Les illustrations (potentiellement nombreuses) passent
 * par la colonne indexée `searchText` ; les autres entités, peu volumineuses,
 * sont filtrées à la volée avec la même normalisation `jdr_normalize`.
 */
function matchAll(expression: Prisma.Sql, terms: string[]): Prisma.Sql {
  return Prisma.join(
    terms.map((term) => Prisma.sql`jdr_normalize(${expression}) LIKE ${`%${escapeLike(term)}%`}`),
    " AND ",
  );
}

export type GlobalSearchResults = {
  terms: string[];
  assets: { items: AssetCard[]; total: number };
  characters: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  generations: { id: string; title: string; status: string }[];
  briefs: { id: string; title: string }[];
  tags: { id: string; name: string }[];
};

const LIMIT = 20;

export async function globalSearch(query: string): Promise<GlobalSearchResults> {
  const terms = searchTerms(query);
  const empty = { items: [], total: 0 };
  if (terms.length === 0) {
    return { terms, assets: empty, characters: [], collections: [], generations: [], briefs: [], tags: [] };
  }
  const db = getDb();

  const [assets, characters, collections, generations, briefs, tags] = await Promise.all([
    listAssets({ q: query, tagIds: [], favorite: false, sort: "imported-desc" }, { offset: 0, limit: 24 }),
    db.$queryRaw<{ id: string; name: string }[]>`
      SELECT c."id", c."name" FROM "Character" c
      WHERE ${matchAll(
        Prisma.sql`concat_ws(' ', c."name", c."summary", c."species", c."characterClass", c."specialization",
          c."silhouette", c."face", c."hairSkin", c."outfit", c."equipment", c."palette", c."symbols",
          c."personality", c."visualHistory", c."notes")`,
        terms,
      )}
      ORDER BY c."name" LIMIT ${LIMIT}`,
    db.$queryRaw<{ id: string; name: string }[]>`
      SELECT co."id", co."name" FROM "Collection" co
      WHERE ${matchAll(Prisma.sql`concat_ws(' ', co."name", co."description")`, terms)}
      ORDER BY co."name" LIMIT ${LIMIT}`,
    db.$queryRaw<{ id: string; title: string; status: string }[]>`
      SELECT g."id", g."title", g."status"::text AS "status" FROM "GenerationRecord" g
      LEFT JOIN "Character" ch ON ch."id" = g."characterId"
      WHERE ${matchAll(Prisma.sql`concat_ws(' ', g."title", g."prompt", g."revisionNotes", g."tool", ch."name")`, terms)}
      ORDER BY g."createdAt" DESC LIMIT ${LIMIT}`,
    db.$queryRaw<{ id: string; title: string }[]>`
      SELECT b."id", b."title" FROM "Brief" b
      WHERE ${matchAll(Prisma.sql`concat_ws(' ', b."title", b."objective", b."imageType", b."prompt")`, terms)}
      ORDER BY b."updatedAt" DESC LIMIT ${LIMIT}`,
    db.$queryRaw<{ id: string; name: string }[]>`
      SELECT t."id", t."name" FROM "Tag" t
      WHERE ${matchAll(Prisma.sql`t."name"`, terms)}
      ORDER BY t."name" LIMIT ${LIMIT}`,
  ]);

  return { terms, assets, characters, collections, generations, briefs, tags };
}
