import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { openStore } from "@bot/db";
import { getGameGuildId } from "../../src/server/env";
import { setBotStoreForTests } from "../../src/server/game/bot-store";
import { applyWizardAction, beginCreation, getCurrentWizard } from "../../src/server/game/character-creation";
import type { GameActor } from "../../src/server/game/membership";
import { buildWizardView, type WizardView } from "../../src/server/game/wizard-view";

const dir = mkdtempSync(join(tmpdir(), "jdr-icons-"));
afterAll(() => {
  setBotStoreForTests(undefined);
  rmSync(dir, { recursive: true, force: true });
});

const player: GameActor = { userId: "u", isAdmin: false, discordId: "1001", displayName: "J", roleIds: ["r-joueurs"], inGuild: true };
let counter = 0;

beforeEach(() => {
  counter += 1;
  const store = openStore(join(dir, `jdr-${counter}.sqlite`));
  setBotStoreForTests(store);
  store.createCampaign({ channelId: "camp-1", guildId: getGameGuildId(), name: "L'Étoile", mjRoleId: "r-mj" });
  store.setCampaignStructure("camp-1", { playerRoleId: "r-joueurs", sheetsChannelId: "fiches" });
});

/** Parcourt la création d'un magicien en relevant chaque écran de choix. */
function choiceViews(): Extract<WizardView["step"], { kind: "select" | "multi" }>[] {
  beginCreation(player, "camp-1", "Ysolde");
  const seen: Extract<WizardView["step"], { kind: "select" | "multi" }>[] = [];
  for (let i = 0; i < 200; i++) {
    const step = buildWizardView(getCurrentWizard(player)!).step;
    if (step.kind === "done") return seen;
    if (step.kind === "roll") applyWizardAction(player, { type: "roll" });
    else if (step.kind === "story") applyWizardAction(player, { type: "story", story: {} });
    else if (step.kind === "table") applyWizardAction(player, { type: "answer", stepId: step.id, values: ["15", "14", "13", "12", "10", "8"] });
    else if (step.kind === "confirm") applyWizardAction(player, { type: "answer", stepId: step.id, values: ["ok"] });
    else if (step.kind === "name") applyWizardAction(player, { type: "answer", stepId: step.id, values: ["Ysolde"] });
    else {
      seen.push(step);
      const values = step.id === "class" ? ["magicien"] : step.id === "assignMode" ? ["manual"] : step.kind === "select" ? [step.options[0]!.value] : step.options.slice(0, step.min).map((o) => o.value);
      applyWizardAction(player, { type: "answer", stepId: step.id, values });
    }
  }
  throw new Error("La création ne se termine pas.");
}

describe("icônes de l'assistant de création", () => {
  it("illustre les classes, les espèces, les sorts proposés et les caractéristiques", () => {
    const views = choiceViews();
    const byId = (id: string) => views.find((view) => view.id === id);
    expect(byId("class")!.options.every((option) => option.icon?.startsWith("classe-"))).toBe(true);
    expect(byId("species")!.options.every((option) => option.icon?.startsWith("espece-"))).toBe(true);
    const spellSteps = views.filter((view) => view.isSpell);
    expect(spellSteps.length).toBeGreaterThan(0);
    for (const view of spellSteps) {
      for (const option of view.options) expect(option.icon, `${view.id} : ${option.value}`).toMatch(/^ecole-/);
    }
    const abilitySteps = views.filter((view) => /^(assign|pb)\./.test(view.id));
    expect(abilitySteps.length).toBe(6);
    for (const view of abilitySteps) expect(view.icon).toMatch(/^carac-/);
  });
});
