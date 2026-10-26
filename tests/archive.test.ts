import { describe, expect, it } from "vitest";
import {
  ARCHIVE_CATEGORY,
  archiveCampaignDiscord,
  archivedChannelName,
  campaignSlug,
  deleteCampaignDiscord,
  reportText,
  restoreCampaignDiscord,
  type CampaignDiscord,
} from "../src/archive.js";
import { openStore } from "../src/db.js";
import { CAMPAIGN_CHANNELS, runSetup, type ChannelAccess, type ChannelRef, type GuildPort, type RoleRef } from "../src/setup.js";

function fakeGuild() {
  let n = 0;
  const roles: RoleRef[] = [];
  const channels: ChannelRef[] = [];
  const access: Record<string, ChannelAccess | undefined> = {};
  let failOn: string | null = null;
  const port: GuildPort = {
    everyoneRoleId: "everyone",
    botId: "bot",
    listRoles: async () => roles.map((r) => ({ ...r })),
    createRole: async (name) => {
      const r = { id: `r${++n}`, name };
      roles.push(r);
      return r;
    },
    listChannels: async () => channels.map((c) => ({ ...c })),
    createCategory: async (name, privateTo) => {
      const c: ChannelRef = { id: `c${++n}`, name, type: "category", parentId: null };
      channels.push(c);
      access[c.id] = privateTo ? { privateTo } : undefined;
      return c;
    },
    createText: async ({ name, parentId, privateTo }) => {
      const c: ChannelRef = { id: `c${++n}`, name, type: "text", parentId };
      channels.push(c);
      access[c.id] = privateTo ? { privateTo } : undefined;
      return c;
    },
    addMemberRole: async () => {},
    removeMemberRole: async () => {},
    createArchiveCategory: async (name) => {
      const c: ChannelRef = { id: `c${++n}`, name, type: "category", parentId: null };
      channels.push(c);
      access[c.id] = "readonly";
      return c;
    },
    moveChannel: async (id, opts) => {
      if (failOn === id) throw new Error("Missing Permissions");
      const c = channels.find((x) => x.id === id)!;
      c.parentId = opts.parentId;
      c.name = opts.name;
      access[id] = opts.access;
    },
    deleteChannel: async (id) => {
      channels.splice(channels.findIndex((x) => x.id === id), 1);
    },
    deleteRole: async (id) => {
      roles.splice(roles.findIndex((x) => x.id === id), 1);
    },
  };
  return { port, roles, channels, access, failAt: (id: string | null) => (failOn = id) };
}

async function setupCampaign(g: ReturnType<typeof fakeGuild>, name: string): Promise<CampaignDiscord & { recap: string }> {
  const res = await runSetup(g.port, name);
  return {
    name,
    categoryId: res.categoryId,
    mjRoleId: res.mjRoleId,
    playerRoleId: res.playerRoleId,
    prepChannelId: res.prepChannelId,
    archivedChannels: [],
    recap: res.recapChannelId,
  };
}

const archive = (g: ReturnType<typeof fakeGuild>) => g.channels.find((c) => c.type === "category" && c.name === ARCHIVE_CATEGORY);

describe("noms des salons archivés", () => {
  it("préfixe le salon par le nom de la campagne, au format Discord", () => {
    expect(campaignSlug("Les Mines d'Or")).toBe("les-mines-d-or");
    expect(campaignSlug("L'Épée   brisée !")).toBe("l-épée-brisée");
    expect(archivedChannelName("Les Mines", "rappel-de-séance")).toBe("les-mines-rappel-de-séance");
    expect(archivedChannelName("x".repeat(120), "fiches").length).toBe(100);
  });
});

describe("archivage d'une campagne côté Discord", () => {
  it("range tous les salons dans Archives, supprime la catégorie et les deux rôles", async () => {
    const g = fakeGuild();
    const c = await setupCampaign(g, "Les Mines");
    await setupCampaign(g, "Autre");
    const r = await archiveCampaignDiscord(g.port, c);
    expect(r.error).toBeUndefined();
    const arch = archive(g)!;
    const archived = g.channels.filter((x) => x.parentId === arch.id);
    expect(archived.map((x) => x.name).sort()).toEqual(CAMPAIGN_CHANNELS.map((s) => `les-mines-${s.name}`).sort());
    expect(r.channels.map((x) => x.name).sort()).toEqual(CAMPAIGN_CHANNELS.map((s) => s.name).sort());
    expect(g.channels.find((x) => x.id === c.categoryId)).toBeUndefined();
    expect(g.roles.map((x) => x.name)).toEqual(["MJ Autre", "Joueurs Autre"]);
    expect(g.access[c.prepChannelId!]).toBe("hidden");
    expect(g.access[c.recap]).toBe("readonly");
  });

  it("réutilise la catégorie Archives d'une campagne à l'autre", async () => {
    const g = fakeGuild();
    const a = await setupCampaign(g, "A");
    const b = await setupCampaign(g, "B");
    await archiveCampaignDiscord(g.port, a);
    await archiveCampaignDiscord(g.port, b);
    expect(g.channels.filter((x) => x.name === ARCHIVE_CATEGORY)).toHaveLength(1);
    expect(g.channels.filter((x) => x.parentId === archive(g)!.id)).toHaveLength(2 * CAMPAIGN_CHANNELS.length);
  });

  it("refuse de dépasser 50 salons dans Archives, avant toute modification", async () => {
    const g = fakeGuild();
    const arch = await g.port.createArchiveCategory(ARCHIVE_CATEGORY);
    for (let k = 0; k < 48; k++) await g.port.createText({ name: `vieux-${k}`, parentId: arch.id, topic: "" });
    const c = await setupCampaign(g, "Pleine");
    const r = await archiveCampaignDiscord(g.port, c);
    expect(r.error).toMatch(/50/);
    expect(g.channels.find((x) => x.id === c.categoryId)).toBeDefined();
    expect(g.roles.some((x) => x.name === "MJ Pleine")).toBe(true);
  });

  it("ne supprime jamais un rôle partagé d'une ancienne campagne, ni des salons hors catégorie", async () => {
    const g = fakeGuild();
    const shared = await g.port.createRole("MJ");
    const general = await g.port.createText({ name: "général", parentId: "x", topic: "" });
    const r = await archiveCampaignDiscord(g.port, {
      name: "Ancienne",
      categoryId: null,
      mjRoleId: shared.id,
      playerRoleId: null,
      prepChannelId: null,
      archivedChannels: [],
    });
    expect(r.error).toBeUndefined();
    expect(g.roles).toHaveLength(1);
    expect(g.channels.find((x) => x.id === general.id)?.parentId).toBe("x");
    expect(r.notes.join(" ")).toMatch(/catégorie propre/);
    expect(r.notes.join(" ")).toMatch(/rôle MJ/);
  });

  it("après une erreur en cours de route, garde la trace des salons déjà rangés et reprend à la relance", async () => {
    const g = fakeGuild();
    const c = await setupCampaign(g, "Coupée");
    g.failAt(c.prepChannelId);
    const first = await archiveCampaignDiscord(g.port, c);
    expect(first.error).toMatch(/Missing Permissions/);
    expect(first.channels.length).toBeGreaterThan(0);
    expect(reportText("titre", first)).toMatch(/relance la commande/);
    g.failAt(null);
    const second = await archiveCampaignDiscord(g.port, { ...c, archivedChannels: first.channels });
    expect(second.error).toBeUndefined();
    expect(second.channels).toHaveLength(CAMPAIGN_CHANNELS.length);
    expect(g.roles).toHaveLength(0);
  });
});

describe("réactivation et suppression côté Discord", () => {
  it("la réactivation recrée rôles et catégorie et remet les salons avec leur nom et leurs droits", async () => {
    const g = fakeGuild();
    const c = await setupCampaign(g, "Retour");
    const arch = await archiveCampaignDiscord(g.port, c);
    const r = await restoreCampaignDiscord(g.port, { ...c, archivedChannels: arch.channels });
    expect(r.error).toBeUndefined();
    expect(r.channels).toHaveLength(0);
    const st = r.setup!;
    expect(st.recapChannelId).toBe(c.recap);
    expect(st.prepChannelId).toBe(c.prepChannelId);
    expect(g.roles.map((x) => x.name)).toEqual(["MJ Retour", "Joueurs Retour"]);
    const cat = g.channels.find((x) => x.id === st.categoryId)!;
    expect(cat.name).toBe("Retour");
    expect(g.channels.filter((x) => x.parentId === cat.id).map((x) => x.name).sort()).toEqual(CAMPAIGN_CHANNELS.map((s) => s.name).sort());
    expect(g.access[c.prepChannelId!]).toEqual({ privateTo: [st.mjRoleId, "bot"] });
    expect(g.access[c.recap]).toEqual({ privateTo: [st.mjRoleId, st.playerRoleId, "bot"] });
  });

  it("la suppression efface les salons (archivés ou non), la catégorie et les rôles, rien d'autre", async () => {
    const g = fakeGuild();
    const a = await setupCampaign(g, "A");
    const b = await setupCampaign(g, "B");
    const arch = await archiveCampaignDiscord(g.port, a);
    const before = g.channels.length;
    const r = await deleteCampaignDiscord(g.port, { ...a, archivedChannels: arch.channels });
    expect(r.error).toBeUndefined();
    expect(g.channels.length).toBe(before - CAMPAIGN_CHANNELS.length);
    const r2 = await deleteCampaignDiscord(g.port, b);
    expect(r2.error).toBeUndefined();
    expect(g.roles).toHaveLength(0);
    expect(g.channels.find((x) => x.id === b.categoryId)).toBeUndefined();
    expect(g.channels.some((x) => x.name === "général")).toBe(true);
  });
});

describe("salons archivés en base", () => {
  it("enregistre et relit la liste, et met à jour le rôle MJ à la réactivation", () => {
    const store = openStore(":memory:");
    store.createCampaign({ channelId: "c1", guildId: "g", name: "A", mjRoleId: "mj" });
    expect(store.getCampaign("c1")?.archivedChannels).toEqual([]);
    store.setArchivedChannels("c1", [{ id: "x", name: "rappel-de-séance" }]);
    expect(store.getCampaign("c1")?.archivedChannels).toEqual([{ id: "x", name: "rappel-de-séance" }]);
    store.setArchivedChannels("c1", []);
    expect(store.getCampaign("c1")?.archivedChannels).toEqual([]);
    store.setCampaignStructure("c1", { mjRoleId: "mj2" });
    expect(store.getCampaign("c1")?.mjRoleId).toBe("mj2");
    store.close();
  });
});
