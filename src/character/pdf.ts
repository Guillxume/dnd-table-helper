import PDFDocument from "pdfkit";
import { ABILITIES, ABILITY_NAMES, signed, type Ability } from "../srd/index.js";
import { SRD_ATTRIBUTION } from "../srd/attribution.js";
import type { Sheet } from "./sheet.js";

const INK = "#1f1b16";
const ACCENT = "#6b2d1f";
const PAPER = "#f4efe6";
const LINE = "#8a7f6d";
const MUTED = "#5d554a";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 28;
const FOOTER_H = 22;
const BOTTOM = PAGE_H - M - FOOTER_H;

type Doc = InstanceType<typeof PDFDocument>;

function setFont(doc: Doc, bold = false, size = 9, color = INK, italic = false) {
  doc.font(bold ? "Helvetica-Bold" : italic ? "Helvetica-Oblique" : "Helvetica").fontSize(size).fillColor(color);
}

function h(doc: Doc, text: string, width: number, size: number, bold = false, italic = false): number {
  doc.font(bold ? "Helvetica-Bold" : italic ? "Helvetica-Oblique" : "Helvetica").fontSize(size);
  return doc.heightOfString(text, { width });
}

function frame(doc: Doc, x: number, y: number, w: number, hgt: number, fill = false) {
  doc.save().lineWidth(0.8).strokeColor(LINE);
  if (fill) doc.fillColor(PAPER).roundedRect(x, y, w, hgt, 4).fillAndStroke(PAPER, LINE);
  else doc.roundedRect(x, y, w, hgt, 4).stroke();
  doc.restore();
}

function sectionTitle(doc: Doc, text: string, x: number, y: number, w: number): number {
  setFont(doc, true, 8.5, ACCENT);
  doc.text(text.toUpperCase(), x, y, { width: w, characterSpacing: 0.6, lineBreak: false });
  doc.save().lineWidth(0.6).strokeColor(ACCENT).moveTo(x, y + 12).lineTo(x + w, y + 12).stroke().restore();
  return y + 17;
}

function dot(doc: Doc, x: number, y: number, filled: boolean, double = false) {
  doc.save().lineWidth(0.8).strokeColor(INK);
  doc.circle(x, y, 3).stroke();
  if (filled) doc.circle(x, y, 3).fillColor(INK).fill();
  if (double) doc.circle(x, y, 5).stroke();
  doc.restore();
}

function statBox(doc: Doc, x: number, y: number, w: number, label: string, value: string, sub?: string) {
  frame(doc, x, y, w, 46, true);
  setFont(doc, true, 15, INK);
  doc.text(value, x, y + 8, { width: w, align: "center", lineBreak: false });
  setFont(doc, true, 6.5, MUTED);
  doc.text(label.toUpperCase(), x + 2, y + 31, { width: w - 4, align: "center", lineBreak: false });
  if (sub) {
    setFont(doc, false, 6, MUTED);
    doc.text(sub, x + 2, y + 38, { width: w - 4, align: "center", lineBreak: false });
  }
}

interface Block {
  title: string;
  height(w: number): number;
  draw(x: number, y: number, w: number): void;
}

function paragraphBlock(doc: Doc, title: string, lines: { label?: string; text: string }[]): Block {
  const render = (x: number, y: number, w: number, draw: boolean): number => {
    let cy = y + 17;
    for (const l of lines) {
      const full = l.label ? `${l.label} ${l.text}` : l.text;
      const hh = h(doc, full, w, 8.5);
      if (draw) {
        if (l.label) {
          setFont(doc, true, 8.5, INK);
          doc.text(l.label + " ", x, cy, { width: w, continued: true });
          setFont(doc, false, 8.5, INK);
          doc.text(l.text, { width: w });
        } else {
          setFont(doc, false, 8.5, INK);
          doc.text(l.text, x, cy, { width: w });
        }
      }
      cy += hh + 3;
    }
    return cy - y;
  };
  return {
    title,
    height: (w) => render(0, 0, w, false) + 4,
    draw: (x, y, w) => {
      sectionTitle(doc, title, x, y, w);
      render(x, y, w, true);
    },
  };
}

function attacksBlock(doc: Doc, sheet: Sheet): Block {
  const cols = (w: number) => ({ name: 118, atk: 34, dmg: 86, notes: w - 118 - 34 - 86 });
  const rowH = (a: Sheet["attacks"][number], w: number) => {
    const c = cols(w);
    return Math.max(
      h(doc, a.name, c.name - 4, 8.5, true),
      h(doc, a.damage, c.dmg - 4, 8.5),
      h(doc, a.notes || " ", c.notes - 2, 7.5),
    ) + 5;
  };
  return {
    title: "Attaques",
    height: (w) => 17 + 12 + sheet.attacks.reduce((s, a) => s + rowH(a, w), 0) + 4,
    draw: (x, y, w) => {
      const c = cols(w);
      let cy = sectionTitle(doc, "Attaques", x, y, w);
      setFont(doc, true, 7, MUTED);
      doc.text("Arme", x, cy, { width: c.name, lineBreak: false });
      doc.text("Bonus", x + c.name, cy, { width: c.atk, lineBreak: false });
      doc.text("Dégâts", x + c.name + c.atk, cy, { width: c.dmg, lineBreak: false });
      doc.text("Notes", x + c.name + c.atk + c.dmg, cy, { width: c.notes, lineBreak: false });
      cy += 12;
      for (const a of sheet.attacks) {
        const rh = rowH(a, w);
        setFont(doc, true, 8.5);
        doc.text(a.name, x, cy, { width: c.name - 4 });
        setFont(doc, true, 8.5);
        doc.text(a.attack, x + c.name, cy, { width: c.atk, lineBreak: false });
        setFont(doc, false, 8.5);
        doc.text(a.damage, x + c.name + c.atk, cy, { width: c.dmg - 4 });
        setFont(doc, false, 7.5, MUTED);
        doc.text(a.notes, x + c.name + c.atk + c.dmg, cy, { width: c.notes - 2 });
        doc.save().lineWidth(0.3).strokeColor("#c9c0b0").moveTo(x, cy + rh - 2).lineTo(x + w, cy + rh - 2).stroke().restore();
        cy += rh;
      }
    },
  };
}

/**
 * Fiche maison complète, ou annexe (`annex`) jointe à la feuille officielle : textes complets des aptitudes et sorts,
 * équipement de départ à recopier, détail des calculs et mentions de licence.
 */
export function renderSheetPdf(sheet: Sheet, opts: { annex?: boolean } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: M, bottom: M, left: M, right: M },
      bufferPages: true,
      info: {
        Title: `Fiche de personnage : ${sheet.name}`,
        Author: "JdrHelper",
        Subject: "Personnage de niveau 1, D&D 2024 (SRD 5.2.1)",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let overflow: Block[] = [];
    // Fiche à cases vides : les valeurs qui dépendent des caractéristiques ne sont pas imprimées.
    const known = (v: string) => (sheet.scoresPending ? "" : v);
    const pendingNote = paragraphBlock(doc, "Caractéristiques à tirer à la table", [
      {
        text: "Lance 4d6 six fois et garde les trois meilleurs dés de chaque lancer. Répartis les six totaux, ajoute le bonus d’historique (+2 et +1, ou +1 aux trois), puis complète au crayon les cases vides avec les formules du détail des calculs. Tu peux aussi saisir tes résultats dans le bot (/personnage creer) pour obtenir la fiche remplie.",
      },
    ]);
    const calcBlock = paragraphBlock(doc, "Détail des calculs", sheet.calculations.map((c) => ({ label: `${c.label} :`, text: `${c.value} = ${c.detail}` })));
    if (opts.annex) {
      setFont(doc, true, 16, INK);
      doc.text(`Annexe de la fiche : ${sheet.name}`, M, M, { width: PAGE_W - 2 * M });
      setFont(doc, false, 8.5, MUTED);
      doc.text(
        `${sheet.className} niveau 1 · ${sheet.speciesName}${sheet.speciesDetail ? ` (${sheet.speciesDetail})` : ""} · ${sheet.backgroundName}. ${sheet.scoresPending ? "Textes complets et formules des valeurs à compléter après le tirage des caractéristiques." : "Textes complets et détail des valeurs inscrites sur la feuille de personnage."}`,
        M,
        doc.y + 2,
        { width: PAGE_W - 2 * M },
      );
      if (sheet.scoresPending) overflow.push(pendingNote);
      overflow.push(calcBlock);
      const sense: { label?: string; text: string }[] = [];
      if (sheet.resistances.length) sense.push({ label: "Résistances :", text: sheet.resistances.join(", ") });
      for (const n of sheet.levelOneNotes) sense.push({ text: n });
      if (sense.length) overflow.push(paragraphBlock(doc, "Particularités", sense));
      if (sheet.warnings.length) overflow.push(paragraphBlock(doc, "À noter", sheet.warnings.map((t) => ({ text: t }))));
    } else {
    // ---------- Page 1 : en-tête ----------
    frame(doc, M, M, PAGE_W - 2 * M, 62, true);
    setFont(doc, true, 22, INK);
    doc.text(sheet.name, M + 10, M + 8, { width: 300, lineBreak: false, ellipsis: true });
    setFont(doc, false, 9, MUTED);
    doc.text(
      `${sheet.className}, niveau 1  ·  ${sheet.speciesName}${sheet.speciesDetail ? ` (${sheet.speciesDetail})` : ""}`,
      M + 10,
      M + 36,
      { width: 330, lineBreak: false, ellipsis: true },
    );
    doc.text(`Historique : ${sheet.backgroundName}  ·  Alignement : ${sheet.alignment}`, M + 10, M + 48, {
      width: 330,
      lineBreak: false,
      ellipsis: true,
    });
    const info: [string, string][] = [
      ["Taille", sheet.size === "M" ? "Moyenne" : "Petite"],
      ["Vitesse", sheet.speed],
      ["Vision dans le noir", sheet.darkvision ?? "Aucune"],
    ];
    info.forEach(([l, v], i) => {
      const bx = M + 350 + i * 62;
      setFont(doc, true, 10, INK);
      doc.text(v, bx, M + 14, { width: 58, align: "center", lineBreak: false });
      setFont(doc, true, 6.5, MUTED);
      doc.text(l.toUpperCase(), bx, M + 30, { width: 58, align: "center" });
    });

    // ---------- Colonne gauche ----------
    const LX = M;
    const LW = 170;
    let ly = M + 72;

    // Caractéristiques
    ly = sectionTitle(doc, "Caractéristiques", LX, ly, LW);
    ABILITIES.forEach((a: Ability, i) => {
      const bx = LX + (i % 2) * 87;
      const by = ly + Math.floor(i / 2) * 52;
      frame(doc, bx, by, 83, 48, true);
      setFont(doc, true, 7, MUTED);
      doc.text(ABILITY_NAMES[a].toUpperCase(), bx, by + 5, { width: 83, align: "center", lineBreak: false });
      setFont(doc, true, 19, INK);
      doc.text(known(signed(sheet.scores[a].mod)), bx, by + 14, { width: 83, align: "center", lineBreak: false });
      doc.save().lineWidth(0.8).strokeColor(LINE).fillColor("#ffffff").ellipse(bx + 41.5, by + 42, 15, 7).fillAndStroke("#ffffff", LINE).restore();
      setFont(doc, true, 8, INK);
      doc.text(known(String(sheet.scores[a].score)), bx, by + 39, { width: 83, align: "center", lineBreak: false });
    });
    ly += 3 * 52 + 4;

    statBox(doc, LX, ly, LW, "Bonus de maîtrise", signed(sheet.proficiencyBonus));
    ly += 54;

    // Jets de sauvegarde
    ly = sectionTitle(doc, "Jets de sauvegarde", LX, ly, LW);
    for (const s of sheet.saves) {
      dot(doc, LX + 5, ly + 4.5, s.proficient);
      setFont(doc, true, 8.5);
      doc.text(known(signed(s.bonus)), LX + 14, ly, { width: 24, lineBreak: false });
      setFont(doc, false, 8.5);
      doc.text(ABILITY_NAMES[s.ability], LX + 40, ly, { width: LW - 40, lineBreak: false });
      ly += 13;
    }
    ly += 6;

    // Compétences
    ly = sectionTitle(doc, "Compétences", LX, ly, LW);
    for (const s of sheet.skills) {
      dot(doc, LX + 5, ly + 4.5, s.proficient, s.expertise);
      setFont(doc, true, 8.5);
      doc.text(known(signed(s.bonus)), LX + 14, ly, { width: 24, lineBreak: false });
      setFont(doc, s.proficient, 8.5);
      doc.text(s.name, LX + 40, ly, { width: 90, lineBreak: false });
      setFont(doc, false, 6.5, MUTED);
      doc.text(s.ability, LX + 135, ly + 1.5, { width: 30, lineBreak: false });
      ly += 12.2;
    }
    setFont(doc, false, 6.5, MUTED);
    doc.text("Point plein : maîtrise. Double cercle : expertise.", LX, ly + 2, { width: LW, lineBreak: false });

    // ---------- Colonne droite ----------
    const RX = M + LW + 14;
    const RW = PAGE_W - M - RX;
    let ry = M + 72;
    const bw = (RW - 5 * 6) / 6;
    const boxes: [string, string, string?][] = [
      ["Classe d’armure", sheet.acKnown ? String(sheet.ac) : ""],
      ["Initiative", known(signed(sheet.initiative))],
      ["Points de vie", known(String(sheet.hp))],
      ["Dés de vie", sheet.hitDie],
      ["Perception passive", known(String(sheet.passivePerception))],
      ["Vitesse", sheet.speed],
    ];
    boxes.forEach(([l, v, sub], i) => statBox(doc, RX + i * (bw + 6), ry, bw, l, v, sub));
    ry += 50;
    setFont(doc, false, 7, MUTED);
    doc.text(`CA : ${sheet.acNote}.`, RX, ry, { width: RW });
    ry += h(doc, `CA : ${sheet.acNote}.`, RW, 7) + 6;

    const blocks: Block[] = [...(sheet.scoresPending ? [pendingNote] : []), attacksBlock(doc, sheet)];
    const prof: { label?: string; text: string }[] = [
      { label: "Armures :", text: sheet.armorTraining.length ? sheet.armorTraining.map((a) => (a === "bouclier" ? "boucliers" : `armures ${a}s`)).join(", ") : "aucune" },
      { label: "Armes :", text: sheet.weaponProficiency || "aucune" },
      { label: "Outils :", text: sheet.tools.length ? sheet.tools.join(", ") : "aucun" },
    ];
    blocks.push(paragraphBlock(doc, "Maîtrises", prof));
    const sense: { label?: string; text: string }[] = [
      { label: "Langues :", text: sheet.languages.join(", ") },
    ];
    if (sheet.resistances.length) sense.push({ label: "Résistances :", text: sheet.resistances.join(", ") });
    for (const n of sheet.levelOneNotes) sense.push({ text: n });
    blocks.push(paragraphBlock(doc, "Langues et particularités", sense));
    if (sheet.warnings.length) blocks.push(paragraphBlock(doc, "À noter", sheet.warnings.map((t) => ({ text: t }))));

    for (const b of blocks) {
      const need = b.height(RW) + 8;
      if (ry + need <= BOTTOM) {
        b.draw(RX, ry, RW);
        ry += need;
      } else overflow.push(b);
    }
    // Fiche maison à cases vides : les formules suivent en page 2.
    if (sheet.scoresPending) overflow.unshift(calcBlock);

    }

    // ---------- Page 2 et suivantes : flux ----------
    let y = M;
    if (opts.annex) y = doc.y + 10;
    else doc.addPage();
    const W = PAGE_W - 2 * M;
    const ensure = (need: number) => {
      if (y + need > BOTTOM) {
        doc.addPage();
        y = M;
      }
    };

    for (const b of overflow) {
      ensure(b.height(W) + 8);
      b.draw(M, y, W);
      y += b.height(W) + 8;
    }

    // Équipement
    ensure(60);
    y = sectionTitle(doc, opts.annex ? "Équipement de départ (à recopier au crayon sur la feuille)" : "Équipement", M, y, W);
    const eqText = sheet.equipment.map((e) => `• ${e}`);
    for (const e of eqText) {
      const hh = h(doc, e, W, 8.5);
      ensure(hh + 2);
      setFont(doc, false, 8.5);
      doc.text(e, M, y, { width: W });
      y += hh + 2;
    }
    ensure(16);
    setFont(doc, true, 8.5);
    doc.text(`Pièces d’or : ${sheet.gold} po`, M, y + 2, { width: W });
    y += 20;

    // Aptitudes
    ensure(50);
    y = sectionTitle(doc, "Aptitudes et traits", M, y, W);
    for (const f of sheet.features) {
      const head = `${f.name}`;
      const textH = h(doc, f.text, W, 8);
      ensure(14 + Math.min(textH, 60));
      setFont(doc, true, 8.5, INK);
      doc.text(head, M, y, { width: W, continued: true });
      setFont(doc, false, 7, MUTED);
      doc.text(`   ${f.source}`, { width: W });
      y = doc.y + 1;
      // Texte potentiellement long : on laisse pdfkit gérer les sauts de page.
      setFont(doc, false, 8, INK);
      const startPage = (doc as unknown as { _pageBuffer: unknown[] })._pageBuffer.length;
      doc.text(f.text, M, y, { width: W });
      if ((doc as unknown as { _pageBuffer: unknown[] })._pageBuffer.length !== startPage) {
        // pdfkit a ajouté une page automatiquement : y repart du haut.
      }
      y = doc.y + 6;
    }

    // Sorts
    for (const sb of sheet.spellBlocks) {
      ensure(70);
      y = sectionTitle(doc, sb.title, M, y, W);
      setFont(doc, true, 8.5);
      const head = sheet.scoresPending
        ? `Caractéristique d’incantation : ${sb.abilityName}   ·   DD de sauvegarde et bonus d’attaque : voir le détail des calculs`
        : `Caractéristique d’incantation : ${sb.abilityName}   ·   DD de sauvegarde : ${sb.dc}   ·   Bonus d’attaque de sort : ${signed(sb.attackBonus)}`;
      doc.text(head, M, y, { width: W });
      y = doc.y + 2;
      if (sb.slots) {
        setFont(doc, false, 8.5);
        doc.text(`Emplacements de sort : ${sb.slots}`, M, y, { width: W });
        y = doc.y + 2;
      }
      const lines: [string, string[]][] = [
        ["Sorts mineurs", sb.cantrips],
        ["Sorts toujours préparés", sb.alwaysPrepared],
        ["Sorts préparés (niveau 1)", sb.prepared],
        ["Grimoire (niveau 1)", sb.spellbook ?? []],
      ];
      for (const [label, list] of lines) {
        if (!list.length) continue;
        ensure(14);
        setFont(doc, true, 8.5);
        doc.text(`${label} : `, M, y, { width: W, continued: true });
        setFont(doc, false, 8.5);
        doc.text(list.join(", "), { width: W });
        y = doc.y + 2;
      }
      for (const e of sb.extra) {
        ensure(14);
        setFont(doc, false, 7.5, MUTED, true);
        doc.text(e, M, y, { width: W });
        y = doc.y + 2;
      }
      y += 6;
    }

    // Description
    ensure(80);
    y = sectionTitle(doc, "Apparence, personnalité et historique", M, y, W);
    const story: [string, string | undefined][] = [
      ["Origine (récit, sans effet de règle)", sheet.story.origin],
      ["Apparence", sheet.story.appearance],
      ["Personnalité", sheet.story.personality],
      ["Historique du personnage", sheet.story.backstory],
    ];
    for (const [label, text] of story) {
      ensure(40);
      setFont(doc, true, 8.5);
      doc.text(label, M, y, { width: W });
      y = doc.y + 1;
      if (text) {
        setFont(doc, false, 8.5);
        doc.text(text, M, y, { width: W });
        y = doc.y + 6;
      } else {
        for (let i = 0; i < 5; i++) {
          doc.save().lineWidth(0.3).strokeColor("#b9b09f").moveTo(M, y + 12).lineTo(M + W, y + 12).stroke().restore();
          y += 14;
        }
        y += 4;
      }
    }

    // Attribution CC-BY (exigée par la licence du SRD)
    ensure(sheet.otherSources.length ? 130 : 60);
    y += 6;
    doc.save().lineWidth(0.5).strokeColor(LINE).moveTo(M, y).lineTo(M + W, y).stroke().restore();
    y += 5;
    setFont(doc, false, 7, MUTED);
    doc.text(SRD_ATTRIBUTION, M, y, { width: W });
    if (sheet.otherSources.length) {
      y = doc.y + 4;
      doc.text(`Contenu hors SRD (marqué « Manuel 2024 ») : ${sheet.otherSources.join(" ; ")}.`, M, y, { width: W });
    }

    // Pieds de page
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      const saved = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      setFont(doc, false, 7, MUTED);
      doc.text(
        `${sheet.name}  ·  Fiche de niveau 1 générée par JdrHelper  ·  D&D 2024, SRD 5.2.1  ·  Page ${i + 1}/${range.count}`,
        M,
        PAGE_H - M - 6,
        { width: PAGE_W - 2 * M, align: "center", lineBreak: false },
      );
      doc.page.margins.bottom = saved;
    }
    doc.end();
  });
}
