import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "@bot/db";
import { draftOf, newState } from "@bot/character/state";
import { nextStep } from "@bot/character/steps";
import { getGameGuildId } from "../../src/server/env";
import {
  applyWizardAction,
  beginCreation,
  characterSheetPdf,
  finishCreation,
  getCurrentWizard,
  getVisibleCharacter,
  listVisibleCharacters,
  publicationStatus,
  requestPublication,
} from "../../src/server/game/character-creation";
import { setBotStoreForTests } from "../../src/server/game/bot-store";
import type { GameActor } from "../../src/server/game/membership";
import { buildWizardView } from "../../src/server/game/wizard-view";

const dir = mkdtempSync(join(tmpdir(), "jdr-web-"));
afterAll(() => {
  setBotStoreForTests(undefined);
  rmSync(dir, { recursive: true, force: true });
});

const actor = (overrides: Partial<GameActor>): GameActor => ({
  userId: "site-user",
  isAdmin: false,
  discordId: "1001",
  displayName: "Joueuse",
  roleIds: ["r-joueurs"],
  inGuild: true,
  ...overrides,
});

const player = actor({});
const outsider = actor({ discordId: "2002", roleIds: [] });
const mj = actor({ discordId: "3003", roleIds: ["r-mj"] });

let store: Store;
let counter = 0;

beforeEach(() => {
  counter += 1;
  store = openStore(join(dir, `jdr-${counter}.sqlite`));
  setBotStoreForTests(store);
  const guildId = getGameGuildId();
  store.createCampaign({ channelId: "camp-1", guildId, name: "L'Étoile", mjRoleId: "r-mj" });
  store.setCampaignStructure("camp-1", { playerRoleId: "r-joueurs", sheetsChannelId: "fiches" });
});

/** Répond à chaque étape avec les premières options valides, comme le ferait un joueur pressé. */
function playThrough(who: GameActor) {
  for (let i = 0; i < 200; i++) {
    const state = getCurrentWizard(who)!;
    const step = nextStep(draftOf(state));
    if (step.kind === "done") return;
    if (step.kind === "roll") applyWizardAction(who, { type: "roll" });
    else if (step.kind === "story") applyWizardAction(who, { type: "story", story: { appearance: "Écailles cuivrées" } });
    else if (step.kind === "table") applyWizardAction(who, { type: "answer", stepId: step.id, values: ["15", "14", "13", "12", "10", "8"] });
    else if (step.kind === "confirm") applyWizardAction(who, { type: "answer", stepId: step.id, values: ["ok"] });
    else if (step.kind === "name") applyWizardAction(who, { type: "answer", stepId: step.id, values: ["Rek'tal"] });
    else {
      const values = step.kind === "select" ? [step.options[0]!.value] : step.options.slice(0, step.min).map((option) => option.value);
      applyWizardAction(who, { type: "answer", stepId: step.id, values });
    }
  }
  throw new Error("La création ne se termine pas.");
}

describe("création de personnage sur le site", () => {
  it("refuse une campagne dont on n'est pas joueur", () => {
    expect(() => beginCreation(outsider, "camp-1", "Intrus")).toThrow(/réservée à ses joueurs/);
  });

  it("mène une création jusqu'au bout et l'enregistre dans la base du bot", async () => {
    beginCreation(player, "camp-1", "Rek'tal");
    const view = buildWizardView(getCurrentWizard(player)!);
    expect(view.campaignName).toBe("L'Étoile");
    expect(view.step.kind).not.toBe("done");

    playThrough(player);
    expect(buildWizardView(getCurrentWizard(player)!).step).toMatchObject({ kind: "done", errors: [] });

    const saved = finishCreation(player);
    expect(getCurrentWizard(player)).toBeUndefined();

    // Le bot relit la fiche telle quelle.
    const fromBot = store.getCharacter(saved.id);
    expect(fromBot).toMatchObject({ userId: "1001", campaignId: "camp-1", name: "Rek'tal" });
    expect(fromBot?.draft.story?.appearance).toBe("Écailles cuivrées");

    expect(listVisibleCharacters(player).map((c) => c.id)).toEqual([saved.id]);
    expect(listVisibleCharacters(mj).map((c) => c.id)).toEqual([saved.id]);
    expect(listVisibleCharacters(outsider)).toEqual([]);
    expect(() => getVisibleCharacter(outsider, saved.id)).toThrow(/introuvable/);

    const pdf = await characterSheetPdf(player, saved.id);
    expect(pdf.buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("demande au bot de publier la fiche, sans jeton Discord côté site", () => {
    beginCreation(player, "camp-1", "Rek'tal");
    playThrough(player);
    const saved = finishCreation(player);

    expect(publicationStatus(player, saved.id)).toEqual({ state: "none" });
    requestPublication(player, saved.id);
    requestPublication(player, saved.id);
    // Une seule demande en attente, que le bot traitera.
    expect(store.pendingPublications()).toEqual([expect.objectContaining({ characterId: saved.id, requestedBy: "1001" })]);
    expect(publicationStatus(player, saved.id)).toMatchObject({ state: "pending" });

    store.markPublished(store.pendingPublications()[0]!.id);
    expect(publicationStatus(player, saved.id)).toMatchObject({ state: "published" });

    expect(() => requestPublication(outsider, saved.id)).toThrow(/introuvable/);
  });

  it("refuse la publication quand la campagne n'a pas de salon des fiches", () => {
    store.createCampaign({ channelId: "camp-2", guildId: getGameGuildId(), name: "Sans salon", mjRoleId: "r-mj" });
    const character = store.addCharacter(getGameGuildId(), "1001", "camp-2", "Elamaer", {});
    expect(() => requestPublication(player, character.id)).toThrow(/salon des fiches/);
  });

  it("reprend sur le site une création commencée sur Discord", () => {
    const state = { ...newState("Elamaer"), campaignId: "camp-1", campaignName: "L'Étoile" };
    store.saveWizard(getGameGuildId(), "1001", state);

    expect(getCurrentWizard(player)?.name).toBe("Elamaer");
    const step = nextStep(draftOf(getCurrentWizard(player)!));
    if (step.kind !== "select" && step.kind !== "multi") throw new Error("étape à choix attendue");
    applyWizardAction(player, { type: "answer", stepId: step.id, values: [step.options[0]!.value] });
    expect(store.getWizard(getGameGuildId(), "1001")?.history).toHaveLength(1);
  });

  it("refuse une réponse à une étape qui n'est plus la courante", () => {
    beginCreation(player, "camp-1", "Rek'tal");
    expect(() => applyWizardAction(player, { type: "answer", stepId: "étape-périmée", values: ["x"] })).toThrow(/plus d'actualité/);
  });

  it("refuse l'enregistrement d'une création inachevée et la création sans compte Discord", () => {
    beginCreation(player, "camp-1", "Rek'tal");
    expect(() => finishCreation(player)).toThrow(/pas terminée/);
    expect(() => beginCreation(actor({ discordId: null }), "camp-1", "X")).toThrow(/Discord/);
  });
});
