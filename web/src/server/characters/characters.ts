import "server-only";
import { z } from "zod";
import { CharacterKind, TraitStatus } from "@/generated/prisma/enums";
import { cleanOptional } from "@/lib/text";
import { getDb, type DbClient } from "../db";
import { DomainError, NotFoundError } from "../errors";
import { refreshAssetSearchText } from "../search/asset-search-text";

const longText = z.string().max(20_000).optional();

export const CANONICAL_FIELDS = [
  "species",
  "characterClass",
  "specialization",
  "silhouette",
  "face",
  "hairSkin",
  "outfit",
  "equipment",
  "palette",
  "symbols",
  "personality",
  "visualHistory",
  "notes",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const characterInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(120),
  kind: z.enum(CharacterKind),
  summary: z.string().max(2000).optional(),
  species: longText,
  characterClass: longText,
  specialization: longText,
  silhouette: longText,
  face: longText,
  hairSkin: longText,
  outfit: longText,
  equipment: longText,
  palette: longText,
  symbols: longText,
  personality: longText,
  visualHistory: longText,
  notes: longText,
});

export type CharacterInput = z.infer<typeof characterInputSchema>;

function toData(input: CharacterInput) {
  const data: Record<string, string | null> = {};
  for (const field of CANONICAL_FIELDS) data[field] = cleanOptional(input[field]);
  return { name: input.name, kind: input.kind, summary: cleanOptional(input.summary), ...data };
}

export async function createCharacter(input: CharacterInput) {
  return getDb().character.create({ data: toData(input), select: { id: true } });
}

export async function updateCharacter(id: string, input: CharacterInput): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const existing = await tx.character.findUnique({ where: { id }, select: { name: true } });
    if (!existing) throw new NotFoundError("Personnage");
    await tx.character.update({ where: { id }, data: toData(input) });
    if (existing.name !== input.name) await refreshAssetSearchText(tx, await characterAssetIds(tx, id));
  });
}

/** Illustrations dont le texte de recherche contient le nom du personnage. */
async function characterAssetIds(tx: DbClient, characterId: string): Promise<string[]> {
  const [links, generations] = await Promise.all([
    tx.characterAsset.findMany({ where: { characterId }, select: { assetId: true } }),
    tx.generationRecord.findMany({ where: { characterId, assetId: { not: null } }, select: { assetId: true } }),
  ]);
  return [
    ...links.map((link) => link.assetId),
    ...generations.flatMap((generation) => (generation.assetId ? [generation.assetId] : [])),
  ];
}

export async function deleteCharacter(id: string): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const assetIds = await characterAssetIds(tx, id);
    const deleted = await tx.character.deleteMany({ where: { id } });
    if (deleted.count === 0) throw new NotFoundError("Personnage");
    await refreshAssetSearchText(tx, assetIds);
  });
}

export async function listCharacters() {
  const characters = await getDb().character.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      kind: true,
      summary: true,
      species: true,
      characterClass: true,
      references: {
        orderBy: [{ validated: "desc" }, { addedAt: "desc" }],
        take: 1,
        select: { asset: { select: { id: true, dominantColor: true } } },
      },
      _count: { select: { references: true, generations: true, traits: true } },
    },
  });
  return characters.map(({ references, ...character }) => ({ ...character, cover: references[0]?.asset ?? null }));
}

export async function listCharacterOptions() {
  return getDb().character.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } });
}

export async function getCharacter(id: string) {
  return getDb().character.findUnique({
    where: { id },
    include: {
      traits: { orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }] },
      references: {
        orderBy: [{ validated: "desc" }, { addedAt: "desc" }],
        select: {
          validated: true,
          note: true,
          asset: { select: { id: true, title: true, width: true, height: true, dominantColor: true } },
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

export type CharacterDetail = NonNullable<Awaited<ReturnType<typeof getCharacter>>>;

// ─── Traits typés ──────────────────────────────────────────────────────────

export const traitInputSchema = z.object({
  status: z.enum(TraitStatus),
  content: z.string().trim().min(1, "Le contenu est obligatoire.").max(4000),
  locked: z.boolean().default(false),
});

export type TraitInput = z.infer<typeof traitInputSchema>;

export async function addTrait(characterId: string, input: TraitInput) {
  const db = getDb();
  const exists = await db.character.count({ where: { id: characterId } });
  if (!exists) throw new NotFoundError("Personnage");
  const last = await db.characterTrait.findFirst({
    where: { characterId, status: input.status },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return db.characterTrait.create({
    data: {
      characterId,
      status: input.status,
      content: input.content,
      // Seul un fait canonique peut être verrouillé.
      locked: input.status === "CANON" && input.locked,
      position: (last?.position ?? -1) + 1,
    },
    select: { id: true },
  });
}

export async function updateTrait(traitId: string, input: { content: string; locked: boolean }): Promise<void> {
  const trait = await getDb().characterTrait.findUnique({ where: { id: traitId }, select: { status: true } });
  if (!trait) throw new NotFoundError("Élément");
  await getDb().characterTrait.update({
    where: { id: traitId },
    data: { content: input.content, locked: trait.status === "CANON" && input.locked },
  });
}

/**
 * Change le statut d'un élément. C'est la seule voie par laquelle une
 * proposition devient canonique : elle exige une action explicite.
 * Un élément canonique verrouillé doit d'abord être déverrouillé.
 */
export async function changeTraitStatus(traitId: string, status: TraitStatus): Promise<void> {
  const trait = await getDb().characterTrait.findUnique({
    where: { id: traitId },
    select: { status: true, locked: true },
  });
  if (!trait) throw new NotFoundError("Élément");
  if (trait.locked && status !== "CANON") {
    throw new DomainError("Cet élément canonique est verrouillé : déverrouillez-le avant de changer son statut.");
  }
  await getDb().characterTrait.update({
    where: { id: traitId },
    data: { status, locked: status === "CANON" ? trait.locked : false },
  });
}

export async function deleteTrait(traitId: string): Promise<void> {
  const trait = await getDb().characterTrait.findUnique({ where: { id: traitId }, select: { locked: true } });
  if (!trait) throw new NotFoundError("Élément");
  if (trait.locked) throw new DomainError("Cet élément est verrouillé : déverrouillez-le avant de le supprimer.");
  await getDb().characterTrait.delete({ where: { id: traitId } });
}

// ─── Références visuelles ─────────────────────────────────────────────────

export async function addCharacterReferences(characterId: string, assetIds: readonly string[]): Promise<number> {
  return getDb().$transaction(async (tx) => {
    const exists = await tx.character.count({ where: { id: characterId } });
    if (!exists) throw new NotFoundError("Personnage");
    const result = await tx.characterAsset.createMany({
      data: assetIds.map((assetId) => ({ characterId, assetId })),
      skipDuplicates: true,
    });
    await refreshAssetSearchText(tx, assetIds);
    return result.count;
  });
}

export async function setCharacterReferenceValidated(
  characterId: string,
  assetId: string,
  validated: boolean,
): Promise<void> {
  await getDb().characterAsset.update({
    where: { characterId_assetId: { characterId, assetId } },
    data: { validated },
  });
}

export async function removeCharacterReference(characterId: string, assetId: string): Promise<void> {
  await getDb().$transaction(async (tx) => {
    await tx.characterAsset.deleteMany({ where: { characterId, assetId } });
    await refreshAssetSearchText(tx, [assetId]);
  });
}
