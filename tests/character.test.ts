import { describe, expect, it } from "vitest";
import { applyAnswer, nextStep } from "../src/character/steps.js";
import { computeSheet } from "../src/character/sheet.js";
import { BACKGROUNDS, CLASSES, SPECIES, modifier, rollAbilityScore } from "../src/srd/index.js";
import { autoplay } from "./helpers.js";

describe("règles de base", () => {
  it("calcule le modificateur selon la table du SRD (3 à 20)", () => {
    const expected: Record<number, number> = {
      3: -4, 4: -3, 5: -3, 6: -2, 7: -2, 8: -1, 9: -1, 10: 0, 11: 0, 12: 1, 13: 1, 14: 2, 15: 2, 16: 3, 17: 3, 18: 4, 19: 4, 20: 5,
    };
    for (const [score, mod] of Object.entries(expected)) expect(modifier(Number(score))).toBe(mod);
  });

  it("tire 4d6 en gardant les trois meilleurs dés", () => {
    const seq = [0.0, 0.5, 0.99, 0.2]; // 1, 4, 6, 2
    let i = 0;
    const r = rollAbilityScore(() => seq[i++]!);
    expect(r.dice).toEqual([1, 4, 6, 2]);
    expect(r.total).toBe(12);
  });
});

describe("parcours de création", () => {
  it("commence par le nom puis la classe", () => {
    expect(nextStep({}).kind).toBe("name");
    expect(nextStep({ name: "Aria" }).id).toBe("class");
  });

  it("refuse une réponse hors options et une étape périmée", () => {
    const d = { name: "Aria" };
    expect(applyAnswer(d, "class", ["inconnue"]).ok).toBe(false);
    expect(applyAnswer(d, "species", ["elfe"]).ok).toBe(false);
  });

  it("n’assigne chaque résultat de dés qu’une seule fois", () => {
    let d = autoplay({}, {});
    expect(d.assignment).toBeTruthy();
    const idx = Object.values(d.assignment!);
    expect(new Set(idx).size).toBe(6);
  });

  it("ne propose pas de compétence déjà maîtrisée", () => {
    const d = autoplay({ classId: "roublard", speciesId: "humain", backgroundId: "criminel" }, {});
    const skills = new Set(d.classSkills);
    for (const s of ["Discrétion", "Escamotage"]) expect(skills.has(s)).toBe(false);
  });
});

describe("toutes les combinaisons classe × espèce × historique", () => {
  for (const cls of CLASSES) {
    it(`${cls.name} : fiche calculable avec chaque espèce et historique`, () => {
      for (const sp of SPECIES) {
        for (const bg of BACKGROUNDS) {
          const d = autoplay({ classId: cls.id, speciesId: sp.id, backgroundId: bg.id });
          const sheet = computeSheet(d);
          expect(sheet.hp).toBeGreaterThan(0);
          expect(sheet.skills.filter((s) => s.proficient).length).toBeGreaterThanOrEqual(2);
          for (const a of Object.values(sheet.scores)) expect(a.score).toBeLessThanOrEqual(20);
        }
      }
    });
  }
});

describe("valeurs calculées (règles du SRD, vérifiées à la main)", () => {
  // Tirage fixe 15, 14, 13, 12, 10, 8 assigné dans l'ordre FOR, DEX, CON, INT, SAG, CHA.
  // Bonus d'historique : +2 sur la première caractéristique de l'historique, +1 sur la seconde.
  const sheetOf = (start: Parameters<typeof autoplay>[0], answers: Parameters<typeof autoplay>[1] = {}) =>
    computeSheet(autoplay(start, answers));

  it("Barbare nain, historique Soldat : CA sans armure, PV, attaques", () => {
    const s = sheetOf({ classId: "barbare", speciesId: "nain", backgroundId: "soldat" });
    // FOR 15+2 = 17 (+3), DEX 14+1 = 15 (+2), CON 13 (+1)
    expect(s.scores.FOR).toEqual({ score: 17, mod: 3 });
    expect(s.scores.DEX.mod).toBe(2);
    // PV : 12 (d12) + 1 (Con) + 1 (Ténacité naine) = 14
    expect(s.hp).toBe(14);
    // Défense sans armure du Barbare : 10 + Dex + Con = 13
    expect(s.ac).toBe(13);
    // Athlétisme : +3 (Force) + 2 (maîtrise) = +5
    expect(s.skills.find((k) => k.name === "Athlétisme")!.bonus).toBe(5);
    expect(s.passivePerception).toBe(10);
    const axe = s.attacks.find((a) => a.name === "Hache à deux mains")!;
    expect(axe.attack).toBe("+5");
    expect(axe.damage).toBe("1d12+3 tranchants");
    expect(s.darkvision).toBe("36 m");
  });

  it("Magicien (Sage) : DD de sauvegarde et bonus d'attaque de sort", () => {
    const s = sheetOf(
      { classId: "magicien", speciesId: "humain", backgroundId: "sage" },
      { bonusPlus2: ["INT"], bonusPlus1: ["CON"] },
    );
    // INT 12+2 = 14 → mod +2 ; DD = 8 + 2 + 2 = 12
    const b = s.spellBlocks.find((x) => x.title === "Sorts de Magicien")!;
    expect(s.scores.INT.score).toBe(14);
    expect(b.dc).toBe(8 + s.scores.INT.mod + 2);
    expect(b.attackBonus).toBe(s.scores.INT.mod + 2);
    expect(b.spellbook).toHaveLength(6);
    expect(b.prepared).toHaveLength(4);
    expect(s.hp).toBe(6 + s.scores.CON.mod);
  });

  it("Moine : CA = 10 + Dex + Sag", () => {
    const s = sheetOf({ classId: "moine", speciesId: "halfelin", backgroundId: "criminel" });
    expect(s.ac).toBe(10 + s.scores.DEX.mod + s.scores.SAG.mod);
  });

  it("Clerc en chemise de mailles et bouclier : 13 + Dex (max 2) + 2", () => {
    const s = sheetOf({ classId: "clerc", speciesId: "orc", backgroundId: "acolyte" });
    expect(s.ac).toBe(13 + Math.min(s.scores.DEX.mod, 2) + 2);
  });

  it("Guerrier en cotte de mailles avec le style Défense : 16 + 1", () => {
    const s = sheetOf(
      { classId: "guerrier", speciesId: "orc", backgroundId: "soldat" },
      { fightingStyle: ["defense"] },
    );
    expect(s.ac).toBe(17);
  });

  it("Roublard : l'Expertise double la maîtrise", () => {
    const d = autoplay({ classId: "roublard", speciesId: "humain", backgroundId: "criminel" }, { expertise: ["Discrétion", "Escamotage"] });
    const s = computeSheet(d);
    const stealth = s.skills.find((k) => k.name === "Discrétion")!;
    expect(stealth.expertise).toBe(true);
    expect(stealth.bonus).toBe(s.scores.DEX.mod + 4);
  });

  it("Ordre thaumaturge : bonus en Arcanes et Religion (Sagesse, minimum +1)", () => {
    const s = sheetOf({ classId: "clerc", speciesId: "orc", backgroundId: "acolyte" }, { order: ["thaumaturge"] });
    const religion = s.skills.find((k) => k.name === "Religion")!;
    const bonus = Math.max(1, s.scores.SAG.mod);
    expect(religion.bonus).toBe(s.scores.INT.mod + 2 + bonus);
    // 4 sorts mineurs de base 3 + 1
    expect(s.spellBlocks[0]!.cantrips).toHaveLength(4);
  });

  it("Humain avec Doué : trois maîtrises, sans doublon de compétence", () => {
    const d = autoplay({ classId: "barde", speciesId: "humain", backgroundId: "acolyte" }, { speciesFeat: ["doue"] });
    expect(d.speciesFeat?.picks).toHaveLength(3);
    const s = computeSheet(d);
    expect(new Set(s.skills.filter((k) => k.proficient).map((k) => k.name)).size).toBe(s.skills.filter((k) => k.proficient).length);
  });
});
