import type { DbClient } from "../db";

/**
 * Recalcule `Asset.searchText` pour les illustrations données.
 *
 * Le texte agrège les champs de l'illustration et les noms des objets liés
 * (catégorie, tags, collections, personnages). Il est dénormalisé pour que la
 * recherche reste une seule condition indexée (GIN trigrammes) au lieu de
 * jointures multiples. Contrepartie : toute mutation qui change l'un de ces
 * textes doit appeler cette fonction pour les illustrations concernées.
 */
export async function refreshAssetSearchText(db: DbClient, assetIds: readonly string[]): Promise<void> {
  if (assetIds.length === 0) return;
  const ids = [...new Set(assetIds)];
  await db.$executeRaw`
    UPDATE "Asset" AS a
    SET "searchText" = jdr_normalize(concat_ws(' ',
      a."title",
      a."description",
      a."notes",
      a."artistName",
      a."originalFilename",
      a."sourceUrl",
      (SELECT c."name" FROM "Category" c WHERE c."id" = a."categoryId"),
      (SELECT string_agg(t."name", ' ')
         FROM "AssetTag" at JOIN "Tag" t ON t."id" = at."tagId"
        WHERE at."assetId" = a."id"),
      (SELECT string_agg(co."name", ' ')
         FROM "CollectionAsset" ca JOIN "Collection" co ON co."id" = ca."collectionId"
        WHERE ca."assetId" = a."id"),
      (SELECT string_agg(ch."name", ' ')
         FROM "CharacterAsset" cha JOIN "Character" ch ON ch."id" = cha."characterId"
        WHERE cha."assetId" = a."id"),
      (SELECT string_agg(ch."name", ' ')
         FROM "GenerationRecord" g JOIN "Character" ch ON ch."id" = g."characterId"
        WHERE g."assetId" = a."id")
    ))
    WHERE a."id" = ANY(${ids}::uuid[])
  `;
}
