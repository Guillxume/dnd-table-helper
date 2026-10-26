import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { draftOf, type WizardState } from "./state.js";
import { nextStep, type Option, type Step } from "./steps.js";
import { methodOf } from "./helpers.js";
import { cut, editOptions, helpFor, isSpellStep, rollsText, summary } from "./wizard-view.js";
import { recapText, validateDraft } from "./validate.js";
import { explainOption } from "./explain.js";
import { selectionSummary } from "./spell-tags.js";

export const DISCORD_MENU_LIMIT = 25;
export const MAX_MENUS = 4;

export interface WizardMessage {
  content: string;
  components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[];
}


export function chunkOptions(options: Option[]): Option[][] {
  const out: Option[][] = [];
  for (let i = 0; i < options.length; i += DISCORD_MENU_LIMIT) out.push(options.slice(i, i + DISCORD_MENU_LIMIT));
  return out;
}

function navRow(state: WizardState, extra: ButtonBuilder[] = [], details = false): ActionRowBuilder<ButtonBuilder>[] {
  const step = nextStep(draftOf(state));
  const advice = details && isSpellStep(step.id);
  const main = [
    ...extra,
    ...(state.edit ? [new ButtonBuilder().setCustomId("pc:editcancel").setLabel("Annuler la modification").setStyle(ButtonStyle.Secondary)] : []),
    new ButtonBuilder().setCustomId("pc:back").setLabel("Retour").setStyle(ButtonStyle.Secondary).setDisabled(state.history.length === 0),
    new ButtonBuilder().setCustomId("pc:cancel").setLabel("Abandonner").setStyle(ButtonStyle.Danger),
  ];
  const help = [
    ...(details ? [new ButtonBuilder().setCustomId("pc:info").setLabel("Détails des options").setStyle(ButtonStyle.Secondary)] : []),
    ...(advice ? [new ButtonBuilder().setCustomId("pc:advice").setLabel("Conseil de l’assistant").setStyle(ButtonStyle.Secondary)] : []),
  ];
  // Discord : 5 boutons par rangée au plus.
  if (main.length + help.length <= 5) return [new ActionRowBuilder<ButtonBuilder>().addComponents(...help, ...main)];
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(...help), new ActionRowBuilder<ButtonBuilder>().addComponents(...main)];
}

function menu(customId: string, placeholder: string, options: Option[], opts: { multi?: { max: number; selected: string[] } } = {}) {
  const m = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(cut(placeholder, 150));
  m.addOptions(
    options.map((o) => {
      const b = new StringSelectMenuOptionBuilder().setLabel(cut(o.label, 100)).setValue(cut(o.value, 100));
      if (o.description) b.setDescription(cut(o.description, 100));
      if (opts.multi?.selected.includes(o.value)) b.setDefault(true);
      return b;
    }),
  );
  if (opts.multi) m.setMinValues(0).setMaxValues(Math.min(options.length, opts.multi.max));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(m);
}

/** Menus « Modifier une étape » (une rangée est gardée pour les boutons). */
function editMenus(state: WizardState, components: WizardMessage["components"]): void {
  chunkOptions(editOptions(state))
    .slice(0, MAX_MENUS - 1)
    .forEach((c, k, all) => components.push(menu(`pc:e:${k}`, all.length > 1 ? `Modifier une étape (${k + 1}/${all.length})` : "Modifier une étape", c)));
}

/** Message de l'étape courante. `pending` : sélection en cours pour une étape à choix multiples. */
export function renderWizard(state: WizardState, pending: string[] = [], notice = ""): WizardMessage {
  const d = draftOf(state);
  const step: Step = nextStep(d);
  const head = [`**Création de ${state.name}**${state.campaignName ? ` · campagne « ${state.campaignName} »` : ""}`, summary(d)].filter(Boolean).join("\n");
  const body: string[] = [];
  const components: WizardMessage["components"] = [];

  switch (step.kind) {
    case "name":
      body.push(step.title);
      break;
    case "roll":
      body.push(`**${step.title}**`, helpFor(step.id, step.help, "discord"));
      components.push(
        ...navRow(state, [new ButtonBuilder().setCustomId("pc:roll").setLabel("Lancer les dés").setStyle(ButtonStyle.Primary)]),
      );
      break;
    case "confirm":
      body.push(`**${step.title}**`, helpFor(step.id, step.help, "discord"));
      components.push(
        ...navRow(state, [new ButtonBuilder().setCustomId(`pc:c:${step.id}`).setLabel(step.button).setStyle(ButtonStyle.Primary)]),
      );
      break;
    case "story":
      body.push(`**${step.title}**`, helpFor(step.id, step.help, "discord"));
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("pc:story:write").setLabel("Écrire mon texte").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("pc:story:ideas").setLabel("Idées de l’assistant").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("pc:story:skip").setLabel("Passer").setStyle(ButtonStyle.Secondary),
        ),
        ...navRow(state),
      );
      break;
    case "table": {
      body.push(`**${step.title}**`, helpFor(step.id, step.help, "discord"));
      body.push("Pour changer un autre choix avant le tirage, utilise « Modifier une étape ».");
      editMenus(state, components);
      components.push(
        ...navRow(state, [
          new ButtonBuilder().setCustomId("pc:table:enter").setLabel("Saisir mes résultats").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("pc:table:blank").setLabel("Fiche à cases vides").setStyle(ButtonStyle.Secondary),
        ]),
      );
      break;
    }
    case "done": {
      const v = validateDraft(d);
      body.push("**Récapitulatif et contrôles**");
      if (v.sheet) body.push(recapText(v.sheet));
      if (v.errors.length) body.push(`**À corriger avant d’enregistrer :**\n${v.errors.map((e) => `• ${e}`).join("\n")}`);
      if (v.warnings.length) body.push(`**À noter :**\n${v.warnings.map((e) => `• ${e}`).join("\n")}`);
      body.push("Pour changer un choix sans tout refaire, utilise « Modifier une étape » : les choix suivants sont conservés tant qu’ils restent valides.");
      editMenus(state, components);
      components.push(
        ...navRow(state, [
          new ButtonBuilder().setCustomId("pc:finish").setLabel("Enregistrer et générer la fiche").setStyle(ButtonStyle.Success).setDisabled(v.errors.length > 0),
        ]),
      );
      break;
    }
    case "select": {
      body.push(`**${step.title}**`);
      if (step.help) body.push(helpFor(step.id, step.help, "discord"));
      if (step.id.startsWith("assign.")) body.push(rollsText(d));
      let options = step.options;
      if (step.id.startsWith("assign.") && methodOf(d) === "des") {
        options = options.map((o) => ({ ...o, description: `dés ${d.rollDice?.[Number(o.value)]?.join(", ") ?? ""}` }));
      }
      const chunks = chunkOptions(options).slice(0, MAX_MENUS);
      chunks.forEach((c, k) =>
        components.push(menu(`pc:s:${step.id}:${k}`, chunks.length > 1 ? `${step.title} (${k + 1}/${chunks.length})` : step.title, c)),
      );
      components.push(...navRow(state, [], true));
      break;
    }
    case "multi": {
      body.push(`**${step.title}**`);
      if (step.help) body.push(helpFor(step.id, step.help, "discord"));
      const names = pending.map((v) => step.options.find((o) => o.value === v)?.label ?? v);
      if (isSpellStep(step.id)) {
        const sum = selectionSummary(pending);
        if (sum) body.push(sum);
        body.push("Chaque option indique le type d’effet, les dégâts et la portée lus dans le SRD. « Détails des options » donne le texte complet ; « Conseil de l’assistant » propose une sélection adaptée à ton personnage.");
      }
      body.push(
        `Sélection : ${names.length ? names.join(", ") : "aucune"} (${pending.length}/${step.max === step.min ? step.max : `${step.min} à ${step.max}`}).`,
      );
      const chunks = chunkOptions(step.options).slice(0, MAX_MENUS);
      chunks.forEach((c, k) =>
        components.push(
          menu(`pc:m:${step.id}:${k}`, chunks.length > 1 ? `${step.title} (${k + 1}/${chunks.length})` : step.title, c, {
            multi: { max: step.max, selected: pending },
          }),
        ),
      );
      const ok = pending.length >= step.min && pending.length <= step.max;
      components.push(
        ...navRow(state, [
          new ButtonBuilder().setCustomId(`pc:ok:${step.id}`).setLabel("Valider").setStyle(ButtonStyle.Success).setDisabled(!ok),
        ], true),
      );
      break;
    }
  }

  const content = [notice, head, ...body].filter(Boolean).join("\n\n");
  return { content: cut(content, 1990), components };
}

/** Message de consultation : un menu des options de l'étape, et la description de l'option choisie. */
export function renderInfo(state: WizardState, chosen?: string): WizardMessage | undefined {
  const d = draftOf(state);
  const step = nextStep(d);
  if (step.kind !== "select" && step.kind !== "multi") return undefined;
  const chunks = chunkOptions(step.options).slice(0, 5);
  const components: WizardMessage["components"] = chunks.map((c, k) =>
    menu(`pc:i:${step.id}:${k}`, chunks.length > 1 ? `Lire la description (${k + 1}/${chunks.length})` : "Lire la description", c),
  );
  const content = chosen ? explainOption(step, chosen, d) : `**${step.title}** : choisis une option pour lire sa description. Ce message ne modifie pas ton personnage.`;
  return { content: cut(content, 1990), components };
}
