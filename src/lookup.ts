import { BACKGROUNDS, CLASSES, FEATS, SPECIES, SPELL_TEXTS, getSpell } from "./srd/index.js";
import { itemNames, itemText } from "./srd/items.js";
import { creatures, normName, type Creature } from "./srd/creatures.js";
import { searchSrd, type SrdChunk } from "./srd/search.js";
import chunksJson from "./srd/data/srd-chunks.json" with { type: "json" };
import refJson from "./guide/ref-index.json" with { type: "json" };
import { backgroundText, classText, featText, speciesText } from "./character/explain.js";
import { splitMessage } from "./text.js";
import { STAT_HEADINGS, statBlockParagraphs } from "./statblocks.js";
import { SRD_SUBCLASSES, findSubclass, subclassText } from "./srd/subclasses.js";

/**
 * Recherche unique (/chercher et bouton du tableau de bord), sur toutes les sources du bot :
 * - SRD 5.2.1 : sorts de niveau 0 et 1, armes, armures, matériel, créatures, glossaire, et tout le reste en plein texte ;
 * - données de création : espèces (dont l'Aasimar), 16 historiques, classes, dons, avec leur source ;
 * - documents du MJ dans ref/ (référentiel d'origines, guide d'orientation, trajectoires), indexés par
 *   scripts/guide/build_ref_index.py dans src/guide/ref-index.json.
 */
type Kind = "sort" | "objet" | "creature" | "espece" | "historique" | "classe" | "sousclasse" | "don" | "ref";

interface RefEntry {
  id: number;
  title: string;
  text: string;
  source: string;
  page: number;
  kind: string;
}

const REF = refJson as RefEntry[];

interface Entry {
  kind: Kind;
  /** Identifiant passé dans la valeur d'autocomplétion (nom, id de données ou numéro d'entrée). */
  key: string;
  name: string;
}

const KIND_LABEL: Record<Kind, string> = {
  sort: "sort",
  objet: "équipement",
  creature: "créature",
  espece: "espèce",
  historique: "historique",
  classe: "classe",
  sousclasse: "sous-classe, SRD",
  don: "don",
  ref: "documents du MJ",
};

let entries: Entry[] | undefined;
function all(): Entry[] {
  entries ??= [
    ...SPECIES.map((s) => ({ kind: "espece" as const, key: s.id, name: s.name })),
    ...BACKGROUNDS.map((b) => ({ kind: "historique" as const, key: b.id, name: b.name })),
    ...CLASSES.map((c) => ({ kind: "classe" as const, key: c.id, name: c.name })),
    ...SRD_SUBCLASSES.map((sc, k) => ({ kind: "sousclasse" as const, key: String(k), name: sc.name })),
    ...FEATS.map((f) => ({ kind: "don" as const, key: f.id, name: f.name })),
    ...Object.keys(SPELL_TEXTS).map((name) => ({ kind: "sort" as const, key: name, name })),
    ...itemNames().map((name) => ({ kind: "objet" as const, key: name, name })),
    ...creatures().map((c) => ({ kind: "creature" as const, key: c.name, name: c.name })),
    ...REF.map((r) => ({ kind: "ref" as const, key: String(r.id), name: r.title })),
  ];
  return entries;
}

/** Propositions d'autocomplétion : « Aasimar (espèce) » → valeur « espece:aasimar ». 25 au plus. */
export function lookupChoices(query: string): { name: string; value: string }[] {
  const q = normName(query);
  const list = all();
  const starts = q ? list.filter((e) => normName(e.name).startsWith(q)) : list;
  const contains = q ? list.filter((e) => !normName(e.name).startsWith(q) && normName(e.name).includes(q)) : [];
  return [...starts, ...contains]
    .slice(0, 25)
    .map((e) => ({ name: `${e.name} (${label(e)})`.slice(0, 100), value: `${e.kind}:${e.key}`.slice(0, 100) }));
}

/** Étiquette d'autocomplétion ; pour les documents du MJ, le document précis (guide, trajectoires, référentiel). */
function label(e: Entry): string {
  if (e.kind !== "ref") return KIND_LABEL[e.kind];
  const source = REF[Number(e.key)]?.source ?? "";
  return source.startsWith("Guide") ? "guide du MJ" : source.startsWith("Trajectoires") ? "trajectoires du MJ" : "référentiel du MJ";
}

function spellText(name: string): string | undefined {
  const t = SPELL_TEXTS[name];
  if (!t) return undefined;
  const s = getSpell(name);
  const head = s ? `${s.level === 0 ? "Sort mineur" : `Sort de niveau ${s.level}`}${s.school ? `, ${s.school}` : ""}${s.ritual ? " (rituel)" : ""}` : "Sort";
  return [`**${name}** : ${head}`, `Incantation : ${t.casting} · Portée : ${t.range}`, `Composantes : ${t.components} · Durée : ${t.duration}`, "", t.text, "", "_Source : SRD 5.2.1_"].join("\n");
}

/** Bloc de statistiques mis en forme pour Discord (mêmes rubriques que le PDF). */
export function creatureText(c: Creature): string {
  const text = c.text.startsWith(c.name) ? c.text.slice(c.name.length).trim() : c.text;
  const body = statBlockParagraphs(text)
    .map((l) => (STAT_HEADINGS.has(l.trim()) ? `**${l.trim()}**` : l))
    .join("\n");
  return `**${c.name}** (FP ${c.cr}, ${c.xp} PX), SRD 5.2.1 p. ${c.page}\n${body}`;
}

/** Passage d'un document du MJ ; `max` raccourcit le texte dans les résultats de recherche. */
function refText(r: RefEntry, max = Infinity): string {
  const text = r.text.length > max ? `${r.text.slice(0, max).replace(/\s+\S*$/, "")}…` : r.text;
  return `**${r.title}** (${r.source}, p. ${r.page})\n${text}`;
}

/** Texte d'une entrée, ou undefined si elle n'existe pas. */
function entryText(e: Entry): string | undefined {
  switch (e.kind) {
    case "espece":
      return speciesText(e.key, true);
    case "historique":
      return backgroundText(e.key);
    case "classe":
      return classText(e.key);
    case "sousclasse": {
      const sc = SRD_SUBCLASSES[Number(e.key)];
      const t = sc ? subclassText(sc, 3800) : undefined;
      return sc && t ? `**${sc.name}** (sous-classe de ${sc.classe}, niveau 3 ; SRD 5.2.1, p. ${sc.page})\n${t}` : undefined;
    }
    case "don":
      return featText(e.key);
    case "sort":
      return spellText(e.key);
    case "objet": {
      const t = itemText(e.key);
      return t ? `${t}\n_Source : SRD 5.2.1_` : undefined;
    }
    case "creature": {
      const c = creatures().find((x) => x.name === e.key);
      return c ? creatureText(c) : undefined;
    }
    case "ref": {
      const r = REF[Number(e.key)];
      return r ? refText(r) : undefined;
    }
  }
}

const CHUNKS = chunksJson as unknown as SrdChunk[];

/**
 * Entrée du glossaire de règles du SRD (« Agrippé [État] », « Embrasement [Danger] ») : on renvoie l'entrée elle-même
 * plutôt que des extraits qui la mentionnent.
 */
export function glossaryEntry(query: string): string | undefined {
  const q = query.trim();
  if (q.length < 3) return undefined;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[.\\s])(${escaped}) \\[([^\\]]{2,20})\\]`, "i");
  for (const c of CHUNKS) {
    const m = re.exec(c.text);
    if (!m) continue;
    const start = m.index + (m[0].length - m[1]!.length - m[2]!.length - 3);
    // L'entrée s'arrête à l'entrée suivante du glossaire (« Mot [Type] ») ou au bout de 1 800 caractères.
    const rest = c.text.slice(start);
    const next = rest.slice(m[1]!.length + m[2]!.length + 3).search(/[A-ZÀÉÈ][\p{L}’' ]{1,40} \[[^\]]{2,20}\]/u);
    const body = next > 0 ? rest.slice(0, m[1]!.length + m[2]!.length + 3 + next) : rest.slice(0, 1800);
    return `**${m[1]} [${m[2]}]** (SRD 5.2.1, ${c.title})\n${body.slice(m[1]!.length + m[2]!.length + 3).trim()}`;
  }
  return undefined;
}

/** Entrées des documents du MJ qui contiennent tous les mots de la recherche, titres favorisés. */
export function searchRef(query: string, limit = 3): RefEntry[] {
  const words = normName(query)
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length >= 3);
  if (!words.length) return [];
  return REF.map((r) => {
    const title = normName(r.title);
    const text = normName(r.text);
    if (!words.every((w) => title.includes(w) || text.includes(w))) return { r, score: 0 };
    return { r, score: words.reduce((a, w) => a + (title.includes(w) ? 3 : 0) + (text.includes(w) ? 1 : 0), 0) - r.text.length / 5000 };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r);
}

/** Réponse en messages Discord (2000 caractères au plus chacun). */
export function lookup(query: string): string[] {
  const raw = query.trim();
  if (!raw) return ["Indique ce que tu cherches : un sort, un objet, une créature, une espèce, un historique, une classe, un don, une règle ou un état."];
  // Choix d'autocomplétion : « espece:aasimar », « ref:12 »…
  const m = /^(sort|objet|creature|espece|historique|classe|sousclasse|don|ref):(.+)$/.exec(raw);
  if (m) {
    const e = all().find((x) => x.kind === m[1] && x.key === m[2]);
    const t = e ? entryText(e) : undefined;
    if (t) return splitMessage(t);
  }
  const name = m?.[2] ?? raw;
  const q = normName(name);

  // Nom exact dans n'importe quelle source : toutes les fiches de ce nom (l'espèce et sa ligne du référentiel ;
  // la créature « Berserker » et la sous-classe « Berserker (Barbare) »).
  const exact = all().filter((e) => normName(e.name) === q || normName(e.name).startsWith(`${q} (`));
  // Sous-classe : les lignes des documents du MJ (« Berserker (Barbare) ») et le texte officiel quand elle est dans
  // le SRD (« Voie du Berserker »), quel que soit le nom tapé.
  const sc = findSubclass(name, normName);
  if (sc) {
    const k = SRD_SUBCLASSES.indexOf(sc);
    for (const e of all()) {
      const same = (e.kind === "sousclasse" && e.key === String(k)) || (e.kind === "ref" && normName(e.name) === normName(`${sc.ref} (${sc.classe})`));
      if (same && !exact.includes(e)) exact.push(e);
    }
  }
  if (exact.length) {
    // Documents du MJ et données du bot d'abord, texte officiel long ensuite.
    const order = (e: Entry) => (e.kind === "sousclasse" ? 2 : e.kind === "ref" ? 1 : 0);
    const texts = [...exact].sort((a, b) => order(a) - order(b)).flatMap((e) => entryText(e) ?? []);
    if (texts.length) return splitMessage(texts.join("\n\n"));
  }
  const entry = glossaryEntry(name);
  if (entry) return splitMessage(entry);

  // Sinon : noms proches dans les données du bot, passages des documents du MJ, puis extraits du SRD.
  const parts: string[] = [];
  const close = all().filter((e) => e.kind !== "ref" && normName(e.name).startsWith(q)).slice(0, 2);
  for (const e of close) parts.push(entryText(e) ?? "");
  // Résultats raccourcis : trois messages au plus. Pour le texte complet, choisir l'entrée dans l'autocomplétion.
  const refs = searchRef(name);
  const refPart = refs.length ? `__Dans les documents du MJ__\n\n${refs.map((r) => refText(r, 700)).join("\n\n")}` : "";
  const srd = searchSrd(name, { limit: 2, budget: 3500 });
  const cut = (t: string) => (t.length > 900 ? `${t.slice(0, 900).replace(/\s+\S*$/, "")}…` : t);
  const srdPart = srd.length ? `__Dans le SRD 5.2.1__\n\n${srd.map((c) => `**${c.title}** (p. ${c.page}${c.kind === "créature" ? ", créature" : ""})\n${cut(c.text)}`).join("\n\n")}` : "";
  // Les documents du MJ passent en premier quand leur titre répond à la recherche (« sous-classe barbare ») ;
  // sinon le SRD d'abord (« repos long » : la règle avant un jalon qui la mentionne).
  const words = q.split(/[^a-z0-9']+/).filter((w) => w.length >= 3);
  const titleHit = refs.some((r) => words.some((w) => w.length >= 4 && normName(r.title).includes(w.replace(/s$/, ""))));
  parts.push(...(titleHit ? [refPart, srdPart] : [srdPart, refPart]));
  const text = parts.filter(Boolean).join("\n\n");
  if (!text) return [`Rien trouvé pour « ${name} » dans le SRD 5.2.1, les données du bot ni les documents du MJ. Essaie un autre mot (par exemple « Agrippé », « repos long », « Aasimar »).`];
  return splitMessage(text);
}
