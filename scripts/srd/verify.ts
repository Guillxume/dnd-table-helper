/**
 * Contrôle les données de règles (src/srd) contre le PDF officiel du SRD 5.2.1 en français.
 *
 *   npm run srd:verify              # utilise ref/FR_SRD_CC_v5.2.1.pdf
 *   SRD_PDF=/chemin/fichier.pdf npm run srd:verify
 *
 * Nécessite `pdftotext` (poppler : `brew install poppler`).
 * Les citations sont comparées sans tenir compte des espaces, de la casse, des tirets de césure
 * ni de la ponctuation. Le script ne vérifie que ce qu'il sait vérifier et liste le reste.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  ABILITY_NAMES,
  ARMORS,
  ARTISAN_TOOLS,
  BACKGROUNDS,
  CLASSES,
  COMMON_LANGUAGES,
  FEATS,
  GAMING_SETS,
  INVOCATIONS,
  MASTERIES,
  MUSICAL_INSTRUMENTS,
  RAW_CLASS_TRAITS,
  formatMeters,
  PACKS,
  RARE_LANGUAGES,
  SKILLS,
  SPECIES,
  SPELLS,
  WEAPONS,
  STANDARD_ARRAY,
  SPELL_TEXTS,
  POINT_BUDGET,
  POINT_COST,
  STANDARD_BY_CLASS,
  type ClassData,
  type EquipmentOption,
} from "../../src/srd/index.js";
import { SRD_ATTRIBUTION } from "../../src/srd/attribution.js";
import { GEAR } from "../../src/srd/items.js";
import { ALIGNMENTS } from "../../src/character/steps.js";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pdf = process.env.SRD_PDF ?? "ref/FR_SRD_CC_v5.2.1.pdf";
if (!existsSync(pdf)) {
  console.error(`PDF introuvable : ${pdf}`);
  process.exit(2);
}

function pdftotext(args: string[]): string {
  try {
    return execFileSync("pdftotext", [...args, pdf, "-"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    console.error("pdftotext est requis (poppler).", e instanceof Error ? e.message : e);
    process.exit(2);
  }
}

const norm = (t: string) => t.replace(/-\n/g, "").replace(/\s+/g, " ").trim();
const squash = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const rawText = pdftotext(["-raw"]);
const corpus = norm(rawText);
const sq = squash(corpus);
const layout = pdftotext(["-layout"]);

let checks = 0;
const failures: string[] = [];
function expect(ok: boolean, label: string, detail = "") {
  checks++;
  if (!ok) failures.push(`${label}${detail ? ` : ${detail}` : ""}`);
}

const has = (text: string) => sq.includes(squash(text));

/** Une citation est valide si elle figure telle quelle, ou si chacune de ses phrases figure dans le PDF. */
function expectQuote(label: string, text: string) {
  if (!text) return expect(false, label, "texte vide");
  if (has(text)) return expect(true, label);
  const parts = text.split(/(?<=[.!?:;])\s+/).filter((p) => squash(p).length > 8);
  // Une phrase coupée par un saut de page ou de colonne se retrouve en deux morceaux dans le texte brut.
  const splitFound = (p: string) => {
    const w = p.split(/\s+/);
    for (let k = 3; k <= w.length - 3; k++) if (has(w.slice(0, k).join(" ")) && has(w.slice(k).join(" "))) return true;
    return false;
  };
  const missing = parts.filter((p) => !has(p) && !splitFound(p));
  expect(missing.length === 0, label, `phrases absentes : ${missing.map((m) => `« ${m.slice(0, 70)}… »`).join(" ; ")}`);
}

// --- Citations des espèces, classes, dons ---------------------------------------------------------
const notSrd: string[] = [];
for (const sp of SPECIES) {
  if (sp.source) {
    notSrd.push(`espèce ${sp.name}`);
    continue;
  }
  expect(has(`Catégorie de taille : ${sp.sizeText}`), `espèce ${sp.name} : taille`);
  expect(has(`Vitesse : ${formatMeters(sp.speed)}`), `espèce ${sp.name} : vitesse`);
  for (const t of sp.traits) expectQuote(`espèce ${sp.name} / ${t.name}`, `${t.name}. ${t.text}`);
  for (const o of sp.options ?? []) {
    if (o.derived) continue;
    expectQuote(`espèce ${sp.name} / option ${o.name}`, o.text);
  }
}
// Drakéide : table « Ancêtres draconiques » (texte brut en colonnes, contrôle par paires).
const dragonTable = corpus.slice(corpus.indexOf("Ancêtres draconiques"), corpus.indexOf("Ancêtres draconiques") + 400);
for (const o of SPECIES.find((s) => s.id === "drakeide")!.options!) {
  const m = new RegExp(`${o.name}\\s+${o.resistance}`, "i");
  expect(m.test(dragonTable), `drakéide : ${o.name} / ${o.resistance}`);
}

for (const c of CLASSES) {
  for (const [name, raw] of RAW_CLASS_TRAITS[c.id] ?? [])
    for (const piece of raw.split(" ¶ ")) expectQuote(`classe ${c.name} / ${name}`, piece);
  if (c.spellcasting) {
    expectQuote(`classe ${c.name} / caractéristique d’incantation`, c.spellcasting.abilityText);
    expectQuote(`classe ${c.name} / focaliseur`, c.spellcasting.focusText);
  }
}
for (const f of FEATS) {
  if (f.source) {
    notSrd.push(`don ${f.name}`);
    continue;
  }
  expect(has(f.name), `don ${f.name} : nom`);
  expectQuote(`don ${f.name} : résumé`, f.summary);
  for (const t of f.traits) expectQuote(`don ${f.name} / ${t.name}`, `${t.name}. ${t.text}`);
}
for (const [name, text] of Object.entries(MASTERIES)) expectQuote(`botte ${name}`, `${name} ${text}`);
for (const [name, text] of Object.entries(INVOCATIONS)) expectQuote(`manifestation ${name}`, text);

// --- Listes de noms -------------------------------------------------------------------------------
for (const s of SKILLS) expect(has(s.name), `compétence ${s.name}`);
for (const l of [...COMMON_LANGUAGES, ...RARE_LANGUAGES]) expect(has(l), `langue ${l}`);
for (const t of [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS, ...GAMING_SETS]) expect(has(t), `outil ${t}`);
for (const a of ALIGNMENTS) expect(has(a), `alignement ${a}`);
for (const [id] of Object.entries(PACKS)) {
  const art = /^[aeiouéèêh]/i.test(id) ? "d’" : "de ";
  expect(has(`paquetage ${art}${id}`), `paquetage ${id}`);
}
for (const [id, items] of Object.entries(PACKS)) {
  for (const it of items) {
    const bare = it.replace(/^\d+ /, "");
    expect(has(bare.replace(/s$/, "")) || has(bare), `paquetage ${id} : ${it}`);
  }
}
for (const [a, n] of Object.entries(ABILITY_NAMES)) expect(has(n), `caractéristique ${a}`);

// --- Historiques ----------------------------------------------------------------------------------
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} et ${xs.at(-1)}` : (xs[0] ?? ""));
for (const b of BACKGROUNDS) {
  if (b.source) {
    notSrd.push(`historique ${b.name}`);
    // Les compétences et outils hors SRD doivent quand même porter un nom du SRD français.
    for (const sk of b.skills) expect(SKILLS.some((x) => x.name === sk), `historique ${b.name} : compétence ${sk} (nom SRD)`);
    if (b.toolChoice === "fixed") expect(has(b.tool), `historique ${b.name} : outil ${b.tool} (nom SRD)`);
    expect(FEATS.some((f) => f.id === b.featId), `historique ${b.name} : don connu`);
    continue;
  }
  const names = b.abilities.map((a) => ABILITY_NAMES[a]);
  expect(has(`Valeurs de caractéristique : ${names.join(", ")}`), `historique ${b.name} : caractéristiques`);
  expect(has(`Maîtrises de compétence : ${list(b.skills)}`), `historique ${b.name} : compétences`);
  expect(has(`Équipement : Choisissez A ou B : (A) ${(b.equipmentA ?? []).join(", ")}, ${b.goldA} po ; ou (B) ${b.goldB} po`), `historique ${b.name} : équipement`);
  expect(has(b.tool.replace(" (au choix)", "")) || b.toolChoice === "gaming-set", `historique ${b.name} : outil`);
  const feat = FEATS.find((f) => f.id === b.featId)!;
  expect(has(`Don : ${feat.name}`), `historique ${b.name} : don`);
}

// --- Classes : traits de base ---------------------------------------------------------------------
const plural = (name: string, qty?: number) => (qty && qty > 1 ? `${qty} ${name.toLowerCase()}s` : qty ? `${qty} ${name.toLowerCase()}` : name.toLowerCase());
function equipmentText(c: ClassData, e: EquipmentOption): string {
  const parts = e.items.map((it) => {
    switch (it.kind) {
      case "weapon":
        return it.note ? `${it.note} (${it.name.toLowerCase()})` : plural(it.name, it.qty);
      case "armor":
        return it.name.toLowerCase();
      case "pack": {
        const art = /^[aeiouéèêh]/i.test(it.pack) ? "d’" : "de ";
        return `paquetage ${art}${it.pack}`;
      }
      case "item":
        return it.qty ? `${it.qty} ${it.name.toLowerCase()}` : it.name.toLowerCase();
      case "choice":
        return it.what === "instrument"
          ? "instrument de musique de votre choix"
          : "outils d’artisan ou instrument de musique choisis pour la maîtrise d’outils ci-dessus";
    }
  });
  return `(${e.id}) ${[...parts, `${e.gold} po`].join(", ").replace(/, (\d+ po)$/, parts.length ? " et $1" : ", $1")}`;
}

const ARMOR_WORDS: Record<string, string> = { légère: "légères", intermédiaire: "intermédiaires", lourde: "lourdes" };
for (const c of CLASSES) {
  const start = corpus.search(new RegExp(`Dé de vie d${c.hitDie} par niveau d(?:e |’)${c.name}`));
  expect(start >= 0, `classe ${c.name} : dé de vie D${c.hitDie}`);
  if (start < 0) continue;
  const end = corpus.indexOf("Devenir", start);
  const base = corpus.slice(start, end > start ? end : start + 1500);
  const bsq = squash(base);
  const inBase = (t: string) => bsq.includes(squash(t));

  expect(inBase(`Jets de sauvegarde ${ABILITY_NAMES[c.saves[0]]} et ${ABILITY_NAMES[c.saves[1]]}`), `classe ${c.name} : jets de sauvegarde`);

  if (c.skills.from) {
    expect(inBase(`${c.skills.count} au choix parmi : ${list(c.skills.from)}`), `classe ${c.name} : compétences`);
  } else {
    expect(inBase(`${c.skills.count} compétences au choix`), `classe ${c.name} : compétences`);
  }

  // Maîtrise des armes.
  const wp = /Maîtrises d’arme (.*?)(?: Maîtrises d’outils| Formation aux armures)/.exec(base)?.[1] ?? "";
  const simple = /courantes/.test(wp);
  let martial: ClassData["weaponProficiency"]["martial"] = "none";
  if (/armes de guerre/.test(wp)) martial = /Finesse ou Légère/.test(wp) ? "finesse-or-light" : /Légère/.test(wp) ? "light" : "all";
  expect(simple === c.weaponProficiency.simple && martial === c.weaponProficiency.martial, `classe ${c.name} : maîtrise des armes`, `lu « ${wp} »`);

  // Formation aux armures.
  const ar = /Formation aux armures (.*?) Équipement de départ/.exec(base)?.[1] ?? "";
  const got = new Set<string>();
  if (/Toutes les armures|Armures légères, intermédiaires et lourdes|Armures légères, intermédiaires, lourdes/.test(ar)) {
    got.add("légère").add("intermédiaire").add("lourde");
  }
  for (const [k, w] of Object.entries(ARMOR_WORDS)) if (new RegExp(w).test(ar)) got.add(k);
  if (/bouclier/i.test(ar)) got.add("bouclier");
  expect(
    got.size === c.armorTraining.length && c.armorTraining.every((x) => got.has(x)),
    `classe ${c.name} : formation aux armures`,
    `lu « ${ar} », attendu ${c.armorTraining.join(", ") || "aucune"}`,
  );

  // Maîtrise d'outils.
  const hasTools = /Maîtrises d’outils/.test(base);
  expect(hasTools === Boolean(c.tools.fixed.length || c.tools.choose), `classe ${c.name} : maîtrise d’outils`);
  for (const t of c.tools.fixed) expect(inBase(t), `classe ${c.name} : outil ${t}`);

  // Équipement de départ.
  for (const e of c.equipment) expect(inBase(equipmentText(c, e)), `classe ${c.name} : équipement ${e.id}`, equipmentText(c, e));
}

// --- Classes : ligne du niveau 1 de la table d'aptitudes (mode mise en page) ------------------------
const rowRules: Record<string, RegExp> = {
  barbare: /\s2\s+\+2\s+2\s*$/, // Rages, Dégâts de Rage, Bottes d'arme
  barde: /d6\s+2\s+4\s+2\s+—/,
  clerc: /—\s+3\s+4\s+2\s+—/,
  druide: /—\s+2\s+4\s+2\s+—/,
  ensorceleur: /—\s+4\s+2\s+2\s+—/,
  guerrier: /\s2\s+3\s*$/, // Second souffle, Bottes d'arme
  magicien: /\s3\s+4\s+2\s+—/,
  moine: /1d6\s+—\s+—\s*$/,
  occultiste: /\s1\s+2\s+2\s+1\s+1\s*$/,
  paladin: /—\s+2\s+2\s+—/,
  rodeur: /\s2\s+2\s+2\s+—/,
  roublard: /1d6\s*$/,
};
const levelOneRows = layout.split("\n").filter((l) => /^\s*1\s+\+2\s/.test(l));
for (const c of CLASSES) {
  const rule = rowRules[c.id]!;
  const sc = c.spellcasting;
  const ok = levelOneRows.some((l) => rule.test(l));
  expect(ok, `classe ${c.name} : ligne du niveau 1 de la table`);
  if (sc && !sc.pact) {
    // Les nombres de la ligne attendue doivent aussi correspondre aux données.
    const seq = [sc.cantrips || null, sc.prepared, sc.slots].filter((x) => x !== null).join("\\s+");
    expect(levelOneRows.some((l) => new RegExp(seq).test(l)), `classe ${c.name} : sorts mineurs/préparés/emplacements`, seq);
  }
}

// --- Armes et armures (tables en mode mise en page) -----------------------------------------------
const layLines = layout.split("\n");
for (const w of WEAPONS) {
  const line = layLines.find((l) => squash(l).startsWith(squash(w.name)) && squash(l).includes(squash(w.mastery)));
  expect(Boolean(line), `arme ${w.name} : ligne de table`);
  if (!line) continue;
  const lsq = squash(line);
  expect(lsq.includes(squash(w.damage)), `arme ${w.name} : dégâts`, w.damage);
  expect(lsq.includes(squash(w.price)), `arme ${w.name} : prix`, w.price);
  expect(lsq.includes(squash(w.weight)), `arme ${w.name} : poids`, w.weight);
}
for (const a of ARMORS) {
  const line = armorLine(a.name);
  expect(Boolean(line), `armure ${a.name} : ligne de table`);
  if (!line) continue;
  const l = squash(line);
  expect(l.includes(squash(a.price)), `armure ${a.name} : prix`, a.price);
  expect(l.includes(squash(a.weight)), `armure ${a.name} : poids`, a.weight);
  if (a.category !== "bouclier") expect(l.includes(String(a.baseAc)), `armure ${a.name} : CA`, String(a.baseAc));
  if (a.minStrength) expect(l.includes(`for${a.minStrength}`), `armure ${a.name} : Force`);
}
function armorLine(name: string): string | undefined {
  return layLines.find((l) => new RegExp(`^\\s*${escapeRe(name)}\\s{2,}(\\+2|\\d)`).test(l));
}
const stealthLines = new Set(ARMORS.filter((a) => a.stealthDisadvantage).map((a) => a.name));
for (const a of ARMORS) {
  const line = armorLine(a.name);
  if (line) expect(squash(line).includes("désavantage") === stealthLines.has(a.name), `armure ${a.name} : désavantage en Discrétion`);
}

// --- Sorts : en-têtes de description ---------------------------------------------------------------
const CLASS_LABEL: Record<string, string> = {
  barde: "Barde",
  clerc: "Clerc",
  druide: "Druide",
  ensorceleur: "Ensorceleur",
  magicien: "Magicien",
  occultiste: "Occultiste",
  paladin: "Paladin",
  rodeur: "Rôdeur",
};
for (const s of SPELLS) {
  const lvl = s.level === 0 ? "mineure?" : "du 1er niveau";
  const re = new RegExp(`${escapeRe(s.name)} ${escapeRe(s.school)} ${lvl} \\(([^)]*)\\) Temps d’incantation : (.{0,200}?) Durée : (.{0,60})`);
  const hit = [...corpus.matchAll(new RegExp(re, "g"))].find((m) => (m[1] ?? "").split(", ").includes(CLASS_LABEL[s.class]!));
  expect(Boolean(hit), `sort ${s.name} (${s.class}, niveau ${s.level}) : en-tête`);
  if (!hit) continue;
  const comp = hit[2] ?? "";
  const costly = /M \([^)]*\d+ po/.test(comp) || /M \(.*?valeur.*?po/.test(comp);
  expect(/ou rituel/i.test(comp) === s.ritual, `sort ${s.name} : rituel`);
  expect((hit[3] ?? "").startsWith("Concentration") === s.concentration, `sort ${s.name} : concentration`);
  expect(costly === s.costlyMaterial, `sort ${s.name} : composante coûteuse`);
}
// Complétude : le nombre d'en-têtes par classe et niveau doit égaler le nôtre.
const headers = [...corpus.matchAll(/(Abjuration|Divination|Enchantement|Évocation|Illusion|Invocation|Nécromancie|Transmutation) (mineure?|du 1er niveau) \(([^)]*)\)/g)];
for (const [id, label] of Object.entries(CLASS_LABEL)) {
  for (const level of [0, 1]) {
    const expected = headers.filter((m) => (level === 0 ? m[2]!.startsWith("mineur") : m[2] === "du 1er niveau") && (m[3] ?? "").split(", ").includes(label)).length;
    const ours = SPELLS.filter((s) => s.class === id && s.level === level).length;
    expect(expected === ours, `liste de sorts ${label} niveau ${level} : nombre`, `PDF ${expected}, données ${ours}`);
  }
}

expectQuote("déclaration d’attribution CC-BY", SRD_ATTRIBUTION);

// --- Description des sorts ------------------------------------------------------------------------
for (const [name, t] of Object.entries(SPELL_TEXTS)) {
  expect(has(`Temps d’incantation : ${t.casting}`), `sort ${name} : temps d’incantation`);
  expect(has(`Portée : ${t.range}`), `sort ${name} : portée`);
  expect(has(`Composantes : ${t.components}`), `sort ${name} : composantes`);
  expect(has(`Durée : ${t.duration}`), `sort ${name} : durée`);
  expectQuote(`sort ${name} : description`, t.text);
}
for (const s of SPELLS) expect(!!SPELL_TEXTS[s.name], `sort ${s.name} : description présente`);

// --- Outils et matériel d'aventurier ----------------------------------------------------------------
for (const [name, g] of Object.entries(GEAR)) {
  expect(has(`${name} (${g.price})`), `objet ${name} : nom et prix`);
  if (g.text) expectQuote(`objet ${name} : description`, g.text);
}

// --- Méthodes de caractéristiques -------------------------------------------------------------------
expect(has(`Reprenez les six valeurs suivantes pour vos caractéristiques : ${STANDARD_ARRAY.join(", ")}`), "valeurs standard");
expect(has(`Vous disposez de ${POINT_BUDGET} points à dépenser`), "budget d’acquisition par points");
const costs = Object.entries(POINT_COST).map(([v, c]) => `${v} ${c}`);
expect(has(`Valeur Prix ${costs.slice(0, 4).join(" ")} Valeur Prix ${costs.slice(4).join(" ")}`), "table de coût des valeurs");
for (const c of CLASSES) {
  const t = STANDARD_BY_CLASS[c.id];
  expect(!!t && has(`${c.name} ${t.FOR} ${t.DEX} ${t.CON} ${t.INT} ${t.SAG} ${t.CHA}`), `valeurs standard par classe : ${c.name}`);
}

// --- Rapport ----------------------------------------------------------------------------------------
console.log(`${checks} contrôles, ${failures.length} échec(s).`);
for (const f of failures) console.log(`  ÉCHEC  ${f}`);
console.log(
  "\nNon contrôlé automatiquement : les choix de sorts recommandés, les textes d’aptitudes de niveau supérieur à 1, " +
    "et les formulations « options » reformulées (drakéide : texte généré à partir de la table).",
);
if (notSrd.length) console.log(`\nHors SRD (source citée dans les données, non comparé au PDF du SRD) : ${notSrd.join(", ")}.`);
process.exit(failures.length ? 1 : 0);
