import { describe, expect, it } from "vitest";
import { changedAspects, mergeGuideRules, rulesToMap, sameRules } from "../../src/lib/style/merge-rules";

describe("règles d'un guide et de ses variantes", () => {
  it("conserve toujours les règles communes dans une variante", () => {
    const common = { LIGHTING: "Lumière chaude", AVOID: "Rendu 3D" };
    const variant = { LIGHTING: "Contre-jour froid", PALETTE: "Désaturée" };
    expect(mergeGuideRules(common, variant)).toEqual([
      { aspect: "PALETTE", specific: "Désaturée" },
      { aspect: "LIGHTING", common: "Lumière chaude", specific: "Contre-jour froid" },
      { aspect: "AVOID", common: "Rendu 3D" },
    ]);
  });

  it("ignore les règles vides et compare les versions", () => {
    const map = rulesToMap([
      { aspect: "TEXTURES", content: "  Empâtements  " },
      { aspect: "LIGHTING", content: "   " },
    ]);
    expect(map).toEqual({ TEXTURES: "Empâtements" });
    expect(sameRules(map, { TEXTURES: "Empâtements" })).toBe(true);
    expect(changedAspects(map, { TEXTURES: "Glacis", LIGHTING: "Aube" })).toEqual(["LIGHTING", "TEXTURES"]);
  });
});
