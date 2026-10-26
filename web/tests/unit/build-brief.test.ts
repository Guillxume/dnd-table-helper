import { describe, expect, it } from "vitest";
import { type BriefContext, BRIEF_SECTION_KEYS, briefToText, buildBrief } from "../../src/lib/brief/build-brief";

const base: BriefContext = {
  subjectType: "CHARACTER",
  objective: "Portrait de référence",
  imageType: "Portrait en buste",
  aspectRatio: "2:3",
  character: {
    name: "Rek'tal",
    kind: "PLAYER_CHARACTER",
    summary: null,
    fields: { species: "Drakéide", face: null, outfit: "Armure noircie" },
    traits: [
      { status: "CANON", content: "Écailles cuivrées", locked: true },
      { status: "CANON", content: "Corne gauche brisée", locked: false },
      { status: "PREFERENCE", content: "Regard calme", locked: false },
      { status: "PROPOSAL", content: "Cape rouge", locked: false },
      { status: "EXCLUDED", content: "Ailes", locked: false },
      { status: "UNDETERMINED", content: "Couleur des yeux", locked: false },
    ],
  },
  guide: {
    name: "Fantasy sombre",
    parentName: "Fantasy peinte",
    number: 3,
    rules: [
      { aspect: "TEXTURES", common: "Coups de pinceau visibles" },
      { aspect: "LIGHTING", common: "Lumière chaude", specific: "Contre-jour froid" },
      { aspect: "AVOID", common: "Rendu 3D lisse" },
    ],
  },
  references: [
    { title: "Ciel d'orage", role: "STYLE", aspects: ["TEXTURES"], note: null },
    { title: "Armure de référence", role: "CONTENT", aspects: [], note: "la forme des spalières" },
  ],
};

describe("construction du brief", () => {
  const { sections, prompt } = buildBrief(base);

  it("produit les dix sections, toutes renseignées", () => {
    expect(BRIEF_SECTION_KEYS).toHaveLength(10);
    for (const key of BRIEF_SECTION_KEYS) expect(sections[key].trim()).not.toBe("");
  });

  it("ne reprend que ce qui est établi et n'invente pas l'inconnu", () => {
    expect(sections.sectionSubject).toContain("Espèce : Drakéide");
    expect(sections.sectionSubject).toContain("Écailles cuivrées [intangible]");
    expect(sections.sectionSubject).not.toContain("Visage");
    expect(sections.sectionSubject).toContain("ne pas inventer");
    expect(sections.sectionSubject).toContain("Couleur des yeux");
  });

  it("n'utilise jamais une proposition non validée", () => {
    expect(JSON.stringify(sections)).not.toContain("Cape rouge");
    expect(prompt).not.toContain("Cape rouge");
  });

  it("distingue références de style et de contenu", () => {
    expect(sections.sectionReferences).toContain("Image 1 (« Ciel d'orage ») : référence de STYLE uniquement (textures)");
    expect(sections.sectionReferences).toContain("Image 2 (« Armure de référence ») : référence de CONTENU : la forme des spalières");
    expect(sections.sectionForbidden).toContain("Reprendre le contenu");
    expect(prompt).toContain("image 1 = style uniquement (textures), ne pas reprendre son contenu");
  });

  it("garde les règles communes et les précisions de la variante", () => {
    expect(sections.sectionArtDirection).toContain("Fantasy peinte › Fantasy sombre (version 3)");
    expect(sections.sectionLighting).toContain("Éclairage : Lumière chaude");
    expect(sections.sectionLighting).toContain("Éclairage (précision de la variante) : Contre-jour froid");
    expect(sections.sectionMaterials).toContain("Coups de pinceau visibles");
  });

  it("rassemble les interdits et les éléments intangibles", () => {
    expect(sections.sectionForbidden).toContain("Ailes");
    expect(sections.sectionForbidden).toContain("Rendu 3D lisse");
    expect(sections.sectionConsistency).toContain("Écailles cuivrées");
    expect(sections.sectionConsistency).not.toContain("Corne gauche brisée");
    expect(prompt).toMatch(/Impératif : Écailles cuivrées/);
    expect(prompt).toMatch(/À éviter : .*Ailes.*Rendu 3D lisse/);
  });

  it("fonctionne sans fiche, sans guide ni référence", () => {
    const minimal = buildBrief({ ...base, subjectType: "MAP", character: null, guide: null, references: [] });
    expect(minimal.sections.sectionSubject).toBe("Non précisé.");
    expect(minimal.sections.sectionArtDirection).toBe("Aucun guide artistique sélectionné.");
    expect(minimal.sections.sectionReferences).toBe("Aucune référence visuelle jointe.");
    expect(minimal.prompt).toContain("Sujet : carte.");
  });

  it("exporte un texte complet avec les dix titres", () => {
    const text = briefToText("Portrait", sections);
    expect(text.match(/^## /gm)).toHaveLength(10);
  });
});

describe("ponctuation du prompt", () => {
  it("n'empile pas de point avant un point-virgule", () => {
    const { prompt } = buildBrief({
      ...base,
      character: { ...base.character!, fields: { species: "Elfe des brumes.", outfit: "Robe de lin." } },
      guide: { ...base.guide!, rules: [{ aspect: "LIGHTING", common: "Lumière chaude." }, { aspect: "AVOID", common: "Rendu 3D." }] },
    });
    expect(prompt).not.toMatch(/\. ;/);
    expect(prompt).toContain("espèce : Elfe des brumes ; tenue et matières : Robe de lin");
  });
});

describe("brief de carte de bataille", () => {
  const { sections, prompt } = buildBrief({
    subjectType: "MAP",
    objective: "Crypte sous le temple",
    imageType: "Carte de bataille vue de dessus",
    aspectRatio: "3:2 (paysage)",
    character: null,
    guide: null,
    references: [],
  });

  it("impose la vue de dessus, l'échelle des cases et l'absence de figurines et de quadrillage dessinés", () => {
    expect(sections.sectionComposition).toContain("Vue strictement de dessus");
    expect(sections.sectionComposition).toContain("1,5 m");
    expect(sections.sectionForbidden).toContain("figurines");
    expect(sections.sectionForbidden).toContain("quadrillage dessiné");
    expect(sections.sectionLighting).toContain("Éclairage uniforme");
    expect(prompt).toContain("Carte de bataille : Vue strictement de dessus");
    expect(prompt).toMatch(/À éviter : Personnages, créatures/);
  });

  it("n'ajoute rien de tout cela aux autres sujets", () => {
    expect(JSON.stringify(buildBrief(base))).not.toContain("Vue strictement de dessus");
  });
});
