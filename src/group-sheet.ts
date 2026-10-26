import PDFDocument from "pdfkit";
import type { Campaign } from "./db.js";
import type { Draft } from "./character/draft.js";
import type { Sheet } from "./character/sheet.js";
import { validateDraft } from "./character/validate.js";
import { ACCENT, INK, MUTED, RULE, registerFonts } from "./export.js";
import { TIMEZONE } from "./time.js";


export interface GroupMember {
  name: string;
  player: string;
  draft: Draft;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Une ligne de la fiche de groupe : les valeurs dont le MJ a besoin pendant la séance, sans ouvrir les fiches. */
export interface GroupRow {
  name: string;
  player: string;
  identity: string;
  ac: string;
  hp: string;
  initiative: string;
  speed: string;
  passive: string;
  saves: string;
  spells: string;
  notes: string;
}

export function groupRow(m: GroupMember): GroupRow {
  const v = validateDraft(m.draft);
  const s: Sheet | undefined = v.sheet;
  if (!s) {
    return { name: m.name, player: m.player, identity: "Fiche incomplète", ac: "", hp: "", initiative: "", speed: "", passive: "", saves: "", spells: "", notes: v.errors.join(" ") };
  }
  const notes = [
    s.darkvision ? `Vision dans le noir ${s.darkvision}` : "",
    s.resistances.length ? `Résistances : ${s.resistances.join(", ")}` : "",
    s.languages.length ? `Langues : ${s.languages.join(", ")}` : "",
  ].filter(Boolean);
  return {
    name: s.name,
    player: m.player,
    identity: `${s.speciesName}${s.speciesDetail ? ` (${s.speciesDetail})` : ""}, ${s.className}, ${s.backgroundName}`,
    ac: String(s.ac),
    hp: `${s.hp} (${s.hitDie})`,
    initiative: signed(s.initiative),
    speed: s.speed,
    passive: String(s.passivePerception),
    // Astérisque : sauvegarde maîtrisée.
    saves: s.saves.map((x) => `${x.ability} ${signed(x.bonus)}${x.proficient ? "*" : ""}`).join("  "),
    // Une ligne par source de sorts (classe, espèce, don), avec sa source : le DD et l'attaque peuvent différer.
    spells:
      s.spellBlocks
        .map((b) => `${b.title.replace(/^Sorts (de |d’)/, "").replace(/^espèce \((.+)\)$/, "$1")} : DD ${b.dc}, att. ${signed(b.attackBonus)}${b.slotCount ? `, ${b.slotCount} empl. niv. 1` : ""}`)
        .join("\n") || "aucun",
    notes: notes.join(". "),
  };
}

const COLUMNS: { key: keyof GroupRow; label: string; width: number }[] = [
  { key: "name", label: "Personnage", width: 150 },
  { key: "ac", label: "CA", width: 34 },
  { key: "hp", label: "PV max", width: 52 },
  { key: "initiative", label: "Init.", width: 36 },
  { key: "speed", label: "Vitesse", width: 48 },
  { key: "passive", label: "Perc. passive", width: 50 },
  { key: "saves", label: "Sauvegardes (* maîtrisée)", width: 150 },
  { key: "spells", label: "Sorts (DD, attaque)", width: 122 },
  { key: "notes", label: "Sens, résistances, langues", width: 140 },
];

/** Fiche de groupe sur une page A4 paysage, à imprimer pour la table du MJ. */
export function renderGroupSheet(c: Campaign, members: GroupMember[], now = new Date()): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const M = 30;
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: M, bottom: M, left: M, right: M }, info: { Title: `Fiche de groupe : ${c.name}`, Author: "JdrHelper" } });
    registerFonts(doc);
    const chunks: Buffer[] = [];
    doc.on("data", (b: Buffer) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const date = new Intl.DateTimeFormat("fr-FR", { timeZone: TIMEZONE, day: "numeric", month: "long", year: "numeric" }).format(now);
    doc.font("title").fontSize(16).fillColor(ACCENT).text(`Fiche de groupe : ${c.name}`, M, M);
    doc.font("italic").fontSize(9).fillColor(MUTED).text(
      `${date}. Valeurs calculées par le bot au niveau 1, à corriger au crayon après une montée de niveau. Un personnage actif par joueur.`,
    );
    doc.moveDown(0.6);

    const pad = 4;
    const tableWidth = COLUMNS.reduce((a, col) => a + col.width, 0);
    let y = doc.y;
    // En-tête
    doc.font("bold").fontSize(9).fillColor(INK);
    let x = M;
    const headerH = Math.max(...COLUMNS.map((col) => doc.heightOfString(col.label, { width: col.width - 2 * pad }))) + 2 * pad;
    for (const col of COLUMNS) {
      doc.text(col.label, x + pad, y + pad, { width: col.width - 2 * pad });
      x += col.width;
    }
    y += headerH;
    doc.moveTo(M, y).lineTo(M + tableWidth, y).lineWidth(1).strokeColor(ACCENT).stroke();

    if (members.length === 0) {
      doc.font("body").fontSize(11).fillColor(INK).text("Aucun personnage dans cette campagne pour le moment.", M, y + 10);
    }
    for (const m of members) {
      const row = groupRow(m);
      const cell = (key: keyof GroupRow): { text: string; sub?: string } =>
        key === "name" ? { text: row.name, sub: `${row.identity}\nJoueur : ${row.player}` } : { text: row[key] };
      doc.fontSize(9);
      const heights = COLUMNS.map((col) => {
        const c2 = cell(col.key);
        doc.font(col.key === "name" ? "bold" : "body").fontSize(col.key === "name" ? 10 : 9);
        let h = doc.heightOfString(c2.text || " ", { width: col.width - 2 * pad });
        if (c2.sub) h += doc.font("body").fontSize(8).heightOfString(c2.sub, { width: col.width - 2 * pad });
        return h;
      });
      const rowH = Math.max(...heights) + 2 * pad;
      x = M;
      for (const col of COLUMNS) {
        const c2 = cell(col.key);
        const big = ["ac", "hp", "initiative", "passive"].includes(col.key);
        doc.font(col.key === "name" || big ? "bold" : "body").fontSize(col.key === "name" ? 10 : big ? 11 : 9).fillColor(INK);
        doc.text(c2.text, x + pad, y + pad, { width: col.width - 2 * pad });
        if (c2.sub) doc.font("body").fontSize(8).fillColor(MUTED).text(c2.sub, { width: col.width - 2 * pad });
        x += col.width;
      }
      y += rowH;
      doc.moveTo(M, y).lineTo(M + tableWidth, y).lineWidth(0.5).strokeColor(RULE).stroke();
    }
    doc.end();
  });
}
