import PDFDocument from "pdfkit";
import type { Pick } from "./encounter.js";
import { ACCENT, INK, MUTED, registerFonts } from "./export.js";
import { SRD_ATTRIBUTION } from "./srd/attribution.js";


/** Rubriques d'un bloc de statistiques, mises à la ligne pour la lecture (le texte du SRD est d'un seul tenant). */
export function statBlockParagraphs(text: string): string[] {
  return text
    .replace(/ (CA \d)/, "\n$1")
    // « MOD JS MOD JS MOD JS For 8 −1 −1 Dex 15 +2 +2 … » → « For 8 (−1, JS −1) · Dex 15 (+2, JS +2) · … »
    .replace(/ MOD JS MOD JS MOD JS ((?:(?:For|Dex|Con|Int|Sag|Cha) \d+ [−+-]\d+ [−+-]\d+ ?){6})/, (_m, abilities: string) =>
      `\n${abilities.trim().replace(/(For|Dex|Con|Int|Sag|Cha) (\d+) ([−+-]\d+) ([−+-]\d+)/g, "$1 $2 ($3, JS $4)").replace(/\) (?=[A-Z])/g, ") · ")} `,
    )
    .replace(/ (Compétences|Sens|Langues|Résistances|Immunités|Vulnérabilités) /g, "\n$1 ")
    .replace(/ (FP [\d/]+ \()/, "\n$1")
    .replace(/ (Traits|Actions [Bb]onus|Actions [Ll]égendaires|Réactions|Actions) (?=[A-ZÀÉ])/g, (_m, h: string) => `\n\n${h[0]}${h.slice(1).toLowerCase()}\n`)
    .split("\n");
}

export const STAT_HEADINGS = new Set(["Traits", "Actions", "Actions bonus", "Réactions", "Actions légendaires"]);

/** Blocs de statistiques des créatures d'une rencontre, à imprimer (texte du SRD 5.2.1, avec la mention de licence). */
export function renderStatBlocks(title: string, picks: Pick[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const M = 40;
    const doc = new PDFDocument({ size: "A4", margins: { top: M, bottom: M, left: M, right: M }, info: { Title: title, Author: "JdrHelper" } });
    registerFonts(doc);
    const chunks: Buffer[] = [];
    doc.on("data", (b: Buffer) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("title").fontSize(16).fillColor(ACCENT).text(title);
    doc.font("italic").fontSize(9).fillColor(MUTED).text(picks.map((p) => `${p.count} × ${p.creature.name}`).join(", "));
    for (const p of picks) {
      doc.moveDown(1);
      if (doc.y > doc.page.height - 160) doc.addPage();
      doc.font("title").fontSize(13).fillColor(ACCENT).text(`${p.creature.name}${p.count > 1 ? ` (× ${p.count})` : ""}`);
      doc.font("italic").fontSize(8.5).fillColor(MUTED).text(`FP ${p.creature.cr}, ${p.creature.xp} PX · SRD 5.2.1, p. ${p.creature.page}`);
      doc.moveDown(0.3);
      // Le titre est déjà affiché : on retire le nom en tête du texte du SRD.
      const text = p.creature.text.startsWith(p.creature.name) ? p.creature.text.slice(p.creature.name.length).trim() : p.creature.text;
      for (const para of statBlockParagraphs(text)) {
        const line = para.trim();
        if (!line) {
          doc.moveDown(0.3);
          continue;
        }
        const heading = STAT_HEADINGS.has(line);
        doc.font(heading ? "bold" : "body").fontSize(heading ? 10.5 : 9.5).fillColor(heading ? ACCENT : INK).text(line, { align: "left" });
      }
    }
    doc.moveDown(1.5);
    doc.font("italic").fontSize(7.5).fillColor(MUTED).text(SRD_ATTRIBUTION);
    doc.end();
  });
}
