import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { sniffImageType, validateUpload } from "../../src/server/images/validate-upload";

const MB = 1024 * 1024;

async function image(format: "jpeg" | "png" | "webp" | "avif") {
  return sharp({ create: { width: 16, height: 16, channels: 3, background: "#884422" } }).toFormat(format).toBuffer();
}

describe("détection du format par les octets", () => {
  it.each(["jpeg", "png", "webp", "avif"] as const)("reconnaît %s", async (format) => {
    expect(sniffImageType(await image(format))).toBe(`image/${format}`);
  });

  it("ne reconnaît ni SVG, ni GIF, ni texte", () => {
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageType(Buffer.from("GIF89a......"))).toBeNull();
    expect(sniffImageType(Buffer.from("bonjour"))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("validation d'un fichier importé", () => {
  it("accepte une image dont extension, type annoncé et contenu concordent", async () => {
    const result = validateUpload({ filename: "Portrait.JPG", declaredType: "image/jpeg", bytes: await image("jpeg") }, MB);
    expect(result).toEqual({ ok: true, mimeType: "image/jpeg", extension: "jpg" });
  });

  it("accepte un type annoncé vide (fréquent pour AVIF)", async () => {
    expect(validateUpload({ filename: "a.avif", declaredType: "", bytes: await image("avif") }, MB).ok).toBe(true);
  });

  it("refuse une extension qui ne correspond pas au contenu", async () => {
    const result = validateUpload({ filename: "image.png", declaredType: "image/png", bytes: await image("jpeg") }, MB);
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("extension") });
  });

  it("refuse un type annoncé contradictoire", async () => {
    const result = validateUpload({ filename: "image.png", declaredType: "image/jpeg", bytes: await image("png") }, MB);
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("type annoncé") });
  });

  it("refuse un fichier trop volumineux ou vide", async () => {
    const bytes = await image("png");
    expect(validateUpload({ filename: "a.png", declaredType: "image/png", bytes }, bytes.byteLength - 1)).toMatchObject({
      ok: false,
      reason: expect.stringContaining("trop volumineux"),
    });
    expect(validateUpload({ filename: "a.png", declaredType: "image/png", bytes: Buffer.alloc(0) }, MB)).toMatchObject({
      ok: false,
      reason: "Le fichier est vide.",
    });
  });

  it("refuse un SVG même renommé en .png", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(validateUpload({ filename: "x.png", declaredType: "image/png", bytes: svg }, MB).ok).toBe(false);
  });
});
