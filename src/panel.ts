import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Client,
  type Interaction,
  type RepliableInteraction,
} from "discord.js";
import type { Deps } from "./commands.js";
import { buildNotesModal, buildPrepModal, partyDefault } from "./commands.js";
import type { Campaign } from "./db.js";
import { canManageCampaign, isCampaignMember, type Actor } from "./permissions.js";
import { beginCreation, pdfFor } from "./character/handlers.js";
import { characterLabel } from "./character/label.js";
import { renderWizard } from "./character/wizard-ui.js";
import { sheetDiscordText, validateDraft } from "./character/validate.js";
import { lastRecap } from "./service.js";
import { discordTime, parseSessionDate } from "./time.js";
import { renderCarnet } from "./carnet.js";
import { lookup } from "./lookup.js";
import { fixNextSession } from "./campaign-commands.js";
import { campaignProgress, renderProgress } from "./tracking.js";
import { renderGroupSheet, type GroupMember } from "./group-sheet.js";
import { parseCreatureList, renderEncounter, type Difficulty, type Pick } from "./encounter.js";
import { creatures } from "./srd/creatures.js";
import { renderStatBlocks } from "./statblocks.js";
import { isPrepType } from "./prep.js";
import { splitMessage } from "./text.js";
import { siteButton, siteUrl } from "./site.js";

/**
 * Tableaux de bord épinglés : celui des joueurs (salon de rappel) et celui du MJ (#aide-mj). Tout passe par des
 * boutons, sans commande à retenir. Les réponses sont éphémères : le message épinglé n'est jamais modifié.
 */
const eph = MessageFlags.Ephemeral;
type ActorOf = (i: Interaction) => Actor;

const button = (id: string, label: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...b: ButtonBuilder[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(...b);

export function playerPanel(c: Campaign, site: string | null = siteUrl()) {
  const id = c.channelId;
  const siteLink = siteButton("Ouvrir le site", "/personnages", site);
  const campaignLink = siteButton("La campagne sur le site", `/campagnes/${id}`, site);
  return {
    content: [
      `**Tableau de bord : ${c.name}**`,
      "Tout se fait avec les boutons ci-dessous. Les réponses ne s’affichent que pour toi.",
      ...(siteLink ? ["• **Ouvrir le site** : créer ton personnage pas à pas (le plus simple) et télécharger ta fiche."] : []),
      ...(campaignLink ? ["• **La campagne sur le site** : séance, rappels, carnet et tes notes, sur une seule page."] : []),
      "• **Mon personnage** : créer, reprendre ou consulter ta fiche.",
      "• **Dernier rappel** : ce qui s’est passé à la dernière séance.",
      "• **Prochaine séance** : la date, dans ton fuseau horaire.",
      "• **Carnet** : les personnages, lieux, objets et fils ouverts de la campagne.",
      "• **Mes notes** : ce que tu as retenu de la séance, pour aider le MJ à écrire le rappel.",
      "• **Chercher** : un sort, un objet, une créature, une règle ou un état.",
    ].join("\n"),
    components: [
      row(
        ...(siteLink ? [siteLink] : []),
        button(`panel:perso:${id}`, "Mon personnage", ButtonStyle.Success),
        button(`panel:rappel:${id}`, "Dernier rappel"),
        button(`panel:seance:${id}`, "Prochaine séance"),
      ),
      row(
        button(`panel:carnet:${id}`, "Carnet"),
        button(`panel:notes:${id}`, "Mes notes"),
        button(`panel:chercher:${id}`, "Chercher"),
        ...(campaignLink ? [campaignLink] : []),
      ),
    ],
  };
}

export function mjPanel(c: Campaign, site: string | null = siteUrl()) {
  const id = c.channelId;
  const siteLink = siteButton("Espace MJ sur le site", `/campagnes/${id}?onglet=seances`, site);
  return {
    content: [
      `**Tableau de bord du MJ : ${c.name}**`,
      "Pour démarrer : 1. règles de création avec /regles ; 2. ajoute tes joueurs avec /campagne ajouter-joueur (chacun reçoit un message d’accueil) ; 3. fixe l’échéance des personnages.",
      "Après chaque séance : **Notes de séance**, relis le brouillon, puis Publier. Le carnet se met à jour tout seul.",
      "**Préparer une rencontre** calcule aussi le budget de PX (table du SRD) des créatures que tu indiques, et fournit leurs blocs de statistiques à imprimer.",
      ...(siteLink ? ["**Espace MJ sur le site** : les mêmes outils sur grand écran (séance, rappel, préparation, règles, guide de style, suivi, documents PDF)."] : []),
    ].join("\n"),
    components: [
      row(button(`mj:seance:${id}`, "Notes de séance", ButtonStyle.Primary), button(`mj:date:${id}`, "Fixer la séance"), button(`mj:echeance:${id}`, "Échéance des personnages")),
      row(button(`mj:prep:scene:${id}`, "Préparer une scène"), button(`mj:prep:pnj:${id}`, "Préparer un PNJ"), button(`mj:prep:rencontre:${id}`, "Préparer une rencontre")),
      row(button(`mj:groupe:${id}`, "Fiche de groupe (PDF)"), button(`mj:suivi:${id}`, "Suivi des personnages"), button(`panel:chercher:${id}`, "Chercher une règle")),
      ...(siteLink ? [row(siteLink)] : []),
    ],
  };
}

/**
 * Publie (ou republie) les deux tableaux de bord et les épingle ; supprime les anciens s'ils existent.
 * Retourne les remarques à transmettre au MJ (droits manquants…).
 */
export async function postPanels(client: Client, deps: Deps, c: Campaign): Promise<string[]> {
  const notes: string[] = [];
  const post = async (channelId: string | null, oldId: string | null, msg: ReturnType<typeof playerPanel>, what: string) => {
    if (!channelId) {
      notes.push(`${what} : salon introuvable, relance /setup.`);
      return null;
    }
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isSendable() || !("messages" in channel)) {
      notes.push(`${what} : je ne peux pas écrire dans <#${channelId}>.`);
      return null;
    }
    if (oldId) await channel.messages.delete(oldId).catch(() => undefined);
    const sent = await channel.send({ ...msg, allowedMentions: { parse: [] } });
    await sent.pin().catch(() => notes.push(`${what} publié dans <#${channelId}> mais pas épinglé (droit « Épingler des messages » manquant).`));
    return sent.id;
  };
  const panelMessageId = await post(c.channelId, c.panelMessageId, playerPanel(c), "Tableau de bord des joueurs");
  const mjPanelMessageId = await post(c.prepChannelId, c.mjPanelMessageId, mjPanel(c), "Tableau de bord du MJ");
  deps.store.setPanels(c.channelId, { panelMessageId, mjPanelMessageId });
  return notes;
}

/** Message d'accueil d'un joueur ajouté à la campagne, avec le bouton de création. */
export function welcomeMessage(c: Campaign, userId: string, site: string | null = siteUrl()) {
  const siteLink = siteButton("Créer mon personnage sur le site", "/personnages", site);
  return {
    content: [
      `Bienvenue <@${userId}> dans « ${c.name} » !`,
      siteLink
        ? "Première étape : crée ton personnage. Le plus simple est de le faire sur le site (connexion avec ton compte Discord) ; tu peux aussi le faire ici, dans Discord. Dans les deux cas, tu peux t’arrêter et reprendre plus tard."
        : "Première étape : crée ton personnage avec le bouton ci-dessous. Le bot te guide pas à pas, tu peux t’arrêter et reprendre plus tard.",
      "Tout le reste (rappel de la dernière séance, prochaine séance, carnet) se trouve dans le tableau de bord épinglé de ce salon.",
    ].join("\n"),
    components: [
      row(
        ...(siteLink ? [siteLink] : []),
        button(`panel:perso:${c.channelId}`, siteLink ? "Le créer dans Discord" : "Créer mon personnage", siteLink ? ButtonStyle.Secondary : ButtonStyle.Success),
      ),
    ],
  };
}

export async function welcomePlayer(client: Client, c: Campaign, userId: string): Promise<boolean> {
  const channel = await client.channels.fetch(c.channelId).catch(() => null);
  if (!channel || !channel.isSendable()) return false;
  await channel.send({ ...welcomeMessage(c, userId), allowedMentions: { users: [userId] } });
  return true;
}

async function replyLong(i: RepliableInteraction, text: string): Promise<void> {
  const [first, ...rest] = splitMessage(text);
  if (i.deferred || i.replied) await i.editReply({ content: first ?? "", allowedMentions: { parse: [] } });
  else await i.reply({ content: first ?? "", flags: eph, allowedMentions: { parse: [] } });
  for (const chunk of rest) await i.followUp({ content: chunk, flags: eph, allowedMentions: { parse: [] } });
}

const textField = (id: string, label: string, opts: { placeholder?: string; max?: number; required?: boolean; long?: boolean; value?: string } = {}) => {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(opts.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(opts.required ?? true)
    .setMaxLength(opts.max ?? 100);
  if (opts.placeholder) input.setPlaceholder(opts.placeholder);
  if (opts.value) input.setValue(opts.value);
  return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
};

export function nameModal(campaignId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`panelm:create:${campaignId}`)
    .setTitle("Nouveau personnage")
    .addComponents(textField("nom", "Nom du personnage", { placeholder: "Par exemple : Lyra", max: 40 }));
}

export function notesModal(campaignId: string, current = ""): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`panelm:notes:${campaignId}`)
    .setTitle("Mes notes de séance")
    .addComponents(
      textField("texte", "Ce que tu as retenu", {
        placeholder: "Par exemple : on a sauvé le forgeron, la clé ouvre sans doute la crypte",
        max: 1000,
        long: true,
        ...(current ? { value: current } : {}),
      }),
    );
}

export function searchModal(campaignId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`panelm:chercher:${campaignId}`)
    .setTitle("Chercher dans les règles")
    .addComponents(textField("terme", "Sort, objet, créature, règle ou état", { placeholder: "Par exemple : Projectile magique, Agrippé, repos long" }));
}

export function dateModal(campaignId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`mjm:date:${campaignId}`)
    .setTitle("Prochaine séance")
    .addComponents(
      textField("date", "Date (JJ/MM/AAAA)", { placeholder: "21/11/2026", max: 10 }),
      textField("heure", "Heure", { placeholder: "20:30", max: 5 }),
      textField("note", "Note pour les joueurs (facultatif)", { placeholder: "Chez Paul, apportez à boire", max: 300, required: false }),
    );
}

export function deadlineModal(campaignId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`mjm:echeance:${campaignId}`)
    .setTitle("Échéance des personnages")
    .addComponents(textField("date", "Date limite (JJ/MM/AAAA), ou « aucune »", { placeholder: "11/11/2026", max: 10 }));
}

/** Fixe ou efface l'échéance de création ; retourne le message pour le MJ. */
export function setDeadline(deps: Deps, c: Campaign, text: string, now = new Date()): string {
  const t = text.trim().toLowerCase();
  if (t === "aucune" || t === "aucun" || t === "") {
    deps.store.setCreationDeadline(c.channelId, null);
    return `Plus d’échéance pour les personnages de « ${c.name} ».`;
  }
  const parsed = parseSessionDate(text, "23:59", now);
  if (!parsed.ok) return parsed.error;
  deps.store.setCreationDeadline(c.channelId, parsed.date.toISOString());
  return `Échéance des personnages de « ${c.name} » : ${discordTime(parsed.date)}. Le bot relancera à J-3 et à J-1 ceux qui n’ont pas fini.`;
}

/** Personnages actifs de la campagne (un par joueur), avec le nom affiché du joueur. */
export async function groupMembers(i: Interaction, deps: Deps, c: Campaign): Promise<GroupMember[]> {
  const chars = deps.store.listCharacters(c.guildId, c.channelId);
  const byPlayer = new Map<string, (typeof chars)[number]>();
  for (const ch of chars) if (!byPlayer.has(ch.userId) || ch.active) byPlayer.set(ch.userId, ch);
  const out: GroupMember[] = [];
  for (const [userId, ch] of byPlayer) {
    const m = await i.guild?.members.fetch(userId).catch(() => null);
    out.push({ name: ch.name, player: m?.displayName ?? "joueur parti", draft: ch.draft });
  }
  return out;
}

const fileSafe = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "campagne";

export async function sendGroupSheet(i: RepliableInteraction, deps: Deps, c: Campaign): Promise<void> {
  await i.deferReply({ flags: eph });
  const members = await groupMembers(i, deps, c);
  const pdf = await renderGroupSheet(c, members);
  await i.editReply({
    content: `Fiche de groupe de « ${c.name} » : ${members.length} personnage(s), une page à imprimer.`,
    files: [new AttachmentBuilder(pdf, { name: `Groupe_${fileSafe(c.name)}.pdf` })],
  });
}

/** Encode une rencontre dans un identifiant de bouton (100 caractères au plus) : index des créatures et nombres. */
export function encodePicks(picks: Pick[]): string | undefined {
  const all = creatures();
  const code = picks.map((p) => `${all.indexOf(p.creature)}x${p.count}`).join(".");
  return `enc:pdf:${code}`.length <= 100 ? code : undefined;
}

export function decodePicks(code: string): Pick[] {
  const all = creatures();
  return code.split(".").flatMap((part) => {
    const [idx, count] = part.split("x").map(Number);
    const creature = idx !== undefined ? all[idx] : undefined;
    return creature && count ? [{ creature, count }] : [];
  });
}

/** Réponse du budget de rencontre (commande /rencontre ou tableau de bord MJ). */
export function encounterMessage(text: string, level: number, players: number, difficulty: Difficulty) {
  const { picks, unknown } = parseCreatureList(text);
  const content = picks.length
    ? renderEncounter(picks, unknown, level, players, difficulty)
    : `Aucune créature reconnue dans le SRD 5.2.1${unknown.length ? ` : ${unknown.join(", ")}` : ""}. Écris par exemple « 4 combattants gobelins, 1 chef gobelin ».`;
  const code = picks.length ? encodePicks(picks) : undefined;
  return {
    content: content.slice(0, 1990),
    components: code ? [row(button(`enc:pdf:${code}`, "PDF des blocs de statistiques", ButtonStyle.Primary))] : [],
  };
}

/** Joueurs : boutons « panel:… » et formulaires « panelm:… ». MJ : « mj:… » et « mjm:… ». Rencontre : « enc:… ». */
export async function handlePanelInteraction(i: Interaction, deps: Deps, actorOf: ActorOf): Promise<boolean> {
  if (!(i.isButton() || i.isModalSubmit())) return false;
  const [scope, action = "", ...rest] = i.customId.split(":");
  if (!scope || !["panel", "panelm", "mj", "mjm", "enc"].includes(scope)) return false;
  const actor = actorOf(i);
  const guildId = i.guildId;
  if (!guildId) return true;

  if (scope === "enc" && action === "pdf" && i.isButton()) {
    const picks = decodePicks(rest[0] ?? "");
    if (!picks.length) {
      await i.reply({ content: "Rencontre introuvable.", flags: eph });
      return true;
    }
    await i.deferReply({ flags: eph });
    const pdf = await renderStatBlocks("Blocs de statistiques (SRD 5.2.1)", picks);
    await i.editReply({ content: "Blocs de statistiques à imprimer :", files: [new AttachmentBuilder(pdf, { name: "Rencontre.pdf" })] });
    return true;
  }

  const campaignId = scope === "mj" && action === "prep" ? rest[1] : rest[0];
  const c = campaignId ? deps.store.getCampaign(campaignId) : undefined;
  if (!c || c.guildId !== guildId) {
    await i.reply({ content: "Cette campagne n’existe plus.", flags: eph });
    return true;
  }
  if (c.archived) {
    await i.reply({ content: `« ${c.name} » est archivée.`, flags: eph });
    return true;
  }

  if (scope === "mj" || scope === "mjm") {
    if (!canManageCampaign(actor, c)) {
      await i.reply({ content: `Ces boutons sont réservés au MJ de « ${c.name} ».`, flags: eph });
      return true;
    }
    return handleMj(i, deps, c, scope, action, rest);
  }

  if (!isCampaignMember(actor, c)) {
    await i.reply({ content: `Tu ne fais pas partie de « ${c.name} ». Demande au MJ de t’ajouter.`, flags: eph });
    return true;
  }
  const userId = i.user.id;

  if (scope === "panel" && i.isButton()) {
    if (action === "perso") {
      const wizard = deps.store.getWizard(guildId, userId);
      if (wizard) {
        const msg = renderWizard(wizard, [], `Reprise de ta création en cours${wizard.campaignName && wizard.campaignId !== c.channelId ? ` (campagne « ${wizard.campaignName} »)` : ""}.`);
        await i.reply({ content: msg.content, components: msg.components, flags: eph });
        return true;
      }
      const ch = deps.store.activeCharacter(guildId, userId, c.channelId) ?? deps.store.latestCharacter(guildId, userId, c.channelId);
      if (!ch) {
        const siteLink = siteButton("Le créer sur le site", "/personnages");
        if (!siteLink) {
          await i.showModal(nameModal(c.channelId));
          return true;
        }
        await i.reply({
          content: "Tu n’as pas encore de personnage dans cette campagne. Le plus simple : le créer sur le site, avec ton compte Discord. Tu peux aussi le créer ici.",
          components: [row(siteLink, button(`panel:new:${c.channelId}`, "Le créer dans Discord"))],
          flags: eph,
        });
        return true;
      }
      const sheetLink = siteButton("Ma fiche sur le site", `/personnages/${ch.id}`);
      await i.reply({
        content: `Ton personnage dans « ${c.name} » : ${characterLabel(ch)}.`,
        components: [
          row(
            button(`panel:sheet:${c.channelId}:${ch.id}`, "Voir la fiche", ButtonStyle.Primary),
            button(`panel:pdf:${c.channelId}:${ch.id}`, "Fiche PDF"),
            ...(sheetLink ? [sheetLink] : []),
            button(`panel:new:${c.channelId}`, "Créer un autre personnage"),
          ),
        ],
        flags: eph,
      });
      return true;
    }
    if (action === "new") {
      await i.showModal(nameModal(c.channelId));
      return true;
    }
    if (action === "sheet" || action === "pdf") {
      const ch = deps.store.getCharacter(Number(rest[1]));
      if (!ch || ch.userId !== userId) {
        await i.reply({ content: "Fiche introuvable.", flags: eph });
        return true;
      }
      if (action === "pdf") {
        await i.deferReply({ flags: eph });
        await i.editReply({ content: `Fiche : ${characterLabel(ch)}`, files: [await pdfFor(i, ch)] });
        return true;
      }
      const v = validateDraft(ch.draft);
      await replyLong(i, v.sheet ? sheetDiscordText(v.sheet) : `Cette fiche ne peut pas être calculée : ${v.errors.join(" ")}`);
      return true;
    }
    if (action === "rappel") {
      const r = lastRecap(deps.store, c.channelId);
      await replyLong(i, r.ok ? `**${c.name} : rappel de la séance ${r.value.number}**\n\n${r.value.recap}` : r.error);
      return true;
    }
    if (action === "seance") {
      const next = deps.store.getNextSession(c.channelId);
      const upcoming = next && new Date(next.startsAt).getTime() > Date.now();
      await i.reply({
        content: upcoming ? `Prochaine séance de « ${c.name} » : ${discordTime(new Date(next.startsAt))}.${next.note ? `\nNote du MJ : ${next.note}` : ""}` : `Pas encore de date pour la prochaine séance de « ${c.name} ».`,
        flags: eph,
      });
      return true;
    }
    if (action === "carnet") {
      await replyLong(i, renderCarnet(c.name, deps.store.listCarnet(c.channelId)));
      return true;
    }
    if (action === "notes") {
      await i.showModal(notesModal(c.channelId, deps.store.pendingPlayerNote(c.channelId, userId)?.text));
      return true;
    }
    if (action === "chercher") {
      await i.showModal(searchModal(c.channelId));
      return true;
    }
  }

  if (scope === "panelm" && i.isModalSubmit()) {
    if (action === "create") {
      const nom = i.fields.getTextInputValue("nom").trim();
      if (nom.length < 2) {
        await i.reply({ content: "Le nom doit faire au moins 2 caractères.", flags: eph });
        return true;
      }
      const state = beginCreation(deps.store, guildId, userId, c, nom);
      const msg = renderWizard(state);
      await i.reply({ content: msg.content, components: msg.components, flags: eph });
      return true;
    }
    if (action === "notes") {
      const text = i.fields.getTextInputValue("texte").trim();
      if (!text) {
        await i.reply({ content: "Note vide : rien n’a été enregistré.", flags: eph });
        return true;
      }
      deps.store.savePlayerNote(c.channelId, userId, text);
      await i.reply({ content: "Merci ! Ta note est transmise au MJ pour le prochain rappel. Tu peux la modifier avec le même bouton tant que le rappel n’est pas publié.", flags: eph });
      return true;
    }
    if (action === "chercher") {
      await i.deferReply({ flags: eph });
      await replyLong(i, lookup(i.fields.getTextInputValue("terme")).join("\n\n"));
      return true;
    }
  }

  await i.reply({ content: "Action inconnue. Le tableau de bord a peut-être changé : demande au MJ de le republier (/campagne panneau).", flags: eph });
  return true;
}

async function handleMj(i: Extract<Interaction, { customId: string }> & RepliableInteraction, deps: Deps, c: Campaign, scope: string, action: string, rest: string[]): Promise<boolean> {
  if (scope === "mj" && i.isButton()) {
    if (action === "seance") {
      await i.showModal(buildNotesModal(c.channelId));
      return true;
    }
    if (action === "prep") {
      const type = rest[0] ?? "";
      if (isPrepType(type)) await i.showModal(buildPrepModal(type, c.channelId, { party: partyDefault(deps.store, c.channelId) }));
      else await i.reply({ content: "Type de préparation inconnu.", flags: eph });
      return true;
    }
    if (action === "date") {
      await i.showModal(dateModal(c.channelId));
      return true;
    }
    if (action === "echeance") {
      await i.showModal(deadlineModal(c.channelId));
      return true;
    }
    if (action === "groupe") {
      await sendGroupSheet(i, deps, c);
      return true;
    }
    if (action === "suivi") {
      await replyLong(i, renderProgress(c, campaignProgress(deps.store, c)));
      return true;
    }
  }
  if (scope === "mjm" && i.isModalSubmit()) {
    if (action === "date") {
      await fixNextSession(i, c, deps, i.fields.getTextInputValue("date"), i.fields.getTextInputValue("heure"), i.fields.getTextInputValue("note").trim());
      return true;
    }
    if (action === "echeance") {
      await i.reply({ content: setDeadline(deps, c, i.fields.getTextInputValue("date")), flags: eph });
      return true;
    }
  }
  await i.reply({ content: "Ce bouton n’existe plus : republie le tableau de bord avec /campagne panneau.", flags: eph });
  return true;
}
