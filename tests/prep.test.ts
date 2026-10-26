import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPrepModal, commandDefinitions } from "../src/commands.js";
import { openStore } from "../src/db.js";
import { PREP_FIELDS, PREP_FORMS, PREP_TYPES, buildPrepPrompt, isPrepType } from "../src/prep.js";
import { createCampaign, generatePrep, partyFromText, publishRecap } from "../src/service.js";

const admin = { isAdministrator: true, roleIds: [] };
const mj = { isAdministrator: false, roleIds: ["mj"] };
const player = { isAdministrator: false, roleIds: ["joueur"] };
const input = { channelId: "recap", guildId: "g", name: "Test", mjRoleId: "mj" };

function seeded() {
  const store = openStore(":memory:");
  createCampaign(store, admin, input);
  store.setPrepChannel("recap", "aide");
  return store;
}

describe("formulaire et commande /preparer", () => {
  it("respecte les limites Discord", () => {
    const titles = new Set<string>();
    for (const [type, form] of Object.entries(PREP_FORMS)) {
      expect(form.fields.length).toBeLessThanOrEqual(5);
      expect(form.fields[0]?.id).toBe("brief");
      for (const f of form.fields) {
        expect(f.label.length).toBeLessThanOrEqual(45);
        expect(f.placeholder.length).toBeLessThanOrEqual(100);
      }
      titles.add(form.title);
      const json = buildPrepModal(type as keyof typeof PREP_TYPES, "c", { party: "5 personnages, niveau 1" }).toJSON();
      expect(json.title).toBe(form.title);
    }
    // Un formulaire différent par type (scène, PNJ, rencontre).
    expect(titles.size).toBe(Object.keys(PREP_TYPES).length);
    expect(new Set(Object.values(PREP_FORMS).map((f) => f.fields.map((x) => x.id).join())).size).toBe(Object.keys(PREP_TYPES).length);
    expect(PREP_FIELDS.length).toBeGreaterThan(5);
    expect(() => commandDefinitions.map((c) => c.toJSON())).not.toThrow();
    expect(commandDefinitions.map((c) => c.name)).toContain("preparer");
  });
  it("reconnaît uniquement les types valides", () => {
    expect(isPrepType("scene")).toBe(true);
    expect(isPrepType("toString")).toBe(false);
  });
});

describe("prompt", () => {
  it("place les rappels du plus ancien au plus récent et omet les champs vides", () => {
    const p = buildPrepPrompt("pnj", { brief: "Un forgeron", party: " ", tone: "sombre" }, [
      { number: 1, recap: "R1" },
      { number: 2, recap: "R2" },
    ]);
    expect(p.indexOf("R1")).toBeLessThan(p.indexOf("R2"));
    expect(p).toContain("Idée du MJ :\nUn forgeron");
    expect(p).toContain("Ton et contraintes :\nsombre");
    expect(p).not.toContain("Groupe :");
    expect(p).toContain("un ou plusieurs PNJ");
  });
  it("signale l'absence de rappel", () => {
    expect(buildPrepPrompt("scene", { brief: "x" }, [])).toContain("Aucun rappel");
  });
});

describe("base de données", () => {
  it("retrouve la campagne depuis le salon d'aide, renvoie les 3 derniers rappels dans l'ordre", () => {
    const store = seeded();
    for (let n = 1; n <= 5; n++) store.addSession("recap", `n${n}`, `r${n}`);
    expect(store.findCampaignForChannel("aide")?.channelId).toBe("recap");
    expect(store.findCampaignForChannel("recap")?.prepChannelId).toBe("aide");
    expect(store.findCampaignForChannel("autre")).toBeUndefined();
    expect(store.recentSessions("recap", 3).map((s) => s.recap)).toEqual(["r3", "r4", "r5"]);
    store.close();
  });
  it("migre une ancienne base sans la colonne prep_channel_id", () => {
    const path = join(mkdtempSync(join(tmpdir(), "jdr-")), "old.sqlite");
    const old = new Database(path);
    old.exec(`CREATE TABLE campaigns (channel_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, name TEXT NOT NULL, mj_role_id TEXT NOT NULL, created_at TEXT NOT NULL);
      INSERT INTO campaigns VALUES ('recap','g','Ancienne','mj','2026-10-15T00:00:00Z');`);
    old.close();
    const store = openStore(path);
    expect(store.getCampaign("recap")?.prepChannelId).toBeNull();
    store.setPrepChannel("recap", "aide");
    expect(store.findCampaignForChannel("aide")?.name).toBe("Ancienne");
    store.close();
  });
});

describe("generatePrep", () => {
  it("envoie le canevas et les rappels au modèle avec la limite de tokens prévue", async () => {
    const store = seeded();
    publishRecap(store, mj, "recap", "n", "Les héros ont trouvé la clé");
    let seen = { user: "", max: 0 };
    const complete = async (_s: string, u: string, m?: number) => ((seen = { user: u, max: m ?? 0 }), "  Brouillon  ");
    const r = await generatePrep(store, complete, mj, "aide", "scene", { brief: "Le bal du baron" });
    expect(r.ok && r.value.startsWith("Brouillon")).toBe(true);
    expect(seen.user).toContain("Les héros ont trouvé la clé");
    expect(seen.user).toContain("Le bal du baron");
    expect(seen.max).toBe(3500);
    store.close();
  });
  it("refuse un joueur, un salon inconnu, une idée vide", async () => {
    const store = seeded();
    const ok = async () => "x";
    expect((await generatePrep(store, ok, player, "aide", "scene", { brief: "a" })).ok).toBe(false);
    expect((await generatePrep(store, ok, mj, "inconnu", "scene", { brief: "a" })).ok).toBe(false);
    expect((await generatePrep(store, ok, mj, "aide", "scene", { brief: "  " })).ok).toBe(false);
    store.close();
  });
  it("transforme une erreur du modèle en échec propre", async () => {
    const store = seeded();
    const boom = async (): Promise<string> => {
      throw new Error("réseau");
    };
    expect((await generatePrep(store, boom, mj, "aide", "pnj", { brief: "a" })).ok).toBe(false);
    store.close();
  });
});

describe("réponse coupée par la limite de tokens", () => {
  it("signale explicitement une troncature, et jamais sinon", async () => {
    const { textFromResponse, TRUNCATION_NOTICE } = await import("../src/summarize.js");
    const cut = textFromResponse({ content: [{ type: "text", text: "Début " }], stop_reason: "max_tokens" });
    expect(cut).toBe("Début" + TRUNCATION_NOTICE);
    expect(textFromResponse({ content: [{ type: "text", text: "Fini" }], stop_reason: "end_turn" })).toBe("Fini");
    expect(textFromResponse({ content: [], stop_reason: "max_tokens" })).toBe("");
  });
});

describe("réponse vide du modèle", () => {
  it("réessaie une fois avec une limite doublée, puis explique la raison", async () => {
    const { completeWithRetry } = await import("../src/summarize.js");
    const calls: number[] = [];
    const flaky = async (_s: string, _u: string, max: number) => {
      calls.push(max);
      return calls.length === 1 ? { content: [], stop_reason: "end_turn" } : { content: [{ type: "text", text: "Idées" }], stop_reason: "end_turn" };
    };
    expect(await completeWithRetry(flaky, "s", "u", 700)).toBe("Idées");
    expect(calls).toEqual([700, 1400]);
    const empty = async () => ({ content: [], stop_reason: "refusal" });
    await expect(completeWithRetry(empty, "s", "u", 700)).rejects.toThrow(/refusal/);
  });
});

describe("recherche dans le SRD et guide de style", () => {
  it("trouve les blocs de statistiques des créatures demandées", async () => {
    const { searchSrd } = await import("../src/srd/search.js");
    const titles = searchSrd("une crypte pleine de squelettes et un zombi").map((c) => c.title);
    expect(titles).toContain("Squelette");
    expect(titles.some((t) => t.startsWith("Zombi"))).toBe(true);
    const sq = searchSrd("squelette").find((c) => c.title === "Squelette")!;
    expect(sq.kind).toBe("créature");
    expect(sq.text).toContain("CA 14");
    expect(sq.text).toContain("Pv 13 (2d8 + 4)");
    expect(searchSrd("")).toEqual([]);
  });
  it("chaque extrait du SRD reprend le texte du PDF", async () => {
    const chunks = (await import("../src/srd/data/srd-chunks.json", { with: { type: "json" } })).default as { title: string; text: string; page: number }[];
    expect(chunks.length).toBeGreaterThan(500);
    for (const c of chunks) {
      expect(c.page).toBeGreaterThan(0);
      expect(c.text).not.toContain("Document de Référence");
    }
  });
  it("transmet extraits du SRD et guide de style à /preparer, et liste les sources", async () => {
    const store = seeded();
    store.setStyle("recap", { tone: "sombre, phrases courtes", names: "Phandaline" });
    let seen = "";
    const complete = async (_s: string, u: string) => ((seen = u), "Brouillon");
    const r = await generatePrep(store, complete, mj, "aide", "rencontre", { brief: "Embuscade dans une crypte", srd: "squelettes" });
    expect(seen).toContain("[SRD p. 351 · Squelette (créature)]");
    expect(seen).toContain("Ton : sombre, phrases courtes");
    expect(r.ok && r.value).toContain("Squelette (p. 351)");
  });
  it("rencontre : le bot calcule le budget des créatures indiquées et le donne au modèle comme un fait", async () => {
    const store = seeded();
    let seen = "";
    const complete = async (_s: string, u: string) => ((seen = u), "Brouillon");
    const r = await generatePrep(store, complete, mj, "aide", "rencontre", {
      brief: "Embuscade sur la route",
      creatures: "4 combattants gobelins, 1 chef gobelin",
      difficulty: "élevée",
      party: "5 personnages, niveau 1",
    });
    expect(seen).toContain("Budget de la rencontre calculé par le bot");
    expect(seen).toContain("Rencontre de difficulté élevée** pour 5 personnage(s) de niveau 1 : budget de **500 PX**");
    expect(r.ok && r.value).toMatch(/^\*\*Rencontre de difficulté élevée/);
    expect(r.ok && r.value).toContain("Brouillon de l’assistant");
  });
  it("lit le groupe écrit par le MJ", () => {
    expect(partyFromText("5 personnages, niveau 3 : guerrier…", 4)).toEqual({ players: 5, level: 3 });
    expect(partyFromText("", 4)).toEqual({ players: 4, level: 1 });
    expect(partyFromText("6 PJ niv. 2", 4)).toEqual({ players: 6, level: 2 });
  });
  it("normalise et décrit le guide de style", async () => {
    const { normalizeStyle, styleBlock, describeStyle } = await import("../src/style.js");
    const g = normalizeStyle({ tone: "  épique ", avoid: "", other: "x" });
    expect(g).toEqual({ tone: "épique" });
    expect(styleBlock({})).toBe("");
    expect(styleBlock(g)).toContain("n'invente toujours rien");
    expect(describeStyle(g)).toContain("**Ton** : épique");
  });
});
