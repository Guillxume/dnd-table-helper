import { beforeEach, describe, expect, it } from "vitest";
import { importAsset } from "../../src/server/assets/import-asset";
import {
  createBrief,
  getBrief,
  updateBriefParams,
  updateBriefText,
  type BriefParams,
} from "../../src/server/briefs/briefs";
import {
  addCharacterReferences,
  addTrait,
  changeTraitStatus,
  createCharacter,
  deleteTrait,
  getCharacter,
  setCharacterReferenceValidated,
} from "../../src/server/characters/characters";
import { getDb } from "../../src/server/db";
import {
  createGeneration,
  getGeneration,
  isValidatedReference,
  promoteGenerationToReference,
  setGenerationStatus,
} from "../../src/server/generations/generations";
import {
  addStyleGuideReferences,
  createStyleGuide,
  getStyleGuide,
  saveStyleGuideRules,
} from "../../src/server/style-guides/style-guides";
import { listAssets } from "../../src/server/assets/asset-queries";
import { parseLibraryFilters } from "../../src/lib/library-filters";
import { makeImage, resetTestState } from "../support/fixtures";

async function importOne(filename: string) {
  const result = await importAsset({ filename, declaredType: "image/png", bytes: await makeImage() });
  if (result.status !== "created") throw new Error("import attendu");
  return result.asset.id;
}

const baseCharacter = { kind: "PLAYER_CHARACTER" as const };

describe("fiches personnages", () => {
  beforeEach(resetTestState);

  it("crée une fiche, la lie à des références et laisse l'inconnu vide", async () => {
    const reference = await importOne("rektal-portrait.png");
    const { id } = await createCharacter({
      ...baseCharacter,
      name: "Rek'tal",
      species: "Drakéide",
      face: "   ",
    });
    await addCharacterReferences(id, [reference]);
    await setCharacterReferenceValidated(id, reference, true);

    const character = await getCharacter(id);
    expect(character?.species).toBe("Drakéide");
    expect(character?.face).toBeNull();
    expect(character?.references).toEqual([
      expect.objectContaining({ validated: true, asset: expect.objectContaining({ id: reference }) }),
    ]);
    // Le nom du personnage devient cherchable sur ses références.
    const { items } = await listAssets(parseLibraryFilters({ q: "rek'tal" }), { offset: 0 });
    expect(items.map((item) => item.id)).toEqual([reference]);
  });

  it("ne rend une proposition canonique que sur action explicite et protège les éléments verrouillés", async () => {
    const { id } = await createCharacter({ ...baseCharacter, name: "Elamaer" });
    const proposal = await addTrait(id, { status: "PROPOSAL", content: "Cicatrice sur la joue", locked: true });
    const canon = await addTrait(id, { status: "CANON", content: "Yeux dorés", locked: true });

    const before = await getDb().characterTrait.findUniqueOrThrow({ where: { id: proposal.id } });
    // Le verrou n'a de sens que pour un fait canonique : ignoré sur une proposition.
    expect(before).toMatchObject({ status: "PROPOSAL", locked: false });

    await changeTraitStatus(proposal.id, "CANON");
    expect(await getDb().characterTrait.findUniqueOrThrow({ where: { id: proposal.id } })).toMatchObject({
      status: "CANON",
    });

    await expect(changeTraitStatus(canon.id, "PROPOSAL")).rejects.toThrow(/verrouillé/);
    await expect(deleteTrait(canon.id)).rejects.toThrow(/verrouillé/);
  });
});

describe("guides artistiques", () => {
  beforeEach(resetTestState);

  it("versionne les règles, associe des références par aspect et préserve les règles communes dans une variante", async () => {
    const texture = await importOne("texture.png");
    const base = await createStyleGuide({ name: "Fantasy peinte" });
    const v2 = await saveStyleGuideRules(base.id, { LIGHTING: "Lumière chaude rasante", AVOID: "Rendu 3D lisse" }, "Premier jet");
    const unchanged = await saveStyleGuideRules(base.id, { LIGHTING: "Lumière chaude rasante", AVOID: "Rendu 3D lisse" }, "");
    expect(v2).toMatchObject({ number: 2, created: true });
    expect(unchanged).toMatchObject({ number: 2, created: false });

    await addStyleGuideReferences(base.id, [texture], ["TEXTURES", "LIGHTING"]);

    const variant = await createStyleGuide({ name: "Fantasy sombre", parentId: base.id });
    await saveStyleGuideRules(variant.id, { LIGHTING: "Contre-jour froid" }, "");

    const guide = await getStyleGuide(variant.id);
    const lighting = guide?.effectiveRules.find((rule) => rule.aspect === "LIGHTING");
    expect(lighting).toEqual({ aspect: "LIGHTING", common: "Lumière chaude rasante", specific: "Contre-jour froid" });
    expect(guide?.effectiveRules.find((rule) => rule.aspect === "AVOID")?.common).toBe("Rendu 3D lisse");

    const baseGuide = await getStyleGuide(base.id);
    expect(baseGuide?.references).toEqual([
      expect.objectContaining({ aspects: ["TEXTURES", "LIGHTING"], asset: expect.objectContaining({ id: texture }) }),
    ]);
    expect(baseGuide?._count.versions).toBe(2);
  });
});

describe("briefs et générations", () => {
  beforeEach(resetTestState);

  async function setup() {
    const styleRef = await importOne("texture-peinte.png");
    const contentRef = await importOne("armure.png");
    const character = await createCharacter({
      ...baseCharacter,
      name: "Rek'tal",
      species: "Drakéide",
      outfit: "Armure de plates noircie",
    });
    await addTrait(character.id, { status: "CANON", content: "Écailles cuivrées", locked: true });
    await addTrait(character.id, { status: "PROPOSAL", content: "Cape rouge", locked: false });
    await addTrait(character.id, { status: "EXCLUDED", content: "Ailes", locked: false });
    const guide = await createStyleGuide({ name: "Fantasy peinte" });
    await saveStyleGuideRules(guide.id, { TEXTURES: "Coups de pinceau visibles" }, "");

    const params: BriefParams = {
      title: "Portrait de Rek'tal",
      subjectType: "CHARACTER",
      characterId: character.id,
      styleGuideId: guide.id,
      objective: "Portrait de référence en buste",
      imageType: "Portrait en buste",
      aspectRatio: "2:3",
      references: [
        { assetId: styleRef, role: "STYLE", aspects: ["TEXTURES"], note: null },
        { assetId: contentRef, role: "CONTENT", aspects: [], note: "Forme de l'armure" },
      ],
    };
    return { styleRef, contentRef, character, guide, params };
  }

  it("prépare un brief, le modifie et l'archive avec une génération liée au prompt et aux références", async () => {
    const { styleRef, contentRef, character, params } = await setup();
    const { id: briefId } = await createBrief(params);

    const brief = await getBrief(briefId);
    expect(brief?.sectionSubject).toContain("Drakéide");
    expect(brief?.sectionSubject).toContain("Écailles cuivrées [intangible]");
    // Une proposition non validée n'entre jamais dans la description canonique.
    expect(brief?.sectionSubject).not.toContain("Cape rouge");
    expect(brief?.prompt).not.toContain("Cape rouge");
    expect(brief?.sectionForbidden).toContain("Ailes");
    expect(brief?.sectionReferences).toContain("STYLE uniquement");
    expect(brief?.references.map((reference) => [reference.asset.id, reference.role])).toEqual([
      [styleRef, "STYLE"],
      [contentRef, "CONTENT"],
    ]);

    await updateBriefText(briefId, {
      ...(brief as NonNullable<typeof brief>),
      prompt: "Prompt retouché à la main",
    });
    expect((await getBrief(briefId))?.prompt).toBe("Prompt retouché à la main");

    const result = await importAsset({
      filename: "rektal-v1.png",
      declaredType: "image/png",
      bytes: await makeImage(),
      origin: "GENERATED",
    });
    if (result.status !== "created") throw new Error("import attendu");
    const finalBrief = await getBrief(briefId);
    const generation = await createGeneration({
      title: "Rek'tal v1",
      status: "TO_REVIEW",
      assetId: result.asset.id,
      briefId,
      characterId: character.id,
      styleGuideVersionId: finalBrief?.styleGuideVersionId ?? "",
      prompt: finalBrief?.prompt ?? "",
      references: finalBrief!.references.map((reference) => ({
        assetId: reference.asset.id,
        role: reference.role,
        aspects: reference.aspects,
        note: reference.note,
      })),
    });

    const archived = await getGeneration(generation.id);
    expect(archived).toMatchObject({
      prompt: "Prompt retouché à la main",
      status: "TO_REVIEW",
      asset: { id: result.asset.id },
      brief: { id: briefId },
      character: { id: character.id },
    });
    expect(archived?.briefSnapshot).toContain("## Prompt\nPrompt retouché à la main");
    expect(archived?.styleGuideVersion?.number).toBe(2);
    expect(archived?.references.map((reference) => reference.asset.id)).toEqual([styleRef, contentRef]);

    // Nouvelle version liée à la précédente.
    const v2 = await createGeneration({
      title: "Rek'tal v2",
      status: "DRAFT",
      previousId: generation.id,
      prompt: "Prompt v2",
      references: [],
    });
    const second = await getGeneration(v2.id);
    expect(second?.ancestors.map((ancestor) => ancestor.id)).toEqual([generation.id]);
    expect((await getGeneration(generation.id))?.nextVersions.map((next) => next.id)).toEqual([v2.id]);
  });

  it("régénère le brief à partir des paramètres modifiés", async () => {
    const { params } = await setup();
    const { id } = await createBrief(params);
    await updateBriefParams(id, { ...params, references: [], exclusions: "Texte dans l'image" });
    const brief = await getBrief(id);
    expect(brief?.references).toEqual([]);
    expect(brief?.sectionForbidden).toContain("Texte dans l'image");
    expect(brief?.sectionReferences).toBe("Aucune référence visuelle jointe.");
  });

  it("refuse d'archiver deux fois la même image comme résultat", async () => {
    const result = await importAsset({ filename: "g.png", declaredType: "image/png", bytes: await makeImage() });
    if (result.status !== "created") throw new Error("import attendu");
    const input = { title: "G", status: "TO_REVIEW" as const, assetId: result.asset.id, prompt: "p", references: [] };
    await createGeneration(input);
    await expect(createGeneration(input)).rejects.toThrow(/déjà archivée/);
    expect((await getDb().asset.findUniqueOrThrow({ where: { id: result.asset.id } })).origin).toBe("GENERATED");
  });

  it("fait d'une génération validée une référence validée de son personnage, et seulement elle", async () => {
    const character = await createCharacter({ ...baseCharacter, name: "Ysolde" });
    const result = await importAsset({ filename: "portrait.png", declaredType: "image/png", bytes: await makeImage() });
    if (result.status !== "created") throw new Error("import attendu");
    const generation = await createGeneration({
      title: "Portrait d'Ysolde",
      status: "TO_REVIEW",
      assetId: result.asset.id,
      characterId: character.id,
      prompt: "p",
      references: [],
    });
    await expect(promoteGenerationToReference(generation.id)).rejects.toThrow(/validée/);

    await setGenerationStatus(generation.id, "VALIDATED");
    expect(await promoteGenerationToReference(generation.id)).toBe(character.id);
    expect(await isValidatedReference({ assetId: result.asset.id, characterId: character.id })).toBe(true);
    const sheet = await getCharacter(character.id);
    expect(sheet?.references).toEqual([expect.objectContaining({ validated: true, note: "Génération validée : Portrait d'Ysolde" })]);
    // Deux fois de suite : aucune erreur, aucun doublon.
    await promoteGenerationToReference(generation.id);
    expect((await getCharacter(character.id))?.references).toHaveLength(1);

    const orphan = await createGeneration({ title: "Sans personnage", status: "VALIDATED", prompt: "p", references: [] });
    await expect(promoteGenerationToReference(orphan.id)).rejects.toThrow(/image/);
  });
});
