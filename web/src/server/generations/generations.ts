import "server-only";
import { z } from "zod";
import { GenerationStatus } from "@/generated/prisma/enums";
import { cleanOptional } from "@/lib/text";
import { referenceSelectionSchema, briefSnapshotText } from "../briefs/briefs";
import { getDb } from "../db";
import { DomainError, isUniqueViolation, NotFoundError } from "../errors";
import { refreshAssetSearchText } from "../search/asset-search-text";

const optionalUuid = z.union([z.uuid(), z.literal("")]).optional();
const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === "" || /^https?:\/\//i.test(value), "L'URL doit commencer par http:// ou https://.")
  .optional();

export const generationInputSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(200),
  status: z.enum(GenerationStatus),
  assetId: optionalUuid,
  briefId: optionalUuid,
  characterId: optionalUuid,
  styleGuideVersionId: optionalUuid,
  previousId: optionalUuid,
  prompt: z.string().trim().min(1, "Le prompt utilisé est obligatoire.").max(20_000),
  briefSnapshot: z.string().max(60_000).optional(),
  tool: z.string().max(120).optional(),
  sourceUrl: optionalUrl,
  revisionNotes: z.string().max(10_000).optional(),
  references: z.array(referenceSelectionSchema).max(20).default([]),
});

export type GenerationInput = z.infer<typeof generationInputSchema>;

/** Le statut se change à part (setGenerationStatus), pour qu'un formulaire ouvert ne l'écrase pas. */
export const generationUpdateSchema = generationInputSchema.pick({
  title: true,
  prompt: true,
  tool: true,
  sourceUrl: true,
  revisionNotes: true,
});

export type GenerationUpdate = z.infer<typeof generationUpdateSchema>;

/**
 * Archive une génération. L'image (si fournie) a été importée au préalable
 * via /api/assets ; elle est marquée comme générée et rattachée ici.
 */
export async function createGeneration(input: GenerationInput) {
  const db = getDb();
  const assetId = input.assetId || null;
  const briefId = input.briefId || null;

  return db.$transaction(async (tx) => {
    let briefSnapshot = cleanOptional(input.briefSnapshot);
    if (briefId) {
      const brief = await tx.brief.findUnique({ where: { id: briefId } });
      if (!brief) throw new DomainError("Le brief d'origine n'existe plus.");
      briefSnapshot ??= briefSnapshotText(brief);
    }
    if (input.previousId) {
      const previous = await tx.generationRecord.count({ where: { id: input.previousId } });
      if (!previous) throw new DomainError("La version précédente n'existe plus.");
    }
    if (assetId) {
      const asset = await tx.asset.count({ where: { id: assetId } });
      if (!asset) throw new DomainError("L'image importée est introuvable.");
      await tx.asset.update({ where: { id: assetId }, data: { origin: "GENERATED" } });
    }

    try {
      const generation = await tx.generationRecord.create({
        data: {
          title: input.title,
          status: input.status,
          assetId,
          briefId,
          characterId: input.characterId || null,
          styleGuideVersionId: input.styleGuideVersionId || null,
          previousId: input.previousId || null,
          prompt: input.prompt,
          briefSnapshot,
          tool: cleanOptional(input.tool),
          sourceUrl: cleanOptional(input.sourceUrl),
          revisionNotes: cleanOptional(input.revisionNotes),
          references: {
            create: input.references.map((reference, position) => ({
              assetId: reference.assetId,
              role: reference.role,
              aspects: [...new Set(reference.aspects)],
              note: cleanOptional(reference.note),
              position,
            })),
          },
        },
        select: { id: true },
      });
      if (assetId) await refreshAssetSearchText(tx, [assetId]);
      return generation;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError("Cette image est déjà archivée comme résultat d'une autre génération.");
      }
      throw error;
    }
  });
}

export async function updateGeneration(id: string, input: GenerationUpdate): Promise<void> {
  const updated = await getDb().generationRecord.updateMany({
    where: { id },
    data: {
      title: input.title,
      prompt: input.prompt,
      tool: cleanOptional(input.tool),
      sourceUrl: cleanOptional(input.sourceUrl),
      revisionNotes: cleanOptional(input.revisionNotes),
    },
  });
  if (updated.count === 0) throw new NotFoundError("Génération");
}

export async function setGenerationStatus(id: string, status: GenerationStatus): Promise<void> {
  const updated = await getDb().generationRecord.updateMany({ where: { id }, data: { status } });
  if (updated.count === 0) throw new NotFoundError("Génération");
}

/** Rattache une image à une génération archivée sans résultat (brouillon). */
export async function attachGenerationImage(id: string, assetId: string): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const generation = await tx.generationRecord.findUnique({ where: { id }, select: { assetId: true } });
    if (!generation) throw new NotFoundError("Génération");
    if (generation.assetId) throw new DomainError("Cette génération a déjà une image.");
    await tx.asset.update({ where: { id: assetId }, data: { origin: "GENERATED" } });
    try {
      await tx.generationRecord.update({ where: { id }, data: { assetId } });
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError("Cette image est déjà le résultat d'une autre génération.");
      throw error;
    }
    await refreshAssetSearchText(tx, [assetId]);
  });
}

/**
 * Fait d'une génération validée une référence validée de son personnage : l'image rejoint
 * les références de la fiche, marquée comme représentative. Retourne l'identifiant du personnage.
 */
export async function promoteGenerationToReference(id: string): Promise<string> {
  return getDb().$transaction(async (tx) => {
    const generation = await tx.generationRecord.findUnique({ where: { id }, select: { status: true, assetId: true, characterId: true, title: true } });
    if (!generation) throw new NotFoundError("Génération");
    if (generation.status !== "VALIDATED") throw new DomainError("Seule une génération validée peut devenir une référence du personnage.");
    if (!generation.assetId) throw new DomainError("Rattache d'abord l'image obtenue à cette génération.");
    if (!generation.characterId) throw new DomainError("Cette génération n'est liée à aucun personnage.");
    const key = { characterId: generation.characterId, assetId: generation.assetId };
    await tx.characterAsset.upsert({
      where: { characterId_assetId: key },
      create: { ...key, validated: true, note: `Génération validée : ${generation.title}`.slice(0, 500) },
      update: { validated: true },
    });
    await refreshAssetSearchText(tx, [generation.assetId]);
    return generation.characterId;
  });
}

/** La génération est-elle déjà une référence validée de son personnage ? */
export async function isValidatedReference(generation: { assetId: string | null; characterId: string | null }): Promise<boolean> {
  if (!generation.assetId || !generation.characterId) return false;
  const link = await getDb().characterAsset.findUnique({
    where: { characterId_assetId: { characterId: generation.characterId, assetId: generation.assetId } },
    select: { validated: true },
  });
  return link?.validated ?? false;
}

/** Supprime l'archive ; l'image reste dans la bibliothèque (elle peut servir de référence). */
export async function deleteGeneration(id: string): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const generation = await tx.generationRecord.findUnique({ where: { id }, select: { assetId: true } });
    if (!generation) throw new NotFoundError("Génération");
    await tx.generationRecord.delete({ where: { id } });
    if (generation.assetId) await refreshAssetSearchText(tx, [generation.assetId]);
  });
}

export type GenerationListFilters = { status?: GenerationStatus; characterId?: string };

export async function listGenerations(filters: GenerationListFilters = {}, take?: number) {
  return getDb().generationRecord.findMany({
    where: { status: filters.status, characterId: filters.characterId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      previousId: true,
      character: { select: { id: true, name: true } },
      asset: { select: { id: true, dominantColor: true, width: true, height: true } },
      _count: { select: { nextVersions: true } },
    },
  });
}

const MAX_VERSION_CHAIN = 50;

export async function getGeneration(id: string) {
  const db = getDb();
  const generation = await db.generationRecord.findUnique({
    where: { id },
    include: {
      asset: { select: { id: true, title: true, width: true, height: true, dominantColor: true } },
      brief: { select: { id: true, title: true } },
      character: { select: { id: true, name: true } },
      styleGuideVersion: { select: { id: true, number: true, styleGuide: { select: { id: true, name: true } } } },
      references: {
        orderBy: { position: "asc" },
        include: { asset: { select: { id: true, title: true, width: true, height: true, dominantColor: true } } },
      },
      nextVersions: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, status: true } },
    },
  });
  if (!generation) return null;

  // Remonte la chaîne des versions précédentes (bornée pour éviter tout cycle accidentel).
  const ancestors: { id: string; title: string; status: GenerationStatus }[] = [];
  let cursor = generation.previousId;
  const seen = new Set([generation.id]);
  while (cursor && ancestors.length < MAX_VERSION_CHAIN && !seen.has(cursor)) {
    seen.add(cursor);
    const previous = await db.generationRecord.findUnique({
      where: { id: cursor },
      select: { id: true, title: true, status: true, previousId: true },
    });
    if (!previous) break;
    ancestors.unshift({ id: previous.id, title: previous.title, status: previous.status });
    cursor = previous.previousId;
  }
  return { ...generation, ancestors };
}

export type GenerationDetail = NonNullable<Awaited<ReturnType<typeof getGeneration>>>;
