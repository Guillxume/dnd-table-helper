/**
 * Découpage d'une carte quadrillée en feuilles A4 à imprimer.
 *
 * Les feuilles sont découpées sur des limites de cases : aucune case n'est coupée,
 * chaque feuille porte des cases entières et s'assemble bord à bord avec ses voisines.
 * Toutes les mesures sont en millimètres.
 */

export const A4_MM = { width: 210, height: 297 } as const;
/** Marge laissée à l'imprimante (la plupart n'impriment pas jusqu'au bord). */
export const PRINT_MARGIN_MM = 10;

/** Tailles de case proposées : 25 mm (usage français courant) ou 25,4 mm (un pouce). */
export const CELL_SIZES_TENTH_MM = [250, 254] as const;
export type CellSizeTenthMm = (typeof CELL_SIZES_TENTH_MM)[number];

export const MIN_CELLS = 2;
export const MAX_CELLS = 120;

export type Orientation = "portrait" | "landscape";

export type PageTile = {
  /** Repère d'assemblage : lettre de colonne de feuilles, numéro de rangée (« A1 », « B1 »…). */
  label: string;
  pageColumn: number;
  pageRow: number;
  /** Première case (colonne, rangée) de la feuille, à partir de 0. */
  firstColumn: number;
  firstRow: number;
  columns: number;
  rows: number;
};

export type PrintLayout = {
  orientation: Orientation;
  cellMm: number;
  pageWidthMm: number;
  pageHeightMm: number;
  /** Cases entières par feuille. */
  cellsPerPage: { columns: number; rows: number };
  pageColumns: number;
  pageRows: number;
  pages: PageTile[];
  /** Taille réelle de la carte assemblée. */
  mapWidthMm: number;
  mapHeightMm: number;
};

export function pageLabel(pageColumn: number, pageRow: number): string {
  return `${String.fromCharCode(65 + pageColumn)}${pageRow + 1}`;
}

function layoutFor(columns: number, rows: number, cellMm: number, orientation: Orientation): PrintLayout {
  const pageWidthMm = orientation === "portrait" ? A4_MM.width : A4_MM.height;
  const pageHeightMm = orientation === "portrait" ? A4_MM.height : A4_MM.width;
  const perPageColumns = Math.floor((pageWidthMm - 2 * PRINT_MARGIN_MM) / cellMm);
  const perPageRows = Math.floor((pageHeightMm - 2 * PRINT_MARGIN_MM) / cellMm);
  const pageColumns = Math.ceil(columns / perPageColumns);
  const pageRows = Math.ceil(rows / perPageRows);
  const pages: PageTile[] = [];
  for (let pageRow = 0; pageRow < pageRows; pageRow++) {
    for (let pageColumn = 0; pageColumn < pageColumns; pageColumn++) {
      const firstColumn = pageColumn * perPageColumns;
      const firstRow = pageRow * perPageRows;
      pages.push({
        label: pageLabel(pageColumn, pageRow),
        pageColumn,
        pageRow,
        firstColumn,
        firstRow,
        columns: Math.min(perPageColumns, columns - firstColumn),
        rows: Math.min(perPageRows, rows - firstRow),
      });
    }
  }
  return {
    orientation,
    cellMm,
    pageWidthMm,
    pageHeightMm,
    cellsPerPage: { columns: perPageColumns, rows: perPageRows },
    pageColumns,
    pageRows,
    pages,
    mapWidthMm: columns * cellMm,
    mapHeightMm: rows * cellMm,
  };
}

/** Orientation qui demande le moins de feuilles (portrait à égalité). */
export function computePrintLayout(input: { columns: number; rows: number; cellTenthMm: number }): PrintLayout {
  const { columns, rows } = input;
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < MIN_CELLS || rows < MIN_CELLS || columns > MAX_CELLS || rows > MAX_CELLS) {
    throw new RangeError(`Le quadrillage doit compter de ${MIN_CELLS} à ${MAX_CELLS} cases par côté.`);
  }
  const cellMm = input.cellTenthMm / 10;
  const portrait = layoutFor(columns, rows, cellMm, "portrait");
  const landscape = layoutFor(columns, rows, cellMm, "landscape");
  return landscape.pages.length < portrait.pages.length ? landscape : portrait;
}

/** Nombre de rangées qui respecte les proportions de l'image pour un nombre de colonnes donné. */
export function rowsForImage(columns: number, imageWidth: number, imageHeight: number): number {
  return Math.min(MAX_CELLS, Math.max(MIN_CELLS, Math.round((columns * imageHeight) / imageWidth)));
}

/** Netteté obtenue à l'impression, en points par pouce, quand l'image couvre toute la carte. */
export function effectiveDpi(imageWidth: number, imageHeight: number, layout: Pick<PrintLayout, "mapWidthMm" | "mapHeightMm">): number {
  const byWidth = imageWidth / (layout.mapWidthMm / 25.4);
  const byHeight = imageHeight / (layout.mapHeightMm / 25.4);
  return Math.round(Math.min(byWidth, byHeight));
}

/**
 * Seuils d'alerte, hypothèses de travail à valider sur une première impression :
 * au-dessous de 100 ppp le flou se voit nettement, au-dessous de 60 la carte devient difficile à lire.
 */
export function dpiQuality(dpi: number): "good" | "soft" | "poor" {
  if (dpi >= 100) return "good";
  if (dpi >= 60) return "soft";
  return "poor";
}
