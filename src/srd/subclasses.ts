import chunksJson from "./data/srd-chunks.json" with { type: "json" };
import type { SrdChunk } from "./search.js";

const CHUNKS = chunksJson as unknown as SrdChunk[];

/**
 * Les 12 sous-classes du SRD 5.2.1 (une par classe), avec le nom court employé dans les documents du MJ.
 * Le découpage du PDF donne des titres irréguliers : chaque section est repérée soit par le titre de son extrait,
 * soit par la phrase « Sous-classe de <classe> : <nom> » dans le texte.
 */
export const SRD_SUBCLASSES: { classe: string; ref: string; name: string; title?: string; page: number }[] = [
  { classe: "Barbare", ref: "Berserker", name: "Voie du Berserker", title: "Voie du Berserker", page: 32 },
  { classe: "Barde", ref: "Savoir", name: "Collège du Savoir", title: "Collège du Savoir", page: 37 },
  { classe: "Clerc", ref: "Vie", name: "Domaine de la Vie", title: "de la Vie", page: 42 },
  { classe: "Druide", ref: "Terre", name: "Cercle de la Terre", title: "Cercle de la Terre", page: 48 },
  { classe: "Ensorceleur", ref: "Draconique", name: "Sorcellerie draconique", title: "Sorcellerie draconique", page: 55 },
  { classe: "Guerrier", ref: "Champion", name: "Champion", page: 56 },
  { classe: "Magicien", ref: "Évocateur", name: "Évocateur", page: 61 },
  { classe: "Moine", ref: "Main ouverte", name: "Credo de la Paume", title: "la Paume", page: 67 },
  { classe: "Occultiste", ref: "Fiélon", name: "Protecteur Fiélon", title: "Protecteur Fiélon", page: 74 },
  { classe: "Paladin", ref: "Dévotion", name: "Serment de Dévotion", page: 78 },
  { classe: "Rôdeur", ref: "Chasseur", name: "Chasseur", page: 82 },
  { classe: "Roublard", ref: "Voleur", name: "Voleur", title: "Sous-classe de Roublard : Voleur", page: 86 },
];

/** Texte officiel d'une sous-classe du SRD (début de la section, `max` caractères au plus). */
export function subclassText(s: (typeof SRD_SUBCLASSES)[number], max = 1800): string | undefined {
  let start = -1;
  let offset = 0;
  if (s.title) start = CHUNKS.findIndex((c) => c.kind === "règle" && c.title === s.title);
  else {
    const marker = `Sous-classe de ${s.classe} : ${s.name}`;
    start = CHUNKS.findIndex((c) => c.text.includes(marker));
    if (start >= 0) offset = CHUNKS[start]!.text.indexOf(marker) + marker.length;
  }
  if (start < 0) return undefined;
  // Les extraits se suivent : on prend le suivant tant que le texte est trop court.
  let text = CHUNKS[start]!.text.slice(offset).trim();
  for (let k = start + 1; text.length < max && k < CHUNKS.length && k <= start + 3; k++) {
    const next = CHUNKS[k]!;
    if (s.title && next.title !== s.title) break;
    // Recouvrement entre extraits voisins : on recolle à la fin du texte déjà pris quand c'est possible.
    const overlap = next.text.indexOf(text.slice(-40));
    text += " " + (overlap >= 0 ? next.text.slice(overlap + 40) : next.text);
  }
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
}

export function findSubclass(query: string, norm: (t: string) => string): (typeof SRD_SUBCLASSES)[number] | undefined {
  const q = norm(query);
  return SRD_SUBCLASSES.find((s) => norm(s.name) === q || norm(s.ref) === q || norm(`${s.ref} (${s.classe})`) === q);
}
