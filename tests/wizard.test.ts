import { describe, expect, it } from "vitest";
import { openStore } from "../src/db.js";
import { computeSheet } from "../src/character/sheet.js";
import { renderSheetPdf } from "../src/character/pdf.js";
import { answer, draftOf, newState, rollOnce, storyAnswer, back, type WizardState } from "../src/character/state.js";
import { nextStep } from "../src/character/steps.js";
import { renderInfo, renderWizard } from "../src/character/wizard-ui.js";
import { editOptions } from "../src/character/wizard-view.js";
import { explainOption } from "../src/character/explain.js";
import { characterLabel } from "../src/character/handlers.js";
import { ideasPrompt } from "../src/character/assist.js";
import { BACKGROUNDS, CLASSES, SPECIES, POINT_BUDGET } from "../src/srd/index.js";
import { ALL_METHODS, DEFAULT_RULES, type CreationRules } from "../src/character/rules.js";
import { pointsSpent } from "../src/character/helpers.js";

function checkMessage(state: WizardState, pending: string[] = []): void {
  const msg = renderWizard(state, pending);
  expect(msg.content.length).toBeLessThanOrEqual(2000);
  expect(msg.components.length).toBeLessThanOrEqual(5);
  for (const row of msg.components) {
    const json = row.toJSON();
    expect(json.components.length).toBeGreaterThan(0);
    expect(json.components.length).toBeLessThanOrEqual(5);
    for (const c of json.components as any[]) {
      if (c.options) {
        expect(c.options.length).toBeGreaterThan(0);
        expect(c.options.length).toBeLessThanOrEqual(25);
        for (const o of c.options) {
          expect(o.label.length).toBeLessThanOrEqual(100);
          expect(o.value.length).toBeLessThanOrEqual(100);
          expect((o.description ?? "").length).toBeLessThanOrEqual(100);
        }
        expect((c.placeholder ?? "").length).toBeLessThanOrEqual(150);
      }
      expect((c.custom_id as string).length).toBeLessThanOrEqual(100);
    }
  }
}

const ALL_RULES: CreationRules = { ...DEFAULT_RULES, methods: ALL_METHODS };

let explainChecks = false;
function play(forced: Record<string, string[]>, rules?: CreationRules): WizardState {
  let s = newState("Test", rules);
  for (let n = 0; n < 200; n++) {
    const step = nextStep(draftOf(s));
    checkMessage(s);
    if (explainChecks && (step.kind === "select" || step.kind === "multi")) {
      const info = renderInfo(s)!;
      expect(info.components.length).toBeLessThanOrEqual(5);
      for (const o of step.options) {
        const t = explainOption(step, o.value, draftOf(s));
        expect(t.length, `${step.id} ${o.value}`).toBeGreaterThan(0);
        expect(t, `${step.id} ${o.value}`).not.toContain("non disponible");
        expect(renderInfo(s, o.value)!.content.length).toBeLessThanOrEqual(2000);
      }
    }
    if (step.kind === "done") return s;
    if (step.kind === "name") throw new Error("nom attendu");
    if (step.kind === "roll") {
      s = rollOnce(s, () => 0.5);
      continue;
    }
    if (step.kind === "confirm") {
      const r = answer(s, step.id, ["ok"]);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      continue;
    }
    if (step.kind === "story") {
      const r = storyAnswer(s, { backstory: "x" });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      continue;
    }
    if (step.kind === "table") {
      const r = answer(s, step.id, forced[step.id] ?? ["15", "14", "13", "12", "10", "8"]);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      continue;
    }
    const values = forced[step.id] ?? (step.kind === "select" ? [step.options[0]!.value] : step.options.slice(0, step.min).map((o) => o.value));
    if (step.kind === "multi") checkMessage(s, values);
    const r = answer(s, step.id, values);
    if (!r.ok) throw new Error(`${step.id}: ${r.error}`);
    s = r.state;
  }
  throw new Error("boucle");
}

describe("assistant Discord", () => {
  it("chaque étape respecte les limites de Discord, pour toutes les classes et espèces", () => {
    for (const cls of CLASSES) for (const sp of SPECIES) play({ class: [cls.id], species: [sp.id] });
  }, 30_000); // 2 à 3 s en temps normal ; les machines de GitHub dépassent parfois les 5 s par défaut

  it("chaque historique est jouable", () => {
    for (const bg of BACKGROUNDS) play({ background: [bg.id] });
  });

  it("le retour en arrière ne relance pas les dés", () => {
    let s = play({});
    const rolls = s.rolls;
    s = back(back(s));
    expect(s.rolls).toEqual(rolls);
    expect(rollOnce(s).rolls).toEqual(rolls);
  });

  it("produit un PDF pour chaque classe", async () => {
    for (const cls of CLASSES) {
      const s = play({ class: [cls.id] });
      const pdf = await renderSheetPdf(computeSheet(draftOf(s)));
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      expect(pdf.length).toBeGreaterThan(5000);
    }
  });

  it("prompt d’idées sans statistiques", () => {
    const d = draftOf(play({}));
    const p = ideasPrompt(d);
    expect(p).toContain("Classe");
    expect(p).not.toMatch(/\d{2}/);
  });
});

describe("persistance des personnages", () => {
  it("enregistre, relit, liste et supprime", () => {
    const store = openStore(":memory:");
    const s = play({});
    store.saveWizard("g", "u", s);
    expect(store.getWizard("g", "u")?.rolls).toEqual(s.rolls);
    const c = store.addCharacter("g", "u", "camp", "Test", draftOf(s));
    store.deleteWizard("g", "u");
    expect(store.getWizard("g", "u")).toBeUndefined();
    expect(store.getCharacter(c.id)?.draft.classId).toBe(draftOf(s).classId);
    expect(store.latestCharacter("g", "u")?.id).toBe(c.id);
    expect(store.listCharacters("g")).toHaveLength(1);
    expect(characterLabel(c)).toContain("Test");
    store.deleteCharacter(c.id);
    expect(store.listCharacters("g")).toHaveLength(0);
    store.close();
  });
});

describe("équipement", () => {
  it("fusionne une arme obtenue deux fois", async () => {
    const { autoplay } = await import("./helpers.js");
    const sheet = computeSheet(autoplay({ classId: "barde", speciesId: "humain", backgroundId: "criminel" }, { equipment: ["A"], backgroundEquipment: ["A"] }));
    const daggers = sheet.equipment.filter((l) => /dague/i.test(l));
    expect(daggers).toHaveLength(1);
    expect(daggers[0]).toBe("4 dagues");
  });
});

describe("guide d'orientation", () => {
  it("couvre les 12 classes de l’assistant avec 4 sous-classes", async () => {
    const { guideClass, renderClassGuide, renderOverview } = await import("../src/guide/index.js");
    for (const cls of CLASSES) {
      const g = guideClass(cls.id);
      expect(g, cls.id).toBeDefined();
      expect(g!.sousClasses).toHaveLength(4);
      for (const m of renderClassGuide(cls.id)) expect(m.length).toBeLessThanOrEqual(2000);
    }
    for (const m of renderOverview()) expect(m.length).toBeLessThanOrEqual(2000);
    expect(renderClassGuide("barbare").join("\n")).not.toContain("—");
  });
});

describe("historiques et dons du Manuel 2024 (référentiel du MJ)", () => {
  it("Fermier : Robuste ajoute 2 PV au niveau 1", async () => {
    const { autoplay } = await import("./helpers.js");
    const base = computeSheet(autoplay({ classId: "guerrier", speciesId: "humain", backgroundId: "soldat" }));
    const fermier = computeSheet(autoplay({ classId: "guerrier", speciesId: "humain", backgroundId: "fermier" }, { bonusPlus2: ["FOR"], bonusPlus1: ["SAG"] }));
    // Même Constitution (FIXED_ROLLS, bonus hors CON) : seule la différence Robuste reste.
    expect(fermier.scores.CON.score).toBe(base.scores.CON.score);
    expect(fermier.hp - base.hp).toBe(2);
    expect(fermier.features.some((f) => f.name.startsWith("Robuste"))).toBe(true);
    expect(fermier.otherSources.length).toBeGreaterThan(0);
  });
  it("Marin : Bagarreur de taverne donne 1d4 + Force à mains nues", async () => {
    const { autoplay } = await import("./helpers.js");
    const s = computeSheet(autoplay({ classId: "guerrier", speciesId: "nain", backgroundId: "marin" }));
    const u = s.attacks.find((a) => a.name === "Attaque à mains nues")!;
    expect(u.damage).toMatch(/^1d4/);
    expect(s.weaponProficiency).toContain("armes improvisées");
  });
  it("Artiste et Artisan : outils choisis et trois maîtrises du don", async () => {
    const { autoplay } = await import("./helpers.js");
    const a = computeSheet(autoplay({ classId: "barbare", speciesId: "nain", backgroundId: "artiste" }));
    expect(a.tools.length).toBeGreaterThanOrEqual(4);
    const b = computeSheet(autoplay({ classId: "barbare", speciesId: "nain", backgroundId: "artisan" }));
    expect(b.tools.length).toBeGreaterThanOrEqual(3);
  });
  it("sans option A connue, l'historique donne 50 po", async () => {
    const { autoplay } = await import("./helpers.js");
    const g = computeSheet(autoplay({ classId: "barbare", speciesId: "nain", backgroundId: "garde" }, { equipment: ["B"] }));
    const cls = CLASSES.find((c) => c.id === "barbare")!;
    expect(g.gold).toBe(cls.equipment.find((e) => e.id === "B")!.gold + 50);
    expect(g.levelOneNotes.some((n) => n.includes("option B"))).toBe(true);
  });
  it("Voyageur option A : dagues et boîte de jeux choisie", async () => {
    const { autoplay } = await import("./helpers.js");
    const v = computeSheet(autoplay({ classId: "barbare", speciesId: "nain", backgroundId: "voyageur" }, { backgroundEquipment: ["A"] }));
    expect(v.equipment.some((e) => e.startsWith("Boîte de jeux : "))).toBe(true);
    expect(v.attacks.some((a) => a.name.startsWith("Dague"))).toBe(true);
  });
});

describe("paramètres de création et méthodes de caractéristiques", () => {
  it("chaque méthode, suggérée ou manuelle, aboutit à une fiche valide pour chaque classe", async () => {
    for (const cls of CLASSES)
      for (const method of ["standard", "points", "des", "table"] as const)
        for (const mode of ["suggested", "manual"]) {
          const s = play({ class: [cls.id], method: [method], assignMode: [mode] }, ALL_RULES);
          const d = draftOf(s);
          expect(d.method).toBe(method);
          const sheet = computeSheet(d);
          for (const a of Object.values(sheet.scores)) {
            expect(a.score).toBeGreaterThanOrEqual(3);
            expect(a.score).toBeLessThanOrEqual(20);
          }
          if (method === "points") expect(pointsSpent(d)).toBeLessThanOrEqual(POINT_BUDGET);
        }
  }, 30_000); // 12 classes × 4 méthodes × 2 répartitions : plus de 5 s sur la machine de CI.
  it("valeurs standard suggérées : reprend la table du SRD pour le Barbare (avant bonus d'historique)", () => {
    const d = draftOf(play({ class: ["barbare"], method: ["standard"], assignMode: ["suggested"], background: ["soldat"], bonusMode: ["1-1-1"] }, DEFAULT_RULES));
    const sh = computeSheet(d);
    // Table : For 15, Dex 13, Con 14, Int 10, Sag 12, Cha 8 ; Soldat +1 For, Dex, Con.
    expect([sh.scores.FOR.score, sh.scores.DEX.score, sh.scores.CON.score, sh.scores.INT.score, sh.scores.SAG.score, sh.scores.CHA.score]).toEqual([16, 14, 15, 10, 12, 8]);
  });
  it("achat par points : 27 points, aucune option au-delà du budget", () => {
    const s = play({ class: ["magicien"], method: ["points"], assignMode: ["manual"], "pb.FOR": ["15"], "pb.DEX": ["15"], "pb.CON": ["15"] }, DEFAULT_RULES);
    const d = draftOf(s);
    expect(pointsSpent(d)).toBe(27);
    expect(d.points).toEqual({ FOR: 15, DEX: 15, CON: 15, INT: 8, SAG: 8, CHA: 8 });
  });
  it("une seule méthode autorisée : pas de question, contenu SRD seul : historiques du Manuel masqués", () => {
    let s = newState("T", { level: 1, methods: ["standard"], content: "srd" });
    s = answer(s, "rules", ["ok"]).ok ? (answer(s, "rules", ["ok"]) as any).state : s;
    s = (answer(s, "class", ["barbare"]) as any).state;
    s = (answer(s, "species", ["nain"]) as any).state;
    const step = nextStep(draftOf(s));
    expect(step.kind).toBe("select");
    expect((step as any).options.map((o: any) => o.value)).toEqual(["acolyte", "criminel", "sage", "soldat"]);
    const done = play({ method: ["des"] }, { level: 1, methods: ["standard"], content: "srd" });
    expect(draftOf(done).method).toBeUndefined();
    expect(computeSheet(draftOf(done)).scores.FOR.score).toBeGreaterThan(0);
  });
});

describe("/regles", () => {
  it("met à jour les méthodes, refuse un niveau non géré et une liste vide", async () => {
    const { updateRules } = await import("../src/character/rules.js");
    const none = { level: null, standard: null, points: null, des: null, table: null, content: null };
    const r = updateRules(DEFAULT_RULES, { ...none, des: false, content: "srd" });
    expect(r.ok && r.rules).toEqual({ level: 1, methods: ["standard", "points"], content: "srd" });
    expect(updateRules(DEFAULT_RULES, { ...none, level: 3 }).ok).toBe(false);
    expect(updateRules(DEFAULT_RULES, { ...none, standard: false, points: false, des: false }).ok).toBe(false);
    const t = updateRules(DEFAULT_RULES, { ...none, table: true, des: false });
    expect(t.ok && t.rules.methods).toEqual(["standard", "points", "table"]);
    expect(updateRules({ ...DEFAULT_RULES, methods: ["table"] }, { ...none, table: false }).ok).toBe(false);
  });
  it("persiste les paramètres de la campagne", () => {
    const store = openStore(":memory:");
    store.createCampaign({ channelId: "c", guildId: "g", name: "N", mjRoleId: "r" });
    expect(store.campaignForGuild("g")?.creationRules).toEqual(DEFAULT_RULES);
    store.setCreationRules("c", { level: 1, methods: ["des"], content: "srd" });
    expect(store.campaignForGuild("g")?.creationRules).toEqual({ level: 1, methods: ["des"], content: "srd" });
    store.close();
  });
});

describe("feuille officielle", async () => {
  const { officialTemplateAvailable, renderOfficialSheetPdf, SKILL_ROWS } = await import("../src/character/official-sheet.js");
  it("chaque compétence du SRD a une ligne sur la feuille", async () => {
    const { SKILLS } = await import("../src/srd/index.js");
    expect(SKILL_ROWS.map((r) => r.skill).sort()).toEqual(SKILLS.map((s) => s.name).sort());
  });
  it.skipIf(!officialTemplateAvailable())("se remplit pour chaque classe et ajoute l'annexe, sans valeurs de séance", async () => {
    const { PDFDocument } = await import("pdf-lib");
    for (const cls of CLASSES) {
      const d = draftOf(play({ class: [cls.id] }));
      const buf = await renderOfficialSheetPdf(computeSheet(d), { playerName: "Joueur" });
      const pdf = await PDFDocument.load(buf);
      expect(pdf.getPageCount()).toBeGreaterThanOrEqual(4);
      const form = pdf.getForm();
      const val = (n: string) => form.getTextField(n).getText() ?? "";
      expect(val("CharacterName")).toBe("Test");
      expect(val("HPMax")).not.toBe("");
      for (const blank of ["HPCurrent", "HPTemp", "HD", "Inspiration", "CP", "SP", "EP", "GP", "PP", "Equipment", "Treasure", "SlotsRemaining 19"])
        expect(val(blank), `${cls.id} ${blank}`).toBe("");
    }
  }, 30_000); // une fiche officielle par classe : plusieurs secondes sur une machine chargée
});

describe("récapitulatif, contrôles et modification d'étape", () => {
  it("le récapitulatif tient dans un message et ne bloque pas une fiche correcte", async () => {
    const { validateDraft } = await import("../src/character/validate.js");
    for (const cls of CLASSES) {
      const s = play({ class: [cls.id] }, DEFAULT_RULES);
      const v = validateDraft(draftOf(s));
      expect(v.errors, cls.id).toEqual([]);
      checkMessage(s);
    }
  });
  it("bloque une compétence accordée deux fois", async () => {
    const { validateDraft } = await import("../src/character/validate.js");
    const d = draftOf(play({ class: ["guerrier"], background: ["soldat"] }));
    d.classSkills = ["Athlétisme", d.classSkills![1]!];
    expect(validateDraft(d).errors.some((e) => e.includes("Athlétisme"))).toBe(true);
  });
  it("modifier l'espèce conserve les choix suivants encore valides", async () => {
    const { editStep, cancelEdit } = await import("../src/character/state.js");
    const s = play({ class: ["guerrier"], species: ["nain"] }, DEFAULT_RULES);
    const idx = s.history.findIndex((h) => h.id === "species");
    const editing = editStep(s, idx);
    expect(editing.history.length).toBe(idx);
    const res = answer(editing, "species", ["orc"]);
    expect(res.ok).toBe(true);
    const after = (res as any).state as WizardState;
    expect(draftOf(after).speciesId).toBe("orc");
    expect(draftOf(after).classId).toBe("guerrier");
    expect(draftOf(after).backgroundId).toBe(draftOf(s).backgroundId);
    expect(draftOf(after).alignment).toBe(draftOf(s).alignment);
    expect(nextStep(draftOf(after)).kind).toBe("done");
    // Annuler une modification restaure tout.
    const restored = cancelEdit(editStep(s, idx));
    expect(restored.history).toEqual(s.history);
  });
});

describe("personnage actif et fiche dans Discord", () => {
  it("le premier personnage devient actif, puis on peut changer", () => {
    const store = openStore(":memory:");
    const a = store.addCharacter("g", "u", "c1", "A", draftOf(play({})));
    const b = store.addCharacter("g", "u", "c1", "B", draftOf(play({ class: ["barde"] })));
    expect(store.activeCharacter("g", "u", "c1")?.id).toBe(a.id);
    store.setActiveCharacter(b.id);
    expect(store.activeCharacter("g", "u", "c1")?.id).toBe(b.id);
    expect(store.listCharacters("g").filter((c) => c.active)).toHaveLength(1);
    store.close();
  });
  it("la fiche Discord contient les calculs et l'équipement", async () => {
    const { sheetDiscordText } = await import("../src/character/validate.js");
    const t = sheetDiscordText(computeSheet(draftOf(play({ class: ["barbare"] }))));
    expect(t).toContain("Points de vie maximum");
    expect(t).toContain("Équipement de départ");
  });
});

describe("explications au moment du choix", () => {
  it("chaque option de chaque étape a une description, pour toutes les classes", () => {
    explainChecks = true;
    try {
      for (const cls of CLASSES) play({ class: [cls.id] }, DEFAULT_RULES);
      for (const bg of BACKGROUNDS) play({ background: [bg.id] }, DEFAULT_RULES);
    } finally {
      explainChecks = false;
    }
  });
});

describe("/objet", () => {
  it("trouve armes, armures, outils et matériel, et chaque objet de départ a une fiche", async () => {
    const { itemText, searchItems, itemNames } = await import("../src/srd/items.js");
    expect(itemText("Dague")).toContain("1d4");
    expect(itemText("Cotte de mailles")).toContain("Classe d’armure");
    expect(itemText("trousse de soins")).toContain("dix charges");
    expect(searchItems("outils")[0]).toMatch(/^Outils/);
    expect(searchItems("").length).toBe(25);
    for (const n of itemNames()) expect(itemText(n), n).toBeDefined();
  });
});

describe("Aasimar (Manuel 2024)", () => {
  it("résistances, vision dans le noir, Lumière au Charisme, taille au choix", async () => {
    const { autoplay } = await import("./helpers.js");
    const s = computeSheet(autoplay({ classId: "clerc", speciesId: "aasimar", backgroundId: "acolyte" }, { size: ["P"] }));
    expect(s.resistances).toEqual(expect.arrayContaining(["nécrotiques", "radiants"]));
    expect(s.darkvision).toBe("18 m");
    expect(s.speed).toBe("9 m");
    expect(s.size).toBe("P");
    const block = s.spellBlocks.find((b) => b.title.includes("Aasimar"))!;
    expect(block.cantrips).toEqual(["Lumière"]);
    expect(block.abilityName).toBe("Charisme");
    // Lumière n'est pas reproposée dans les sorts mineurs du Clerc.
    expect(s.spellBlocks.find((b) => b.title === "Sorts de Clerc")!.cantrips).not.toContain("Lumière");
    expect(s.otherSources.some((x) => x.includes("Roll20"))).toBe(true);
  });
});

describe("aide au choix des sorts", () => {
  it("déduit le type d'effet, les dégâts et la portée du texte du SRD", async () => {
    const { spellTags, selectionSummary } = await import("../src/character/spell-tags.js");
    expect(spellTags("Trait de feu")).toMatchObject({ kind: "Attaque de sort", damage: "1d10 feu" });
    expect(spellTags("Mot de guérison")).toMatchObject({ kind: "Soins", heal: true });
    expect(spellTags("Sommeil")?.kind).toBe("Sauvegarde de Sagesse");
    expect(selectionSummary(["Trait de feu", "Mot de guérison"])).toContain("1 sort(s) de dégâts, 1 de soins");
  });
  it("le prompt de conseil ne contient que les sorts proposés", async () => {
    const { spellAdvicePrompt } = await import("../src/character/assist.js");
    let s = newState("T", DEFAULT_RULES);
    for (let n = 0; n < 200; n++) {
      const st = nextStep(draftOf(s));
      if (st.kind === "multi" && st.id === "cantrips") {
        const p = spellAdvicePrompt(draftOf(s), st);
        for (const o of st.options) expect(p).toContain(`- ${o.value} :`);
        expect(p).toContain("Nombre à choisir");
        return;
      }
      if (st.kind === "confirm") s = (answer(s, st.id, ["ok"]) as any).state;
      else if (st.kind === "roll") s = rollOnce(s, () => 0.5);
      else if (st.kind === "select") s = (answer(s, st.id, [st.id === "class" ? "magicien" : st.options[0]!.value]) as any).state;
      else if (st.kind === "multi") s = (answer(s, st.id, st.options.slice(0, st.min).map((o) => o.value)) as any).state;
      else throw new Error(st.kind);
    }
    throw new Error("étape des sorts mineurs non atteinte");
  });
});

describe("/aide", () => {
  it("montre à chacun les commandes de son rôle, et couvre toutes les commandes", async () => {
    const { renderHelp, HELP } = await import("../src/help.js");
    const { commandDefinitions } = await import("../src/commands.js");
    const joueur = renderHelp(false, false);
    const mj = renderHelp(false, true);
    const admin = renderHelp(true, false);
    expect(joueur).toContain("/personnage creer");
    expect(joueur).not.toContain("/seance");
    expect(joueur).not.toContain("/setup");
    expect(mj).toContain("/seance");
    expect(mj).not.toContain("/setup");
    expect(admin).toContain("/setup");
    for (const t of [joueur, mj, admin]) expect(t.length).toBeLessThanOrEqual(4000);
    for (const c of commandDefinitions) expect(HELP.some((h) => h.command.startsWith(`/${c.name}`)) || c.name === "aide", c.name).toBe(true);
  });
});

describe("campagnes multiples", () => {
  it("chaque personnage appartient à une campagne, avec un personnage actif par campagne", () => {
    const store = openStore(":memory:");
    store.createCampaign({ channelId: "c1", guildId: "g", name: "Les Mines", mjRoleId: "mj1" });
    store.createCampaign({ channelId: "c2", guildId: "g", name: "L’Abîme", mjRoleId: "mj2" });
    const a = store.addCharacter("g", "u", "c1", "A", draftOf(play({})));
    const b = store.addCharacter("g", "u", "c2", "B", draftOf(play({})));
    expect(store.activeCharacter("g", "u", "c1")?.id).toBe(a.id);
    expect(store.activeCharacter("g", "u", "c2")?.id).toBe(b.id);
    expect(store.listCharacters("g", "c1").map((c) => c.name)).toEqual(["A"]);
    expect(store.listCharacters("g")).toHaveLength(2);
    store.close();
  });

  it("résout la campagne : option, salon, catégorie, rôle, campagne unique, sinon erreur", async () => {
    const { resolveCampaign } = await import("../src/campaigns.js");
    const store = openStore(":memory:");
    store.createCampaign({ channelId: "c1", guildId: "g", name: "Les Mines", mjRoleId: "mj1" });
    const q = { guildId: "g", roleIds: [] as string[] };
    expect(resolveCampaign(store, q).ok).toBe(true); // une seule campagne
    store.createCampaign({ channelId: "c2", guildId: "g", name: "L’Abîme", mjRoleId: "mj2" });
    store.setCampaignStructure("c2", { categoryId: "cat2", playerRoleId: "p2", sheetsChannelId: "s2" });
    const name = (r: ReturnType<typeof resolveCampaign>) => (r.ok ? r.campaign.name : r.error);
    expect(resolveCampaign(store, q).ok).toBe(false);
    expect(name(resolveCampaign(store, { ...q, name: "les mines" }))).toBe("Les Mines");
    expect(name(resolveCampaign(store, { ...q, name: "L'Abîme" }))).toBe("L’Abîme");
    expect(name(resolveCampaign(store, { ...q, channelId: "c1" }))).toBe("Les Mines");
    expect(name(resolveCampaign(store, { ...q, channelId: "x", parentId: "cat2" }))).toBe("L’Abîme");
    expect(name(resolveCampaign(store, { ...q, channelId: "s2" }))).toBe("L’Abîme");
    expect(name(resolveCampaign(store, { ...q, roleIds: ["p2"] }))).toBe("L’Abîme");
    expect(name(resolveCampaign(store, { ...q, roleIds: ["mj1"] }))).toBe("Les Mines");
    expect(resolveCampaign(store, { ...q, name: "Inconnue" }).ok).toBe(false);
    store.setArchived("c2", true);
    expect(name(resolveCampaign(store, q))).toBe("Les Mines");
    expect(store.listCampaigns("g").map((c) => c.name)).toEqual(["Les Mines"]);
    expect(store.listCampaigns("g", true)).toHaveLength(2);
    store.close();
  });

  it("migre une ancienne base : les personnages rejoignent la première campagne", async () => {
    const Database = (await import("better-sqlite3")).default;
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const path = join(mkdtempSync(join(tmpdir(), "jdr-")), "old.sqlite");
    const old = new Database(path);
    old.exec(`CREATE TABLE campaigns (channel_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, name TEXT NOT NULL, mj_role_id TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE characters (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, draft TEXT NOT NULL, created_at TEXT NOT NULL);
      INSERT INTO campaigns VALUES ('c1', 'g', 'Ancienne', 'mj', '2026-01-01');
      INSERT INTO characters (guild_id, user_id, name, draft, created_at) VALUES ('g', 'u', 'Vieux', '{}', '2026-01-02');`);
    old.close();
    const store = openStore(path);
    expect(store.listCharacters("g", "c1").map((c) => c.name)).toEqual(["Vieux"]);
    expect(store.getCampaign("c1")?.archived).toBe(false);
    store.close();
  });
});

describe("suppression et archivage de campagne", () => {
  it("une campagne archivée ne s'applique plus à son salon, la suppression efface ses données", async () => {
    const { resolveCampaign } = await import("../src/campaigns.js");
    const store = openStore(":memory:");
    store.createCampaign({ channelId: "general", guildId: "g", name: "test-campagne", mjRoleId: "mj" });
    store.createCampaign({ channelId: "c2", guildId: "g", name: "Les Mines", mjRoleId: "mj2" });
    store.setArchived("general", true);
    const r = resolveCampaign(store, { guildId: "g", channelId: "general", roleIds: [] });
    expect(r.ok && r.campaign.name).toBe("Les Mines");
    store.addCharacter("g", "u", "general", "A", draftOf(play({})));
    store.addSession("general", "notes", "rappel");
    store.setNextSession("general", "2030-01-01T00:00:00.000Z", "");
    store.deleteCampaign("general");
    expect(store.getCampaign("general")).toBeUndefined();
    expect(store.listCharacters("g", "general")).toHaveLength(0);
    expect(store.allSessions("general")).toHaveLength(0);
    expect(store.getNextSession("general")).toBeUndefined();
    store.close();
  });
});

describe("dés lancés à la table", async () => {
  const { officialTemplateAvailable } = await import("../src/character/official-sheet.js");
  const TABLE: CreationRules = { ...DEFAULT_RULES, methods: ["table"] };
  /** Joue jusqu'à l'étape de saisie des résultats (tout le reste répondu). */
  function untilTable(forced: Record<string, string[]> = {}): WizardState {
    let s = newState("Test", TABLE);
    for (let n = 0; n < 200; n++) {
      const step = nextStep(draftOf(s));
      if (step.kind === "table") return s;
      if (step.kind === "done" || step.kind === "roll") throw new Error(`étape inattendue : ${step.kind}`);
      checkMessage(s);
      const values =
        step.kind === "confirm"
          ? ["ok"]
          : step.kind === "story"
            ? [JSON.stringify({ backstory: "x" })]
            : step.kind === "select"
              ? (forced[step.id] ?? [step.options[0]!.value])
              : step.kind === "multi"
                ? (forced[step.id] ?? step.options.slice(0, step.min).map((o) => o.value))
                : [];
      const r = answer(s, step.id, values);
      if (!r.ok) throw new Error(`${step.id}: ${r.error}`);
      s = r.state;
    }
    throw new Error("boucle");
  }

  it("la saisie vient après tout le reste, sans aucune question de caractéristiques avant", () => {
    const s = untilTable({ class: ["magicien"] });
    const ids = s.history.map((h) => h.id);
    expect(ids).toContain("story");
    expect(ids).toContain("prepared");
    expect(ids.some((id) => /^(assign|pb)\.|^assignMode$|^bonus/.test(id))).toBe(false);
    checkMessage(s);
    const msg = renderWizard(s);
    const buttons = msg.components.flatMap((r) => (r.toJSON().components as any[]).map((c) => c.custom_id));
    expect(buttons).toContain("pc:table:enter");
    expect(buttons).toContain("pc:table:blank");
  });

  it("refuse une saisie incomplète ou hors limites", () => {
    const s = untilTable();
    for (const bad of [["15", "14", "13", "12", "10"], ["15", "14", "13", "12", "10", "19"], ["2", "14", "13", "12", "10", "8"], ["a", "14", "13", "12", "10", "8"], ["15.5", "14", "13", "12", "10", "8"]])
      expect(answer(s, "tableRolls", bad).ok, bad.join(" ")).toBe(false);
  });

  it("lit les résultats séparés par des espaces, virgules ou barres", async () => {
    const { parseTableRolls } = await import("../src/character/handlers.js");
    expect(parseTableRolls(" 15, 14 12/11;10  8 ")).toEqual(["15", "14", "12", "11", "10", "8"]);
    expect(parseTableRolls("")).toEqual([]);
  });

  it("fiche à cases vides : rien ne dépend de valeurs inconnues, les formules sont données", async () => {
    for (const cls of CLASSES) {
      const d = draftOf(untilTable({ class: [cls.id] }));
      expect(() => computeSheet(d)).toThrow();
      const sh = computeSheet(d, { pendingScores: true });
      expect(sh.scoresPending).toBe(true);
      for (const a of sh.attacks) {
        expect(a.attack, `${cls.id} ${a.name}`).toMatch(/FOR|DEX/);
        expect(a.damage, `${cls.id} ${a.name}`).toMatch(/FOR|DEX/);
      }
      const calc = (label: string) => sh.calculations.find((c) => c.label === label)!;
      expect(calc("Points de vie maximum").value).toBe("à calculer");
      expect(calc("Points de vie maximum").detail).toContain("+ mod. CON");
      expect(calc("Classe d’armure").value).toBe(sh.acKnown ? String(sh.ac) : "à calculer");
      expect(calc("Initiative").detail).toContain("mod. DEX");
      for (const b of sh.spellBlocks) expect(calc(`${b.title} : DD et attaque`).detail).toMatch(/\+ mod\. (INT|SAG|CHA)/);
      for (const pdf of [await renderSheetPdf(sh), await renderSheetPdf(sh, { annex: true })]) expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    }
  }, 30_000);

  it("une armure lourde garde sa CA, qui ne dépend d'aucune caractéristique", () => {
    const sh = computeSheet(draftOf(untilTable({ class: ["guerrier"], equipment: ["A"] })), { pendingScores: true });
    expect(sh.acNote).toContain("Cotte de mailles");
    expect(sh.acKnown).toBe(true);
    expect(sh.ac).toBeGreaterThanOrEqual(16);
    expect(sh.calculations.find((c) => c.label === "Initiative")!.detail).toMatch(/^mod\. DEX/);
  });

  it("le Barbare sans armure voit les deux calculs de CA possibles", () => {
    const sh = computeSheet(draftOf(untilTable({ class: ["barbare"] })), { pendingScores: true });
    expect(sh.calculations.find((c) => c.label === "Classe d’armure")!.detail).toMatch(/la plus haute de : .*Dextérité.*Constitution/);
  });

  it("après la saisie : répartition, bonus d'historique, puis fiche remplie avec ces valeurs", () => {
    let s = untilTable({ class: ["guerrier"], background: ["soldat"] });
    const r = answer(s, "tableRolls", ["8", "17", "11", "14", "9", "12"]);
    expect(r.ok).toBe(true);
    s = (r as any).state;
    expect(nextStep(draftOf(s)).id).toBe("assignMode");
    s = play({}, TABLE); // parcours complet par le chemin normal
    const d = draftOf(s);
    expect(d.rolls).toEqual([15, 14, 13, 12, 10, 8]);
    const sh = computeSheet(d);
    expect(sh.scoresPending).toBe(false);
    expect(Object.values(sh.scores).every((x) => x.score >= 8)).toBe(true);
    // Les résultats saisis se corrigent par « Modifier une étape ».
    expect(editOptions(s).some((o: any) => o.label.startsWith("Résultats des dés lancés à la table : 15, 14"))).toBe(true);
  });

  it("corriger les résultats saisis garde la répartition et la suite", async () => {
    const { editStep } = await import("../src/character/state.js");
    const s = play({}, TABLE);
    const idx = s.history.findIndex((h) => h.id === "tableRolls");
    const res = answer(editStep(s, idx), "tableRolls", ["16", "14", "13", "12", "10", "8"]);
    expect(res.ok).toBe(true);
    const after = draftOf((res as any).state);
    expect(after.rolls?.[0]).toBe(16);
    expect(nextStep(after).kind).toBe("done");
  });

  it.skipIf(!officialTemplateAvailable())("feuille officielle à cases vides", async () => {
    const { renderOfficialSheetPdf } = await import("../src/character/official-sheet.js");
    const { PDFDocument } = await import("pdf-lib");
    const d = draftOf(untilTable({ class: ["clerc"] }));
    const pdf = await PDFDocument.load(await renderOfficialSheetPdf(computeSheet(d, { pendingScores: true })));
    const val = (n: string) => pdf.getForm().getTextField(n).getText() ?? "";
    for (const blank of ["STR", "STRmod", "ST Strength", "HPMax", "AC", "Initiative", "Passive", "SpellSaveDC  2", "Acrobaties"]) expect(val(blank), blank).toBe("");
    expect(val("ProfBonus")).toBe("+2");
    expect(val("Wpn1 AtkBonus")).toMatch(/FOR|DEX/);
  });
});

describe("aide des étapes selon l'interface", () => {
  it("ajoute les renvois Discord au bot et ceux du site au site, sur un texte du moteur neutre", async () => {
    const { helpFor } = await import("../src/character/wizard-view.js");
    expect(helpFor("class", "Personnage de niveau 1.", "discord")).toContain("/guide");
    expect(helpFor("class", "Personnage de niveau 1.", "web")).toBe("Personnage de niveau 1. « En savoir plus » présente chaque classe.");
    expect(helpFor("species", "Texte.", "web")).toBe("Texte.");
    expect(helpFor("rules", undefined, "web")).toBe("Le MJ les modifie depuis son espace de campagne.");
  });
});
