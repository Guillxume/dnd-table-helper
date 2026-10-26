import { afterEach, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { fontFile } from "../src/export.js";

describe("polices des PDF", () => {
  const saved = process.env.PDF_FONTS_DIR;
  afterEach(() => {
    if (saved === undefined) delete process.env.PDF_FONTS_DIR;
    else process.env.PDF_FONTS_DIR = saved;
  });

  it("résout les paquets @fontsource par défaut (bot)", () => {
    delete process.env.PDF_FONTS_DIR;
    expect(existsSync(fontFile("title"))).toBe(true);
  });

  it("lit les fichiers dans PDF_FONTS_DIR quand il est défini (site)", () => {
    process.env.PDF_FONTS_DIR = "/app/web/assets/pdf-fonts";
    expect(fontFile("body")).toBe("/app/web/assets/pdf-fonts/eb-garamond-latin-400-normal.woff");
  });
});
