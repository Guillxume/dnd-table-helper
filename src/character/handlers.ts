import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";
import type { Deps } from "../commands.js";
import type { Campaign, Store, StoredCharacter } from "../db.js";
import { canManageCampaign, isCampaignMember, type Actor } from "../permissions.js";
import { campaignFor, campaignOption } from "../campaign-commands.js";
import { styleBlock } from "../style.js";
import { SRD_ATTRIBUTION } from "../srd/attribution.js";
import { answer, back, cancelEdit, draftOf, editStep, newState, rollOnce, storyAnswer, type WizardState } from "./state.js";
import { sheetDiscordText, validateDraft } from "./validate.js";
import { nextStep } from "./steps.js";
import { computeSheet } from "./sheet.js";
import { renderSheetPdf } from "./pdf.js";
import { characterPdf } from "./render.js";
import { chunkOptions, renderInfo, renderWizard } from "./wizard-ui.js";
import { characterLabel, sheetFileName } from "./label.js";
import type { Completer } from "../summarize.js";
import { splitMessage } from "../text.js";
import { publishCharacter } from "../publish.js";
import { characterIdeas, spellAdvice } from "./assist.js";

type ActorOf = (i: Interaction) => Actor;

export const personnageCommand = new SlashCommandBuilder()
  .setName("personnage")
  .setDescription("Créer et consulter les fiches de personnage (niveau 1, SRD 5.2.1)")
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) =>
    s
      .setName("creer")
      .setDescription("Créer un personnage pas à pas, ou reprendre la création en cours")
      .addStringOption((o) =>
        o.setName("nom").setDescription("Nom du personnage (laisser vide pour reprendre)").setMinLength(2).setMaxLength(40),
      )
      .addStringOption(campaignOption()),
  )
  .addSubcommand((s) =>
    s
      .setName("fiche")
      .setDescription("Obtenir le PDF d’une fiche")
      .addIntegerOption((o) => o.setName("numero").setDescription("Numéro de la fiche (voir /personnage liste)").setMinValue(1))
      .addUserOption((o) => o.setName("joueur").setDescription("Personnage actif de ce joueur (MJ ou administrateur)"))
      .addStringOption(campaignOption()),
  )
  .addSubcommand((s) =>
    s
      .setName("voir")
      .setDescription("Afficher la fiche complète dans Discord, avec le détail des calculs")
      .addIntegerOption((o) => o.setName("numero").setDescription("Numéro de la fiche (par défaut : ton personnage actif)").setMinValue(1))
      .addUserOption((o) => o.setName("joueur").setDescription("Personnage actif de ce joueur (MJ ou administrateur)"))
      .addStringOption(campaignOption()),
  )
  .addSubcommand((s) =>
    s
      .setName("actif")
      .setDescription("Choisir ton personnage actif")
      .addIntegerOption((o) => o.setName("numero").setDescription("Numéro de la fiche").setRequired(true).setMinValue(1)),
  )
  .addSubcommand((s) => s.setName("liste").setDescription("Lister les personnages (d’une campagne ou de tout le serveur)").addStringOption(campaignOption()))
  .addSubcommand((s) =>
    s
      .setName("supprimer")
      .setDescription("Supprimer une fiche")
      .addIntegerOption((o) => o.setName("numero").setDescription("Numéro de la fiche").setRequired(true).setMinValue(1)),
  );

const eph = MessageFlags.Ephemeral;

/** Sélections en cours pour les étapes à choix multiples (par joueur et par étape). Perdues au redémarrage : sans gravité. */
const pendingSelections = new Map<string, string[]>();
const pendingKey = (guildId: string, userId: string, stepId: string) => `${guildId}:${userId}:${stepId}`;
function clearPending(guildId: string, userId: string): void {
  for (const k of [...pendingSelections.keys()]) if (k.startsWith(`${guildId}:${userId}:`)) pendingSelections.delete(k);
}

/** Démarre une création de personnage dans une campagne (remplace une création en cours). */
export function beginCreation(store: Store, guildId: string, userId: string, campaign: Campaign, nom: string): WizardState {
  const state = { ...newState(nom, campaign.creationRules), campaignId: campaign.channelId, campaignName: campaign.name };
  clearPending(guildId, userId);
  store.saveWizard(guildId, userId, state);
  return state;
}

/** Administrateur, ou MJ de la campagne de ce personnage. */
export const isMjOf = (store: Store, campaignId: string, actor: Actor): boolean => {
  const c = store.getCampaign(campaignId);
  return actor.isAdministrator || (c ? canManageCampaign(actor, c) : false);
};

export { characterLabel };

function storyModal(): ModalBuilder {
  const field = (id: string, label: string, placeholder: string) =>
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setPlaceholder(placeholder)
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1500)
        .setRequired(false),
    );
  return new ModalBuilder()
    .setCustomId("pc:storyform")
    .setTitle("Votre personnage")
    .addComponents(
      field("origin", "Origine (sans effet de règle)", "Lieu de naissance, milieu, famille : né dans une cité souterraine…"),
      field("appearance", "Apparence", "Taille, allure, signes distinctifs…"),
      field("personality", "Personnalité", "Traits, idéal, lien, défaut…"),
      field("backstory", "Historique du personnage", "D’où il vient, ce qui l’a poussé à partir…"),
    );
}

/** Saisie des six totaux des dés lancés à la table (un formulaire Discord a cinq champs au plus : un seul champ). */
function tableModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId("pc:tableform")
    .setTitle("Dés lancés à la table")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("rolls")
          .setLabel("Tes six totaux, dans l’ordre des lancers")
          .setPlaceholder("15 14 12 11 10 8")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(40)
          .setRequired(true),
      ),
    );
}

/** « 15, 14 12/11 10 8 » → six nombres ; tout autre contenu est refusé par l'étape. */
export function parseTableRolls(text: string): string[] {
  return text.trim() ? text.trim().split(/[\s,;/]+/).filter(Boolean) : [];
}


/** Nom affiché du joueur sur le serveur (pour la case « nom du joueur »). */
async function playerName(i: Interaction, userId: string): Promise<string | undefined> {
  const m = await i.guild?.members.fetch(userId).catch(() => null);
  return m?.displayName ?? undefined;
}

export async function pdfFor(i: Interaction, c: StoredCharacter): Promise<AttachmentBuilder> {
  const buf = await characterPdf(c.draft, await playerName(i, c.userId));
  return new AttachmentBuilder(buf, { name: sheetFileName(c.name) });
}

export async function handleCharacterCommand(i: ChatInputCommandInteraction, deps: Deps, actorOf: ActorOf): Promise<void> {
  const guildId = i.guildId;
  if (!guildId) {
    await i.reply({ content: "Cette commande s’utilise sur le serveur.", flags: eph });
    return;
  }
  const sub = i.options.getSubcommand();
  const actor = actorOf(i);

  if (sub === "creer") {
    const nom = i.options.getString("nom")?.trim();
    let state = deps.store.getWizard(guildId, i.user.id);
    if (nom) {
      const found = campaignFor(i, deps, actor, i.options.getString("campagne"));
      if (!found.ok) {
        await i.reply({ content: found.error, flags: eph });
        return;
      }
      const campaign = found.campaign;
      if (campaign.archived) {
        await i.reply({ content: `« ${campaign.name} » est archivée : on n’y crée plus de personnage.`, flags: eph });
        return;
      }
      if (!isCampaignMember(actor, campaign)) {
        await i.reply({ content: `Tu ne fais pas partie de « ${campaign.name} ». Demande au MJ : /campagne ajouter-joueur.`, flags: eph });
        return;
      }
      state = beginCreation(deps.store, guildId, i.user.id, campaign, nom);
    } else if (!state) {
      await i.reply({ content: "Aucune création en cours. Lance /personnage creer avec un nom.", flags: eph });
      return;
    }
    const msg = renderWizard(state, [], nom ? "" : "Reprise de ta création en cours.");
    await i.reply({ content: msg.content, components: msg.components, flags: eph });
    return;
  }

  if (sub === "liste") {
    // Une campagne précise (option ou salon de la campagne), sinon toutes, regroupées.
    const opt = i.options.getString("campagne");
    const ch = i.channel;
    const here = deps.store.findCampaignForChannel(i.channelId) ?? (ch && "parentId" in ch && ch.parentId ? deps.store.findCampaignForChannel(ch.parentId) : undefined);
    const named = opt ? campaignFor(i, deps, actor, opt) : undefined;
    if (named && !named.ok) {
      await i.reply({ content: named.error, flags: eph });
      return;
    }
    const campaigns = named?.ok ? [named.campaign] : here ? [here] : deps.store.listCampaigns(guildId, true);
    const parts: string[] = [];
    for (const camp of campaigns) {
      const chars = deps.store.listCharacters(guildId, camp.channelId);
      if (!chars.length && campaigns.length > 1) continue;
      parts.push(`**${camp.name}**${camp.archived ? " (archivée)" : ""}`);
      parts.push(chars.length ? chars.map((c) => `${characterLabel(c)} : <@${c.userId}>${c.active ? " (actif)" : ""}`).join("\n") : "Aucun personnage.");
    }
    if (!parts.length) {
      await i.reply({ content: "Aucun personnage pour le moment.", flags: eph });
      return;
    }
    const text = parts.join("\n");
    await i.reply({ content: splitMessage(text)[0] ?? "", flags: eph, allowedMentions: { parse: [] } });
    return;
  }

  if (sub === "actif") {
    const c = deps.store.getCharacter(i.options.getInteger("numero", true));
    if (!c || c.guildId !== guildId || c.userId !== i.user.id) {
      await i.reply({ content: "Fiche introuvable parmi tes personnages.", flags: eph });
      return;
    }
    deps.store.setActiveCharacter(c.id);
    await i.reply({ content: `Personnage actif dans « ${deps.store.getCampaign(c.campaignId)?.name ?? "?"} » : ${characterLabel(c)}.`, flags: eph });
    return;
  }

  if (sub === "fiche" || sub === "voir") {
    const numero = i.options.getInteger("numero");
    const joueur = i.options.getUser("joueur");
    let c: StoredCharacter | undefined;
    if (numero !== null) c = deps.store.getCharacter(numero);
    else {
      const uid = (joueur ?? i.user).id;
      const found = campaignFor(i, deps, actor, i.options.getString("campagne"));
      c = found.ok
        ? (deps.store.activeCharacter(guildId, uid, found.campaign.channelId) ?? deps.store.latestCharacter(guildId, uid, found.campaign.channelId))
        : deps.store.latestCharacter(guildId, uid);
    }
    if (!c || c.guildId !== guildId) {
      await i.reply({ content: "Fiche introuvable.", flags: eph });
      return;
    }
    if (c.userId !== i.user.id && !isMjOf(deps.store, c.campaignId, actor)) {
      await i.reply({ content: "Seuls le MJ ou un administrateur peuvent consulter la fiche d’un autre joueur.", flags: eph });
      return;
    }
    if (sub === "voir") {
      const v = validateDraft(c.draft);
      if (!v.sheet) {
        await i.reply({ content: `Cette fiche ne peut pas être calculée : ${v.errors.join(" ")}`, flags: eph });
        return;
      }
      const [first, ...rest] = splitMessage(sheetDiscordText(v.sheet));
      await i.reply({ content: first ?? "", flags: eph });
      for (const chunk of rest) await i.followUp({ content: chunk, flags: eph });
      return;
    }
    await i.deferReply({ flags: eph });
    await i.editReply({ content: `Fiche : ${characterLabel(c)}`, files: [await pdfFor(i, c)] });
    return;
  }

  if (sub === "supprimer") {
    const c = deps.store.getCharacter(i.options.getInteger("numero", true));
    if (!c || c.guildId !== guildId) {
      await i.reply({ content: "Fiche introuvable.", flags: eph });
      return;
    }
    if (c.userId !== i.user.id && !isMjOf(deps.store, c.campaignId, actor)) {
      await i.reply({ content: "Tu ne peux supprimer que tes propres fiches (le MJ peut supprimer toutes les fiches).", flags: eph });
      return;
    }
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`pc:del:${c.id}`).setLabel("Supprimer définitivement").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("pc:delno").setLabel("Garder").setStyle(ButtonStyle.Secondary),
    );
    await i.reply({ content: `Supprimer ${characterLabel(c)} ? Cette action est définitive.`, components: [row], flags: eph });
  }
}

/** Retourne true si l’interaction concernait l’assistant de création. */
export async function handleCharacterInteraction(i: Interaction, deps: Deps, actorOf: ActorOf): Promise<boolean> {
  const customId = "customId" in i ? i.customId : "";
  if (!customId.startsWith("pc:")) return false;
  const guildId = i.guildId;
  if (!guildId || !(i.isButton() || i.isStringSelectMenu() || i.isModalSubmit())) return true;
  const userId = i.user.id;
  const parts = customId.split(":");
  const kind = parts[1];

  const reply = async (content: string) => {
    if (i.isModalSubmit() && !i.isFromMessage()) await i.reply({ content, flags: eph });
    else if (i.isModalSubmit()) await i.update({ content, components: [] });
    else await i.update({ content, components: [] });
  };
  const show = async (state: WizardState, pending: string[] = [], notice = "") => {
    const msg = renderWizard(state, pending, notice);
    if (i.isModalSubmit() && !i.isFromMessage()) await i.reply({ content: msg.content, components: msg.components, flags: eph });
    else await i.update({ content: msg.content, components: msg.components });
  };
  const wizard = () => deps.store.getWizard(guildId, userId);

  // Suppression
  if (kind === "del" && i.isButton()) {
    const c = deps.store.getCharacter(Number(parts[2]));
    if (!c || c.guildId !== guildId) {
      await i.update({ content: "Fiche introuvable.", components: [] });
      return true;
    }
    if (c.userId !== userId && !isMjOf(deps.store, c.campaignId, actorOf(i))) {
      await i.update({ content: "Action non autorisée.", components: [] });
      return true;
    }
    deps.store.deleteCharacter(c.id);
    await i.update({ content: `Fiche #${c.id} supprimée.`, components: [] });
    return true;
  }
  if (kind === "delno" && i.isButton()) {
    await i.update({ content: "Suppression annulée.", components: [] });
    return true;
  }

  // Publication de la fiche
  if (kind === "pub" && i.isButton()) {
    const c = deps.store.getCharacter(Number(parts[2]));
    if (!c || c.guildId !== guildId) {
      await i.update({ content: "Fiche introuvable.", components: [] });
      return true;
    }
    if (c.userId !== userId && !isMjOf(deps.store, c.campaignId, actorOf(i))) {
      await i.reply({ content: "Seul le propriétaire de la fiche ou le MJ peut la publier.", flags: eph });
      return true;
    }
    await i.deferUpdate();
    const result = await publishCharacter(i.client, deps.store, c, await playerName(i, c.userId));
    if (!result.ok) {
      await i.followUp({ content: result.error, flags: eph });
      return true;
    }
    await i.editReply({ components: [] });
    await i.followUp({ content: `Fiche publiée dans <#${result.channelId}>.`, flags: eph });
    return true;
  }

  // Étapes de l'assistant
  const state = wizard();
  if (!state) {
    await reply("Cette création n’existe plus. Relance /personnage creer.");
    return true;
  }

  if (kind === "cancel" && i.isButton()) {
    deps.store.deleteWizard(guildId, userId);
    clearPending(guildId, userId);
    await reply("Création abandonnée.");
    return true;
  }

  if (kind === "back" && i.isButton()) {
    clearPending(guildId, userId);
    const next = back(state);
    deps.store.saveWizard(guildId, userId, next);
    await show(next);
    return true;
  }

  if (kind === "roll" && i.isButton()) {
    const next = rollOnce(state);
    deps.store.saveWizard(guildId, userId, next);
    // Après le tirage, l'étape d'assignation de FOR est affichée. Le tirage est définitif et conservé.
    if (next === state) await show(state);
    else await show(next, [], "Dés lancés. Le tirage est définitif, même si tu reviens en arrière.");
    return true;
  }

  const step = nextStep(draftOf(state));

  if (kind === "advice" && i.isButton() && (step.kind === "multi" || step.kind === "select")) {
    await i.deferReply({ flags: eph });
    try {
      const text = await spellAdvice(deps.complete as Completer, draftOf(state), step);
      await i.editReply({ content: `Conseil de l’assistant (suggestion, tu restes libre de ton choix) :\n\n${text}`.slice(0, 1990) });
    } catch (e) {
      await i.editReply({ content: `Impossible d’obtenir un conseil : ${e instanceof Error ? e.message : "erreur inconnue"}` });
    }
    return true;
  }

  if (kind === "info" && i.isButton()) {
    const msg = renderInfo(state);
    await i.reply({ content: msg?.content ?? "Aucune option à détailler à cette étape.", components: msg?.components ?? [], flags: eph });
    return true;
  }

  if (kind === "i" && i.isStringSelectMenu()) {
    const msg = parts[2] === step.id ? renderInfo(state, i.values[0]) : undefined;
    await i.update({ content: msg?.content ?? "Cette étape n’est plus d’actualité.", components: msg?.components ?? [] });
    return true;
  }

  if (kind === "e" && i.isStringSelectMenu()) {
    clearPending(guildId, userId);
    const next = editStep(state, Number(i.values[0]));
    deps.store.saveWizard(guildId, userId, next);
    await show(next, [], "Modification : choisis la nouvelle réponse. Les choix suivants sont repris tant qu’ils restent valides.");
    return true;
  }

  if (kind === "editcancel" && i.isButton()) {
    clearPending(guildId, userId);
    const next = cancelEdit(state);
    deps.store.saveWizard(guildId, userId, next);
    await show(next, [], "Modification annulée.");
    return true;
  }

  if (kind === "c" && i.isButton() && step.kind === "confirm") {
    if (parts[2] !== step.id) {
      await show(state, [], "Cette étape n’est plus d’actualité.");
      return true;
    }
    const res = answer(state, step.id, ["ok"]);
    if (res.ok) deps.store.saveWizard(guildId, userId, res.state);
    await show(res.ok ? res.state : state, [], res.ok ? "" : res.error);
    return true;
  }

  if (kind === "s" && i.isStringSelectMenu()) {
    const stepId = parts[2] ?? "";
    if (stepId !== step.id) {
      await show(state, [], "Cette étape n’est plus d’actualité.");
      return true;
    }
    const res = answer(state, stepId, i.values);
    if (!res.ok) {
      await show(state, [], res.error);
      return true;
    }
    clearPending(guildId, userId);
    deps.store.saveWizard(guildId, userId, res.state);
    await show(res.state);
    return true;
  }

  if (kind === "m" && i.isStringSelectMenu() && step.kind === "multi") {
    const stepId = parts[2] ?? "";
    if (stepId !== step.id) {
      await show(state, [], "Cette étape n’est plus d’actualité.");
      return true;
    }
    const k = Number(parts[3] ?? 0);
    const chunk = new Set((chunkOptions(step.options)[k] ?? []).map((o) => o.value));
    const key = pendingKey(guildId, userId, stepId);
    const pending = (pendingSelections.get(key) ?? []).filter((v) => !chunk.has(v)).concat(i.values);
    pendingSelections.set(key, pending);
    await show(state, pending);
    return true;
  }

  if (kind === "ok" && i.isButton() && step.kind === "multi") {
    if (parts[2] !== step.id) {
      await show(state, [], "Cette étape n’est plus d’actualité.");
      return true;
    }
    const key = pendingKey(guildId, userId, step.id);
    const pending = pendingSelections.get(key) ?? [];
    const res = answer(state, step.id, pending);
    if (!res.ok) {
      await show(state, pending, res.error);
      return true;
    }
    pendingSelections.delete(key);
    deps.store.saveWizard(guildId, userId, res.state);
    await show(res.state);
    return true;
  }

  if (kind === "story" && i.isButton() && step.kind === "story") {
    const action = parts[2];
    if (action === "write") {
      await i.showModal(storyModal());
      return true;
    }
    if (action === "skip") {
      const res = storyAnswer(state, {});
      if (res.ok) {
        deps.store.saveWizard(guildId, userId, res.state);
        await show(res.state);
      }
      return true;
    }
    if (action === "ideas") {
      await i.deferReply({ flags: eph });
      try {
        const text = await characterIdeas(deps.complete as Completer, draftOf(state), styleBlock(state.campaignId ? (deps.store.getCampaign(state.campaignId)?.style ?? {}) : {}));
        await i.editReply({
          content: text
            ? `Idées à reformuler à ta façon (suggestions de l’assistant, sans valeur de règle) :\n\n${text}`.slice(0, 1990)
            : "Le modèle n’a renvoyé aucun texte. Réessaie.",
        });
      } catch (e) {
        await i.editReply({ content: `Impossible d’obtenir des idées : ${e instanceof Error ? e.message : "erreur inconnue"}` });
      }
      return true;
    }
  }

  if (kind === "table" && i.isButton() && step.kind === "table") {
    if (parts[2] === "enter") {
      await i.showModal(tableModal());
      return true;
    }
    if (parts[2] === "blank") {
      await i.deferReply({ flags: eph });
      try {
        const pdf = await characterPdf(draftOf(state), await playerName(i, userId), { pendingScores: true });
        await i.editReply({
          content: "Fiche à cases vides : tout ce qui dépend des caractéristiques est à compléter au crayon, les formules sont dans l’annexe. Ta création reste en cours : saisis tes résultats après le tirage pour obtenir la fiche remplie et l’enregistrer.",
          files: [new AttachmentBuilder(pdf, { name: sheetFileName(`${state.name}_a_completer`) })],
        });
      } catch (e) {
        await i.editReply({ content: `La génération de la fiche a échoué : ${e instanceof Error ? e.message : "erreur inconnue"}` });
      }
      return true;
    }
  }

  if (kind === "tableform" && i.isModalSubmit() && step.kind === "table") {
    const res = answer(state, "tableRolls", parseTableRolls(i.fields.getTextInputValue("rolls")));
    if (!res.ok) {
      await show(state, [], res.error);
      return true;
    }
    deps.store.saveWizard(guildId, userId, res.state);
    await show(res.state, [], "Résultats enregistrés. Répartis-les maintenant entre tes caractéristiques.");
    return true;
  }

  if (kind === "storyform" && i.isModalSubmit() && step.kind === "story") {
    const get = (id: string) => i.fields.getTextInputValue(id);
    const res = storyAnswer(state, { origin: get("origin"), appearance: get("appearance"), personality: get("personality"), backstory: get("backstory") });
    if (!res.ok) {
      await show(state, [], res.error);
      return true;
    }
    deps.store.saveWizard(guildId, userId, res.state);
    await show(res.state);
    return true;
  }

  if (kind === "finish" && i.isButton() && step.kind === "done") {
    const v = validateDraft(draftOf(state));
    if (v.errors.length) {
      await show(state, [], "La fiche contient des erreurs à corriger.");
      return true;
    }
    await i.deferUpdate();
    try {
      const draft = draftOf(state);
      const pdf = await characterPdf(draft, await playerName(i, userId));
      const campaignId = state.campaignId ?? deps.store.campaignForGuild(guildId)?.channelId ?? "";
      if (!deps.store.getCampaign(campaignId)) {
        await i.editReply({ content: "La campagne de ce personnage n’existe plus. Relance /personnage creer avec l’option campagne.", components: [] });
        return true;
      }
      const saved = deps.store.addCharacter(guildId, userId, campaignId, state.name, draft);
      deps.store.deleteWizard(guildId, userId);
      clearPending(guildId, userId);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`pc:pub:${saved.id}`).setLabel("Publier dans les fiches de la campagne").setStyle(ButtonStyle.Success),
      );
      await i.editReply({
        content: `Fiche #${saved.id} créée : ${characterLabel(saved)}.\nRelis-la, puis publie-la quand tu veux. ${SRD_ATTRIBUTION.length > 0 ? "Elle contient la mention de licence du SRD 5.2.1." : ""}`.slice(0, 1990),
        components: [row],
        files: [new AttachmentBuilder(pdf, { name: sheetFileName(saved.name) })],
      });
    } catch (e) {
      await i.editReply({ content: `La génération de la fiche a échoué : ${e instanceof Error ? e.message : "erreur inconnue"}` });
    }
    return true;
  }

  await show(state, [], "Action non reconnue ou étape modifiée.");
  return true;
}
