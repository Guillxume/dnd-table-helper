import "server-only";
import { z } from "zod";
import { StyleAspect } from "@/generated/prisma/enums";
import { mergeGuideRules, type RuleMap, rulesToMap, sameRules } from "@/lib/style/merge-rules";
import { cleanOptional } from "@/lib/text";
import { getDb } from "../db";
import { DomainError, isUniqueViolation, NotFoundError } from "../errors";

export const styleGuideInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(120),
  description: z.string().max(4000).optional(),
  parentId: z.union([z.uuid(), z.literal("")]).optional(),
});

export type StyleGuideInput = z.infer<typeof styleGuideInputSchema>;

export const ruleMapSchema = z.partialRecord(z.enum(StyleAspect), z.string().max(8000));

const latestVersionInclude = {
  orderBy: { number: "desc" },
  take: 1,
  include: { rules: true },
} as const;

export async function createStyleGuide(input: StyleGuideInput) {
  const db = getDb();
  const parentId = input.parentId || null;
  if (parentId) {
    const parent = await db.styleGuide.findUnique({ where: { id: parentId }, select: { parentId: true } });
    if (!parent) throw new NotFoundError("Guide principal");
    if (parent.parentId) throw new DomainError("Une variante ne peut pas avoir elle-même de variante.");
  }
  return db.styleGuide.create({
    data: {
      name: input.name,
      description: cleanOptional(input.description),
      parentId,
      versions: { create: { number: 1, changeNote: "Création du guide" } },
    },
    select: { id: true },
  });
}

export async function updateStyleGuideInfo(id: string, input: Omit<StyleGuideInput, "parentId">): Promise<void> {
  const updated = await getDb().styleGuide.updateMany({
    where: { id },
    data: { name: input.name, description: cleanOptional(input.description) },
  });
  if (updated.count === 0) throw new NotFoundError("Guide");
}

/**
 * Enregistre les règles sous forme d'une nouvelle version, immuable.
 * Si rien n'a changé, aucune version n'est créée.
 */
export async function saveStyleGuideRules(
  guideId: string,
  rules: RuleMap,
  changeNote: string | undefined,
): Promise<{ versionId: string; number: number; created: boolean }> {
  const db = getDb();
  return db.$transaction(async (tx) => {
    const latest = await tx.styleGuideVersion.findFirst({
      where: { styleGuideId: guideId },
      orderBy: { number: "desc" },
      include: { rules: true },
    });
    if (!latest) throw new NotFoundError("Guide");

    const normalized = rulesToMap(
      Object.entries(rules).map(([aspect, content]) => ({ aspect: aspect as StyleAspect, content: content ?? "" })),
    );
    if (sameRules(rulesToMap(latest.rules), normalized)) {
      return { versionId: latest.id, number: latest.number, created: false };
    }
    try {
      const version = await tx.styleGuideVersion.create({
        data: {
          styleGuideId: guideId,
          number: latest.number + 1,
          changeNote: cleanOptional(changeNote),
          rules: {
            create: Object.entries(normalized).map(([aspect, content]) => ({
              aspect: aspect as StyleAspect,
              content: content as string,
            })),
          },
        },
        select: { id: true, number: true },
      });
      await tx.styleGuide.update({ where: { id: guideId }, data: { updatedAt: new Date() } });
      return { versionId: version.id, number: version.number, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError("Le guide a été modifié entre-temps. Rechargez la page avant d'enregistrer.");
      }
      throw error;
    }
  });
}

export async function deleteStyleGuide(id: string): Promise<void> {
  const db = getDb();
  const variants = await db.styleGuide.count({ where: { parentId: id } });
  if (variants > 0) throw new DomainError("Ce guide a des variantes : supprimez-les ou rattachez-les d'abord.");
  const deleted = await db.styleGuide.deleteMany({ where: { id } });
  if (deleted.count === 0) throw new NotFoundError("Guide");
}

export async function listStyleGuides() {
  const guides = await getDb().styleGuide.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      updatedAt: true,
      versions: { orderBy: { number: "desc" }, take: 1, select: { number: true, _count: { select: { rules: true } } } },
      references: {
        orderBy: { addedAt: "desc" },
        take: 4,
        select: { asset: { select: { id: true, dominantColor: true } } },
      },
      _count: { select: { references: true } },
    },
  });
  const roots = guides.filter((guide) => !guide.parentId);
  return roots.map((root) => ({
    ...root,
    variants: guides.filter((guide) => guide.parentId === root.id),
  }));
}

export async function listStyleGuideOptions() {
  const guides = await getDb().styleGuide.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, parentId: true, parent: { select: { name: true } } },
  });
  return guides.map((guide) => ({
    id: guide.id,
    label: guide.parent ? `${guide.parent.name} › ${guide.name}` : guide.name,
    isVariant: Boolean(guide.parentId),
  }));
}

export async function getStyleGuide(id: string) {
  const guide = await getDb().styleGuide.findUnique({
    where: { id },
    include: {
      versions: latestVersionInclude,
      parent: { include: { versions: latestVersionInclude } },
      variants: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      references: {
        orderBy: { addedAt: "desc" },
        select: {
          aspects: true,
          note: true,
          asset: { select: { id: true, title: true, width: true, height: true, dominantColor: true } },
        },
      },
      _count: { select: { versions: true } },
    },
  });
  if (!guide) return null;
  const version = guide.versions[0];
  const parentVersion = guide.parent?.versions[0];
  const ownRules = rulesToMap(version?.rules ?? []);
  const effectiveRules = parentVersion
    ? mergeGuideRules(rulesToMap(parentVersion.rules), ownRules)
    : mergeGuideRules(ownRules, null);
  return { ...guide, version, parentVersion, ownRules, effectiveRules };
}

export type StyleGuideDetail = NonNullable<Awaited<ReturnType<typeof getStyleGuide>>>;

export async function listStyleGuideVersions(guideId: string) {
  return getDb().styleGuideVersion.findMany({
    where: { styleGuideId: guideId },
    orderBy: { number: "desc" },
    include: { rules: true },
  });
}

/** Version précise d'un guide avec les règles effectives (communes + variante) à cet instant. */
export async function getEffectiveRulesForVersion(versionId: string) {
  const version = await getDb().styleGuideVersion.findUnique({
    where: { id: versionId },
    include: {
      rules: true,
      styleGuide: {
        select: {
          id: true,
          name: true,
          parent: { select: { name: true, versions: latestVersionInclude } },
        },
      },
    },
  });
  if (!version) return null;
  const ownRules = rulesToMap(version.rules);
  const parentVersion = version.styleGuide.parent?.versions[0];
  return {
    guideId: version.styleGuide.id,
    guideName: version.styleGuide.name,
    parentName: version.styleGuide.parent?.name ?? null,
    versionId: version.id,
    number: version.number,
    rules: parentVersion
      ? mergeGuideRules(rulesToMap(parentVersion.rules), ownRules)
      : mergeGuideRules(ownRules, null),
  };
}

export async function getLatestVersionId(guideId: string): Promise<string> {
  const version = await getDb().styleGuideVersion.findFirst({
    where: { styleGuideId: guideId },
    orderBy: { number: "desc" },
    select: { id: true },
  });
  if (!version) throw new NotFoundError("Guide");
  return version.id;
}

// ─── Références ────────────────────────────────────────────────────────────

export async function addStyleGuideReferences(
  guideId: string,
  assetIds: readonly string[],
  aspects: StyleAspect[],
): Promise<number> {
  const db = getDb();
  const exists = await db.styleGuide.count({ where: { id: guideId } });
  if (!exists) throw new NotFoundError("Guide");
  const result = await db.styleGuideAsset.createMany({
    data: assetIds.map((assetId) => ({ styleGuideId: guideId, assetId, aspects })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function updateStyleGuideReference(
  guideId: string,
  assetId: string,
  input: { aspects: StyleAspect[]; note?: string },
): Promise<void> {
  await getDb().styleGuideAsset.update({
    where: { styleGuideId_assetId: { styleGuideId: guideId, assetId } },
    data: { aspects: [...new Set(input.aspects)], note: cleanOptional(input.note) },
  });
}

export async function removeStyleGuideReference(guideId: string, assetId: string): Promise<void> {
  await getDb().styleGuideAsset.deleteMany({ where: { styleGuideId: guideId, assetId } });
}
