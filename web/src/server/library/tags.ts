import "server-only";
import { normalizeForSearch } from "@/lib/search/normalize";
import { getDb, type DbClient } from "../db";
import { DomainError, isUniqueViolation, NotFoundError } from "../errors";
import { refreshAssetSearchText } from "../search/asset-search-text";

export const MAX_TAG_LENGTH = 60;

export function cleanTagName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH);
}

export function normalizeTagName(name: string): string {
  return normalizeForSearch(cleanTagName(name));
}

/** Retrouve ou crée les tags par nom (insensible à la casse et aux accents). */
export async function findOrCreateTags(db: DbClient, names: readonly string[]): Promise<{ id: string; name: string }[]> {
  const unique = new Map<string, string>();
  for (const raw of names) {
    const name = cleanTagName(raw);
    // La première graphie saisie l'emporte (« Clerc, clerc » → « Clerc »).
    const normalized = normalizeTagName(name);
    if (name && !unique.has(normalized)) unique.set(normalized, name);
  }
  if (unique.size === 0) return [];

  await db.tag.createMany({
    data: [...unique].map(([normalized, name]) => ({ normalized, name })),
    skipDuplicates: true,
  });
  return db.tag.findMany({
    where: { normalized: { in: [...unique.keys()] } },
    select: { id: true, name: true },
  });
}

export async function addTagsToAssets(assetIds: readonly string[], names: readonly string[]): Promise<number> {
  if (assetIds.length === 0) return 0;
  return getDb().$transaction(async (tx) => {
    const tags = await findOrCreateTags(tx, names);
    if (tags.length === 0) throw new DomainError("Indiquez au moins un tag.");
    const result = await tx.assetTag.createMany({
      data: assetIds.flatMap((assetId) => tags.map((tag) => ({ assetId, tagId: tag.id }))),
      skipDuplicates: true,
    });
    await refreshAssetSearchText(tx, assetIds);
    return result.count;
  });
}

export async function removeTagFromAssets(assetIds: readonly string[], tagId: string): Promise<number> {
  return getDb().$transaction(async (tx) => {
    const result = await tx.assetTag.deleteMany({ where: { tagId, assetId: { in: [...assetIds] } } });
    await refreshAssetSearchText(tx, assetIds);
    return result.count;
  });
}

export async function listTagsWithCounts() {
  return getDb().tag.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { assets: true } } },
  });
}

export async function renameTag(tagId: string, newName: string): Promise<void> {
  const name = cleanTagName(newName);
  if (!name) throw new DomainError("Le nom du tag est obligatoire.");
  await getDb().$transaction(async (tx) => {
    try {
      await tx.tag.update({ where: { id: tagId }, data: { name, normalized: normalizeTagName(name) } });
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError(`Un tag « ${name} » existe déjà.`);
      throw error;
    }
    const links = await tx.assetTag.findMany({ where: { tagId }, select: { assetId: true } });
    await refreshAssetSearchText(
      tx,
      links.map((link) => link.assetId),
    );
  });
}

export async function deleteTag(tagId: string): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const links = await tx.assetTag.findMany({ where: { tagId }, select: { assetId: true } });
    const deleted = await tx.tag.deleteMany({ where: { id: tagId } });
    if (deleted.count === 0) throw new NotFoundError("Tag");
    await refreshAssetSearchText(
      tx,
      links.map((link) => link.assetId),
    );
  });
}
