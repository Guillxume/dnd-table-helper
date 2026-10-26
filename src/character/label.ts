import type { StoredCharacter } from "../db.js";
import { getBackground, getClass, getSpecies } from "../srd/index.js";

/** « #12 Lyra (Elfe, Magicien, Sage) ». */
export function characterLabel(c: StoredCharacter): string {
  const d = c.draft;
  const cls = d.classId ? getClass(d.classId)?.name : undefined;
  const sp = d.speciesId ? getSpecies(d.speciesId)?.name : undefined;
  const bg = d.backgroundId ? getBackground(d.backgroundId)?.name : undefined;
  return `#${c.id} ${c.name} (${[sp, cls, bg].filter(Boolean).join(", ")})`;
}

/** Nom de fichier du PDF d'une fiche : « Rek'tal » → « Rek_tal.pdf » (Discord et site). */
export function sheetFileName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || "personnage"}.pdf`;
}
