import { describe, expect, it } from "vitest";
import { computePrintLayout, dpiQuality, effectiveDpi, PRINT_MARGIN_MM, rowsForImage } from "../../src/lib/battle-map/layout";

describe("découpage d'une carte en feuilles A4", () => {
  it("place des cases entières de 25 mm dans la zone imprimable", () => {
    const layout = computePrintLayout({ columns: 7, rows: 11, cellTenthMm: 250 });
    // A4 portrait : (210 - 2×10) / 25 = 7,6 → 7 colonnes ; (297 - 20) / 25 = 11,08 → 11 rangées.
    expect(layout).toMatchObject({ orientation: "portrait", cellsPerPage: { columns: 7, rows: 11 }, pageColumns: 1, pageRows: 1 });
    expect(layout.pages).toHaveLength(1);
    expect(7 * 25).toBeLessThanOrEqual(210 - 2 * PRINT_MARGIN_MM);
  });

  it("découpe une grande carte sur des limites de cases et nomme les feuilles", () => {
    const layout = computePrintLayout({ columns: 20, rows: 15, cellTenthMm: 250 });
    // Portrait : 3 × 2 = 6 feuilles ; paysage (11 × 7 cases) : 2 × 3 = 6 feuilles → portrait à égalité.
    expect(layout.orientation).toBe("portrait");
    expect(layout.pages.map((page) => page.label)).toEqual(["A1", "B1", "C1", "A2", "B2", "C2"]);
    const covered = layout.pages.reduce((sum, page) => sum + page.columns * page.rows, 0);
    expect(covered).toBe(20 * 15);
    expect(layout.pages.at(-1)).toMatchObject({ firstColumn: 14, firstRow: 11, columns: 6, rows: 4 });
    expect(layout.mapWidthMm).toBe(500);
  });

  it("choisit le paysage quand il demande moins de feuilles", () => {
    const layout = computePrintLayout({ columns: 11, rows: 7, cellTenthMm: 250 });
    expect(layout.orientation).toBe("landscape");
    expect(layout.pages).toHaveLength(1);
  });

  it("accepte la case d'un pouce (25,4 mm)", () => {
    const layout = computePrintLayout({ columns: 7, rows: 10, cellTenthMm: 254 });
    expect(layout.cellMm).toBeCloseTo(25.4);
    expect(layout.cellsPerPage).toEqual({ columns: 7, rows: 10 });
  });

  it("refuse un quadrillage hors limites", () => {
    expect(() => computePrintLayout({ columns: 1, rows: 10, cellTenthMm: 250 })).toThrow(RangeError);
    expect(() => computePrintLayout({ columns: 10, rows: 500, cellTenthMm: 250 })).toThrow(RangeError);
  });
});

describe("proportions et netteté", () => {
  it("déduit le nombre de rangées des proportions de l'image", () => {
    expect(rowsForImage(20, 1536, 1024)).toBe(13);
    expect(rowsForImage(10, 1024, 1536)).toBe(15);
  });

  it("calcule la netteté à l'impression", () => {
    // 20 cases de 25 mm = 500 mm = 19,69 pouces ; 1536 px / 19,69 = 78 ppp.
    const layout = computePrintLayout({ columns: 20, rows: 13, cellTenthMm: 250 });
    expect(effectiveDpi(1536, 1024, layout)).toBe(78);
    expect(dpiQuality(78)).toBe("soft");
    expect(dpiQuality(150)).toBe("good");
    expect(dpiQuality(40)).toBe("poor");
  });
});
