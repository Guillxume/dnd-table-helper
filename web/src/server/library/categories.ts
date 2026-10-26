import "server-only";
import { z } from "zod";
import { cleanOptional, slugify } from "@/lib/text";
import { getDb, type DbClient } from "../db";
import { DomainError, NotFoundError } from "../errors";
import { refreshAssetSearchText } from "../search/asset-search-text";

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(80),
  description: z.string().max(1000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

async function uniqueSlug(db: DbClient, name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || "categorie";
  const taken = await db.category.findMany({
    where: { slug: { startsWith: base }, id: excludeId ? { not: excludeId } : undefined },
    select: { slug: true },
  });
  const slugs = new Set(taken.map((category) => category.slug));
  if (!slugs.has(base)) return base;
  let suffix = 2;
  while (slugs.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function listCategories() {
  return getDb().category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      _count: { select: { assets: true } },
    },
  });
}

export async function createCategory(input: CategoryInput) {
  const db = getDb();
  return db.category.create({
    data: {
      name: input.name,
      slug: await uniqueSlug(db, input.name),
      description: cleanOptional(input.description),
      sortOrder: input.sortOrder,
    },
    select: { id: true },
  });
}

export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const existing = await tx.category.findUnique({ where: { id }, select: { name: true } });
    if (!existing) throw new NotFoundError("Catégorie");
    await tx.category.update({
      where: { id },
      data: {
        name: input.name,
        // Le slug ne change qu'avec le nom, pour garder des URL stables.
        slug: existing.name === input.name ? undefined : await uniqueSlug(tx, input.name, id),
        description: cleanOptional(input.description),
        sortOrder: input.sortOrder,
      },
    });
    if (existing.name !== input.name) {
      const assets = await tx.asset.findMany({ where: { categoryId: id }, select: { id: true } });
      await refreshAssetSearchText(
        tx,
        assets.map((asset) => asset.id),
      );
    }
  });
}

/** Les illustrations de la catégorie supprimée deviennent « sans catégorie ». */
export async function deleteCategory(id: string): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const assets = await tx.asset.findMany({ where: { categoryId: id }, select: { id: true } });
    const deleted = await tx.category.deleteMany({ where: { id } });
    if (deleted.count === 0) throw new NotFoundError("Catégorie");
    await refreshAssetSearchText(
      tx,
      assets.map((asset) => asset.id),
    );
  });
}

export async function assertCategoryExists(db: DbClient, id: string | null | undefined): Promise<void> {
  if (!id) return;
  const count = await db.category.count({ where: { id } });
  if (!count) throw new DomainError("La catégorie choisie n'existe plus.");
}
