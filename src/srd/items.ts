import gearJson from "./data/gear.json" with { type: "json" };
import { ARMORS, WEAPONS } from "./index.js";
import { MASTERIES } from "./data/basics.js";
import { formatMeters } from "./rules.js";

/** Outils et matériel d'aventurier : prix et description (SRD 5.2.1, extraits par scripts/srd/gear_texts.py). */
export const GEAR = gearJson as Record<string, { price: string; text: string }>;

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'");

export function itemNames(): string[] {
  return [...new Set([...WEAPONS.map((w) => w.name), ...ARMORS.map((a) => a.name), ...Object.keys(GEAR)])].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Noms proposés par l'autocomplétion (25 au plus, limite de Discord). */
export function searchItems(query: string): string[] {
  const q = norm(query.trim());
  const all = itemNames();
  const starts = all.filter((n) => norm(n).startsWith(q));
  const contains = all.filter((n) => !norm(n).startsWith(q) && norm(n).includes(q));
  return [...starts, ...contains].slice(0, 25);
}

/** Fiche d'un objet, ou undefined s'il n'existe pas dans le SRD. */
export function itemText(name: string): string | undefined {
  const w = WEAPONS.find((x) => norm(x.name) === norm(name));
  if (w)
    return [
      `**${w.name}** : arme ${w.category === "courante" ? "courante" : "de guerre"} (${w.kind}), ${w.price}, ${w.weight}`,
      `Dégâts : ${w.damage} ${w.damageType}${w.versatile ? ` (${w.versatile} à deux mains)` : ""}`,
      `Propriétés : ${w.properties && w.properties !== "—" ? w.properties : "aucune"}`,
      `Botte : **${w.mastery}**. ${MASTERIES[w.mastery] ?? ""}`,
    ].join("\n");
  const a = ARMORS.find((x) => norm(x.name) === norm(name));
  if (a) {
    const ac =
      a.category === "bouclier"
        ? "+2 à la CA"
        : `${a.baseAc}${a.addDex ? ` + modificateur de Dextérité${a.dexMax !== null ? ` (${a.dexMax} au plus)` : ""}` : ""}`;
    return [
      `**${a.name}** : ${a.category === "bouclier" ? "bouclier" : `armure ${a.category}`}, ${a.price}, ${a.weight}`,
      `Classe d’armure : ${ac}`,
      a.minStrength ? `Force requise : ${a.minStrength} (sinon Vitesse réduite de ${formatMeters(3)})` : "",
      a.stealthDisadvantage ? "Discrétion : Désavantage" : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  const key = Object.keys(GEAR).find((k) => norm(k) === norm(name));
  if (key) {
    const g = GEAR[key]!;
    const text = g.text.replace(/ (Poids|Utilisation|Artisanat|Variantes) : /g, "\n$1 : ");
    return `**${key}** (${g.price})\n${text}`;
  }
  return undefined;
}
