import { describe, expect, it } from "vitest";
import { CAMPAIGN_CHANNELS, SHARED_CATEGORY, runSetup, type ChannelRef, type GuildPort, type RoleRef } from "../src/setup.js";

function fakeGuild(initialRoles: RoleRef[] = [], initialChannels: ChannelRef[] = []) {
  let n = 0;
  const roles = [...initialRoles];
  const channels = [...initialChannels];
  const privates: Record<string, string[] | undefined> = {};
  const memberRoles: Record<string, string[]> = {};
  const port: GuildPort = {
    everyoneRoleId: "everyone",
    botId: "bot",
    listRoles: async () => [...roles],
    createRole: async (name) => {
      const r = { id: `r${++n}`, name };
      roles.push(r);
      return r;
    },
    listChannels: async () => [...channels],
    createCategory: async (name, privateTo) => {
      const c: ChannelRef = { id: `c${++n}`, name, type: "category", parentId: null };
      channels.push(c);
      privates[c.id] = privateTo;
      return c;
    },
    createText: async ({ name, parentId, privateTo }) => {
      const c: ChannelRef = { id: `c${++n}`, name, type: "text", parentId };
      channels.push(c);
      privates[c.id] = privateTo;
      return c;
    },
    addMemberRole: async (u, r) => {
      (memberRoles[u] ??= []).push(r);
    },
    removeMemberRole: async (u, r) => {
      memberRoles[u] = (memberRoles[u] ?? []).filter((x) => x !== r);
    },
    createArchiveCategory: async (name) => {
      const c: ChannelRef = { id: `c${++n}`, name, type: "category", parentId: null };
      channels.push(c);
      return c;
    },
    moveChannel: async (id, { parentId, name }) => {
      const c = channels.find((x) => x.id === id)!;
      c.parentId = parentId;
      c.name = name;
    },
    deleteChannel: async (id) => {
      channels.splice(channels.findIndex((x) => x.id === id), 1);
    },
    deleteRole: async (id) => {
      roles.splice(roles.findIndex((x) => x.id === id), 1);
    },
  };
  return { port, roles, channels, privates, memberRoles };
}

describe("runSetup (une catégorie par campagne)", () => {
  it("crée la catégorie commune, la catégorie de la campagne, ses salons et ses rôles", async () => {
    const g = fakeGuild();
    const res = await runSetup(g.port, "Les Mines");
    expect(g.roles.map((r) => r.name)).toEqual(["MJ Les Mines", "Joueurs Les Mines"]);
    expect(res.created).toHaveLength(2 + 1 + SHARED_CATEGORY.channels.length + 1 + CAMPAIGN_CHANNELS.length);
    const cat = g.channels.find((c) => c.id === res.categoryId)!;
    expect(cat.name).toBe("Les Mines");
    for (const id of [res.recapChannelId, res.prepChannelId, res.sheetsChannelId]) expect(g.channels.find((c) => c.id === id)?.parentId).toBe(cat.id);
  });

  it("rend les salons privés à la table, et aide-mj au seul MJ", async () => {
    const g = fakeGuild();
    const res = await runSetup(g.port, "A");
    expect(g.privates[res.prepChannelId]).toEqual([res.mjRoleId, "bot"]);
    expect(g.privates[res.recapChannelId]).toEqual([res.mjRoleId, res.playerRoleId, "bot"]);
    const general = g.channels.find((c) => c.name === "général")!;
    expect(g.privates[general.id]).toBeUndefined();
    const pub = await runSetup(g.port, "B", { public: true });
    expect(g.privates[pub.recapChannelId]).toBeUndefined();
    expect(g.privates[pub.prepChannelId]).toEqual([pub.mjRoleId, "bot"]);
  });

  it("deux campagnes ont des salons et des rôles distincts, et la catégorie commune est partagée", async () => {
    const g = fakeGuild();
    const a = await runSetup(g.port, "A");
    const b = await runSetup(g.port, "B");
    expect(a.recapChannelId).not.toBe(b.recapChannelId);
    expect(a.mjRoleId).not.toBe(b.mjRoleId);
    expect(g.channels.filter((c) => c.name === SHARED_CATEGORY.name)).toHaveLength(1);
  });

  it("réutilise un #général existant hors de la catégorie commune, sans le dupliquer", async () => {
    const g = fakeGuild([], [
      { id: "def", name: "Salons textuels", type: "category", parentId: null },
      { id: "gen", name: "général", type: "text", parentId: "def" },
    ]);
    const res = await runSetup(g.port, "A");
    expect(g.channels.filter((c) => c.name === "général")).toHaveLength(1);
    expect(res.reused).toContain("salon #général");
    // #calendrier manque encore : il est créé dans la catégorie commune.
    const table = g.channels.find((c) => c.name === SHARED_CATEGORY.name)!;
    expect(g.channels.find((c) => c.name === "calendrier")?.parentId).toBe(table.id);
  });

  it("ne crée pas la catégorie commune quand tous ses salons existent déjà ailleurs", async () => {
    const g = fakeGuild([], SHARED_CATEGORY.channels.map((s, k) => ({ id: `x${k}`, name: s.name, type: "text" as const, parentId: null })));
    await runSetup(g.port, "A");
    expect(g.channels.filter((c) => c.name === SHARED_CATEGORY.name)).toHaveLength(0);
    for (const s of SHARED_CATEGORY.channels) expect(g.channels.filter((c) => c.name === s.name)).toHaveLength(1);
  });

  it("est idempotent pour une même campagne", async () => {
    const g = fakeGuild();
    const first = await runSetup(g.port, "A");
    const before = g.channels.length;
    const second = await runSetup(g.port, "A");
    expect(second.created).toHaveLength(0);
    expect(g.channels).toHaveLength(before);
    expect(second.recapChannelId).toBe(first.recapChannelId);
  });
});
