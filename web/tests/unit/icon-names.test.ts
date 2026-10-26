import { describe, expect, it } from "vitest";
import { ABILITIES, CLASSES, SPECIES, SPELLS } from "@bot/srd/index";
import { abilityIcon, classIcon, schoolIcon, speciesIcon } from "@/components/icons/icon-names";

// Chaque élément du SRD utilisé par le site doit avoir son icône : une icône manquante
// passerait inaperçue à l'écran (simple absence).
describe("icônes du design system", () => {
  it("couvre les 12 classes, les espèces, les écoles de magie et les caractéristiques", () => {
    for (const cls of CLASSES) expect(classIcon(cls.id), cls.id).toBeDefined();
    for (const species of SPECIES) expect(speciesIcon(species.id), species.id).toBeDefined();
    for (const school of new Set(SPELLS.map((spell) => spell.school))) expect(schoolIcon(school), school).toBeDefined();
    for (const ability of ABILITIES) expect(abilityIcon(ability), ability).toBeDefined();
  });

  it("ne renvoie rien pour un identifiant inconnu", () => {
    expect(classIcon("inconnue")).toBeUndefined();
    expect(classIcon("toString")).toBeUndefined();
    expect(schoolIcon(undefined)).toBeUndefined();
  });
});
