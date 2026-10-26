import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDict, PDFDocument, PDFName, PDFRef, PDFString, StandardFonts, type PDFFont, type PDFForm } from "pdf-lib";
import { ABILITIES, type Ability } from "../srd/index.js";
import { signed } from "../srd/rules.js";
import { renderSheetPdf } from "./pdf.js";
import type { Sheet } from "./sheet.js";

/**
 * Feuille de personnage officielle D&D 5 en français (formulaire PDF fourni par le MJ dans ref/,
 * « Permission is granted to photocopy this document for personal use »). Le fichier n'est pas versionné.
 *
 * Valeurs laissées vides à la demande du MJ, pour être tenues au crayon : PV actuels et temporaires,
 * dés de vie restants, jets contre la mort, inspiration, emplacements utilisés, pièces, trésor, équipement.
 */
export const DEFAULT_TEMPLATE = "ref/DD5-eFeuillePersoDD5.pdf";

/**
 * Compétences dans l'ordre imprimé sur la feuille (de haut en bas), avec le champ placé sur chaque ligne.
 * Attention : sur ce formulaire, les noms internes des champs 9 à 13 sont décalés d'une ligne
 * par rapport au texte imprimé (vérifié par la position des champs et du texte, p. 1).
 * « Perspicacité » imprimé correspond à « Intuition » dans le SRD français.
 */
export const SKILL_ROWS: { skill: string; field: string; box: string }[] = [
  ["Acrobaties", "Acrobaties"],
  ["Arcanes", "Arcanes"],
  ["Athlétisme", "Athlétisme"],
  ["Discrétion", "Discrétion"],
  ["Dressage", "Dressage"],
  ["Escamotage", "Escamotage"],
  ["Histoire", "Histoire"],
  ["Intimidation", "Intimidation"],
  ["Investigation", "Intuition"],
  ["Médecine", "Investigation"],
  ["Nature", "Médecine"],
  ["Perception", "Nature"],
  ["Intuition", "Perception"],
  ["Persuasion", "Persuasion"],
  ["Religion", "Religion"],
  ["Représentation", "Représentation"],
  ["Survie", "Survie"],
  ["Tromperie", "Tromperie"],
].map(([skill, field], i) => ({ skill: skill!, field: field!, box: `Check Box ${23 + i}` }));

const ABILITY_FIELDS: Record<Ability, { score: string; mod: string; save: string; box: string }> = {
  FOR: { score: "STR", mod: "STRmod", save: "ST Strength", box: "Check Box 11" },
  DEX: { score: "DEX", mod: "DEXmod ", save: "ST Dexterity", box: "Check Box 18" },
  CON: { score: "CON", mod: "CONmod", save: "ST Constitution", box: "Check Box 19" },
  INT: { score: "INT", mod: "INTmod", save: "ST Intelligence", box: "Check Box 20" },
  SAG: { score: "WIS", mod: "WISmod", save: "ST Wisdom", box: "Check Box 21" },
  CHA: { score: "CHA", mod: "CHAmod", save: "ST Charisma", box: "Check Box 22" },
};

const WEAPON_ROWS = [
  ["Wpn Name", "Wpn1 AtkBonus", "Wpn1 Damage"],
  ["Wpn Name 2", "Wpn2 AtkBonus ", "Wpn2 Damage "],
  ["Wpn Name 3", "Wpn3 AtkBonus  ", "Wpn3 Damage "],
] as const;

const CANTRIP_FIELDS = Array.from({ length: 8 }, (_, i) => `Spells ${1014 + i}`);
const LEVEL1_FIELDS = Array.from({ length: 12 }, (_, i) => `Spells ${1022 + i}`);
const LEVEL1_BOXES = ["Check Box 251", "Check Box 309", ...Array.from({ length: 10 }, (_, i) => `Check Box ${3010 + i}`)];

export function templatePath(): string {
  return resolve(process.env.SHEET_TEMPLATE ?? DEFAULT_TEMPLATE);
}

export function officialTemplateAvailable(): boolean {
  return existsSync(templatePath());
}

/** Le fichier téléchargé commence par une balise HTML avant l'en-tête PDF : on la retire. */
function loadTemplate(): Uint8Array {
  const raw = readFileSync(templatePath());
  const start = raw.indexOf("%PDF");
  if (start < 0) throw new Error("Le modèle de feuille n’est pas un PDF.");
  return raw.subarray(start);
}

/** Remplace les caractères que la police standard ne sait pas écrire. */
function encodable(font: PDFFont, text: string): string {
  return [...text]
    .map((c) => {
      if (c === "\n") return c;
      try {
        font.encodeText(c);
        return c;
      } catch {
        return c === "≤" ? "<=" : c === "≥" ? ">=" : "?";
      }
    })
    .join("");
}

/** Plus grande taille (9 à 5 pt) pour laquelle le texte tient dans le champ. */
function fitSize(font: PDFFont, text: string, width: number, height: number, max = 9): number {
  for (let size = max; size > 5; size -= 0.5) {
    const lineH = size * 1.2;
    let lines = 0;
    for (const para of text.split("\n")) {
      let line = "";
      lines++;
      for (const word of para.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > width - 4) {
          lines++;
          line = word;
        } else line = test;
      }
    }
    if (lines * lineH <= height - 2) return size;
  }
  return 5;
}

function filler(form: PDFForm, font: PDFFont) {
  return {
    text(name: string, value: string | number | undefined, opts: { multiline?: boolean; size?: number } = {}) {
      if (value === undefined || value === "") return;
      const field = form.getTextField(name);
      const text = encodable(font, String(value));
      if (!field.acroField.getDefaultAppearance()) field.acroField.setDefaultAppearance("/Helv 0 Tf 0 g");
      if (opts.multiline) field.enableMultiline();
      const rect = field.acroField.getWidgets()[0]?.getRectangle();
      const size = opts.size ?? (rect ? fitSize(font, text, rect.width, rect.height, opts.multiline ? 8 : 10) : 8);
      field.setFontSize(size);
      field.setText(text);
    },
    check(name: string) {
      form.getCheckBox(name).check();
    },
  };
}

/**
 * Sur ce modèle, une partie des champs de la page 1 existe sur la page mais n'est pas déclarée dans le
 * formulaire (édition Foxit). On les rattache au formulaire pour pouvoir les remplir.
 */
function attachOrphanFields(doc: PDFDocument): number {
  const form = doc.getForm();
  const known = new Set(form.acroForm.getAllFields().map(([, ref]) => ref.toString()));
  let added = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i);
      if (!(ref instanceof PDFRef)) continue;
      const dict = doc.context.lookup(ref, PDFDict);
      if (dict.get(PDFName.of("Subtype")) !== PDFName.of("Widget")) continue;
      const parent = dict.get(PDFName.of("Parent"));
      const fieldRef = parent instanceof PDFRef ? parent : dict.has(PDFName.of("T")) ? ref : undefined;
      if (!fieldRef || known.has(fieldRef.toString())) continue;
      const fieldDict = doc.context.lookup(fieldRef, PDFDict);
      // Champ texte sans apparence par défaut : on lui en donne une (police réglée au remplissage).
      if (fieldDict.get(PDFName.of("FT")) === PDFName.of("Tx") && !fieldDict.has(PDFName.of("DA")) && !dict.has(PDFName.of("DA")))
        fieldDict.set(PDFName.of("DA"), PDFString.of("/Helv 0 Tf 0 g"));
      form.acroForm.addField(fieldRef);
      known.add(fieldRef.toString());
      added++;
    }
  }
  return added;
}

export interface OfficialOptions {
  playerName?: string;
}

/** Feuille officielle remplie, suivie de l'annexe (textes complets, équipement à recopier, calculs, licences). */
export async function renderOfficialSheetPdf(sheet: Sheet, opts: OfficialOptions = {}): Promise<Buffer> {
  const doc = await PDFDocument.load(loadTemplate(), { ignoreEncryption: true });
  attachOrphanFields(doc);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const f = filler(form, font);
  // Fiche à cases vides : ce qui dépend des caractéristiques reste à remplir au crayon.
  const known = <T,>(v: T): T | undefined => (sheet.scoresPending ? undefined : v);

  // Page 1 : identité
  f.text("CharacterName", sheet.name);
  f.text("ClassLevel", `${sheet.className} 1`);
  f.text("Background", sheet.backgroundName);
  f.text("PlayerName", opts.playerName);
  f.text("Race ", sheet.speciesDetail ? `${sheet.speciesName} (${sheet.speciesDetail})` : sheet.speciesName);
  f.text("Alignment", sheet.alignment);
  f.text("XP", "0");

  // Caractéristiques, sauvegardes, compétences
  for (const a of ABILITIES) {
    const fl = ABILITY_FIELDS[a];
    f.text(fl.score, known(sheet.scores[a].score));
    f.text(fl.mod, known(signed(sheet.scores[a].mod)));
    const save = sheet.saves.find((s) => s.ability === a)!;
    f.text(fl.save, known(signed(save.bonus)));
    if (save.proficient) f.check(fl.box);
  }
  f.text("ProfBonus", signed(sheet.proficiencyBonus));
  for (const row of SKILL_ROWS) {
    const sk = sheet.skills.find((s) => s.name === row.skill)!;
    f.text(row.field, known(signed(sk.bonus)));
    if (sk.proficient || sk.expertise) f.check(row.box);
  }
  f.text("Passive", known(sheet.passivePerception));

  // Combat (valeurs stables uniquement)
  f.text("AC", sheet.acKnown ? sheet.ac : undefined);
  f.text("Initiative", known(signed(sheet.initiative)));
  f.text("Speed", sheet.speed);
  f.text("HPMax", known(sheet.hp));
  f.text("HDTotal", sheet.hitDie);
  sheet.attacks.slice(0, 3).forEach((a, i) => {
    const [n, atk, dmg] = WEAPON_ROWS[i]!;
    f.text(n, a.name);
    f.text(atk, a.attack);
    f.text(dmg, a.damage);
  });
  const attackNotes = [
    ...sheet.attacks.slice(3).map((a) => `${a.name} : ${a.attack}, ${a.damage}`),
    ...sheet.attacks.filter((a) => a.notes).map((a) => `${a.name} : ${a.notes}`),
  ];
  f.text("AttacksSpellcasting", attackNotes.join("\n"), { multiline: true });

  // Maîtrises et langues
  const armor = sheet.armorTraining.length ? sheet.armorTraining.map((a) => (a === "bouclier" ? "boucliers" : `armures ${a}s`)).join(", ") : "aucune";
  const expertise = sheet.skills.filter((s) => s.expertise).map((s) => s.name);
  f.text(
    "ProficienciesLang",
    [
      `Armures : ${armor}`,
      `Armes : ${sheet.weaponProficiency || "aucune"}`,
      `Outils : ${sheet.tools.length ? sheet.tools.join(", ") : "aucun"}`,
      ...(expertise.length ? [`Expertise : ${expertise.join(", ")}`] : []),
      `Langues : ${sheet.languages.join(", ")}`,
      ...(sheet.darkvision ? [`Vision dans le noir : ${sheet.darkvision}`] : []),
      ...(sheet.resistances.length ? [`Résistances : ${sheet.resistances.join(", ")}`] : []),
      `Taille : ${sheet.size === "M" ? "moyenne" : "petite"}`,
    ].join("\n"),
    { multiline: true },
  );

  // Aptitudes (noms ; les textes complets sont dans l'annexe)
  const nonFeat = sheet.features.filter((x) => !x.source.startsWith("Don") && x.source !== "Style de combat");
  f.text("Features and Traits", [...nonFeat.map((x) => `• ${x.name} (${x.source})`), "", "Textes complets : voir l’annexe."].join("\n"), {
    multiline: true,
  });
  const feats = sheet.features.filter((x) => x.source.startsWith("Don") || x.source === "Style de combat");
  f.text("Feat+Traits", feats.map((x) => `• ${x.name} (${x.source})`).join("\n"), { multiline: true });

  // Personnalité et histoire
  f.text("PersonalityTraits ", sheet.story.personality, { multiline: true });
  f.text("CharacterName 2", sheet.name);
  f.text("Apparence", sheet.story.appearance, { multiline: true });
  f.text("Backstory", [sheet.story.origin ? `Origine : ${sheet.story.origin}` : "", sheet.story.backstory ?? ""].filter(Boolean).join("\n\n"), {
    multiline: true,
  });

  // Page 3 : sorts
  if (sheet.spellBlocks.length) {
    const main = sheet.spellBlocks.find((b) => b.slotCount !== undefined) ?? sheet.spellBlocks[0]!;
    // En-tête : « classe de lanceur de sorts (caractéristique) » ; la 1re case est « sorts à préparer chaque jour ».
    f.text("Spellcasting Class 2", `${main.title.replace(/^Sorts d[’e] ?/, "")} (${main.abilityName})`);
    if (main.slotCount !== undefined) f.text("SpellcastingAbility 2", main.prepared.length);
    f.text("SpellSaveDC  2", known(main.dc));
    f.text("SpellAtkBonus 2", known(signed(main.attackBonus)));
    if (main.slotCount) f.text("SlotsTotal 19", main.slotCount);
    const tag = (b: (typeof sheet.spellBlocks)[number], n: string) => (b === main ? n : `${n} (${b.title.replace(/^Sorts d[’e] ?/, "")})`);
    const cantrips = sheet.spellBlocks.flatMap((b) => b.cantrips.map((n) => tag(b, n)));
    cantrips.slice(0, CANTRIP_FIELDS.length).forEach((n, i) => f.text(CANTRIP_FIELDS[i]!, n));
    const level1: { name: string; prepared: boolean }[] = [];
    for (const b of sheet.spellBlocks) {
      if (b.spellbook) for (const n of b.spellbook) level1.push({ name: tag(b, n), prepared: b.prepared.includes(n) });
      else for (const n of b.prepared) level1.push({ name: tag(b, n), prepared: true });
      for (const n of b.alwaysPrepared) level1.push({ name: `${tag(b, n)} (toujours préparé)`, prepared: true });
    }
    level1.slice(0, LEVEL1_FIELDS.length).forEach((s, i) => {
      f.text(LEVEL1_FIELDS[i]!, s.name);
      if (s.prepared) f.check(LEVEL1_BOXES[i]!);
    });
  }

  form.updateFieldAppearances(font);

  // Annexe
  const annex = await PDFDocument.load(await renderSheetPdf(sheet, { annex: true }));
  const pages = await doc.copyPages(annex, annex.getPageIndices());
  for (const p of pages) doc.addPage(p);
  doc.setTitle(`Fiche de personnage : ${sheet.name}`);
  return Buffer.from(await doc.save());
}
