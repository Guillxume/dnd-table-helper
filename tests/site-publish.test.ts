import { afterEach, describe, expect, it, vi } from "vitest";
import type { Client } from "discord.js";
import { MAX_PUBLISH_ATTEMPTS, openStore } from "../src/db.js";
import { mjPanel, playerPanel, welcomeMessage } from "../src/panel.js";
import { PUBLISH_EVERY_MS, sendPendingDiscordPosts, sendPendingPublications, startPublications } from "../src/publish.js";
import { sheetFileName } from "../src/character/label.js";
import { siteUrl } from "../src/site.js";
import { autoplay } from "./helpers.js";

const SITE = "https://table.example.com";

function campaignStore() {
  const store = openStore(":memory:");
  store.createCampaign({ channelId: "c1", guildId: "g1", name: "L'Étoile", mjRoleId: "mj" });
  store.setCampaignStructure("c1", { sheetsChannelId: "fiches", playerRoleId: "joueurs" });
  return store;
}

const buttonData = (panel: { components: { components: unknown[] }[] }) =>
  panel.components.flatMap((r) => r.components as { data: { style: number; url?: string; custom_id?: string; label: string } }[]).map((b) => b.data);

describe("lien vers le site", () => {
  it("lit SITE_URL et refuse une valeur invalide", () => {
    expect(siteUrl({ SITE_URL: "https://table.example.com/" })).toBe(SITE);
    expect(siteUrl({ SITE_URL: "  " })).toBeNull();
    expect(siteUrl({ SITE_URL: "javascript:alert(1)" })).toBeNull();
    expect(siteUrl({ SITE_URL: "pas une url" })).toBeNull();
    expect(siteUrl({})).toBeNull();
  });

  it("ajoute un bouton-lien au tableau de bord des joueurs, dans les limites de Discord", () => {
    const store = campaignStore();
    const c = store.getCampaign("c1")!;
    const withSite = playerPanel(c, SITE);
    const links = buttonData(withSite).filter((b) => b.url);
    expect(links).toEqual([
      expect.objectContaining({ url: `${SITE}/personnages`, label: "Ouvrir le site" }),
      expect.objectContaining({ url: `${SITE}/campagnes/c1`, label: "La campagne sur le site" }),
    ]);
    expect(withSite.content).toContain("Ouvrir le site");
    expect(withSite.content.length).toBeLessThanOrEqual(2000);
    for (const r of withSite.components) expect(r.components.length).toBeLessThanOrEqual(5);

    const withoutSite = playerPanel(c, null);
    expect(buttonData(withoutSite).some((b) => b.url)).toBe(false);
    expect(withoutSite.content).not.toContain("site");
    store.close();
  });

  it("relie le tableau de bord du MJ à son espace de campagne sur le site", () => {
    const store = campaignStore();
    const c = store.getCampaign("c1")!;
    const panel = mjPanel(c, SITE);
    expect(buttonData(panel).filter((b) => b.url)).toEqual([expect.objectContaining({ url: `${SITE}/campagnes/c1?onglet=seances` })]);
    expect(panel.components.length).toBeLessThanOrEqual(5);
    expect(panel.content.length).toBeLessThanOrEqual(2000);
    expect(buttonData(mjPanel(c, null)).some((b) => b.url)).toBe(false);
    store.close();
  });

  it("propose le site dans le message d'accueil, en gardant la création dans Discord", () => {
    const store = campaignStore();
    const c = store.getCampaign("c1")!;
    const labels = buttonData(welcomeMessage(c, "u1", SITE)).map((b) => b.label);
    expect(labels).toEqual(["Créer mon personnage sur le site", "Le créer dans Discord"]);
    expect(buttonData(welcomeMessage(c, "u1", null)).map((b) => b.label)).toEqual(["Créer mon personnage"]);
    store.close();
  });
});

describe("publication des fiches demandée depuis le site", () => {
  it("réutilise une demande en attente et cesse de réessayer après plusieurs échecs", () => {
    const store = campaignStore();
    const ch = store.addCharacter("g1", "u1", "c1", "Rek'tal", autoplay());
    const first = store.requestPublication(ch.id, "u1");
    expect(store.requestPublication(ch.id, "u1").id).toBe(first.id);
    expect(store.pendingPublications().map((p) => p.id)).toEqual([first.id]);

    for (let k = 0; k < MAX_PUBLISH_ATTEMPTS; k++) store.markPublicationFailed(first.id, "salon introuvable");
    expect(store.pendingPublications()).toEqual([]);
    expect(store.latestPublication(ch.id)).toMatchObject({ error: "salon introuvable", attempts: MAX_PUBLISH_ATTEMPTS, publishedAt: null });

    // Une nouvelle demande relance la publication.
    const retry = store.requestPublication(ch.id, "u1");
    expect(retry.id).not.toBe(first.id);
    store.close();
  });

  it("publie le PDF dans le salon des fiches et marque la demande", async () => {
    const store = campaignStore();
    const ch = store.addCharacter("g1", "u1", "c1", "Rek'tal", autoplay());
    store.requestPublication(ch.id, "u1");
    const sent: { channel: string; files: unknown[]; content: string }[] = [];
    const client = {
      channels: {
        fetch: async (id: string) => ({
          isSendable: () => true,
          send: async (message: { files: unknown[]; content: string }) => {
            sent.push({ channel: id, ...message });
          },
        }),
      },
      guilds: { fetch: async () => Promise.reject(new Error("hors ligne")) },
    } as unknown as Client;

    expect(await sendPendingPublications(client, store)).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ channel: "fiches", content: expect.stringContaining("Rek'tal") });
    expect(sent[0]!.files).toHaveLength(1);
    expect(store.pendingPublications()).toEqual([]);
    expect(store.latestPublication(ch.id)?.publishedAt).not.toBeNull();
    store.close();
  });

  it("enregistre l'échec quand le salon des fiches est inaccessible", async () => {
    const store = campaignStore();
    const ch = store.addCharacter("g1", "u1", "c1", "Rek'tal", autoplay());
    const request = store.requestPublication(ch.id, "u1");
    const client = { channels: { fetch: async () => null } } as unknown as Client;
    expect(await sendPendingPublications(client, store)).toBe(0);
    expect(store.latestPublication(ch.id)).toMatchObject({ id: request.id, attempts: 1, error: expect.stringContaining("salon des fiches") });
    store.close();
  });
});

describe("robustesse de la publication", () => {
  afterEach(() => vi.useRealTimers());

  it("ne publie pas deux fois quand une passe dure plus que l'intervalle", async () => {
    vi.useFakeTimers();
    const store = campaignStore();
    const ch = store.addCharacter("g1", "u1", "c1", "Rek'tal", autoplay());
    store.requestPublication(ch.id, "u1");
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let sends = 0;
    const client = {
      channels: {
        // Discord répond lentement (limite de débit) : la passe dépasse les 30 s.
        fetch: async () => {
          await blocked;
          return { isSendable: () => true, send: async () => void (sends += 1) };
        },
      },
      guilds: { fetch: async () => Promise.reject(new Error("hors ligne")) },
    } as unknown as Client;

    const timer = startPublications(client, store);
    await vi.advanceTimersByTimeAsync(PUBLISH_EVERY_MS * 3);
    release();
    await vi.advanceTimersByTimeAsync(PUBLISH_EVERY_MS);
    clearInterval(timer);
    // La fiche est générée pour de vrai (PDF) : on laisse les promesses se terminer.
    vi.useRealTimers();
    await vi.waitFor(() => expect(store.pendingPublications()).toEqual([]), { timeout: 10_000 });
    expect(sends).toBe(1);
    store.close();
  });

  it("supprime les demandes avec la fiche ou la campagne", () => {
    const store = campaignStore();
    const a = store.addCharacter("g1", "u1", "c1", "A", autoplay());
    const b = store.addCharacter("g1", "u2", "c1", "B", autoplay());
    store.requestPublication(a.id, "u1");
    store.requestPublication(b.id, "u2");
    store.deleteCharacter(a.id);
    expect(store.latestPublication(a.id)).toBeUndefined();
    expect(store.pendingPublications().map((p) => p.characterId)).toEqual([b.id]);
    store.deleteCampaign("c1");
    expect(store.pendingPublications()).toEqual([]);
    store.close();
  });

  it("donne un nom de fichier sûr, accents retirés", () => {
    expect(sheetFileName("Élamaër d'Ys")).toBe("Elamaer_d_Ys.pdf");
    expect(sheetFileName("¡!")).toBe("personnage.pdf");
  });
});

describe("messages demandés depuis le site", () => {
  type Sent = { channel: string; content: string; allowedMentions: unknown };
  function recordingClient(sent: Sent[], writable = true) {
    return {
      channels: {
        fetch: async (id: string) =>
          writable ? { isSendable: () => true, send: async (m: Omit<Sent, "channel">) => void sent.push({ channel: id, ...m }) } : null,
      },
    } as unknown as Client;
  }

  it("poste l'annonce de séance dans le salon de la campagne en mentionnant seulement le rôle des joueurs", async () => {
    const store = campaignStore();
    store.queueDiscordPost({ campaignId: "c1", kind: "session", content: "Prochaine séance : samedi.", mentionPlayers: true, requestedBy: "site:u" });
    const sent: Sent[] = [];
    expect(await sendPendingDiscordPosts(recordingClient(sent), store)).toBe(1);
    expect(sent).toEqual([{ channel: "c1", content: "<@&joueurs> Prochaine séance : samedi.", allowedMentions: { roles: ["joueurs"] } }]);
    expect(store.pendingDiscordPosts()).toEqual([]);
    expect(store.recentDiscordPosts("c1", 5)[0]!.sentAt).not.toBeNull();
    store.close();
  });

  it("découpe un long rappel sans aucune mention, et abandonne après plusieurs échecs", async () => {
    const store = campaignStore();
    store.queueDiscordPost({ campaignId: "c1", kind: "recap", content: "Paragraphe. ".repeat(400), mentionPlayers: false, requestedBy: "site:u" });
    const sent: Sent[] = [];
    await sendPendingDiscordPosts(recordingClient(sent), store);
    expect(sent.length).toBeGreaterThan(1);
    expect(sent.every((m) => m.content.length <= 2000 && JSON.stringify(m.allowedMentions) !== JSON.stringify({ roles: ["joueurs"] }))).toBe(true);

    store.queueDiscordPost({ campaignId: "c1", kind: "recap", content: "Texte", mentionPlayers: false, requestedBy: "site:u" });
    for (let i = 0; i < MAX_PUBLISH_ATTEMPTS + 1; i++) await sendPendingDiscordPosts(recordingClient([], false), store);
    expect(store.pendingDiscordPosts()).toEqual([]);
    expect(store.recentDiscordPosts("c1", 1)[0]!.error).toMatch(/salon de la campagne/);
    store.close();
  });

  it("supprime les messages en attente avec la campagne", () => {
    const store = campaignStore();
    store.queueDiscordPost({ campaignId: "c1", kind: "session", content: "x", mentionPlayers: true, requestedBy: "site:u" });
    store.deleteCampaign("c1");
    expect(store.pendingDiscordPosts()).toEqual([]);
    store.close();
  });
});
