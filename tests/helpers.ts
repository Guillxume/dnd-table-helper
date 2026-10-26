import type { Draft } from "../src/character/draft.js";
import { applyAnswer, nextStep } from "../src/character/steps.js";

export const FIXED_ROLLS = [15, 14, 13, 12, 10, 8];

/** Parcourt le formulaire en prenant les premières options valides, sauf réponses imposées. */
export function autoplay(start: Draft = {}, answers: Record<string, string[]> = {}): Draft {
  let d: Draft = { name: "Test", ...start };
  for (let i = 0; i < 200; i++) {
    const step = nextStep(d);
    if (step.kind === "done") return d;
    if (step.kind === "name") {
      d = { ...d, name: "Test" };
      continue;
    }
    if (step.kind === "roll") {
      d = { ...d, rolls: [...FIXED_ROLLS], rollDice: FIXED_ROLLS.map((v) => [v]) };
      continue;
    }
    if (step.kind === "story") {
      d = { ...d, storyDone: true };
      continue;
    }
    if (step.kind === "table") {
      const res = applyAnswer(d, step.id, answers[step.id] ?? FIXED_ROLLS.map(String));
      if (!res.ok) throw new Error(res.error);
      d = res.draft;
      continue;
    }
    if (step.kind === "confirm") {
      const res = applyAnswer(d, step.id, ["ok"]);
      if (!res.ok) throw new Error(res.error);
      d = res.draft;
      continue;
    }
    const forced = answers[step.id];
    const values =
      forced ?? (step.kind === "select" ? [step.options[0]!.value] : step.options.slice(0, step.min).map((o) => o.value));
    const res = applyAnswer(d, step.id, values);
    if (!res.ok) throw new Error(`Étape ${step.id} : ${res.error} (${JSON.stringify(values)})`);
    d = res.draft;
  }
  throw new Error("Le parcours ne se termine pas.");
}
