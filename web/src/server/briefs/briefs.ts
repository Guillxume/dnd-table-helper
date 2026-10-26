import "server-only";
import { z } from "zod";
import { ReferenceRole, StyleAspect, SubjectType } from "@/generated/prisma/enums";
import {
  type BriefContext,
  type BriefSections,
  BRIEF_SECTION_KEYS,
  briefToText,
  buildBrief,
} from "@/lib/brief/build-brief";
import { cleanOptional } from "@/lib/text";
import { getDb, type DbClient } from "../db";
import { DomainError, NotFoundError } from "../errors";
import { getEffectiveRulesForVersion, getLatestVersionId } from "../style-guides/style-guides";

export const MAX_BRIEF_REFERENCES = 12;

export const referenceSelectionSchema = z.object({
  assetId: z.uuid(),
  role: z.enum(ReferenceRole),
  aspects: z.array(z.enum(StyleAspect)).max(20).default([]),
  note: z.string().max(1000).nullish(),
});

export type ReferenceSelection = z.infer<typeof referenceSelectionSchema>;

const optionalText = (max: number) => z.string().max(max).optional();

export const briefParamsSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(200),
  subjectType: z.enum(SubjectType),
  characterId: z.union([z.uuid(), z.literal("")]).optional(),
  styleGuideId: z.union([z.uuid(), z.literal("")]).optional(),
  objective: z.string().trim().min(1, "Décrivez l'objectif de l'image.").max(4000),
  imageType: z.string().trim().min(1, "Indiquez le type d'image.").max(200),
  subjectDetails: optionalText(8000),
  framing: optionalText(2000),
  aspectRatio: optionalText(50),
  highlights: optionalText(4000),
  constraints: optionalText(4000),
  exclusions: optionalText(4000),
  references: z
    .array(referenceSelectionSchema)
    .max(MAX_BRIEF_REFERENCES, `Au plus ${MAX_BRIEF_REFERENCES} références par brief.`)
    .refine(
      (references) => new Set(references.map((reference) => reference.assetId)).size === references.length,
      "Une même image ne peut être référencée qu'une fois.",
    ),
});

export type BriefParams = z.infer<typeof briefParamsSchema>;

const sectionText = z.string().max(20_000);

export const briefTextSchema = z.object({
  sectionObjective: sectionText,
  sectionSubject: sectionText,
  sectionArtDirection: sectionText,
  sectionReferences: sectionText,
  sectionComposition: sectionText,
  sectionLighting: sectionText,
  sectionMaterials: sectionText,
  sectionConsistency: sectionText,
  sectionForbidden: sectionText,
  sectionOutput: sectionText,
  prompt: z.string().trim().min(1, "Le prompt ne peut pas être vide.").max(20_000),
}) satisfies z.ZodType<BriefSections & { prompt: string }>;

/** Rassemble fiche, guide et références pour construire le brief. */
async function loadBriefContext(db: DbClient, params: BriefParams) {
  const characterId = params.characterId || null;
  const styleGuideVersionId = params.styleGuideId ? await getLatestVersionId(params.styleGuideId) : null;

  const [character, guide, assets] = await Promise.all([
    characterId
      ? db.character.findUnique({
          where: { id: characterId },
          include: { traits: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
        })
      : null,
    styleGuideVersionId ? getEffectiveRulesForVersion(styleGuideVersionId) : null,
    db.asset.findMany({
      where: { id: { in: params.references.map((reference) => reference.assetId) } },
      select: { id: true, title: true },
    }),
  ]);
  if (characterId && !character) throw new DomainError("Le personnage choisi n'existe plus.");
  const titles = new Map(assets.map((asset) => [asset.id, asset.title]));
  const missing = params.references.filter((reference) => !titles.has(reference.assetId));
  if (missing.length > 0) throw new DomainError("Une des références choisies n'existe plus dans la bibliothèque.");

  const context: BriefContext = {
    subjectType: params.subjectType,
    objective: params.objective,
    imageType: params.imageType,
    subjectDetails: params.subjectDetails,
    framing: params.framing,
    aspectRatio: params.aspectRatio,
    highlights: params.highlights,
    constraints: params.constraints,
    exclusions: params.exclusions,
    character: character
      ? {
          name: character.name,
          kind: character.kind,
          summary: character.summary,
          fields: character,
          traits: character.traits,
        }
      : null,
    guide: guide ? { name: guide.guideName, parentName: guide.parentName, number: guide.number, rules: guide.rules } : null,
    references: params.references.map((reference) => ({
      title: titles.get(reference.assetId) as string,
      role: reference.role,
      aspects: reference.aspects,
      note: reference.note ?? null,
    })),
  };
  return { context, characterId, styleGuideVersionId };
}

function paramsData(params: BriefParams) {
  return {
    title: params.title,
    subjectType: params.subjectType,
    objective: params.objective,
    imageType: params.imageType,
    subjectDetails: cleanOptional(params.subjectDetails),
    framing: cleanOptional(params.framing),
    aspectRatio: cleanOptional(params.aspectRatio),
    highlights: cleanOptional(params.highlights),
    constraints: cleanOptional(params.constraints),
    exclusions: cleanOptional(params.exclusions),
  };
}

function referencesData(references: ReferenceSelection[]) {
  return references.map((reference, position) => ({
    assetId: reference.assetId,
    role: reference.role,
    aspects: [...new Set(reference.aspects)],
    note: cleanOptional(reference.note),
    position,
  }));
}

export async function createBrief(params: BriefParams) {
  const db = getDb();
  const { context, characterId, styleGuideVersionId } = await loadBriefContext(db, params);
  const { sections, prompt } = buildBrief(context);
  return db.brief.create({
    data: {
      ...paramsData(params),
      characterId,
      styleGuideVersionId,
      ...sections,
      prompt,
      references: { create: referencesData(params.references) },
    },
    select: { id: true },
  });
}

/**
 * Met à jour les paramètres et régénère entièrement le brief.
 * Les modifications manuelles des sections sont remplacées : l'interface le signale.
 */
export async function updateBriefParams(id: string, params: BriefParams): Promise<void> {
  const db = getDb();
  const exists = await db.brief.count({ where: { id } });
  if (!exists) throw new NotFoundError("Brief");
  const { context, characterId, styleGuideVersionId } = await loadBriefContext(db, params);
  const { sections, prompt } = buildBrief(context);
  await db.$transaction([
    db.briefReference.deleteMany({ where: { briefId: id } }),
    db.brief.update({
      where: { id },
      data: {
        ...paramsData(params),
        characterId,
        styleGuideVersionId,
        ...sections,
        prompt,
        references: { create: referencesData(params.references) },
      },
    }),
  ]);
}

/** Enregistre le texte retouché à la main (sections et prompt). */
export async function updateBriefText(id: string, text: BriefSections & { prompt: string }): Promise<void> {
  // Seuls les champs de texte sont repris, quel que soit l'objet reçu.
  const updated = await getDb().brief.updateMany({
    where: { id },
    data: { ...briefSections(text), prompt: text.prompt },
  });
  if (updated.count === 0) throw new NotFoundError("Brief");
}

export async function deleteBrief(id: string): Promise<void> {
  const deleted = await getDb().brief.deleteMany({ where: { id } });
  if (deleted.count === 0) throw new NotFoundError("Brief");
}

export async function getBrief(id: string) {
  return getDb().brief.findUnique({
    where: { id },
    include: {
      character: { select: { id: true, name: true } },
      styleGuideVersion: {
        select: { id: true, number: true, styleGuide: { select: { id: true, name: true } } },
      },
      references: {
        orderBy: { position: "asc" },
        include: {
          asset: {
            select: {
              id: true,
              title: true,
              width: true,
              height: true,
              dominantColor: true,
              mimeType: true,
              originalFilename: true,
            },
          },
        },
      },
      generations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          asset: { select: { id: true, dominantColor: true, width: true, height: true } },
        },
      },
    },
  });
}

export type BriefDetail = NonNullable<Awaited<ReturnType<typeof getBrief>>>;

export async function listBriefs() {
  return getDb().brief.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      subjectType: true,
      imageType: true,
      updatedAt: true,
      character: { select: { id: true, name: true } },
      _count: { select: { references: true, generations: true } },
    },
  });
}

export function briefSections(brief: BriefSections): BriefSections {
  return Object.fromEntries(BRIEF_SECTION_KEYS.map((key) => [key, brief[key]])) as BriefSections;
}

export function briefSnapshotText(brief: BriefSections & { title: string; prompt: string }): string {
  return `${briefToText(brief.title, briefSections(brief))}\n\n## Prompt\n${brief.prompt}`;
}

/** Export JSON autonome : brief, prompt et description des références (sans les fichiers). */
export function briefToExport(brief: BriefDetail, baseUrl: string) {
  return {
    format: "jdr-art-library/brief",
    version: 1,
    exportedAt: new Date().toISOString(),
    brief: {
      id: brief.id,
      title: brief.title,
      subjectType: brief.subjectType,
      imageType: brief.imageType,
      objective: brief.objective,
      character: brief.character,
      styleGuide: brief.styleGuideVersion
        ? {
            id: brief.styleGuideVersion.styleGuide.id,
            name: brief.styleGuideVersion.styleGuide.name,
            version: brief.styleGuideVersion.number,
          }
        : null,
      parameters: {
        subjectDetails: brief.subjectDetails,
        framing: brief.framing,
        aspectRatio: brief.aspectRatio,
        highlights: brief.highlights,
        constraints: brief.constraints,
        exclusions: brief.exclusions,
      },
      sections: briefSections(brief),
      prompt: brief.prompt,
    },
    references: brief.references.map((reference) => ({
      order: reference.position + 1,
      assetId: reference.asset.id,
      title: reference.asset.title,
      originalFilename: reference.asset.originalFilename,
      role: reference.role,
      aspects: reference.aspects,
      note: reference.note,
      // URL interne, accessible uniquement avec une session valide.
      url: new URL(`/api/files/${reference.asset.id}/original`, baseUrl).toString(),
    })),
  };
}
