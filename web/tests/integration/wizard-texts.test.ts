import { describe, expect, it } from "vitest";
import type { Draft } from "@bot/character/draft";
import { applyAnswer, nextStep } from "@bot/character/steps";
import { CLASSES } from "@bot/srd/index";
import { helpFor } from "@bot/character/wizard-view";

/** Textes d'aide rencontrés en parcourant toute la création avec les premiers choix possibles. */
function helpTexts(classId: string): string[] {
  // Texte tel qu'affiché par le site : aide du moteur et renvois propres au site.
  let draft: Draft = { name: "Test", rules: { level: 1, methods: ["standard", "points", "des", "table"], content: "manuel" } };
  const texts: string[] = [];
  for (let i = 0; i < 200; i++) {
    const step = nextStep(draft);
    if (step.kind === "done") return texts;
    if ("help" in step && step.help) texts.push(helpFor(step.id, step.help, "web"));
    if (step.kind === "name") {
      draft = { ...draft, name: "Test" };
      continue;
    }
    if (step.kind === "roll" || step.kind === "story") {
      draft = step.kind === "roll" ? { ...draft, rolls: [15, 14, 13, 12, 10, 8], rollDice: [[15], [14], [13], [12], [10], [8]] } : { ...draft, storyDone: true };
      continue;
    }
    const values =
      step.kind === "table"
        ? ["15", "14", "13", "12", "10", "8"]
        : step.kind === "confirm"
          ? ["ok"]
          : step.id === "class"
            ? [classId]
            : step.kind === "select"
              ? [step.options[0]!.value]
              : step.options.slice(0, step.min).map((option) => option.value);
    const result = applyAnswer(draft, step.id, values);
    if (!result.ok) throw new Error(`${classId}, étape ${step.id} : ${result.error}`);
    draft = result.draft;
  }
  throw new Error("Parcours sans fin");
}

describe("textes d'aide affichés sur le site", () => {
  it.each(CLASSES.map((cls) => cls.id))("ne renvoient pas aux boutons ou commandes de gestion Discord (%s)", (classId) => {
    for (const text of helpTexts(classId)) {
      expect(text).not.toMatch(/Détails des options|Conseil de l’assistant/);
      // Aucune commande Discord dans l'aide du site ; seule /objet est assumée
      // (le texte dit explicitement de la taper sur le serveur Discord).
      const commands = text.match(/(?<![\w/])\/[a-z][a-z-]+/g) ?? [];
      expect(commands.filter((command) => command !== "/objet")).toEqual([]);
    }
  });
});
