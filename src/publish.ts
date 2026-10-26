import type { Client } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import type { Store, StoredCharacter } from "./db.js";
import { characterLabel, sheetFileName } from "./character/label.js";
import { characterPdf } from "./character/render.js";
import { splitMessage } from "./text.js";

/** Vérification des publications et messages demandés depuis le site. */
export const PUBLISH_EVERY_MS = 30 * 1000;

export type PublishResult = { ok: true; channelId: string } | { ok: false; error: string };

/** Publie la fiche (PDF) dans le salon des fiches de sa campagne. Les droits sont vérifiés par l'appelant. */
export async function publishCharacter(client: Client, store: Store, c: StoredCharacter, playerName?: string): Promise<PublishResult> {
  const campaign = store.getCampaign(c.campaignId);
  const channelId = campaign?.sheetsChannelId;
  if (!campaign || !channelId) return { ok: false, error: "Le salon des fiches n’est pas enregistré. Un administrateur doit relancer /setup." };
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isSendable()) return { ok: false, error: "Je ne peux pas écrire dans le salon des fiches (droits ou salon supprimé)." };
  const name = playerName ?? (await client.guilds.fetch(c.guildId).then((g) => g.members.fetch(c.userId)).catch(() => null))?.displayName;
  await channel.send({
    content: `Fiche de ${characterLabel(c)}, campagne « ${campaign.name} », joueur : <@${c.userId}>`,
    files: [new AttachmentBuilder(await characterPdf(c.draft, name ?? undefined), { name: sheetFileName(c.name) })],
    allowedMentions: { parse: [] },
  });
  return { ok: true, channelId };
}

/** Traite les demandes de publication en attente (une à la fois, dans l'ordre). Retourne le nombre publié. */
export async function sendPendingPublications(client: Client, store: Store): Promise<number> {
  let sent = 0;
  for (const request of store.pendingPublications()) {
    const character = store.getCharacter(request.characterId);
    if (!character) {
      store.markPublicationFailed(request.id, "Fiche supprimée.");
      continue;
    }
    try {
      const result = await publishCharacter(client, store, character);
      if (result.ok) {
        store.markPublished(request.id);
        sent += 1;
      } else {
        store.markPublicationFailed(request.id, result.error);
      }
    } catch (e) {
      store.markPublicationFailed(request.id, e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }
  return sent;
}

/**
 * Envoie les messages demandés depuis le site (annonce de séance, rappel de séance) dans le salon
 * de la campagne. Seule l'annonce de séance mentionne le rôle des joueurs. Retourne le nombre envoyé.
 */
export async function sendPendingDiscordPosts(client: Client, store: Store): Promise<number> {
  let sent = 0;
  for (const post of store.pendingDiscordPosts()) {
    const campaign = store.getCampaign(post.campaignId);
    if (!campaign) {
      store.markDiscordPostFailed(post.id, "Campagne supprimée.");
      continue;
    }
    try {
      const channel = await client.channels.fetch(campaign.channelId).catch(() => null);
      if (!channel || !channel.isSendable()) {
        store.markDiscordPostFailed(post.id, "Je ne peux pas écrire dans le salon de la campagne (droits ou salon supprimé).");
        continue;
      }
      const roles = post.mentionPlayers && campaign.playerRoleId ? [campaign.playerRoleId] : [];
      const text = `${roles.map((r) => `<@&${r}> `).join("")}${post.content}`;
      for (const [index, chunk] of splitMessage(text).entries()) {
        // La mention ne notifie qu'au premier message.
        await channel.send({ content: chunk, allowedMentions: index === 0 ? { roles } : { parse: [] } });
      }
      store.markDiscordPostSent(post.id);
      sent += 1;
    } catch (e) {
      store.markDiscordPostFailed(post.id, e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }
  return sent;
}

export function startPublications(client: Client, store: Store): NodeJS.Timeout {
  // Une passe lente (limite de débit Discord, plusieurs PDF) ne doit pas être doublée par la
  // suivante : la même demande serait publiée deux fois avant d'être marquée.
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    sendPendingPublications(client, store)
      .catch((e: unknown) => console.error("Publication des fiches :", e))
      .then(() => sendPendingDiscordPosts(client, store))
      .catch((e: unknown) => console.error("Messages demandés par le site :", e))
      .finally(() => {
        running = false;
      });
  };
  void tick();
  return setInterval(tick, PUBLISH_EVERY_MS);
}
