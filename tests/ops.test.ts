import { describe, expect, it } from "vitest";
import { openStore } from "../src/db.js";
import { beat } from "../src/heartbeat.js";
import { loadConfig } from "../src/config.js";

describe("brouillons de rappel en base", () => {
  it("survivent à la réouverture de la base et expirent après 7 jours", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "jdr-"));
    try {
      const path = join(dir, "t.sqlite");
      let store = openStore(path);
      store.saveRecapDraft({ id: "d1", userId: "u", channelId: "c1", notes: "n", recap: "r" }, new Date("2026-10-01T10:00:00Z"));
      store.close();
      store = openStore(path); // redémarrage du bot
      expect(store.getRecapDraft("d1")).toEqual({ id: "d1", userId: "u", channelId: "c1", notes: "n", recap: "r" });
      store.saveRecapDraft({ id: "d2", userId: "u", channelId: "c1", notes: "n", recap: "r" }, new Date("2026-10-09T10:00:00Z"));
      expect(store.getRecapDraft("d1")).toBeUndefined();
      store.deleteRecapDraft("d2");
      expect(store.getRecapDraft("d2")).toBeUndefined();
      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("sont supprimés avec leur campagne", () => {
    const store = openStore(":memory:");
    store.createCampaign({ channelId: "c1", guildId: "g", name: "A", mjRoleId: "mj" });
    store.saveRecapDraft({ id: "d1", userId: "u", channelId: "c1", notes: "n", recap: "r" });
    store.deleteCampaign("c1");
    expect(store.getRecapDraft("d1")).toBeUndefined();
    store.close();
  });
});

describe("surveillance (HEARTBEAT_URL)", () => {
  const base = { DISCORD_TOKEN: "a", DISCORD_CLIENT_ID: "b", DISCORD_GUILD_ID: "c", ANTHROPIC_API_KEY: "d" };
  it("est désactivée sans variable", () => {
    expect(loadConfig(base).heartbeatUrl).toBeNull();
    expect(loadConfig({ ...base, HEARTBEAT_URL: " https://exemple.test/x " }).heartbeatUrl).toBe("https://exemple.test/x");
  });

  it("n'appelle l'URL que si le bot est connecté, et n'échoue jamais", async () => {
    const calls: string[] = [];
    const ok = async (url: string) => (calls.push(url), { ok: true, status: 200 });
    expect(await beat("https://exemple.test/x", () => false, ok)).toBe(false);
    expect(calls).toHaveLength(0);
    expect(await beat("https://exemple.test/x", () => true, ok)).toBe(true);
    expect(calls).toEqual(["https://exemple.test/x"]);
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      expect(await beat("https://exemple.test/x", () => true, async () => { throw new Error("réseau"); })).toBe(false);
      expect(await beat("https://exemple.test/x", () => true, async () => ({ ok: false, status: 500 }))).toBe(false);
    } finally {
      console.warn = warn;
    }
  });
});
