import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "@bot/db";
import { getDb } from "../../src/server/db";
import { getGameGuildId } from "../../src/server/env";
import { resetQuotasForTests, setCompleterForTests } from "../../src/server/game/ai";
import { setBotStoreForTests } from "../../src/server/game/bot-store";
import {
  campaignExportPdf,
  cancelSession,
  draftRecap,
  getCampaignOverview,
  getProgress,
  getRecapDraft,
  groupSheetPdf,
  listCampaignSummaries,
  prepare,
  publishRecap,
  removeCarnetEntry,
  savePlayerNote,
  scheduleSession,
  setCreationDeadline,
  updateCreationRules,
  updateStyle,
} from "../../src/server/game/campaigns";
import type { GameActor } from "../../src/server/game/membership";
import { resetTestState } from "../support/fixtures";
import { draftOf } from "@bot/character/state";
import { nextStep } from "@bot/character/steps";
import { applyWizardAction, beginCreation, finishCreation, getCurrentWizard } from "../../src/server/game/character-creation";

const dir = mkdtempSync(join(tmpdir(), "jdr-campaigns-"));
afterAll(() => {
  setBotStoreForTests(undefined);
  setCompleterForTests(undefined);
  rmSync(dir, { recursive: true, force: true });
});

const base: GameActor = { userId: "u-player", isAdmin: false, discordId: "1001", displayName: "Joueuse", roleIds: ["r-joueurs"], inGuild: true };
const player = base;
const mj: GameActor = { ...base, userId: "u-mj", discordId: "3003", displayName: "MJ", roleIds: ["r-mj"] };
const outsider: GameActor = { ...base, userId: "u-out", discordId: "2002", roleIds: [] };

let store: Store;
let counter = 0;
let prompts: { system: string; user: string }[];

/** Date future au format attendu par le formulaire (JJ/MM/AAAA). */
function futureDate(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

beforeEach(async () => {
  counter += 1;
  store = openStore(join(dir, `jdr-${counter}.sqlite`));
  setBotStoreForTests(store);
  store.createCampaign({ channelId: "camp-1", guildId: getGameGuildId(), name: "L'Étoile", mjRoleId: "r-mj" });
  store.setCampaignStructure("camp-1", { playerRoleId: "r-joueurs", sheetsChannelId: "fiches" });
  prompts = [];
  resetQuotasForTests();
  setCompleterForTests(async (system, user) => {
    prompts.push({ system, user });
    if (system.includes("carnet")) return JSON.stringify({ pnj: [{ nom: "Baron Vex", detail: "Hôte du bal" }], lieux: [], objets: [], fils: [] });
    return "Les héros ont exploré le manoir du baron.";
  });
});

describe("espace de campagne", () => {
  it("montre la campagne à ses membres seulement, avec le rôle de chacun", () => {
    expect(listCampaignSummaries(player)).toEqual([expect.objectContaining({ id: "camp-1", mj: false })]);
    expect(listCampaignSummaries(mj)).toEqual([expect.objectContaining({ id: "camp-1", mj: true })]);
    expect(listCampaignSummaries(outsider)).toEqual([]);
    expect(() => getCampaignOverview(outsider, "camp-1")).toThrow(/réservée à ses joueurs/);
    expect(getCampaignOverview(player, "camp-1").mj).toBe(false);
  });

  it("le MJ fixe la séance, l'annonce part par le bot ; un joueur ne peut pas la fixer", () => {
    const input = { date: futureDate(5), time: "20:30", note: "Chez Paul", announce: true };
    expect(() => scheduleSession(player, "camp-1", input)).toThrow(/Seul le MJ/);
    const label = scheduleSession(mj, "camp-1", input);
    expect(label).toMatch(/à 20:30$/);
    expect(getCampaignOverview(player, "camp-1").nextSession).toEqual(expect.objectContaining({ note: "Chez Paul", label }));
    expect(store.pendingDiscordPosts()).toEqual([
      expect.objectContaining({ kind: "session", mentionPlayers: true, content: expect.stringContaining("Note du MJ : Chez Paul") }),
    ]);

    scheduleSession(mj, "camp-1", { ...input, announce: false });
    expect(store.pendingDiscordPosts()).toHaveLength(1);
    expect(() => scheduleSession(mj, "camp-1", { ...input, date: "01/01/2020" })).toThrow(/passée/);
    cancelSession(mj, "camp-1");
    expect(getCampaignOverview(mj, "camp-1").nextSession).toBeNull();
  });

  it("règles de création, échéance et guide de style", () => {
    expect(() => updateCreationRules(mj, "camp-1", { methods: [], content: "srd" })).toThrow(/Au moins une méthode/);
    updateCreationRules(mj, "camp-1", { methods: ["des", "inconnue"], content: "srd" });
    expect(getCampaignOverview(player, "camp-1").rules).toEqual({ level: 1, methods: ["des"], content: "srd" });

    expect(setCreationDeadline(mj, "camp-1", { date: futureDate(10), time: "" })).toMatch(/à 20:00$/);
    expect(getCampaignOverview(player, "camp-1").deadline).not.toBeNull();
    setCreationDeadline(mj, "camp-1", null);
    expect(getCampaignOverview(player, "camp-1").deadline).toBeNull();

    expect(() => updateStyle(player, "camp-1", { tone: "x" })).toThrow(/Seul le MJ/);
    updateStyle(mj, "camp-1", { tone: "  Sombre  ", inconnu: "ignoré", names: "" });
    expect(store.getCampaign("camp-1")!.style).toEqual({ tone: "Sombre" });
  });

  it("note d'un joueur, brouillon de rappel, publication sur Discord et carnet", async () => {
    savePlayerNote(player, "camp-1", "On a trouvé une lettre scellée.");
    expect(getCampaignOverview(player, "camp-1").myPendingNote).toBe("On a trouvé une lettre scellée.");

    const draftId = await draftRecap(mj, "camp-1", "Bal masqué chez le baron Vex.");
    // La note du joueur est transmise au modèle avec son auteur.
    expect(prompts[0]!.user).toContain("On a trouvé une lettre scellée.");
    expect(getRecapDraft(mj, "camp-1", draftId)).toEqual(expect.objectContaining({ recap: "Les héros ont exploré le manoir du baron." }));
    expect(() => getRecapDraft(player, "camp-1", draftId)).toThrow(/Seul le MJ/);

    const result = await publishRecap(mj, "camp-1", draftId, "Texte relu par le MJ : bal masqué chez le baron Vex.");
    expect(result.number).toBe(1);
    expect(result.carnet).not.toBeNull();
    const overview = getCampaignOverview(player, "camp-1");
    expect(overview.sessions[0]).toEqual(expect.objectContaining({ number: 1, recap: "Texte relu par le MJ : bal masqué chez le baron Vex." }));
    expect(overview.myPendingNote).toBeNull();
    expect(overview.carnet).toEqual([expect.objectContaining({ kind: "pnj", name: "Baron Vex" })]);
    expect(store.pendingDiscordPosts()).toEqual([expect.objectContaining({ kind: "recap", mentionPlayers: false })]);
    await expect(publishRecap(mj, "camp-1", draftId, "Encore une fois ce texte publié.")).rejects.toThrow(/n'existe plus/);

    removeCarnetEntry(mj, "camp-1", "pnj", "baron vex");
    expect(getCampaignOverview(mj, "camp-1").carnet).toEqual([]);
  });

  it("le rappel est publié même si la mise à jour du carnet échoue", async () => {
    const draftId = await draftRecap(mj, "camp-1", "Notes.");
    setCompleterForTests(async () => {
      throw new Error("credit balance is too low");
    });
    const result = await publishRecap(mj, "camp-1", draftId, "Un rappel suffisamment long pour être publié.");
    expect(result).toEqual({ number: 1, carnet: null });
  });

  it("préparation d'une rencontre : budget calculé par le bot, brouillon de l'assistant", async () => {
    const text = await prepare(mj, "camp-1", "rencontre", { brief: "Embuscade de gobelins", creatures: "4 gobelins", party: "4 personnages, niveau 1" });
    expect(text).toContain("Les héros ont exploré");
    await expect(prepare(mj, "camp-1", "inconnu", { brief: "x" })).rejects.toThrow(/inconnu/);
    await expect(prepare(player, "camp-1", "scene", { brief: "x" })).rejects.toThrow(/Seul le MJ/);
  });

  it("suivi de la création avec les pseudos connus du site", async () => {
    await resetTestState();
    const user = await getDb().user.create({ data: { id: "u-player", name: "Compte", email: "joueuse@example.test" } });
    await getDb().discordMember.create({
      data: { userId: user.id, discordId: "1001", guildId: getGameGuildId(), roleIds: ["r-joueurs"], displayName: "Joueuse", inGuild: true, fetchedAt: new Date() },
    });
    store.addPlayer("camp-1", "1001");
    store.addPlayer("camp-1", "9999");
    const progress = await getProgress(mj, "camp-1");
    expect(progress.notStarted).toEqual(["Joueuse", expect.stringContaining("…9999")]);
  });

  it("fiche de groupe et chronique en PDF, réservées au MJ", async () => {
    // Un personnage terminé par la joueuse, pour que les deux documents aient du contenu.
    beginCreation(player, "camp-1", "Ysolde");
    for (let i = 0; i < 200; i++) {
      const step = nextStep(draftOf(getCurrentWizard(player)!));
      if (step.kind === "done") break;
      if (step.kind === "roll") applyWizardAction(player, { type: "roll" });
      else if (step.kind === "story") applyWizardAction(player, { type: "story", story: {} });
      else if (step.kind === "table") applyWizardAction(player, { type: "answer", stepId: step.id, values: ["15", "14", "13", "12", "10", "8"] });
      else if (step.kind === "confirm") applyWizardAction(player, { type: "answer", stepId: step.id, values: ["ok"] });
      else if (step.kind === "name") applyWizardAction(player, { type: "answer", stepId: step.id, values: ["Ysolde"] });
      else applyWizardAction(player, { type: "answer", stepId: step.id, values: step.kind === "select" ? [step.options[0]!.value] : step.options.slice(0, step.min).map((o) => o.value) });
    }
    finishCreation(player);
    store.addSession("camp-1", "notes", "Les héros arrivent à Valbourg.");

    const group = await groupSheetPdf(mj, "camp-1");
    expect(group.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    const chronicle = await campaignExportPdf(mj, "camp-1", false);
    expect(chronicle.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    await expect(groupSheetPdf(player, "camp-1")).rejects.toThrow(/Seul le MJ/);
  });
});
