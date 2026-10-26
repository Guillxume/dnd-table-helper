import { describe, expect, it } from "vitest";
import { openStore } from "../src/db.js";
import { sendDueReminders } from "../src/schedule.js";
import { formatLocal, localToUtc, parseSessionDate } from "../src/time.js";
import { buildCampaignExport, renderChronicle } from "../src/export.js";
import { officialTemplateAvailable } from "../src/character/official-sheet.js";
import { autoplay } from "./helpers.js";

const now = new Date("2026-10-15T10:00:00Z");

describe("dates de séance (Europe/Paris)", () => {
  it("convertit l'heure de Paris, heure d'hiver et heure d'été", () => {
    expect(localToUtc(2026, 11, 4, 20, 30, "Europe/Paris").toISOString()).toBe("2026-11-04T19:30:00.000Z");
    expect(localToUtc(2026, 7, 1, 20, 0, "Europe/Paris").toISOString()).toBe("2026-07-01T18:00:00.000Z");
  });
  it("lit plusieurs formats et refuse les dates impossibles ou passées", () => {
    const ok = (d: string, t: string) => {
      const r = parseSessionDate(d, t, now, "Europe/Paris");
      return r.ok ? r.date.toISOString() : r.error;
    };
    expect(ok("04/11/2026", "20:30")).toBe("2026-11-04T19:30:00.000Z");
    expect(ok("4/11", "20h30")).toBe("2026-11-04T19:30:00.000Z");
    expect(ok("04/11/26", "20h")).toBe("2026-11-04T19:00:00.000Z");
    expect(ok("01/02", "20:00")).toBe("2027-02-01T19:00:00.000Z"); // sans année : la prochaine occurrence
    expect(ok("31/02/2027", "20:00")).toMatch(/n’existe pas/);
    expect(ok("01/10/2026", "20:00")).toMatch(/passée/);
    expect(ok("demain", "20:00")).toMatch(/illisible/);
    expect(formatLocal(new Date("2026-11-04T19:30:00Z"), "Europe/Paris")).toBe("mercredi 4 novembre 2026 à 20:30");
  });
});

describe("rappel automatique", () => {
  it("envoie un seul rappel par séance, 24 h avant, en mentionnant MJ et joueurs", async () => {
    const store = openStore(":memory:");
    store.createCampaign({ channelId: "c1", guildId: "g", name: "Les Mines", mjRoleId: "mj" });
    store.setCampaignStructure("c1", { playerRoleId: "pj" });
    store.setNextSession("c1", "2026-10-16T18:00:00.000Z", "Chez Paul");
    const sent: { content: string; allowedMentions: unknown }[] = [];
    const client = { channels: { fetch: async () => ({ isSendable: () => true, send: async (m: any) => sent.push(m) }) } } as any;
    expect(await sendDueReminders(client, store, new Date("2026-10-15T10:00:00Z"))).toBe(0); // plus de 24 h avant
    expect(await sendDueReminders(client, store, new Date("2026-10-15T18:30:00Z"))).toBe(1);
    expect(await sendDueReminders(client, store, new Date("2026-10-15T19:00:00Z"))).toBe(0); // déjà envoyé
    expect(sent[0]!.content).toContain("<@&mj> <@&pj>");
    expect(sent[0]!.content).toContain("Chez Paul");
    expect(sent[0]!.allowedMentions).toEqual({ roles: ["mj", "pj"] });
    // Une nouvelle date remet le rappel en attente.
    store.setNextSession("c1", "2026-10-23T18:00:00.000Z", "");
    expect(await sendDueReminders(client, store, new Date("2026-10-22T19:00:00Z"))).toBe(1);
    store.close();
  });

  it("un salon sans droit d'écriture ne bloque pas les autres campagnes et sera retenté", async () => {
    const store = openStore(":memory:");
    for (const id of ["c1", "c2"]) {
      store.createCampaign({ channelId: id, guildId: "g", name: id, mjRoleId: "mj" });
      store.setNextSession(id, "2026-10-16T18:00:00.000Z", "");
    }
    let blocked = true;
    const sent: string[] = [];
    const client = {
      channels: {
        fetch: async (id: string) => ({
          isSendable: () => true,
          send: async () => {
            if (id === "c1" && blocked) throw new Error("Missing Permissions");
            sent.push(id);
          },
        }),
      },
    } as any;
    const at = new Date("2026-10-15T18:30:00Z");
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => void errors.push(args);
    try {
      expect(await sendDueReminders(client, store, at)).toBe(1);
      expect(sent).toEqual(["c2"]);
      expect(errors).toHaveLength(1);
      blocked = false;
      expect(await sendDueReminders(client, store, at)).toBe(1);
      expect(sent).toEqual(["c2", "c1"]);
    } finally {
      console.error = original;
      store.close();
    }
  });
});

describe("export de campagne", () => {
  const campaign = {
    channelId: "c1", guildId: "g", name: "Les Mines", mjRoleId: "mj", prepChannelId: null, sheetsChannelId: null,
    creationRules: { level: 1, methods: ["des" as const], content: "manuel" as const }, playerRoleId: null, categoryId: null, archived: false, archivedChannels: [], style: {}, panelMessageId: null, mjPanelMessageId: null, creationDeadline: null, deadlineStage: 0, createdAt: "2026-10-01",
  };
  const sessions = [1, 2].map((n) => ({ id: n, channelId: "c1", number: n, notes: "", recap: `**Résumé ${n}**\n- point`, createdAt: `2026-10-0${n}T20:00:00Z` }));
  it("chroniques : couverture puis une page par séance", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(await renderChronicle(campaign, sessions, []));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3);
  });
  it.skipIf(!officialTemplateAvailable())("ajoute les fiches aplaties à la suite", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const chars = ["guerrier", "magicien"].map((classId, k) => ({ name: `P${k}`, player: "Joueur", draft: autoplay({ classId }) }));
    const buf = await buildCampaignExport(campaign, sessions, chars, { sheets: true });
    const pdf = await PDFDocument.load(buf);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3 + 2 * 4);
    expect(pdf.getForm().getFields()).toHaveLength(0);
    expect(buf.length).toBeLessThan(10 * 1024 * 1024);
  });
});

describe("mise en page des rappels", () => {
  it("découpe titres, puces et paragraphes, et numérote en chiffres romains", async () => {
    const { recapBlocks, roman } = await import("../src/export.js");
    expect(recapBlocks("Résumé court.\n\n**Points à retenir**\n- PNJ : **Gundren**\n- Lieu\n\n## Fils ouverts\nLa carte.")).toEqual([
      { kind: "para", text: "Résumé court." },
      { kind: "heading", text: "Points à retenir" },
      { kind: "bullet", text: "PNJ : Gundren" },
      { kind: "bullet", text: "Lieu" },
      { kind: "heading", text: "Fils ouverts" },
      { kind: "para", text: "La carte." },
    ]);
    expect([1, 4, 9, 14, 40].map(roman)).toEqual(["I", "IV", "IX", "XIV", "XL"]);
  });
});
