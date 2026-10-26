import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteAssets } from "../../src/server/assets/asset-mutations";
import { importAsset } from "../../src/server/assets/import-asset";
import {
  columnLabel,
  createBattleMap,
  describeBattleMap,
  getBattleMap,
  renderBattleMapPdf,
} from "../../src/server/battle-maps/battle-maps";
import { getDb } from "../../src/server/db";
import { makeImage, resetTestState } from "../support/fixtures";

const MM_TO_PT = 72 / 25.4;

async function importMapImage() {
  const result = await importAsset({
    filename: "crypte.png",
    declaredType: "image/png",
    bytes: await makeImage({ width: 1536, height: 1024 }),
  });
  if (result.status !== "created") throw new Error("import attendu");
  return result.asset.id;
}

const settings = { gridStyle: "DARK" as const, gridOpacity: 60, showLabels: true, cellTenthMm: 250 };

describe("cartes de bataille", () => {
  beforeEach(resetTestState);

  it("produit un plan d'assemblage puis des feuilles A4 à l'échelle", async () => {
    const assetId = await importMapImage();
    const { id } = await createBattleMap({ title: "Crypte", assetId, columns: 20, rows: 13, ...settings });

    const map = await getBattleMap(id);
    const { layout, dpi } = describeBattleMap(map!);
    // Paysage : 11 × 7 cases par feuille → 2 × 2 feuilles (le portrait en demanderait 6).
    expect(layout.orientation).toBe("landscape");
    expect(layout.pages).toHaveLength(4);
    expect(dpi).toBe(78);

    const { buffer, pages } = await renderBattleMapPdf(id);
    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBe(5);
    expect(pages).toBe(5);
    const [assembly, firstTile] = [pdf.getPage(0), pdf.getPage(1)];
    expect(assembly.getWidth()).toBeCloseTo(210 * MM_TO_PT, 1);
    expect(firstTile.getWidth()).toBeCloseTo(297 * MM_TO_PT, 1);
    expect(firstTile.getHeight()).toBeCloseTo(210 * MM_TO_PT, 1);
  });

  it("supprime la carte avec son image", async () => {
    const assetId = await importMapImage();
    await createBattleMap({ title: "Crypte", assetId, columns: 10, rows: 7, ...settings });
    await deleteAssets([assetId]);
    expect(await getDb().battleMap.count()).toBe(0);
  });

  it("refuse une image inexistante", async () => {
    await expect(
      createBattleMap({ title: "X", assetId: "00000000-0000-4000-8000-000000000000", columns: 10, rows: 7, ...settings }),
    ).rejects.toThrow(/n'existe plus/);
  });

  it("nomme les colonnes au-delà de Z", () => {
    expect([0, 25, 26, 27, 51, 52].map(columnLabel)).toEqual(["A", "Z", "AA", "AB", "AZ", "BA"]);
  });
});
