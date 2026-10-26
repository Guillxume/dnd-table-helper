import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type Client } from "discord.js";
import type { Campaign, Store } from "./db.js";
import { splitMessage } from "./text.js";
import { campaignProgress } from "./tracking.js";
import { REMINDER_AHEAD_MS, discordTime } from "./time.js";

export const CHECK_EVERY_MS = 5 * 60 * 1000;
/** L'appel aux notes des joueurs part le lendemain matin : 14 h après le début (20:30 → 10:30). */
export const NOTES_CALL_DELAY_MS = 14 * 60 * 60 * 1000;
/** Au-delà de 3 jours, une séance oubliée (bot éteint) ne déclenche plus d'appel aux notes. */
export const NOTES_CALL_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Ce qu'il faut apporter, rappelé aux joueurs la veille (séances en présentiel). */
export const BRING_LINE = "À apporter : ta fiche de personnage, un crayon, une gomme et tes dés.";

/** Bouton qui ouvre la création (ou la reprise) du personnage, utilisable par chaque joueur pour lui-même. */
export const createButton = (campaignId: string, label = "Créer mon personnage") =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`panel:perso:${campaignId}`).setLabel(label).setStyle(ButtonStyle.Success));

export const notesButton = (campaignId: string) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`panel:notes:${campaignId}`).setLabel("Ajouter mes notes").setStyle(ButtonStyle.Primary));

/** Envoie les rappels dus (séances qui commencent dans moins de 24 h). Appelé régulièrement. */
export async function sendDueReminders(client: Client, store: Store, now = new Date()): Promise<number> {
  const due = store.dueReminders(now.toISOString(), new Date(now.getTime() + REMINDER_AHEAD_MS).toISOString());
  let sent = 0;
  for (const s of due) {
    const campaign = store.getCampaign(s.campaignId);
    if (!campaign || campaign.archived) {
      store.markReminded(s.campaignId);
      continue;
    }
    const channel = await client.channels.fetch(campaign.channelId).catch(() => null);
    if (!channel || !channel.isSendable()) {
      console.warn(`Rappel de séance impossible pour « ${campaign.name} » : salon introuvable ou sans droit d’écriture.`);
      store.markReminded(s.campaignId);
      continue;
    }
    const roles = [campaign.mjRoleId, ...(campaign.playerRoleId ? [campaign.playerRoleId] : [])];
    const date = new Date(s.startsAt);
    try {
      await channel.send({
        content: [
          `${roles.map((r) => `<@&${r}>`).join(" ")} Rappel : prochaine séance de « ${campaign.name} » ${discordTime(date)}.`,
          s.note ? `Note du MJ : ${s.note}` : "",
          BRING_LINE,
        ]
          .filter(Boolean)
          .join("\n"),
        allowedMentions: { roles },
      });
    } catch (e) {
      // isSendable() ne vérifie pas les droits : un salon où le bot ne peut pas écrire échoue ici.
      // On passe aux autres campagnes ; celle-ci sera retentée au prochain passage.
      console.error(`Rappel de séance non envoyé pour « ${campaign.name} », nouvel essai dans 5 min :`, e);
      continue;
    }
    store.markReminded(s.campaignId);
    sent++;
    // Le rappel de la séance précédente suit, pour que personne n'ait à le chercher.
    const last = store.latestSession(campaign.channelId);
    if (last) {
      try {
        for (const chunk of splitMessage(`**Pour se remettre dans le bain : rappel de la séance ${last.number}**\n\n${last.recap}`)) {
          await channel.send({ content: chunk, allowedMentions: { parse: [] } });
        }
      } catch (e) {
        console.error(`Résumé joint au rappel non envoyé pour « ${campaign.name} » :`, e);
      }
    }
  }
  return sent;
}

/** Le lendemain de la séance : invite les joueurs à noter ce qu'ils ont retenu, pour aider le MJ à rédiger le rappel. */
export async function sendNoteCalls(client: Client, store: Store, now = new Date()): Promise<number> {
  const due = store.dueNoteCalls(new Date(now.getTime() - NOTES_CALL_DELAY_MS).toISOString(), new Date(now.getTime() - NOTES_CALL_WINDOW_MS).toISOString());
  let sent = 0;
  for (const s of due) {
    const campaign = store.getCampaign(s.campaignId);
    const channel = campaign && !campaign.archived ? await client.channels.fetch(campaign.channelId).catch(() => null) : null;
    if (!campaign || !channel || !channel.isSendable()) {
      store.markNotesCalled(s.campaignId, s.startsAt);
      continue;
    }
    try {
      await channel.send({
        content: `Merci pour la séance ! Pour aider le MJ à écrire le rappel, note en une ou deux phrases ce que tu as retenu (facultatif, seul le MJ les lit). Tu peux le faire jusqu’à ce que le rappel soit publié.`,
        components: [notesButton(campaign.channelId)],
        allowedMentions: { parse: [] },
      });
    } catch (e) {
      console.error(`Appel aux notes non envoyé pour « ${campaign.name} », nouvel essai dans 5 min :`, e);
      continue;
    }
    store.markNotesCalled(s.campaignId, s.startsAt);
    sent++;
  }
  return sent;
}

/** Texte de relance avant l'échéance de création, ou undefined si tout le monde a fini. */
export function deadlineText(store: Store, c: Campaign, daysLeft: number): { content: string; users: string[] } | undefined {
  const p = campaignProgress(store, c);
  const late = [...p.inProgress.map((x) => x.userId), ...p.notStarted];
  if (!late.length || !c.creationDeadline) return undefined;
  const lines = [
    `Les personnages de « ${c.name} » sont attendus pour le ${discordTime(new Date(c.creationDeadline))} (${daysLeft === 1 ? "demain" : `dans ${daysLeft} jours`}).`,
    p.inProgress.length ? `En cours : ${p.inProgress.map((x) => `<@${x.userId}>`).join(", ")}. Le bouton reprend là où tu t’étais arrêté.` : "",
    p.notStarted.length ? `Pas encore commencé : ${p.notStarted.map((u) => `<@${u}>`).join(", ")}.` : "",
    p.done.length ? `Déjà prêts : ${p.done.length}.` : "",
    p.awaitingTable.length ? `Prêts, caractéristiques à tirer à la table : ${p.awaitingTable.length}.` : "",
  ];
  return { content: lines.filter(Boolean).join("\n"), users: late };
}

/** Relances à J-3 puis à J-1 de l'échéance de création des personnages. */
export async function sendDeadlineReminders(client: Client, store: Store, now = new Date()): Promise<number> {
  let sent = 0;
  for (const c of store.campaignsWithDeadline()) {
    const deadline = new Date(c.creationDeadline!).getTime();
    const left = deadline - now.getTime();
    const stage = left <= 0 ? 2 : left <= DAY_MS ? 2 : left <= 3 * DAY_MS ? 1 : 0;
    if (stage <= c.deadlineStage) continue;
    // Échéance passée sans relance (bot éteint) : on n'envoie rien en retard.
    if (left <= 0) {
      store.setDeadlineStage(c.channelId, 2);
      continue;
    }
    const msg = deadlineText(store, c, Math.max(1, Math.ceil(left / DAY_MS)));
    if (msg) {
      const channel = await client.channels.fetch(c.channelId).catch(() => null);
      if (channel && channel.isSendable()) {
        try {
          await channel.send({ content: msg.content, components: [createButton(c.channelId, "Créer ou reprendre mon personnage")], allowedMentions: { users: msg.users } });
          sent++;
        } catch (e) {
          console.error(`Relance des personnages non envoyée pour « ${c.name} », nouvel essai dans 5 min :`, e);
          continue;
        }
      }
    }
    store.setDeadlineStage(c.channelId, stage);
  }
  return sent;
}

export function startReminders(client: Client, store: Store): NodeJS.Timeout {
  const tick = () => {
    sendDueReminders(client, store).catch((e: unknown) => console.error("Rappels de séance :", e));
    sendNoteCalls(client, store).catch((e: unknown) => console.error("Appel aux notes des joueurs :", e));
    sendDeadlineReminders(client, store).catch((e: unknown) => console.error("Relances des personnages :", e));
  };
  void tick();
  return setInterval(tick, CHECK_EVERY_MS);
}
