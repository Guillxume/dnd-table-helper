import PDFDocument from "pdfkit";
import { PDFDocument as PdfLib } from "pdf-lib";
import type { Campaign, SessionRecord } from "./db.js";
import { characterPdf } from "./character/render.js";
import type { Draft } from "./character/draft.js";
import { SRD_ATTRIBUTION } from "./srd/attribution.js";
import { TIMEZONE } from "./time.js";
import { createRequire } from "node:module";
import { basename, join } from "node:path";

/** Limite d'envoi de fichiers d'un bot sur un serveur sans boost (10 Mio). */
export const DISCORD_UPLOAD_LIMIT = 10 * 1024 * 1024;

export interface ExportCharacter {
  name: string;
  player: string;
  draft: Draft;
}

const day = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: TIMEZONE, day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

const require = createRequire(import.meta.url);
/** Polices sous licence SIL OFL 1.1 (paquets @fontsource) : Cinzel pour les titres, EB Garamond pour le texte. */
export const FONTS = {
  title: "@fontsource/cinzel/files/cinzel-latin-700-normal.woff",
  titleLight: "@fontsource/cinzel/files/cinzel-latin-400-normal.woff",
  body: "@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff",
  italic: "@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff",
  bold: "@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff",
} as const;

/**
 * Chemin d'une police. PDF_FONTS_DIR (dossier contenant ces fichiers .woff) sert au site, où le
 * code est empaqueté et où require.resolve ne retrouve pas les paquets ; le bot résout les paquets.
 */
export function fontFile(key: keyof typeof FONTS): string {
  const dir = process.env.PDF_FONTS_DIR?.trim();
  return dir ? join(dir, basename(FONTS[key])) : require.resolve(FONTS[key]);
}

/** Enregistre les polices du thème dans un document pdfkit. */
export function registerFonts(doc: PDFKit.PDFDocument): void {
  for (const key of Object.keys(FONTS) as (keyof typeof FONTS)[]) doc.registerFont(key, fontFile(key));
}

// Encre sombre sur papier blanc : lisible et économe à l'impression.
export const INK = "#2b2118";
export const ACCENT = "#7a2e1d";
export const MUTED = "#7d6e5e";
export const RULE = "#b8a68a";

export function roman(n: number): string {
  const table: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, r] of table) while (n >= v) (out += r), (n -= v);
  return out;
}

/** Bloc du rappel : titre (ligne en gras), puce, ou paragraphe. */
export type RecapBlock = { kind: "heading" | "bullet" | "para"; text: string };

export function recapBlocks(markdown: string): RecapBlock[] {
  const out: RecapBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "para", text: para.join(" ") });
    para = [];
  };
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(?:#+\s*)?\*\*(.+?)\*\*\s*:?$/.exec(line) ?? /^#+\s*(.+)$/.exec(line);
    if (heading) {
      flush();
      out.push({ kind: "heading", text: heading[1]!.replace(/\s*:$/, "") });
      continue;
    }
    const bullet = /^(?:[-*•]|\d+[.)])\s+(.+)$/.exec(line);
    if (bullet) {
      flush();
      out.push({ kind: "bullet", text: bullet[1]!.replace(/\*\*(.+?)\*\*/g, "$1") });
      continue;
    }
    para.push(line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1"));
  }
  flush();
  return out;
}

/**
 * Chroniques de la campagne : couverture, sommaire, un chapitre par séance, puis une page d'ouverture
 * du « Livre des héros ». `sheetPages` : nombre de pages de chaque fiche, pour le sommaire.
 */
export function renderChronicle(c: Campaign, sessions: SessionRecord[], chars: ExportCharacter[], now = new Date(), sheetPages: number[] = []): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const M = 64;
    const doc = new PDFDocument({ size: "A4", margins: { top: M + 14, bottom: M + 10, left: M, right: M }, bufferPages: true, info: { Title: `Campagne : ${c.name}`, Author: "JdrHelper" } });
    registerFonts(doc);
    const chunks: Buffer[] = [];
    doc.on("data", (b: Buffer) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const PW = doc.page.width;
    const PH = doc.page.height;
    const W = PW - 2 * M;
    const plain = new Set<number>(); // pages sans en-tête ni pied (couverture, pages de titre)

    const diamond = (x: number, y: number, r: number, fill = ACCENT) => doc.save().moveTo(x, y - r).lineTo(x + r, y).lineTo(x, y + r).lineTo(x - r, y).closePath().fill(fill).restore();
    const divider = (y: number, width = 180) => {
      const cx = PW / 2;
      doc.save().lineWidth(0.6).strokeColor(RULE).moveTo(cx - width / 2, y).lineTo(cx - 8, y).moveTo(cx + 8, y).lineTo(cx + width / 2, y).stroke().restore();
      diamond(cx, y, 3.2);
      diamond(cx - width / 2 - 4, y, 1.6, RULE);
      diamond(cx + width / 2 + 4, y, 1.6, RULE);
    };
    const frame = () => {
      const o = 30;
      const i = 36;
      doc.save().lineWidth(1.2).strokeColor(ACCENT).rect(o, o, PW - 2 * o, PH - 2 * o).stroke();
      doc.lineWidth(0.4).strokeColor(RULE).rect(i, i, PW - 2 * i, PH - 2 * i).stroke().restore();
      for (const [x, y] of [[o, o], [PW - o, o], [o, PH - o], [PW - o, PH - o]] as const) diamond(x, y, 5);
    };
    const center = (text: string, font: keyof typeof FONTS, size: number, color: string, y?: number, opts: PDFKit.Mixins.TextOptions = {}) => {
      doc.font(font).fontSize(size).fillColor(color);
      doc.text(text, M, y ?? doc.y, { width: W, align: "center", ...opts });
    };

    // ---------- Couverture ----------
    plain.add(0);
    frame();
    center("Chroniques de campagne", "titleLight", 11, MUTED, 170, { characterSpacing: 3 });
    doc.moveDown(0.8);
    center(c.name, "title", 32, INK);
    doc.moveDown(0.6);
    divider(doc.y + 6, 220);
    doc.moveDown(1.6);
    const span = sessions.length
      ? `${sessions.length} séance${sessions.length > 1 ? "s" : ""} racontée${sessions.length > 1 ? "s" : ""}, du ${day(sessions[0]!.createdAt)} au ${day(sessions.at(-1)!.createdAt)}`
      : "Aucune séance racontée pour le moment";
    center(span, "italic", 13, MUTED);
    if (chars.length) {
      doc.moveDown(3);
      center("Dramatis personae", "title", 13, ACCENT, undefined, { characterSpacing: 1.5 });
      doc.moveDown(0.6);
      for (const ch of chars) {
        doc.font("bold").fontSize(13).fillColor(INK);
        const label = `${ch.name}`;
        const tail = `  ·  ${ch.player}`;
        const wLabel = doc.widthOfString(label);
        doc.font("italic").fontSize(12);
        const wTail = doc.widthOfString(tail);
        const x = (PW - wLabel - wTail) / 2;
        const y = doc.y;
        doc.font("bold").fontSize(13).fillColor(INK).text(label, x, y, { lineBreak: false });
        doc.font("italic").fontSize(12).fillColor(MUTED).text(tail, x + wLabel, y + 1, { lineBreak: false });
        doc.x = M;
        doc.y = y + 20;
      }
    }
    center(`Exporté le ${day(now.toISOString())}`, "italic", 10, MUTED, PH - 150);
    doc.font("body").fontSize(6.5).fillColor(MUTED).text(SRD_ATTRIBUTION, M + 20, PH - 118, { width: W - 40, align: "center" });

    // ---------- Sommaire (rempli à la fin) ----------
    doc.addPage();
    const tocPage = 1;
    const chapterPages: number[] = [];

    // ---------- Chapitres ----------
    let first = true;
    for (const s of sessions) {
      const room = PH - doc.page.margins.bottom - doc.y;
      if (first || room < 220) doc.addPage();
      else doc.moveDown(2.2);
      first = false;
      chapterPages.push(doc.bufferedPageRange().count - 1);
      center(`Chapitre ${roman(s.number)}`, "titleLight", 10, ACCENT, undefined, { characterSpacing: 3 });
      doc.moveDown(0.2);
      center(`Séance ${s.number}`, "title", 22, INK);
      center(`Rappel publié le ${day(s.createdAt)}`, "italic", 11, MUTED);
      doc.moveDown(0.4);
      divider(doc.y + 4, 140);
      doc.moveDown(1.4);
      for (const b of recapBlocks(s.recap)) {
        if (doc.y > PH - doc.page.margins.bottom - 40) doc.addPage();
        if (b.kind === "heading") {
          doc.moveDown(0.5);
          doc.font("title").fontSize(10.5).fillColor(ACCENT).text(b.text.toUpperCase(), M, doc.y, { width: W, characterSpacing: 1 });
          doc.save().lineWidth(0.4).strokeColor(RULE).moveTo(M, doc.y + 1).lineTo(M + 60, doc.y + 1).stroke().restore();
          doc.moveDown(0.5);
        } else if (b.kind === "bullet") {
          const y = doc.y;
          diamond(M + 8, y + 7, 2.2);
          doc.font("body").fontSize(11.5).fillColor(INK).text(b.text, M + 18, y, { width: W - 18, lineGap: 1.5, align: "left" });
          doc.moveDown(0.15);
        } else {
          doc.font("body").fontSize(11.5).fillColor(INK).text(b.text, M, doc.y, { width: W, align: "justify", lineGap: 2 });
          doc.moveDown(0.6);
        }
      }
    }
    if (!sessions.length) {
      doc.addPage();
      center("Aucun rappel de séance publié pour le moment.", "italic", 12, MUTED, 200);
    }

    // ---------- Page d'ouverture des fiches ----------
    let heroesPage = -1;
    if (chars.length && sheetPages.length) {
      doc.addPage();
      heroesPage = doc.bufferedPageRange().count - 1;
      plain.add(heroesPage);
      frame();
      center("Livre des héros", "title", 28, INK, 300);
      doc.moveDown(0.6);
      divider(doc.y + 6, 200);
      doc.moveDown(1.6);
      center("Les fiches de personnage, telles qu’au moment de l’export.", "italic", 12, MUTED);
    }

    // ---------- Sommaire ----------
    const total = doc.bufferedPageRange().count;
    doc.switchToPage(tocPage);
    center("Sommaire", "title", 22, INK, M + 30);
    doc.moveDown(0.4);
    divider(doc.y + 4, 140);
    doc.moveDown(1.6);
    const line = (label: string, page: number, sub = false) => {
      const y = doc.y;
      doc.font(sub ? "body" : "bold").fontSize(sub ? 11.5 : 12.5).fillColor(INK);
      const num = String(page);
      const wl = doc.widthOfString(label);
      const wn = doc.widthOfString(num);
      const indent = sub ? 16 : 0;
      doc.text(label, M + indent, y, { lineBreak: false });
      doc.text(num, M + W - wn, y, { lineBreak: false });
      const dots = M + indent + wl + 6;
      const end = M + W - wn - 6;
      doc.save().fillColor(RULE);
      for (let x = dots; x < end; x += 5) doc.circle(x, y + 9, 0.6).fill();
      doc.restore();
      doc.x = M;
      doc.y = y + (sub ? 19 : 23);
    };
    if (sessions.length) {
      line("Chroniques", (chapterPages[0] ?? 2) + 1);
      sessions.forEach((s, k) => line(`Chapitre ${roman(s.number)} · Séance ${s.number}, ${day(s.createdAt)}`, chapterPages[k]! + 1, true));
    }
    if (heroesPage >= 0) {
      doc.moveDown(0.6);
      line("Livre des héros", heroesPage + 1);
      let p = total + 1;
      chars.forEach((ch, k) => {
        line(`${ch.name} (${ch.player})`, p, true);
        p += sheetPages[k] ?? 0;
      });
    }

    // ---------- En-têtes et pieds de page ----------
    for (let p = 0; p < total; p++) {
      if (plain.has(p)) continue;
      doc.switchToPage(p);
      const top = doc.page.margins.top;
      const bottom = doc.page.margins.bottom;
      doc.page.margins.top = 0;
      doc.page.margins.bottom = 0;
      doc.font("titleLight").fontSize(7.5).fillColor(MUTED).text(c.name.toUpperCase(), M, 40, { width: W, align: "center", characterSpacing: 2, lineBreak: false });
      doc.save().lineWidth(0.4).strokeColor(RULE).moveTo(M, 54).lineTo(PW - M, 54).stroke().restore();
      doc.font("italic").fontSize(10).fillColor(MUTED).text(`~ ${p + 1} ~`, M, PH - 46, { width: W, align: "center", lineBreak: false });
      doc.page.margins.top = top;
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}

/** PDF unique à imprimer : chroniques puis fiches (feuilles aplaties pour éviter les conflits de champs). */
export async function buildCampaignExport(c: Campaign, sessions: SessionRecord[], chars: ExportCharacter[], opts: { sheets: boolean }): Promise<Buffer> {
  const sheets: PdfLib[] = [];
  if (opts.sheets) {
    for (const ch of chars) {
      const pdf = await PdfLib.load(await characterPdf(ch.draft, ch.player));
      try {
        pdf.getForm().flatten();
      } catch {
        // Fiche maison : pas de formulaire à aplatir.
      }
      sheets.push(pdf);
    }
  }
  const out = await PdfLib.load(await renderChronicle(c, sessions, chars, new Date(), sheets.map((p) => p.getPageCount())));
  for (const pdf of sheets) {
    const pages = await out.copyPages(pdf, pdf.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  out.setTitle(`Campagne : ${c.name}`);
  return Buffer.from(await out.save());
}
