import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";
import type { Deps } from "./commands.js";
import { campaignsOfMember, resolveCampaign, type CampaignResult } from "./campaigns.js";
import type { Campaign } from "./db.js";
import { guildPort } from "./guild-port.js";
import { canManageCampaign, type Actor } from "./permissions.js";
import { createCampaign } from "./service.js";
import { runSetup } from "./setup.js";
import { ARCHIVE_CATEGORY, archiveCampaignDiscord, deleteCampaignDiscord, reportText, restoreCampaignDiscord } from "./archive.js";
import { describeRules } from "./character/rules.js";
import { STYLE_FIELDS, STYLE_MAX, describeStyle, normalizeStyle } from "./style.js";
import { DISCORD_UPLOAD_LIMIT, buildCampaignExport } from "./export.js";
import { REMINDER_AHEAD_MS, TIMEZONE, discordTime, formatLocal, parseSessionDate } from "./time.js";

const eph = MessageFlags.Ephemeral;

/** Option « campagne » commune (autocomplétion parmi les campagnes du serveur). */
export const campaignOption = (required = false) => (o: import("discord.js").SlashCommandStringOption) =>
  o.setName("campagne").setDescription("Campagne concernée (par défaut : celle du salon ou la tienne)").setRequired(required).setAutocomplete(true);

export const setupCommand = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Créer une campagne : sa catégorie, ses salons et ses rôles MJ et Joueurs")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild)
  .addStringOption((o) => o.setName("nom").setDescription("Nom de la campagne").setRequired(true).setMaxLength(80))
  .addUserOption((o) => o.setName("mj").setDescription("Membre qui reçoit le rôle MJ de cette campagne"))
  .addBooleanOption((o) => o.setName("public").setDescription("Salons visibles par tout le serveur (par défaut : réservés à la table)"));

export const campagneCommand = new SlashCommandBuilder()
  .setName("campagne")
  .setDescription("Campagnes du serveur : liste, détails, joueurs, archivage")
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s.setName("liste").setDescription("Lister les campagnes du serveur"))
  .addSubcommand((s) => s.setName("infos").setDescription("Détails d’une campagne").addStringOption(campaignOption()))
  .addSubcommand((s) => s.setName("panneau").setDescription("MJ : republier et épingler les tableaux de bord (joueurs et MJ)").addStringOption(campaignOption()))
  .addSubcommand((s) => s.setName("groupe").setDescription("MJ : fiche de groupe sur une page (CA, PV, perception passive…) en PDF").addStringOption(campaignOption()))
  .addSubcommand((s) => s.setName("suivi").setDescription("MJ : où en est chaque joueur dans la création de son personnage").addStringOption(campaignOption()))
  .addSubcommand((s) =>
    s
      .setName("ajouter-joueur")
      .setDescription("MJ : donner le rôle Joueurs de la campagne à un membre")
      .addUserOption((o) => o.setName("joueur").setDescription("Membre à ajouter").setRequired(true))
      .addStringOption(campaignOption()),
  )
  .addSubcommand((s) =>
    s
      .setName("retirer-joueur")
      .setDescription("MJ : retirer le rôle Joueurs de la campagne à un membre")
      .addUserOption((o) => o.setName("joueur").setDescription("Membre à retirer").setRequired(true))
      .addStringOption(campaignOption()),
  )
  .addSubcommand((s) =>
    s
      .setName("configurer")
      .setDescription("MJ : rattacher un rôle Joueurs existant (campagne créée avant les campagnes multiples)")
      .addRoleOption((o) => o.setName("joueurs").setDescription("Rôle des joueurs de cette campagne").setRequired(true))
      .addStringOption(campaignOption()),
  )
  .addSubcommand((s) =>
    s
      .setName("exporter")
      .setDescription("MJ : PDF à imprimer (rappels de toutes les séances, puis fiches des personnages)")
      .addStringOption(campaignOption())
      .addBooleanOption((o) => o.setName("fiches").setDescription("Inclure les fiches des personnages (oui par défaut)")),
  )
  .addSubcommand((s) =>
    s.setName("archiver").setDescription("MJ : ranger les salons dans Archives et supprimer les rôles (données conservées)").addStringOption(campaignOption(true)),
  )
  .addSubcommand((s) =>
    s.setName("reactiver").setDescription("Administrateur : réactiver une campagne archivée (rôles et catégorie recréés)").addStringOption(campaignOption(true)),
  )
  .addSubcommand((s) =>
    s
      .setName("creer")
      .setDescription("Administrateur : créer une campagne (catégorie, salons, rôles), depuis n’importe quel salon")
      .addStringOption((o) => o.setName("nom").setDescription("Nom de la campagne").setRequired(true).setMaxLength(80))
      .addUserOption((o) => o.setName("mj").setDescription("Membre qui reçoit le rôle MJ de cette campagne"))
      .addBooleanOption((o) => o.setName("public").setDescription("Salons visibles par tout le serveur (par défaut : réservés à la table)")),
  )
  .addSubcommand((s) =>
    s
      .setName("supprimer")
      .setDescription("Administrateur : tout supprimer (salons, rôles, rappels, personnages), avec confirmation")
      .addStringOption(campaignOption(true)),
  );

/** Campagne visée par une interaction (option, salon, rôle, ou seule campagne du serveur). */
export function campaignFor(i: Interaction, deps: Deps, actor: Actor, name?: string | null): CampaignResult {
  const ch = i.channel;
  const parentId = ch && "parentId" in ch ? (ch.parentId ?? null) : null;
  return resolveCampaign(deps.store, { guildId: i.guildId ?? "", name: name ?? null, channelId: i.channelId, parentId, roleIds: actor.roleIds });
}

export function describeCampaign(deps: Deps, c: Campaign): string {
  const chars = deps.store.listCharacters(c.guildId, c.channelId);
  const sessions = deps.store.latestSession(c.channelId)?.number ?? 0;
  return [
    `**${c.name}**${c.archived ? " (archivée)" : ""}`,
    `MJ : <@&${c.mjRoleId}>${c.playerRoleId ? ` · Joueurs : <@&${c.playerRoleId}>` : ""}`,
    `Salons : rappels <#${c.channelId}>${c.sheetsChannelId ? `, fiches <#${c.sheetsChannelId}>` : ""}${c.prepChannelId ? `, aide MJ <#${c.prepChannelId}>` : ""}`,
    `Séances publiées : ${sessions} · Personnages : ${chars.length}${chars.length ? ` (${chars.map((x) => x.name).join(", ")})` : ""}`,
    describeRules(c.creationRules),
  ].join("\n");
}

export async function handleSetup(i: ChatInputCommandInteraction, deps: Deps, actor: Actor): Promise<void> {
  if (!actor.isAdministrator || !i.guild) {
    await i.reply({ content: "Seul un administrateur du serveur peut faire cela.", flags: eph });
    return;
  }
  await i.deferReply({ flags: eph });
  const name = i.options.getString("nom", true).trim();
  const taken = deps.store.listCampaigns(i.guild.id, true).find((c) => c.name.toLowerCase() === name.toLowerCase() && c.categoryId === null);
  if (taken) {
    await i.editReply({
      content: `Le nom « ${name} » est déjà pris par une ancienne campagne déclarée dans un salon. Choisis un autre nom, ou supprime-la d’abord avec /campagne supprimer.`,
    });
    return;
  }
  try {
    const port = guildPort(i.guild, i.client.user.id);
    const res = await runSetup(port, name, { public: i.options.getBoolean("public") ?? false });
    const lines = [
      res.created.length ? `Créé : ${res.created.join(", ")}.` : "Rien à créer.",
      res.reused.length ? `Déjà présent, laissé tel quel : ${res.reused.join(", ")}.` : "",
    ];
    const sameName = deps.store.listCampaigns(i.guild.id, true).find((c) => c.name.toLowerCase() === name.toLowerCase() && c.channelId !== res.recapChannelId);
    if (sameName) lines.push(`Attention : une autre campagne s’appelle déjà « ${sameName.name} ».`);
    if (deps.store.getCampaign(res.recapChannelId)) lines.push("La campagne existait déjà : structure vérifiée.");
    else {
      const c = createCampaign(deps.store, actor, { channelId: res.recapChannelId, guildId: i.guild.id, name, mjRoleId: res.mjRoleId });
      lines.push(c.ok ? `Campagne « ${c.value.name} » créée.` : c.error);
    }
    deps.store.setCampaignStructure(res.recapChannelId, {
      prepChannelId: res.prepChannelId,
      sheetsChannelId: res.sheetsChannelId,
      playerRoleId: res.playerRoleId,
      categoryId: res.categoryId,
    });
    const mj = i.options.getUser("mj");
    if (mj) {
      await port.addMemberRole(mj.id, res.mjRoleId);
      lines.push(`<@${mj.id}> reçoit le rôle <@&${res.mjRoleId}>.`);
    } else lines.push(`Donne le rôle <@&${res.mjRoleId}> au MJ.`);
    lines.push(`Ajoute les joueurs avec /campagne ajouter-joueur : chacun reçoit un message d’accueil avec un bouton pour créer son personnage.`);
    const created = deps.store.getCampaign(res.recapChannelId);
    if (created && !created.panelMessageId) {
      const { postPanels } = await import("./panel.js");
      const notes = await postPanels(i.client, deps, created);
      lines.push(`Tableaux de bord épinglés dans <#${res.recapChannelId}> (joueurs) et <#${res.prepChannelId}> (MJ).`, ...notes);
    }
    await i.editReply({ content: lines.filter(Boolean).join("\n"), allowedMentions: { parse: [] } });
  } catch (e) {
    await i.editReply({
      content: `La configuration a échoué (le bot a-t-il les droits Gérer les salons et Gérer les rôles, et son rôle est-il au-dessus des rôles de campagne ?). Détail : ${e instanceof Error ? e.message : "erreur inconnue"}`,
    });
  }
}

export async function handleCampagne(i: ChatInputCommandInteraction, deps: Deps, actor: Actor): Promise<void> {
  const guildId = i.guildId ?? "";
  const sub = i.options.getSubcommand();

  if (sub === "liste") {
    const all = deps.store.listCampaigns(guildId, true);
    const mine = new Map(campaignsOfMember(deps.store, guildId, actor.roleIds).map((m) => [m.campaign.channelId, m.mj]));
    const text = all.length
      ? all
          .map((c) => {
            const role = mine.has(c.channelId) ? (mine.get(c.channelId) ? " · tu es MJ" : " · tu joues") : "";
            return `• **${c.name}**${c.archived ? " (archivée)" : ""} : <#${c.channelId}>, ${deps.store.listCharacters(guildId, c.channelId).length} personnage(s)${role}`;
          })
          .join("\n")
      : "Aucune campagne. Un administrateur peut en créer une avec /setup.";
    await i.reply({ content: text.slice(0, 1990), flags: eph, allowedMentions: { parse: [] } });
    return;
  }

  if (sub === "creer") {
    await handleSetup(i, deps, actor);
    return;
  }

  const found = campaignFor(i, deps, actor, i.options.getString("campagne"));
  if (!found.ok) {
    await i.reply({ content: found.error, flags: eph });
    return;
  }
  const c = found.campaign;

  if (sub === "supprimer") {
    if (!actor.isAdministrator) {
      await i.reply({ content: "Seul un administrateur du serveur peut supprimer une campagne.", flags: eph });
      return;
    }
    const chars = deps.store.listCharacters(c.guildId, c.channelId).length;
    const sessions = deps.store.allSessions(c.channelId).length;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`camp:del:${c.channelId}`).setLabel("Supprimer définitivement").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("camp:keep").setLabel("Garder").setStyle(ButtonStyle.Secondary),
    );
    await i.reply({
      content: `Supprimer « ${c.name} » ? Ses salons (y compris ceux rangés dans ${ARCHIVE_CATEGORY}), sa catégorie et ses rôles « MJ ${c.name} » et « Joueurs ${c.name} » seront supprimés de Discord, et ses ${sessions} rappel(s) et ${chars} personnage(s) effacés du bot, sans retour possible. Pour garder l’historique, préfère /campagne archiver.`,
      components: [row],
      flags: eph,
    });
    return;
  }

  if (sub === "infos") {
    await i.reply({ content: describeCampaign(deps, c).slice(0, 1990), flags: eph, allowedMentions: { parse: [] } });
    return;
  }

  if (!canManageCampaign(actor, c)) {
    await i.reply({ content: `Seuls le MJ de « ${c.name} » ou un administrateur peuvent faire cela.`, flags: eph });
    return;
  }

  if (sub === "exporter") {
    await i.deferReply({ flags: eph });
    try {
      const chars = deps.store.listCharacters(c.guildId, c.channelId);
      const players = new Map<string, string>();
      for (const ch of chars) {
        if (players.has(ch.userId)) continue;
        const m = await i.guild?.members.fetch(ch.userId).catch(() => null);
        players.set(ch.userId, m?.displayName ?? "joueur parti");
      }
      const pdf = await buildCampaignExport(
        c,
        deps.store.allSessions(c.channelId),
        chars.map((ch) => ({ name: ch.name, player: players.get(ch.userId) ?? "?", draft: ch.draft })),
        { sheets: i.options.getBoolean("fiches") ?? true },
      );
      if (pdf.length > DISCORD_UPLOAD_LIMIT) {
        await i.editReply({
          content: `Le PDF fait ${(pdf.length / 1024 / 1024).toFixed(1)} Mo, au-delà de la limite d’envoi de Discord (10 Mo). Relance avec fiches:false, puis exporte les fiches avec /personnage fiche.`,
        });
        return;
      }
      const file = `${c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "campagne"}.pdf`;
      await i.editReply({
        content: `Export de « ${c.name} » : ${deps.store.allSessions(c.channelId).length} rappel(s) et ${chars.length} fiche(s).`,
        files: [new AttachmentBuilder(pdf, { name: file })],
      });
    } catch (e) {
      await i.editReply({ content: `L’export a échoué : ${e instanceof Error ? e.message : "erreur inconnue"}` });
    }
    return;
  }

  if (sub === "panneau" || sub === "groupe" || sub === "suivi") {
    const panel = await import("./panel.js");
    if (sub === "groupe") {
      await panel.sendGroupSheet(i, deps, c);
      return;
    }
    if (sub === "suivi") {
      const { campaignProgress, renderProgress } = await import("./tracking.js");
      const text = renderProgress(c, campaignProgress(deps.store, c));
      await i.reply({ content: text.slice(0, 1990), flags: eph, allowedMentions: { parse: [] } });
      return;
    }
    await i.deferReply({ flags: eph });
    const notes = await panel.postPanels(i.client, deps, c);
    await i.editReply({ content: ["Tableaux de bord republiés et épinglés (les anciens sont supprimés).", ...notes].join("\n"), allowedMentions: { parse: [] } });
    return;
  }

  if (sub === "configurer") {
    const role = i.options.getRole("joueurs", true);
    const recap = await i.client.channels.fetch(c.channelId).catch(() => null);
    const categoryId = recap && "parentId" in recap && recap.parentId ? recap.parentId : undefined;
    deps.store.setCampaignStructure(c.channelId, { playerRoleId: role.id, ...(categoryId ? { categoryId } : {}) });
    await i.reply({
      content: `« ${c.name} » : rôle Joueurs <@&${role.id}>${categoryId ? ", et les commandes tapées dans sa catégorie s’y appliquent désormais" : ""}.`,
      flags: eph,
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (sub === "archiver") {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`camp:arch:${c.channelId}`).setLabel("Archiver").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("camp:keep").setLabel("Annuler").setStyle(ButtonStyle.Secondary),
    );
    await i.reply({
      content: [
        `Archiver « ${c.name} » ?${c.archived ? " (Elle est déjà archivée : je range ce qui reste.)" : ""}`,
        `• Ses salons vont dans la catégorie ${ARCHIVE_CATEGORY}, renommés avec le nom de la campagne : lecture seule pour tout le serveur, sauf #aide-mj (notes du MJ) visible des seuls administrateurs.`,
        `• Sa catégorie et ses rôles « MJ ${c.name} » et « Joueurs ${c.name} » sont supprimés, la séance prévue est annulée.`,
        `• Les rappels et les personnages restent dans le bot : /campagne exporter et /personnage fiche fonctionnent avec l’option campagne. Un administrateur peut la réactiver avec /campagne reactiver.`,
      ].join("\n"),
      components: [row],
      flags: eph,
    });
    return;
  }

  if (sub === "reactiver") {
    if (!actor.isAdministrator || !i.guild) {
      await i.reply({ content: "Seul un administrateur du serveur peut réactiver une campagne (ses rôles ont été supprimés à l’archivage).", flags: eph });
      return;
    }
    if (!c.archived) {
      await i.reply({ content: `« ${c.name} » n’est pas archivée.`, flags: eph });
      return;
    }
    await i.deferReply({ flags: eph });
    const report = await restoreCampaignDiscord(guildPort(i.guild, i.client.user.id), c);
    deps.store.setArchivedChannels(c.channelId, report.channels);
    const lines: string[] = [];
    if (report.setup) {
      const st = report.setup;
      deps.store.setCampaignStructure(c.channelId, {
        mjRoleId: st.mjRoleId,
        playerRoleId: st.playerRoleId,
        categoryId: st.categoryId,
        prepChannelId: st.prepChannelId,
        sheetsChannelId: st.sheetsChannelId,
      });
      deps.store.setArchived(c.channelId, false);
      if (st.recapChannelId !== c.channelId) {
        lines.push(`Attention : le salon de rappel d’origine n’a pas été retrouvé. Les rappels automatiques visent toujours l’ancien salon <#${c.channelId}>.`);
      }
      const owners = [...new Set(deps.store.listCharacters(c.guildId, c.channelId).map((x) => x.userId))];
      lines.push(
        `Donne le rôle <@&${st.mjRoleId}> au MJ et rajoute les joueurs avec /campagne ajouter-joueur${owners.length ? ` (ont un personnage : ${owners.map((u) => `<@${u}>`).join(", ")})` : ""}.`,
      );
    }
    await i.editReply({
      content: (reportText(report.setup ? `« ${c.name} » est de nouveau active.` : `La réactivation de « ${c.name} » n’a pas abouti.`, report) + (lines.length ? `\n${lines.join("\n")}` : "")).slice(0, 1990),
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (sub === "ajouter-joueur" || sub === "retirer-joueur") {
    if (!c.playerRoleId || !i.guild) {
      await i.reply({ content: `« ${c.name} » n’a pas de rôle Joueurs. Relance /setup nom:${c.name} pour le créer, ou donne le rôle à la main.`, flags: eph });
      return;
    }
    const user = i.options.getUser("joueur", true);
    try {
      const port = guildPort(i.guild, i.client.user.id);
      if (sub === "ajouter-joueur") {
        await port.addMemberRole(user.id, c.playerRoleId);
        deps.store.addPlayer(c.channelId, user.id);
      } else {
        await port.removeMemberRole(user.id, c.playerRoleId);
        deps.store.removePlayer(c.channelId, user.id);
      }
      let welcomed = false;
      if (sub === "ajouter-joueur") {
        const { welcomePlayer } = await import("./panel.js");
        welcomed = await welcomePlayer(i.client, c, user.id).catch(() => false);
      }
      await i.reply({
        content:
          sub === "ajouter-joueur"
            ? `<@${user.id}> rejoint « ${c.name} ».${welcomed ? ` Un message d’accueil l’attend dans <#${c.channelId}>, avec le bouton pour créer son personnage.` : ""}`
            : `<@${user.id}> quitte « ${c.name} » (ses personnages sont conservés).`,
        flags: eph,
        allowedMentions: { parse: [] },
      });
    } catch (e) {
      await i.reply({
        content: `Impossible de changer le rôle (le rôle du bot doit être au-dessus de <@&${c.playerRoleId}>). Détail : ${e instanceof Error ? e.message : "erreur inconnue"}`,
        flags: eph,
        allowedMentions: { parse: [] },
      });
    }
  }
}

export const nextSessionCommand = new SlashCommandBuilder()
  .setName("prochaine-seance")
  .setDescription("Voir la prochaine séance, ou (MJ) la fixer : rappel automatique 24 h avant")
  .setContexts(InteractionContextType.Guild)
  .addStringOption((o) => o.setName("date").setDescription("JJ/MM/AAAA, par exemple 04/11/2026").setMaxLength(10))
  .addStringOption((o) => o.setName("heure").setDescription("20:30 ou 20h30").setMaxLength(5))
  .addStringOption((o) => o.setName("note").setDescription("Lieu, chose à apporter… (facultatif)").setMaxLength(300))
  .addBooleanOption((o) => o.setName("annuler").setDescription("Annuler la séance prévue"))
  .addStringOption(campaignOption());

export async function handleNextSession(i: ChatInputCommandInteraction, deps: Deps, actor: Actor): Promise<void> {
  const found = campaignFor(i, deps, actor, i.options.getString("campagne"));
  if (!found.ok) {
    await i.reply({ content: found.error, flags: eph });
    return;
  }
  const c = found.campaign;
  const date = i.options.getString("date");
  const time = i.options.getString("heure");
  const cancel = i.options.getBoolean("annuler") ?? false;

  if (!date && !time && !cancel) {
    const next = deps.store.getNextSession(c.channelId);
    const upcoming = next && new Date(next.startsAt).getTime() > Date.now();
    await i.reply({
      content: upcoming
        ? `Prochaine séance de « ${c.name} » : ${discordTime(new Date(next.startsAt))}.${next.note ? `\nNote du MJ : ${next.note}` : ""}`
        : `Aucune séance prévue pour « ${c.name} ».`,
      flags: eph,
    });
    return;
  }
  if (!canManageCampaign(actor, c)) {
    await i.reply({ content: `Seuls le MJ de « ${c.name} » ou un administrateur peuvent fixer la séance.`, flags: eph });
    return;
  }
  if (cancel) {
    deps.store.clearNextSession(c.channelId);
    await i.reply({ content: `Séance prévue de « ${c.name} » annulée : aucun rappel ne partira.`, flags: eph });
    return;
  }
  if (!date || !time) {
    await i.reply({ content: "Indique la date et l’heure, par exemple date:04/11/2026 heure:20:30.", flags: eph });
    return;
  }
  await fixNextSession(i, c, deps, date, time, i.options.getString("note")?.trim() ?? "");
}

/** Fixe la séance (commande /prochaine-seance ou tableau de bord du MJ), répond au MJ et l'annonce aux joueurs. */
export async function fixNextSession(
  i: ChatInputCommandInteraction | import("discord.js").ModalSubmitInteraction,
  c: Campaign,
  deps: Deps,
  date: string,
  time: string,
  note: string,
): Promise<void> {
  const parsed = parseSessionDate(date, time);
  if (!parsed.ok) {
    await i.reply({ content: parsed.error, flags: eph });
    return;
  }
  deps.store.setNextSession(c.channelId, parsed.date.toISOString(), note);
  const soon = parsed.date.getTime() - Date.now() <= REMINDER_AHEAD_MS;
  await i.reply({
    content: `Séance de « ${c.name} » fixée au ${formatLocal(parsed.date)} (${TIMEZONE}). ${
      soon ? "Elle commence dans moins de 24 h : le rappel part dans les prochaines minutes." : "Un rappel sera publié 24 h avant dans le salon de rappel."
    }`,
    flags: eph,
  });
  // Annonce publique dans le salon de rappel de la campagne.
  const channel = await i.client.channels.fetch(c.channelId).catch(() => null);
  if (channel && channel.isSendable()) {
    const roles = c.playerRoleId ? [c.playerRoleId] : [];
    await channel.send({
      content: `${roles.map((r) => `<@&${r}> `).join("")}Prochaine séance de « ${c.name} » : ${discordTime(parsed.date)}.${note ? `\nNote du MJ : ${note}` : ""}`,
      allowedMentions: { roles },
    });
  }
}

/** Boutons « camp:… » (confirmation d’archivage ou de suppression). Retourne true si l'interaction a été traitée. */
export async function handleCampaignButton(i: Interaction, deps: Deps, actor: Actor): Promise<boolean> {
  if (!i.isButton() || !i.customId.startsWith("camp:")) return false;
  const [, action, id] = i.customId.split(":");
  if (action === "keep") {
    await i.update({ content: "Rien n’a été modifié.", components: [] });
    return true;
  }
  if (action === "arch" && id) {
    const c = deps.store.getCampaign(id);
    if (!c || c.guildId !== i.guildId || !i.guild) {
      await i.update({ content: "Campagne introuvable.", components: [] });
      return true;
    }
    if (!canManageCampaign(actor, c)) {
      await i.update({ content: `Seuls le MJ de « ${c.name} » ou un administrateur peuvent l’archiver.`, components: [] });
      return true;
    }
    await i.update({ content: `Archivage de « ${c.name} » en cours…`, components: [] });
    const report = await archiveCampaignDiscord(guildPort(i.guild, i.client.user.id), c);
    deps.store.setArchived(id, true);
    deps.store.setArchivedChannels(id, report.channels);
    deps.store.clearNextSession(id);
    await i
      .editReply({ content: reportText(`« ${c.name} » est archivée. Ses rappels et personnages restent dans le bot.`, report) })
      .catch(() => undefined);
    return true;
  }
  if (action === "del" && id) {
    const c = deps.store.getCampaign(id);
    if (!c || c.guildId !== i.guildId || !i.guild) {
      await i.update({ content: "Campagne introuvable.", components: [] });
      return true;
    }
    if (!actor.isAdministrator) {
      await i.update({ content: "Seul un administrateur du serveur peut supprimer une campagne.", components: [] });
      return true;
    }
    await i.update({ content: `Suppression de « ${c.name} » en cours…`, components: [] });
    const report = await deleteCampaignDiscord(guildPort(i.guild, i.client.user.id), c);
    // Les données ne sont effacées que si Discord a suivi : sinon la commande peut être relancée.
    if (!report.error) deps.store.deleteCampaign(id);
    // Si la commande a été lancée depuis un salon de la campagne, ce message disparaît avec lui.
    await i
      .editReply({ content: reportText(report.error ? `« ${c.name} » n’est pas entièrement supprimée : ses données sont conservées.` : `« ${c.name} » est supprimée.`, report) })
      .catch(() => undefined);
  }
  return true;
}

export const styleCommand = new SlashCommandBuilder()
  .setName("style")
  .setDescription("Guide de style d’une campagne, suivi par l’assistant (rappels, préparation, idées)")
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s.setName("voir").setDescription("Afficher le guide de style").addStringOption(campaignOption()))
  .addSubcommand((s) => s.setName("modifier").setDescription("MJ : écrire ou modifier le guide de style").addStringOption(campaignOption()))
  .addSubcommand((s) => s.setName("effacer").setDescription("MJ : effacer le guide de style").addStringOption(campaignOption()));

export function buildStyleModal(c: Campaign): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(`style:${c.channelId}`).setTitle(`Style : ${c.name}`.slice(0, 45));
  modal.addComponents(
    STYLE_FIELDS.map((f) => {
      const input = new TextInputBuilder()
        .setCustomId(f.id)
        .setLabel(f.label)
        .setPlaceholder(f.placeholder)
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(STYLE_MAX)
        .setRequired(false);
      const current = c.style[f.id];
      if (current) input.setValue(current);
      return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    }),
  );
  return modal;
}

export async function handleStyle(i: ChatInputCommandInteraction, deps: Deps, actor: Actor): Promise<void> {
  const found = campaignFor(i, deps, actor, i.options.getString("campagne"));
  if (!found.ok) {
    await i.reply({ content: found.error, flags: eph });
    return;
  }
  const c = found.campaign;
  const sub = i.options.getSubcommand();
  if (sub === "voir") {
    await i.reply({ content: `**Guide de style : ${c.name}**\n${describeStyle(c.style)}`.slice(0, 1990), flags: eph });
    return;
  }
  if (!canManageCampaign(actor, c)) {
    await i.reply({ content: `Seuls le MJ de « ${c.name} » ou un administrateur peuvent modifier son style.`, flags: eph });
    return;
  }
  if (sub === "effacer") {
    deps.store.setStyle(c.channelId, {});
    await i.reply({ content: `Guide de style de « ${c.name} » effacé.`, flags: eph });
    return;
  }
  await i.showModal(buildStyleModal(c));
}

/** Formulaire /style modifier. Retourne true si l'interaction a été traitée. */
export async function handleStyleModal(i: Interaction, deps: Deps, actor: Actor): Promise<boolean> {
  if (!i.isModalSubmit() || !i.customId.startsWith("style:")) return false;
  const c = deps.store.getCampaign(i.customId.slice("style:".length));
  if (!c || !canManageCampaign(actor, c)) {
    await i.reply({ content: "Campagne introuvable ou action non autorisée.", flags: eph });
    return true;
  }
  const style = Object.fromEntries(STYLE_FIELDS.map((f) => [f.id, i.fields.getTextInputValue(f.id)]));
  deps.store.setStyle(c.channelId, normalizeStyle(style));
  const saved = deps.store.getCampaign(c.channelId)!;
  await i.reply({
    content: `Guide de style de « ${c.name} » enregistré. Il s’applique aux prochains rappels (/seance), préparations (/preparer) et idées de personnage.\n\n${describeStyle(saved.style)}`.slice(0, 1990),
    flags: eph,
  });
  return true;
}
