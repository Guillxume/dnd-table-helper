import { describe, expect, it } from "vitest";
import { loadConfig, DEFAULT_MODEL } from "../src/config.js";
import { openStore } from "../src/db.js";
import { canManageCampaign } from "../src/permissions.js";
import { createCampaign, generateRecap, lastRecap, publishRecap } from "../src/service.js";
import { summarizeNotes } from "../src/summarize.js";
import { splitMessage } from "../src/text.js";

const admin = { isAdministrator: true, roleIds: [] };
const mj = { isAdministrator: false, roleIds: ["mj"] };
const player = { isAdministrator: false, roleIds: ["joueur"] };
const campaignInput = { channelId: "c1", guildId: "g1", name: "Test", mjRoleId: "mj" };
const fake = async () => "  Résumé généré  ";

describe("permissions", () => {
  it("autorise admin et MJ, refuse les joueurs", () => {
    expect(canManageCampaign(admin, { mjRoleId: "mj" })).toBe(true);
    expect(canManageCampaign(mj, { mjRoleId: "mj" })).toBe(true);
    expect(canManageCampaign(player, { mjRoleId: "mj" })).toBe(false);
  });
});

describe("splitMessage", () => {
  it("ne dépasse jamais la limite et conserve le contenu", () => {
    const text = Array.from({ length: 300 }, (_, i) => `mot${i}`).join(" ");
    const chunks = splitMessage(text, 100);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text);
  });
  it("renvoie un seul morceau pour un texte court", () => {
    expect(splitMessage("court", 100)).toEqual(["court"]);
  });
});

describe("config", () => {
  it("liste les variables manquantes sans valeurs", () => {
    expect(() => loadConfig({ DISCORD_TOKEN: "secret" })).toThrow(/DISCORD_CLIENT_ID/);
    expect(() => loadConfig({ DISCORD_TOKEN: "secret" })).not.toThrow(/secret/);
  });
  it("applique le modèle par défaut", () => {
    const c = loadConfig({ DISCORD_TOKEN: "a", DISCORD_CLIENT_ID: "b", DISCORD_GUILD_ID: "c", ANTHROPIC_API_KEY: "d" });
    expect(c.anthropicModel).toBe(DEFAULT_MODEL);
  });
});

describe("store et service", () => {
  it("réserve la création aux administrateurs et refuse les doublons", () => {
    const store = openStore(":memory:");
    expect(createCampaign(store, mj, campaignInput).ok).toBe(false);
    expect(createCampaign(store, admin, campaignInput).ok).toBe(true);
    expect(createCampaign(store, admin, campaignInput).ok).toBe(false);
    store.close();
  });

  it("génère, publie et numérote les rappels", async () => {
    const store = openStore(":memory:");
    createCampaign(store, admin, campaignInput);
    expect(lastRecap(store, "c1").ok).toBe(false);
    const r = await generateRecap(store, fake, mj, "c1", "notes");
    expect(r).toEqual({ ok: true, value: "Résumé généré" });
    const p1 = publishRecap(store, mj, "c1", "notes", "r1");
    const p2 = publishRecap(store, admin, "c1", "notes2", "r2");
    expect(p1.ok && p1.value.number).toBe(1);
    expect(p2.ok && p2.value.number).toBe(2);
    const last = lastRecap(store, "c1");
    expect(last.ok && last.value.recap).toBe("r2");
    store.close();
  });

  it("refuse un joueur, des notes vides, trop longues, ou un salon sans campagne", async () => {
    const store = openStore(":memory:");
    createCampaign(store, admin, campaignInput);
    expect((await generateRecap(store, fake, player, "c1", "x")).ok).toBe(false);
    expect((await generateRecap(store, fake, mj, "c1", "   ")).ok).toBe(false);
    expect((await generateRecap(store, fake, mj, "c1", "a".repeat(4001))).ok).toBe(false);
    expect((await generateRecap(store, fake, mj, "autre", "x")).ok).toBe(false);
    expect(publishRecap(store, player, "c1", "n", "r").ok).toBe(false);
    store.close();
  });

  it("transforme une erreur du modèle en échec propre", async () => {
    const store = openStore(":memory:");
    createCampaign(store, admin, campaignInput);
    const boom = async (): Promise<string> => {
      throw new Error("réseau");
    };
    const r = await generateRecap(store, boom, mj, "c1", "x");
    expect(r.ok).toBe(false);
    store.close();
  });
});

describe("summarizeNotes", () => {
  it("transmet les notes au modèle", async () => {
    let seen = "";
    await summarizeNotes(async (_s, u) => ((seen = u), "ok"), "  les héros entrent dans la crypte  ");
    expect(seen).toContain("les héros entrent dans la crypte");
  });
  it("refuse des notes vides ou une réponse vide", async () => {
    await expect(summarizeNotes(fake, " ")).rejects.toThrow();
    await expect(summarizeNotes(async () => "  ", "x")).rejects.toThrow();
  });
});

describe("formulaire /seance", () => {
  it("construit le formulaire de notes sans erreur de validation", async () => {
    const { commandDefinitions, buildNotesModal } = await import("../src/commands.js");
    expect(commandDefinitions.length).toBeGreaterThan(0);
    expect(() => buildNotesModal().toJSON()).not.toThrow();
  });
});
