import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteAssets } from "../../src/server/assets/asset-mutations";
import { listAssets } from "../../src/server/assets/asset-queries";
import { importAsset } from "../../src/server/assets/import-asset";
import { getDb } from "../../src/server/db";
import { getStorage } from "../../src/server/storage";
import { makeImage, readObject, resetTestState } from "../support/fixtures";

const noFilters = { tagIds: [], favorite: false, sort: "imported-desc" as const };

describe("import d'une illustration", () => {
  beforeEach(resetTestState);

  it("stocke l'original intact, une miniature et un aperçu, puis l'affiche dans la galerie", async () => {
    const bytes = await makeImage({ width: 3000, height: 2000, format: "jpeg" });

    const result = await importAsset({ filename: "clerc_lumiere-divine.jpg", declaredType: "image/jpeg", bytes });

    expect(result.status).toBe("created");
    if (result.status !== "created") return;
    const asset = await getDb().asset.findUniqueOrThrow({ where: { id: result.asset.id } });
    expect(asset).toMatchObject({
      title: "clerc lumiere divine",
      mimeType: "image/jpeg",
      width: 3000,
      height: 2000,
      byteSize: bytes.byteLength,
      origin: "UNKNOWN",
    });

    const original = await readObject(asset.originalKey);
    expect(original?.equals(bytes)).toBe(true);

    const thumbnail = await readObject(asset.thumbnailKey);
    const thumbnailMeta = await sharp(thumbnail!).metadata();
    expect(thumbnailMeta.format).toBe("webp");
    expect(thumbnailMeta.width).toBe(640);

    const preview = await readObject(asset.previewKey);
    const previewMeta = await sharp(preview!).metadata();
    expect(previewMeta.format).toBe("webp");
    expect(Math.max(previewMeta.width!, previewMeta.height!)).toBe(2048);

    const gallery = await listAssets(noFilters, { offset: 0 });
    expect(gallery.total).toBe(1);
    expect(gallery.items[0]).toMatchObject({ id: asset.id, width: 3000, height: 2000 });
  });

  it("détecte un doublon par empreinte et ne crée pas de seconde copie", async () => {
    const bytes = await makeImage();
    const first = await importAsset({ filename: "a.png", declaredType: "image/png", bytes });
    const second = await importAsset({ filename: "renomme.png", declaredType: "image/png", bytes });

    expect(first.status).toBe("created");
    expect(second.status).toBe("duplicate");
    if (first.status === "created" && second.status === "duplicate") {
      expect(second.asset.id).toBe(first.asset.id);
    }
    expect(await getDb().asset.count()).toBe(1);
  });

  it("accepte WebP et AVIF", async () => {
    const webp = await importAsset({
      filename: "texture.webp",
      declaredType: "image/webp",
      bytes: await makeImage({ format: "webp" }),
    });
    const avif = await importAsset({
      filename: "palette.avif",
      declaredType: "image/avif",
      bytes: await makeImage({ format: "avif", width: 400, height: 300 }),
    });
    expect(webp.status).toBe("created");
    expect(avif.status).toBe("created");
  });

  it("rejette un fichier non image déguisé en PNG sans rien stocker", async () => {
    const result = await importAsset({
      filename: "script.png",
      declaredType: "image/png",
      bytes: Buffer.from("<script>alert(1)</script>"),
    });

    expect(result).toEqual({ status: "rejected", reason: expect.stringContaining("Format non reconnu") });
    expect(await getDb().asset.count()).toBe(0);
    const keys: string[] = [];
    for await (const key of getStorage().listKeys("assets/")) keys.push(key);
    expect(keys).toEqual([]);
  });

  it("rejette une image tronquée (corrompue)", async () => {
    const bytes = await makeImage({ format: "png" });
    const result = await importAsset({
      filename: "casse.png",
      declaredType: "image/png",
      bytes: bytes.subarray(0, 120),
    });
    expect(result.status).toBe("rejected");
  });

  it("supprime les fichiers avec l'illustration", async () => {
    const result = await importAsset({ filename: "a.png", declaredType: "image/png", bytes: await makeImage() });
    if (result.status !== "created") throw new Error("import attendu");
    const asset = await getDb().asset.findUniqueOrThrow({ where: { id: result.asset.id } });

    await deleteAssets([asset.id]);

    expect(await getDb().asset.count()).toBe(0);
    expect(await getStorage().exists(asset.originalKey)).toBe(false);
    expect(await getStorage().exists(asset.thumbnailKey)).toBe(false);
    expect(await getStorage().exists(asset.previewKey)).toBe(false);
  });
});
