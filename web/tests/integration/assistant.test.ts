import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "@bot/db";
import { draftOf } from "@bot/character/state";
import { nextStep, type Step } from "@bot/character/steps";
import { isSpellStep } from "@bot/character/wizard-view";
import { getGameGuildId } from "../../src/server/env";
import { resetQuotasForTests, setCompleterForTests } from "../../src/server/game/ai";
import { askAssistant } from "../../src/server/game/assistant";
import { setBotStoreForTests } from "../../src/server/game/bot-store";
import { applyWizardAction, beginCreation, getCurrentWizard } from "../../src/server/game/character-creation";
import type { GameActor } from "../../src/server/game/membership";

const dir = mkdtempSync(join(tmpdir(), "jdr-assistant-"));
afterAll(() => {
  setBotStoreForTests(undefined);
  setCompleterForTests(undefined);
  rmSync(dir, { recursive: true, force: true });
});

const player: GameActor = {
  userId: "site-user",
  isAdmin: false,
  discordId: "1001",
  displayName: "Joueuse",
  roleIds: ["r-joueurs"],
  inGuild: true,
};

type Call = { system: string; user: string };
let calls: Call[];
let store: Store;
let counter = 0;

beforeEach(() => {
  counter += 1;
  store = openStore(join(dir, `jdr-${counter}.sqlite`));
  setBotStoreForTests(store);
  store.createCampaign({ channelId: "camp-1", guildId: getGameGuildId(), name: "L'Étoile", mjRoleId: "r-mj" });
  store.setCampaignStructure("camp-1", { playerRoleId: "r-joueurs", sheetsChannelId: "fiches" });
  calls = [];
  resetQuotasForTests();
  setCompleterForTests(async (system, user) => {
    calls.push({ system, user });
    return "  Une proposition.  ";
  });
});

/** Avance avec des réponses valides (classe imposée) jusqu'à l'étape voulue. */
function advanceUntil(classId: string, stop: (step: Step) => boolean): Step {
  beginCreation(player, "camp-1", "Ysolde");
  for (let i = 0; i < 200; i++) {
    const step = nextStep(draftOf(getCurrentWizard(player)!));
    if (stop(step)) return step;
    if (step.kind === "done") throw new Error("Étape cherchée jamais atteinte.");
    if (step.kind === "roll") applyWizardAction(player, { type: "roll" });
    else if (step.kind === "story") applyWizardAction(player, { type: "story", story: {} });
    else if (step.kind === "table") applyWizardAction(player, { type: "answer", stepId: step.id, values: ["15", "14", "13", "12", "10", "8"] });
    else if (step.kind === "confirm") applyWizardAction(player, { type: "answer", stepId: step.id, values: ["ok"] });
    else if (step.kind === "name") applyWizardAction(player, { type: "answer", stepId: step.id, values: ["Ysolde"] });
    else if (step.id === "class") applyWizardAction(player, { type: "answer", stepId: step.id, values: [classId] });
    else {
      const values = step.kind === "select" ? [step.options[0]!.value] : step.options.slice(0, step.min).map((option) => option.value);
      applyWizardAction(player, { type: "answer", stepId: step.id, values });
    }
  }
  throw new Error("Étape cherchée jamais atteinte.");
}

describe("assistant de création sur le site", () => {
  it("propose des idées à l'étape de l'histoire, avec la classe et le style de la campagne", async () => {
    store.setStyle("camp-1", { tone: "Sombre et tendu" });
    advanceUntil("clerc", (step) => step.kind === "story");
    await expect(askAssistant(player, "ideas")).resolves.toBe("Une proposition.");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.user).toContain("Classe : Clerc");
    expect(calls[0]!.user).toContain("Sombre et tendu");
  });

  it("conseille des sorts uniquement parmi ceux de l'étape", async () => {
    const step = advanceUntil("magicien", (s) => (s.kind === "multi" || s.kind === "select") && isSpellStep(s.id));
    await askAssistant(player, "spells");
    const offered = step.kind === "multi" || step.kind === "select" ? step.options.map((option) => option.value) : [];
    expect(offered.length).toBeGreaterThan(0);
    for (const value of offered) expect(calls[0]!.user).toContain(`- ${value} :`);
  });

  it("refuse une aide qui ne correspond pas à l'étape en cours, sans appeler le modèle", async () => {
    advanceUntil("guerrier", (step) => step.id === "class");
    await expect(askAssistant(player, "ideas")).rejects.toThrow(/histoire du personnage/);
    await expect(askAssistant(player, "spells")).rejects.toThrow(/choix des sorts/);
    expect(calls).toHaveLength(0);
  });

  it("refuse sans création en cours", async () => {
    await expect(askAssistant({ ...player, discordId: "9999" }, "ideas")).rejects.toThrow(/Aucune création en cours/);
  });

  it("plafonne les demandes par joueur", async () => {
    advanceUntil("clerc", (step) => step.kind === "story");
    for (let i = 0; i < 3; i++) await askAssistant(player, "ideas");
    await expect(askAssistant(player, "ideas")).rejects.toThrow(/Réessaie dans \d+ minute/);
    expect(calls).toHaveLength(3);
  });

  it("donne un message simple si le modèle ne répond pas", async () => {
    setCompleterForTests(async () => {
      throw new Error("credit balance is too low");
    });
    advanceUntil("clerc", (step) => step.kind === "story");
    const failure = askAssistant(player, "ideas");
    await expect(failure).rejects.toThrow(/ne répond pas pour le moment/);
    await expect(failure).rejects.not.toThrow(/credit/);
  });
});
