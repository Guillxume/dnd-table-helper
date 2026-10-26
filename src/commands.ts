import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";
import { randomUUID } from "node:crypto";
import type { Store } from "./db.js";
import { canManageCampaign, type Actor } from "./permissions.js";
import { NOTE_FIELDS, formatNotes } from "./notes.js";
import { PREP_FORMS, PREP_TYPES, isPrepType, type PrepType } from "./prep.js";
import { GUIDE_CLASS_IDS, guideClass, renderClassGuide, renderOverview } from "./guide/index.js";
import { describeRules, updateRules } from "./character/rules.js";
import { itemText, searchItems } from "./srd/items.js";
import { renderHelp } from "./help.js";
import {
  campagneCommand,
  campaignFor,
  campaignOption,
  handleCampagne,
  handleCampaignButton,
  handleNextSession,
  handleStyle,
  handleStyleModal,
  styleCommand,
  handleSetup,
  nextSessionCommand,
  setupCommand,
} from "./campaign-commands.js";
import { campaignChoices, campaignsOfMember } from "./campaigns.js";
import { handleCharacterCommand, handleCharacterInteraction, personnageCommand } from "./character/handlers.js";
import { generatePrep, generateRecap, lastRecap, publishRecap } from "./service.js";
import type { Completer } from "./summarize.js";
import { DISCORD_MESSAGE_LIMIT, splitMessage } from "./text.js";
import { discordTime } from "./time.js";
import { encodePicks, encounterMessage, handlePanelInteraction, setDeadline } from "./panel.js";
import { parseCreatureList } from "./encounter.js";
import { getClass } from "./srd/index.js";
import { lookup, lookupChoices } from "./lookup.js";
import { searchCreatures } from "./srd/creatures.js";
import type { Difficulty } from "./encounter.js";
import { applyCarnet, extractCarnet, renderCarnet, CARNET_TITLES } from "./carnet.js";
import type { CarnetKind } from "./db.js";

export const commandDefinitions = [
  campagneCommand,
  setupCommand,
  nextSessionCommand,
  styleCommand,
  new SlashCommandBuilder()
    .setName("seance")
    .setDescription("MJ : saisir les notes de la séance pour générer le rappel")
    .setContexts(InteractionContextType.Guild)
    .addStringOption(campaignOption()),
  new SlashCommandBuilder()
    .setName("preparer")
    .setDescription("MJ : obtenir un brouillon de scène, de PNJ ou de rencontre")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("Ce que vous voulez préparer")
        .setRequired(true)
        .addChoices(...(Object.entries(PREP_TYPES) as [PrepType, string][]).map(([value, name]) => ({ name, value }))),
    )
    .addStringOption(campaignOption()),
  new SlashCommandBuilder()
    .setName("rappel")
    .setDescription("Afficher le rappel de la dernière séance")
    .setContexts(InteractionContextType.Guild)
    .addStringOption(campaignOption()),
  personnageCommand,
  new SlashCommandBuilder().setName("aide").setDescription("Les commandes du bot que tu peux utiliser, selon ton rôle").setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName("objet")
    .setDescription("Consulter une arme, une armure, un outil ou un objet du SRD")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName("nom").setDescription("Nom de l’objet").setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName("regles")
    .setDescription("MJ : voir ou fixer les paramètres de création de personnage")
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((o) => o.setName("niveau").setDescription("Niveau de départ").setMinValue(1).setMaxValue(20))
    .addBooleanOption((o) => o.setName("standard").setDescription("Autoriser les valeurs standard (15, 14, 13, 12, 10, 8)"))
    .addBooleanOption((o) => o.setName("achat").setDescription("Autoriser l’acquisition par points (27 points)"))
    .addBooleanOption((o) => o.setName("des").setDescription("Autoriser le tirage 4d6"))
    .addBooleanOption((o) => o.setName("table").setDescription("Autoriser les dés lancés à la table (le joueur saisit ses résultats)"))
    .addStringOption((o) =>
      o
        .setName("contenu")
        .setDescription("Contenu de jeu autorisé")
        .addChoices({ name: "Manuel des joueurs 2024 (SRD + référentiel du MJ)", value: "manuel" }, { name: "SRD 5.2.1 uniquement", value: "srd" }),
    )
    .addStringOption((o) => o.setName("echeance").setDescription("Date limite des personnages (JJ/MM/AAAA), ou « aucune » : relances à J-3 et J-1").setMaxLength(10))
    .addStringOption(campaignOption()),
  new SlashCommandBuilder()
    .setName("chercher")
    .setDescription("Chercher un sort, un objet, une créature, une espèce, une règle… (SRD et documents du MJ)")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName("terme").setDescription("Ce que tu cherches (autocomplétion, ou texte libre)").setRequired(true).setAutocomplete(true).setMaxLength(100)),
  new SlashCommandBuilder()
    .setName("rencontre")
    .setDescription("MJ : budget de PX d’une rencontre de combat (SRD 5.2.1) et blocs de statistiques à imprimer")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName("creatures").setDescription("Par exemple : 4 combattants gobelins, 1 chef gobelin").setRequired(true).setAutocomplete(true).setMaxLength(400))
    .addStringOption((o) =>
      o
        .setName("difficulte")
        .setDescription("Difficulté visée (modérée par défaut)")
        .addChoices({ name: "faible", value: "faible" }, { name: "modérée", value: "moderee" }, { name: "élevée", value: "elevee" }),
    )
    .addIntegerOption((o) => o.setName("niveau").setDescription("Niveau du groupe (1 par défaut)").setMinValue(1).setMaxValue(20))
    .addIntegerOption((o) => o.setName("personnages").setDescription("Nombre de personnages (par défaut : personnages actifs de la campagne)").setMinValue(1).setMaxValue(12))
    .addStringOption(campaignOption()),
  new SlashCommandBuilder()
    .setName("carnet")
    .setDescription("Carnet de campagne : personnages, lieux, objets et fils ouverts, tirés des rappels")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sc) => sc.setName("voir").setDescription("Afficher le carnet de la campagne").addStringOption(campaignOption()))
    .addSubcommand((sc) =>
      sc
        .setName("retirer")
        .setDescription("MJ : retirer une entrée du carnet")
        .addStringOption((o) => o.setName("entree").setDescription("Entrée à retirer").setRequired(true).setAutocomplete(true))
        .addStringOption(campaignOption()),
    ),
  new SlashCommandBuilder()
    .setName("guide")
    .setDescription("Guide d’orientation : comparer les classes et voir leurs sous-classes et jalons")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o
        .setName("classe")
        .setDescription("Classe à détailler (vide : comparaison des 12 classes)")
        .addChoices(...GUIDE_CLASS_IDS.map((id) => ({ name: guideClass(id)?.nom ?? id, value: id }))),
    ),
];

/** Autocomplétion de /rencontre : complète la dernière créature de la liste en gardant le début tapé. */
export function creatureListChoices(typed: string): { name: string; value: string }[] {
  const cut = typed.lastIndexOf(",");
  const head = cut >= 0 ? `${typed.slice(0, cut + 1).trimEnd()} ` : "";
  const last = typed.slice(cut + 1).trim();
  const count = /^(\d+)\s*[x×]?\s*/i.exec(last);
  const prefix = count ? `${count[1]} ` : "";
  const query = count ? last.slice(count[0].length) : last;
  return searchCreatures(query)
    .map((c) => `${head}${prefix}${c.name}`)
    .filter((v) => v.length <= 100)
    .map((v) => ({ name: v, value: v }));
}

export interface Deps {
  store: Store;
  complete: Completer;
}


export function actorFrom(i: Interaction): Actor {
  const m = i.member;
  const roleIds = !m ? [] : Array.isArray(m.roles) ? m.roles : [...m.roles.cache.keys()];
  return {
    isAdministrator: i.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false,
    roleIds,
  };
}

/** Publie le rappel dans le salon de rappel de la campagne (ou, à défaut, dans le salon courant). */
async function sendRecap(i: Interaction, campaignChannelId: string, text: string): Promise<void> {
  const channel = (await i.client.channels.fetch(campaignChannelId).catch(() => null)) ?? i.channel;
  if (!channel || !("send" in channel)) throw new Error("Salon non compatible avec l'envoi de messages.");
  for (const chunk of splitMessage(text)) {
    await channel.send(chunk);
  }
}

export function buildPrepModal(type: PrepType, campaignId = "", defaults: Readonly<Record<string, string>> = {}): ModalBuilder {
  const form = PREP_FORMS[type];
  const modal = new ModalBuilder().setCustomId(`prep:${type}:${campaignId}`).setTitle(form.title);
  modal.addComponents(
    form.fields.map((f) => {
      const input = new TextInputBuilder()
        .setCustomId(f.id)
        .setLabel(f.label)
        .setPlaceholder(f.placeholder)
        .setStyle(f.maxLength > 100 ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setMaxLength(f.maxLength)
        .setRequired(f.required);
      const value = defaults[f.id];
      if (value) input.setValue(value.slice(0, f.maxLength));
      return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    }),
  );
  return modal;
}

/** Groupe pré-rempli dans les formulaires de préparation : personnages actifs de la campagne. */
export function partyDefault(store: Store, campaignId: string): string {
  const c = store.getCampaign(campaignId);
  if (!c) return "";
  const chars = store.listCharacters(c.guildId, c.channelId).filter((x) => x.active);
  if (!chars.length) return "";
  const classes = chars.map((x) => (x.draft.classId ? getClass(x.draft.classId)?.name : undefined) ?? "?");
  return `${chars.length} personnages, niveau 1 : ${classes.join(", ")}`;
}

export function buildNotesModal(campaignId = ""): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(`seance-notes:${campaignId}`).setTitle("Notes de séance");
  modal.addComponents(
    NOTE_FIELDS.map((f) =>
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(f.id)
          .setLabel(f.label)
          .setPlaceholder(f.placeholder)
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(f.maxLength)
          .setRequired(f.required),
      ),
    ),
  );
  return modal;
}

async function handleCommand(i: ChatInputCommandInteraction, deps: Deps): Promise<void> {
  if (i.commandName === "aide") {
    const actor = actorFrom(i);
    const mine = campaignsOfMember(deps.store, i.guildId ?? "", actor.roleIds);
    const isMj = mine.some((m) => m.mj);
    const campaigns = mine.map((m) => `${m.campaign.name} (${m.mj ? "MJ" : "joueur"})`);
    const [first, ...rest] = splitMessage(renderHelp(actor.isAdministrator, isMj, campaigns));
    await i.reply({ content: first ?? "", flags: MessageFlags.Ephemeral });
    for (const chunk of rest) await i.followUp({ content: chunk, flags: MessageFlags.Ephemeral });
    return;
  }

  if (i.commandName === "objet") {
    const name = i.options.getString("nom", true);
    const text = itemText(name);
    await i.reply({
      content: text ? `${text}\n_Source : SRD 5.2.1_` : `« ${name} » ne figure pas dans l’équipement du SRD. Essaie l’autocomplétion.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (i.commandName === "regles") {
    const actor = actorFrom(i);
    const found = campaignFor(i, deps, actor, i.options.getString("campagne"));
    if (!found.ok) {
      await i.reply({ content: found.error, flags: MessageFlags.Ephemeral });
      return;
    }
    const campaign = found.campaign;
    const echeance = i.options.getString("echeance");
    const changes = ["niveau", "standard", "achat", "des", "table", "contenu"].some((n) => i.options.get(n) !== null);
    if (!changes && echeance === null) {
      const deadline = campaign.creationDeadline ? `\nÉchéance des personnages : ${discordTime(new Date(campaign.creationDeadline))}.` : "";
      await i.reply({ content: `**Paramètres de création : ${campaign.name}**\n${describeRules(campaign.creationRules)}${deadline}`, flags: MessageFlags.Ephemeral });
      return;
    }
    if (!canManageCampaign(actor, campaign)) {
      await i.reply({ content: "Seuls le MJ de la campagne ou un administrateur peuvent faire cela.", flags: MessageFlags.Ephemeral });
      return;
    }
    const lines: string[] = [];
    if (echeance !== null) lines.push(setDeadline(deps, campaign, echeance));
    if (changes) {
      const res = updateRules(campaign.creationRules, {
        level: i.options.getInteger("niveau"),
        standard: i.options.getBoolean("standard"),
        points: i.options.getBoolean("achat"),
        des: i.options.getBoolean("des"),
        table: i.options.getBoolean("table"),
        content: i.options.getString("contenu"),
      });
      if (!res.ok) lines.push(res.error);
      else {
        deps.store.setCreationRules(campaign.channelId, res.rules);
        lines.push(`Paramètres de « ${campaign.name} » enregistrés. Ils s’appliquent aux créations commencées à partir de maintenant.\n${describeRules(res.rules)}`);
      }
    }
    await i.reply({ content: lines.join("\n\n"), flags: MessageFlags.Ephemeral });
    return;
  }

  if (i.commandName === "chercher") {
    const [first, ...rest] = lookup(i.options.getString("terme", true));
    await i.reply({ content: first ?? "", flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    for (const chunk of rest) await i.followUp({ content: chunk, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return;
  }

  if (i.commandName === "rencontre") {
    const actor = actorFrom(i);
    const found = campaignFor(i, deps, actor, i.options.getString("campagne"));
    if (found.ok && !canManageCampaign(actor, found.campaign)) {
      await i.reply({ content: "Seuls le MJ de la campagne ou un administrateur peuvent faire cela.", flags: MessageFlags.Ephemeral });
      return;
    }
    const active = found.ok ? deps.store.listCharacters(found.campaign.guildId, found.campaign.channelId).filter((c) => c.active).length : 0;
    const difficulty = (i.options.getString("difficulte") ?? "moderee") as Difficulty;
    const msg = encounterMessage(i.options.getString("creatures", true), i.options.getInteger("niveau") ?? 1, i.options.getInteger("personnages") ?? (active || 5), difficulty);
    await i.reply({ ...msg, flags: MessageFlags.Ephemeral });
    return;
  }

  if (i.commandName === "carnet") {
    const actor = actorFrom(i);
    const found = campaignFor(i, deps, actor, i.options.getString("campagne"));
    if (!found.ok) {
      await i.reply({ content: found.error, flags: MessageFlags.Ephemeral });
      return;
    }
    const c = found.campaign;
    if (i.options.getSubcommand() === "retirer") {
      if (!canManageCampaign(actor, c)) {
        await i.reply({ content: "Seuls le MJ de la campagne ou un administrateur peuvent retirer une entrée.", flags: MessageFlags.Ephemeral });
        return;
      }
      const raw = i.options.getString("entree", true);
      const m = /^(pnj|lieu|objet|fil):(.+)$/.exec(raw);
      const removed = m ? deps.store.removeCarnet(c.channelId, m[1] as CarnetKind, m[2]!) : false;
      await i.reply({ content: removed ? `« ${m![2]} » retiré du carnet.` : "Entrée introuvable : choisis-la dans la liste proposée.", flags: MessageFlags.Ephemeral });
      return;
    }
    const [first, ...rest] = splitMessage(renderCarnet(c.name, deps.store.listCarnet(c.channelId)));
    await i.reply({ content: first ?? "", flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    for (const chunk of rest) await i.followUp({ content: chunk, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return;
  }

  if (i.commandName === "guide") {
    const id = i.options.getString("classe");
    const [first, ...rest] = id ? renderClassGuide(id) : renderOverview();
    await i.reply({ content: first ?? "Classe inconnue.", flags: MessageFlags.Ephemeral });
    for (const chunk of rest) await i.followUp({ content: chunk, flags: MessageFlags.Ephemeral });
    return;
  }

  if (i.commandName === "personnage") {
    await handleCharacterCommand(i, deps, actorFrom);
    return;
  }

  if (i.commandName === "campagne") {
    await handleCampagne(i, deps, actorFrom(i));
    return;
  }

  if (i.commandName === "setup") {
    await handleSetup(i, deps, actorFrom(i));
    return;
  }

  if (i.commandName === "style") {
    await handleStyle(i, deps, actorFrom(i));
    return;
  }

  if (i.commandName === "prochaine-seance") {
    await handleNextSession(i, deps, actorFrom(i));
    return;
  }

  if (i.commandName === "preparer") {
    const type = i.options.getString("type", true);
    if (!isPrepType(type)) {
      await i.reply({ content: "Type inconnu.", flags: MessageFlags.Ephemeral });
      return;
    }
    const actor = actorFrom(i);
    const found = campaignFor(i, deps, actor, i.options.getString("campagne"));
    if (!found.ok) {
      await i.reply({ content: found.error, flags: MessageFlags.Ephemeral });
      return;
    }
    const campaign = found.campaign;
    if (!canManageCampaign(actor, campaign)) {
      await i.reply({ content: "Seuls le MJ de la campagne ou un administrateur peuvent faire cela.", flags: MessageFlags.Ephemeral });
      return;
    }
    await i.showModal(buildPrepModal(type, campaign.channelId, { party: partyDefault(deps.store, campaign.channelId) }));
    return;
  }

  if (i.commandName === "seance") {
    const actor = actorFrom(i);
    const found = campaignFor(i, deps, actor, i.options.getString("campagne"));
    if (!found.ok) {
      await i.reply({ content: found.error, flags: MessageFlags.Ephemeral });
      return;
    }
    const campaign = found.campaign;
    if (!canManageCampaign(actor, campaign)) {
      await i.reply({ content: `Seuls le MJ de « ${campaign.name} » ou un administrateur peuvent faire cela.`, flags: MessageFlags.Ephemeral });
      return;
    }
    await i.showModal(buildNotesModal(campaign.channelId));
    return;
  }

  if (i.commandName === "rappel") {
    const found = campaignFor(i, deps, actorFrom(i), i.options.getString("campagne"));
    if (!found.ok) {
      await i.reply({ content: found.error, flags: MessageFlags.Ephemeral });
      return;
    }
    const res = lastRecap(deps.store, found.campaign.channelId);
    if (!res.ok) {
      await i.reply({ content: res.error, flags: MessageFlags.Ephemeral });
      return;
    }
    await i.reply({ content: `**${found.campaign.name} : rappel de la séance ${res.value.number}**\n\n${res.value.recap}`.slice(0, DISCORD_MESSAGE_LIMIT) });
  }
}

export async function handleInteraction(i: Interaction, deps: Deps): Promise<void> {
  if (await handleCampaignButton(i, deps, actorFrom(i))) return;
  if (await handleStyleModal(i, deps, actorFrom(i))) return;
  if (i.isAutocomplete()) {
    const focused = i.options.getFocused(true);
    if (focused.name === "campagne") {
      await i.respond(campaignChoices(deps.store, i.guildId ?? "", String(focused.value), true));
      return;
    }
    if (i.commandName === "objet") {
      const names = searchItems(String(focused.value));
      await i.respond(names.map((n) => ({ name: n.slice(0, 100), value: n.slice(0, 100) })));
    }
    if (i.commandName === "chercher") await i.respond(lookupChoices(String(focused.value)));
    if (i.commandName === "rencontre") await i.respond(creatureListChoices(String(focused.value)));
    if (i.commandName === "carnet") {
      const found = campaignFor(i, deps, actorFrom(i), i.options.getString("campagne"));
      const q = String(focused.value).toLowerCase();
      const entries = found.ok ? deps.store.listCarnet(found.campaign.channelId) : [];
      await i.respond(
        entries
          .filter((e) => e.name.toLowerCase().includes(q))
          .slice(0, 25)
          .map((e) => ({ name: `${e.name} (${CARNET_TITLES[e.kind]})`.slice(0, 100), value: `${e.kind}:${e.name}`.slice(0, 100) })),
      );
    }
    return;
  }
  if (await handlePanelInteraction(i, deps, actorFrom)) return;
  if (await handleCharacterInteraction(i, deps, actorFrom)) return;

  if (i.isChatInputCommand()) {
    await handleCommand(i, deps);
    return;
  }

  if (i.isModalSubmit() && i.customId.startsWith("seance-notes")) {
    const campaignId = i.customId.split(":")[1] || (i.channelId ?? "");
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const notes = formatNotes(
      Object.fromEntries(NOTE_FIELDS.map((f) => [f.id, i.fields.getTextInputValue(f.id)])),
    );
    const pending = deps.store.pendingPlayerNotes(campaignId);
    const playerNotes = await Promise.all(
      pending.map(async (n) => ({ author: (await i.guild?.members.fetch(n.userId).catch(() => null))?.displayName ?? "un joueur", text: n.text })),
    );
    const res = await generateRecap(deps.store, deps.complete, actorFrom(i), campaignId, notes, playerNotes);
    if (!res.ok) {
      await i.editReply({ content: res.error });
      return;
    }
    // Brouillon en base : il survit à un redémarrage du bot (déploiement) entre la génération et la publication.
    const id = randomUUID();
    deps.store.saveRecapDraft({ id, userId: i.user.id, channelId: campaignId, notes, recap: res.value });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`publish:${id}`).setLabel("Publier").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`discard:${id}`).setLabel("Annuler").setStyle(ButtonStyle.Secondary),
    );
    const preview = `Brouillon (relisez avant de publier)${playerNotes.length ? `, avec ${playerNotes.length} note(s) de joueur en complément` : ""} :\n\n${res.value}`;
    await i.editReply({ content: preview.slice(0, DISCORD_MESSAGE_LIMIT), components: [row] });
    if (playerNotes.length) {
      for (const chunk of splitMessage(`**Notes des joueurs prises en compte** (vérifie qu’elles ne contredisent pas les tiennes) :\n${playerNotes.map((n) => `• ${n.author} : ${n.text}`).join("\n")}`)) {
        await i.followUp({ content: chunk, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      }
    }
    return;
  }

  if (i.isModalSubmit() && i.customId.startsWith("prep:")) {
    const [, type = "", prepCampaign = ""] = i.customId.split(":");
    if (!isPrepType(type)) return;
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const values = Object.fromEntries(PREP_FORMS[type].fields.map((f) => [f.id, i.fields.getTextInputValue(f.id)]));
    const res = await generatePrep(deps.store, deps.complete, actorFrom(i), prepCampaign || (i.channelId ?? ""), type, values);
    if (!res.ok) {
      await i.editReply({ content: res.error });
      return;
    }
    const [first, ...rest] = splitMessage(res.value);
    await i.editReply({ content: first ?? "" });
    for (const chunk of rest) {
      await i.followUp({ content: chunk, flags: MessageFlags.Ephemeral });
    }
    // Rencontre : bouton pour imprimer les blocs de statistiques des créatures reconnues.
    const code = type === "rencontre" && values["creatures"] ? encodePicks(parseCreatureList(values["creatures"]).picks) : undefined;
    if (code) {
      await i.followUp({
        content: "Blocs de statistiques des créatures, à imprimer :",
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`enc:pdf:${code}`).setLabel("PDF des blocs de statistiques").setStyle(ButtonStyle.Primary))],
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (i.isButton()) {
    const [action, id] = i.customId.split(":");
    if ((action !== "publish" && action !== "discard") || !id) return;
    const draft = deps.store.getRecapDraft(id);
    if (!draft) {
      await i.update({ content: "Ce brouillon a expiré. Relancez /seance.", components: [] });
      return;
    }
    if (draft.userId !== i.user.id) {
      await i.reply({ content: "Ce brouillon appartient à quelqu'un d'autre.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (action === "discard") {
      deps.store.deleteRecapDraft(id);
      await i.update({ content: "Brouillon annulé.", components: [] });
      return;
    }
    const res = publishRecap(deps.store, actorFrom(i), draft.channelId, draft.notes, draft.recap);
    if (!res.ok) {
      await i.update({ content: res.error, components: [] });
      return;
    }
    deps.store.deleteRecapDraft(id);
    deps.store.markPlayerNotesUsed(draft.channelId, res.value.number);
    await i.update({ content: "Rappel publié. Mise à jour du carnet de campagne…", components: [] });
    await sendRecap(i, draft.channelId, `**Rappel de la séance ${res.value.number}**\n\n${res.value.recap}`);
    // Carnet : extrait du rappel publié (déjà lu par les joueurs), donc rien de plus n'est révélé.
    try {
      const pcs = deps.store.listCharacters(i.guildId ?? "", draft.channelId).map((c) => c.name);
      const summary = applyCarnet(deps.store, draft.channelId, await extractCarnet(deps.complete, res.value.recap, pcs), res.value.number);
      await i.editReply({ content: `Rappel publié. Carnet de campagne mis à jour : ${summary}. Une entrée à corriger ? /carnet retirer.` });
    } catch (e) {
      console.error("Carnet de campagne :", e);
      await i.editReply({ content: "Rappel publié. Le carnet de campagne n’a pas pu être mis à jour cette fois (réponse illisible de l’assistant)." });
    }
  }
}
