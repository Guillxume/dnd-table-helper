import "server-only";
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { z } from "zod";
import { GridStyle } from "@/generated/prisma/enums";
import {
  CELL_SIZES_TENTH_MM,
  computePrintLayout,
  effectiveDpi,
  MAX_CELLS,
  MIN_CELLS,
  type PageTile,
  type PrintLayout,
} from "@/lib/battle-map/layout";
import { cleanOptional } from "@/lib/text";
import { getDb } from "../db";
import { DomainError, NotFoundError } from "../errors";
import { getStorage } from "../storage";

export const battleMapInputSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(200),
  assetId: z.uuid({ message: "Choisissez une image." }),
  columns: z.coerce.number().int().min(MIN_CELLS).max(MAX_CELLS),
  rows: z.coerce.number().int().min(MIN_CELLS).max(MAX_CELLS),
  cellTenthMm: z.coerce
    .number()
    .refine((value) => (CELL_SIZES_TENTH_MM as readonly number[]).includes(value), "Taille de case non prise en charge."),
  gridStyle: z.enum(GridStyle),
  gridOpacity: z.coerce.number().int().min(10).max(100),
  showLabels: z.boolean(),
  notes: z.string().max(4000).optional(),
});

export type BattleMapInput = z.infer<typeof battleMapInputSchema>;

const mapSelect = {
  id: true,
  title: true,
  columns: true,
  rows: true,
  cellTenthMm: true,
  gridStyle: true,
  gridOpacity: true,
  showLabels: true,
  notes: true,
  updatedAt: true,
  asset: { select: { id: true, title: true, width: true, height: true, dominantColor: true, originalKey: true } },
} as const;

async function assertAsset(assetId: string) {
  const asset = await getDb().asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) throw new DomainError("L'image choisie n'existe plus.");
}

function toData(input: BattleMapInput) {
  return {
    title: input.title,
    assetId: input.assetId,
    columns: input.columns,
    rows: input.rows,
    cellTenthMm: input.cellTenthMm,
    gridStyle: input.gridStyle,
    gridOpacity: input.gridOpacity,
    showLabels: input.showLabels,
    notes: cleanOptional(input.notes),
  };
}

export async function createBattleMap(input: BattleMapInput) {
  await assertAsset(input.assetId);
  return getDb().battleMap.create({ data: toData(input), select: { id: true } });
}

export async function updateBattleMap(id: string, input: BattleMapInput): Promise<void> {
  await assertAsset(input.assetId);
  const updated = await getDb().battleMap.updateMany({ where: { id }, data: toData(input) });
  if (updated.count === 0) throw new NotFoundError("Carte");
}

export async function deleteBattleMap(id: string): Promise<void> {
  const deleted = await getDb().battleMap.deleteMany({ where: { id } });
  if (deleted.count === 0) throw new NotFoundError("Carte");
}

export async function listBattleMaps() {
  return getDb().battleMap.findMany({ orderBy: { updatedAt: "desc" }, select: mapSelect });
}

export async function getBattleMap(id: string) {
  return getDb().battleMap.findUnique({ where: { id }, select: mapSelect });
}

export type BattleMapDetail = NonNullable<Awaited<ReturnType<typeof getBattleMap>>>;

/** Mise en page et netteté d'une carte, pour l'aperçu et le PDF. */
export function describeBattleMap(map: Pick<BattleMapDetail, "columns" | "rows" | "cellTenthMm" | "asset">) {
  const layout = computePrintLayout({ columns: map.columns, rows: map.rows, cellTenthMm: map.cellTenthMm });
  return { layout, dpi: effectiveDpi(map.asset.width, map.asset.height, layout) };
}

// ─── Rendu PDF ─────────────────────────────────────────────────────────────

const PT_PER_MM = 72 / 25.4;
/** Résolution de rendu des tuiles : au-delà, le PDF grossit sans gain visible sur une image générée. */
const RENDER_DPI = 150;

const mm = (value: number) => value * PT_PER_MM;

/** A, B, … Z, AA, AB… : repère de colonne de cases. */
export function columnLabel(index: number): string {
  let label = "";
  let n = index + 1;
  while (n > 0) {
    const rest = (n - 1) % 26;
    label = String.fromCharCode(65 + rest) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/** L'image recadrée au centre pour remplir exactement le quadrillage (proportions colonnes × rangées). */
async function croppedImage(original: Buffer, columns: number, rows: number) {
  const oriented = await sharp(original).rotate().toBuffer();
  const { width, height } = await sharp(oriented).metadata();
  if (!width || !height) throw new DomainError("Image illisible.");
  const target = columns / rows;
  const cropWidth = width / height > target ? Math.round(height * target) : width;
  const cropHeight = width / height > target ? height : Math.round(width / target);
  const left = Math.floor((width - cropWidth) / 2);
  const top = Math.floor((height - cropHeight) / 2);
  return { buffer: oriented, left, top, width: cropWidth, height: cropHeight };
}

async function tileJpeg(
  image: Awaited<ReturnType<typeof croppedImage>>,
  map: { columns: number; rows: number },
  tile: PageTile,
  cellMm: number,
): Promise<Buffer> {
  const pxPerColumn = image.width / map.columns;
  const pxPerRow = image.height / map.rows;
  const left = image.left + Math.round(tile.firstColumn * pxPerColumn);
  const top = image.top + Math.round(tile.firstRow * pxPerRow);
  const right = image.left + Math.round((tile.firstColumn + tile.columns) * pxPerColumn);
  const bottom = image.top + Math.round((tile.firstRow + tile.rows) * pxPerRow);
  const targetWidth = Math.round(((tile.columns * cellMm) / 25.4) * RENDER_DPI);
  const targetHeight = Math.round(((tile.rows * cellMm) / 25.4) * RENDER_DPI);
  return sharp(image.buffer)
    .extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
    .resize(targetWidth, targetHeight, { fit: "fill", kernel: "lanczos3" })
    .jpeg({ quality: 88 })
    .toBuffer();
}

function neighbours(layout: PrintLayout, tile: PageTile): string {
  const find = (column: number, row: number) =>
    layout.pages.find((page) => page.pageColumn === column && page.pageRow === row)?.label;
  const parts = [
    find(tile.pageColumn - 1, tile.pageRow) && `${find(tile.pageColumn - 1, tile.pageRow)} à gauche`,
    find(tile.pageColumn + 1, tile.pageRow) && `${find(tile.pageColumn + 1, tile.pageRow)} à droite`,
    find(tile.pageColumn, tile.pageRow - 1) && `${find(tile.pageColumn, tile.pageRow - 1)} au-dessus`,
    find(tile.pageColumn, tile.pageRow + 1) && `${find(tile.pageColumn, tile.pageRow + 1)} en dessous`,
  ].filter(Boolean);
  return parts.length > 0 ? `Voisines : ${parts.join(", ")}.` : "Carte sur une seule feuille.";
}

/**
 * Texte encodable par les polices PDF standard (WinAnsi) : latin-1, guillemets et
 * apostrophes typographiques compris. Les autres caractères sont retirés.
 */
function safe(text: string): string {
  return text.replace(/[^\x20-\x7E -ÿ‘’“”…–]/g, "");
}

function drawAssemblyPage(
  pdf: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  overview: Awaited<ReturnType<PDFDocument["embedJpg"]>>,
  map: { title: string; columns: number; rows: number },
  layout: PrintLayout,
) {
  const page = pdf.addPage([mm(210), mm(297)]);
  const left = mm(18);
  let y = mm(297 - 25);
  const line = (text: string, size = 11, useBold = false) => {
    page.drawText(safe(text), { x: left, y, size, font: useBold ? bold : font, color: rgb(0.1, 0.1, 0.1) });
    y -= size * 1.6;
  };
  line(map.title, 18, true);
  line(`${map.columns} x ${map.rows} cases de ${String(layout.cellMm).replace(".", ",")} mm, ${layout.pages.length} feuille(s) A4 en ${layout.orientation === "portrait" ? "portrait" : "paysage"}.`);
  y -= mm(3);
  line("Pour imprimer", 13, true);
  line("1. Imprimez en taille réelle (100 %), sans « Ajuster à la page ».");
  line(`2. Vérifiez à la règle qu'une case mesure ${String(layout.cellMm / 10).replace(".", ",")} cm.`);
  line("3. Découpez chaque feuille le long du cadre noir de la carte.");
  line("4. Assemblez les feuilles selon le plan ci-dessous (repères en bas de chaque feuille).");

  // Plan : miniature de la carte entière, découpage des feuilles par-dessus.
  const maxWidth = mm(210 - 36);
  const maxHeight = y - mm(25);
  const scale = Math.min(maxWidth / layout.mapWidthMm, maxHeight / layout.mapHeightMm);
  const width = layout.mapWidthMm * scale;
  const height = layout.mapHeightMm * scale;
  const x0 = (mm(210) - width) / 2;
  const y0 = y - mm(8) - height;
  page.drawImage(overview, { x: x0, y: y0, width, height });
  for (const tile of layout.pages) {
    const tileX = x0 + tile.firstColumn * layout.cellMm * scale;
    const tileTop = y0 + height - tile.firstRow * layout.cellMm * scale;
    const tileWidth = tile.columns * layout.cellMm * scale;
    const tileHeight = tile.rows * layout.cellMm * scale;
    page.drawRectangle({
      x: tileX,
      y: tileTop - tileHeight,
      width: tileWidth,
      height: tileHeight,
      borderColor: rgb(1, 1, 1),
      borderWidth: 1.5,
    });
    const labelSize = Math.max(8, Math.min(20, tileHeight / 4));
    page.drawText(tile.label, {
      x: tileX + tileWidth / 2 - bold.widthOfTextAtSize(tile.label, labelSize) / 2,
      y: tileTop - tileHeight / 2 - labelSize / 3,
      size: labelSize,
      font: bold,
      color: rgb(1, 1, 1),
    });
  }
}

function drawTilePage(
  page: PDFPage,
  font: PDFFont,
  image: Awaited<ReturnType<PDFDocument["embedJpg"]>>,
  map: { title: string; gridStyle: GridStyle; gridOpacity: number; showLabels: boolean },
  layout: PrintLayout,
  tile: PageTile,
) {
  const cell = mm(layout.cellMm);
  const width = tile.columns * cell;
  const height = tile.rows * cell;
  const x0 = (mm(layout.pageWidthMm) - width) / 2;
  const y0 = (mm(layout.pageHeightMm) - height) / 2;
  page.drawImage(image, { x: x0, y: y0, width, height });

  const gridColor = map.gridStyle === "LIGHT" ? rgb(1, 1, 1) : rgb(0, 0, 0);
  const opacity = map.gridOpacity / 100;
  for (let column = 1; column < tile.columns; column++) {
    page.drawLine({ start: { x: x0 + column * cell, y: y0 }, end: { x: x0 + column * cell, y: y0 + height }, thickness: 0.6, color: gridColor, opacity });
  }
  for (let row = 1; row < tile.rows; row++) {
    page.drawLine({ start: { x: x0, y: y0 + row * cell }, end: { x: x0 + width, y: y0 + row * cell }, thickness: 0.6, color: gridColor, opacity });
  }
  // Cadre de découpe, toujours noir et net.
  page.drawRectangle({ x: x0, y: y0, width, height, borderColor: rgb(0, 0, 0), borderWidth: 0.8 });

  const grey = rgb(0.35, 0.35, 0.35);
  if (map.showLabels) {
    for (let column = 0; column < tile.columns; column++) {
      const label = columnLabel(tile.firstColumn + column);
      page.drawText(label, {
        x: x0 + column * cell + cell / 2 - font.widthOfTextAtSize(label, 7) / 2,
        y: y0 + height + mm(1.5),
        size: 7,
        font,
        color: grey,
      });
    }
    for (let row = 0; row < tile.rows; row++) {
      const label = String(tile.firstRow + row + 1);
      page.drawText(label, {
        x: x0 - mm(1.5) - font.widthOfTextAtSize(label, 7),
        y: y0 + height - row * cell - cell / 2 - 2.5,
        size: 7,
        font,
        color: grey,
      });
    }
  }
  const footer = safe(`Feuille ${tile.label} - ${map.title}. ${neighbours(layout, tile)} Imprimer en taille réelle (100 %).`);
  page.drawText(footer, { x: mm(10), y: mm(4.5), size: 7, font, color: grey, maxWidth: mm(layout.pageWidthMm - 20) });
}

/** PDF à imprimer : plan d'assemblage puis une feuille A4 par tuile, quadrillage vectoriel. */
export async function renderBattleMapPdf(id: string): Promise<{ buffer: Buffer; title: string; pages: number }> {
  const map = await getBattleMap(id);
  if (!map) throw new NotFoundError("Carte");
  const { layout } = describeBattleMap(map);

  const stored = await getStorage().get(map.asset.originalKey);
  if (!stored) throw new DomainError("Le fichier de l'image est introuvable dans le stockage.");
  const original = Buffer.from(await new Response(stored.body).arrayBuffer());
  const image = await croppedImage(original, map.columns, map.rows);

  const pdf = await PDFDocument.create();
  pdf.setTitle(map.title);
  pdf.setCreator("La Table de l'Étoile");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const overview = await pdf.embedJpg(
    await sharp(image.buffer)
      .extract({ left: image.left, top: image.top, width: image.width, height: image.height })
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer(),
  );
  drawAssemblyPage(pdf, font, bold, overview, map, layout);

  for (const tile of layout.pages) {
    const page = pdf.addPage([mm(layout.pageWidthMm), mm(layout.pageHeightMm)]);
    const jpeg = await pdf.embedJpg(await tileJpeg(image, map, tile, layout.cellMm));
    drawTilePage(page, font, jpeg, map, layout, tile);
  }

  return { buffer: Buffer.from(await pdf.save()), title: map.title, pages: layout.pages.length + 1 };
}
