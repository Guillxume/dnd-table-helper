import { beforeEach, describe, expect, it } from "vitest";
import { listAssets } from "../../src/server/assets/asset-queries";
import { setAssetsFavorite, updateAssetMetadata } from "../../src/server/assets/asset-mutations";
import { importAsset } from "../../src/server/assets/import-asset";
import { getDb } from "../../src/server/db";
import { addAssetsToCollection, createCollection, updateCollection } from "../../src/server/library/collections";
import { createCategory } from "../../src/server/library/categories";
import { addTagsToAssets, removeTagFromAssets, renameTag } from "../../src/server/library/tags";
import { globalSearch } from "../../src/server/search/global-search";
import { normalizeForSearch } from "../../src/lib/search/normalize";
import { parseLibraryFilters } from "../../src/lib/library-filters";
import { makeImage, resetTestState } from "../support/fixtures";

async function importOne(filename: string) {
  const result = await importAsset({ filename, declaredType: "image/png", bytes: await makeImage() });
  if (result.status !== "created") throw new Error(`import attendu pour ${filename}`);
  return result.asset.id;
}

async function ids(params: Record<string, string | string[]>) {
  const { items } = await listAssets(parseLibraryFilters(params), { offset: 0 });
  return items.map((item) => item.id).sort();
}

describe("tags, collections, recherche et filtres", () => {
  beforeEach(resetTestState);

  it("associe tags et collections à une illustration", async () => {
    const assetId = await importOne("portrait.png");
    await addTagsToAssets([assetId], ["Clerc", "lumière divine", "clerc"]);
    const collection = await createCollection({ name: "Références pour Rek'tal" });
    await addAssetsToCollection(collection.id, [assetId]);

    const asset = await getDb().asset.findUniqueOrThrow({
      where: { id: assetId },
      include: { tags: { include: { tag: true } }, collections: true },
    });
    // « Clerc » et « clerc » sont le même tag.
    expect(asset.tags.map((link) => link.tag.name).sort()).toEqual(["Clerc", "lumière divine"]);
    expect(asset.collections).toHaveLength(1);
  });

  it("recherche sans tenir compte des accents ni de la casse, sur titre, tags et collections", async () => {
    const elamaer = await importOne("Élamaër en armure.png");
    const other = await importOne("donjon.png");
    await addTagsToAssets([other], ["Ténèbres"]);
    const collection = await createCollection({ name: "Cartes de donjons" });
    await addAssetsToCollection(collection.id, [other]);

    expect(await ids({ q: "elamaer" })).toEqual([elamaer]);
    expect(await ids({ q: "ARMURE elamaër" })).toEqual([elamaer]);
    expect(await ids({ q: "tenebres" })).toEqual([other]);
    expect(await ids({ q: "cartes de" })).toEqual([other]);
    expect(await ids({ q: "introuvable" })).toEqual([]);
  });

  it("garde la recherche à jour après renommage de tag, de collection et retrait de tag", async () => {
    const assetId = await importOne("a.png");
    await addTagsToAssets([assetId], ["ancien-nom"]);
    const tag = await getDb().tag.findFirstOrThrow();
    const collection = await createCollection({ name: "Brouillon" });
    await addAssetsToCollection(collection.id, [assetId]);

    await renameTag(tag.id, "Occultisme");
    await updateCollection(collection.id, { name: "Magie sombre" });
    expect(await ids({ q: "occultisme" })).toEqual([assetId]);
    expect(await ids({ q: "magie sombre" })).toEqual([assetId]);
    expect(await ids({ q: "ancien" })).toEqual([]);

    await removeTagFromAssets([assetId], tag.id);
    expect(await ids({ q: "occultisme" })).toEqual([]);
  });

  it("combine les filtres catégorie, tags, collection, favori, origine et date", async () => {
    const [a, b, c] = [await importOne("a.png"), await importOne("b.png"), await importOne("c.png")];
    const category = await createCategory({ name: "Portraits", sortOrder: 0 });
    await updateAssetMetadata(a, { title: "A", origin: "EXTERNAL", categoryId: category.id });
    await updateAssetMetadata(b, { title: "B", origin: "EXTERNAL", categoryId: category.id });
    await addTagsToAssets([a, b], ["paladin"]);
    await addTagsToAssets([a], ["or"]);
    await setAssetsFavorite([a, c], true);
    const collection = await createCollection({ name: "Direction artistique principale" });
    await addAssetsToCollection(collection.id, [a, c]);
    const [paladin, or] = await Promise.all([
      getDb().tag.findFirstOrThrow({ where: { name: "paladin" } }),
      getDb().tag.findFirstOrThrow({ where: { name: "or" } }),
    ]);
    const today = new Date().toISOString().slice(0, 10);

    expect(await ids({ category: category.id })).toEqual([a, b].sort());
    expect(await ids({ tag: [paladin.id, or.id] })).toEqual([a]);
    expect(await ids({ collection: collection.id, favorite: "1" })).toEqual([a, c].sort());
    expect(await ids({ origin: "EXTERNAL", favorite: "1" })).toEqual([a]);
    expect(await ids({ origin: "UNKNOWN" })).toEqual([c]);
    expect(await ids({ from: today, to: today })).toEqual([a, b, c].sort());
    expect(await ids({ from: "2000-01-01", to: "2000-01-02" })).toEqual([]);
  });

  it("trie par titre et pagine", async () => {
    for (const name of ["gamma.png", "alpha.png", "beta.png"]) await importOne(name);
    const filters = parseLibraryFilters({ sort: "title-asc" });
    const first = await listAssets(filters, { offset: 0, limit: 2 });
    const second = await listAssets(filters, { offset: 2, limit: 2 });
    expect(first.total).toBe(3);
    expect([...first.items, ...second.items].map((item) => item.title)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("normalise la requête comme la base (accents, ligatures, apostrophes)", async () => {
    const samples = ["Élamaër", "CŒUR de Rek’tal", "Straße", "Łódź", "Ægir", "Øya", "ça brûle"];
    for (const sample of samples) {
      const [row] = await getDb().$queryRaw<{ value: string }[]>`SELECT jdr_normalize(${sample}) AS value`;
      expect(normalizeForSearch(sample)).toBe(row.value);
    }
  });

  it("recherche globalement dans les personnages, collections et tags", async () => {
    const assetId = await importOne("x.png");
    await addTagsToAssets([assetId], ["Rek'tal"]);
    await createCollection({ name: "Références pour Rek’tal" });
    await getDb().character.create({ data: { name: "Rek'tal", species: "Drakéide" } });

    const results = await globalSearch("rek'tal");
    expect(results.tags.map((tag) => tag.name)).toEqual(["Rek'tal"]);
    expect(results.collections).toHaveLength(1);
    expect(results.characters.map((character) => character.name)).toEqual(["Rek'tal"]);
    expect(results.assets.total).toBe(1);

    expect((await globalSearch("drakeide")).characters).toHaveLength(1);
  });
});
