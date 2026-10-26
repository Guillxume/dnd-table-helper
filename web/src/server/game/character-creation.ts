import "server-only";
import { MAX_PUBLISH_ATTEMPTS, type StoredCharacter } from "@bot/db";
import type { Story } from "@bot/character/draft";
import { characterPdf } from "@bot/character/render";
import {
  answer,
  back,
  cancelEdit,
  draftOf,
  editStep,
  newState,
  rollOnce,
  storyAnswer,
  type WizardState,
} from "@bot/character/state";
import { nextStep, type Step } from "@bot/character/steps";
import { validateDraft } from "@bot/character/validate";
import { getGameGuildId } from "../env";
import { DomainError, NotFoundError } from "../errors";
import { getBotStore } from "./bot-store";
import { type GameActor, isMjOf, requireCampaign, requireDiscordId } from "./membership";

/**
 * Création de personnage sur le site. Même moteur, même stockage que l'assistant
 * Discord (table character_wizards) : on peut commencer d'un côté et finir de l'autre.
 */

export type WizardAction =
  | { type: "answer"; stepId: string; values: string[] }
  | { type: "back" }
  | { type: "roll" }
  | { type: "edit"; index: number }
  | { type: "cancelEdit" }
  | { type: "story"; story: Story };

function guildId(): string {
  return getGameGuildId();
}

export function getCurrentWizard(actor: GameActor): WizardState | undefined {
  if (!actor.discordId) return undefined;
  return getBotStore().getWizard(guildId(), actor.discordId);
}

/** Démarre une création (remplace une éventuelle création en cours, comme /personnage creer). */
export function beginCreation(actor: GameActor, campaignId: string, name: string): WizardState {
  const discordId = requireDiscordId(actor);
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 40) throw new DomainError("Le nom doit faire entre 2 et 40 caractères.");
  const campaign = requireCampaign(actor, campaignId);
  if (campaign.archived) throw new DomainError(`« ${campaign.name} » est archivée : on n'y crée plus de personnage.`);
  const state: WizardState = {
    ...newState(cleanName, campaign.creationRules),
    campaignId: campaign.channelId,
    campaignName: campaign.name,
  };
  getBotStore().saveWizard(guildId(), discordId, state);
  return state;
}

export function requireWizard(actor: GameActor): { discordId: string; state: WizardState } {
  const discordId = requireDiscordId(actor);
  const state = getBotStore().getWizard(guildId(), discordId);
  if (!state) throw new DomainError("Aucune création en cours.");
  // Le joueur doit toujours faire partie de la campagne du brouillon.
  if (state.campaignId) requireCampaign(actor, state.campaignId);
  return { discordId, state };
}

/** Applique une action à la création en cours. L'étape visée doit être l'étape courante. */
export function applyWizardAction(actor: GameActor, action: WizardAction): WizardState {
  const { discordId, state } = requireWizard(actor);
  let next: WizardState;
  switch (action.type) {
    case "answer": {
      const step = nextStep(draftOf(state));
      if (step.id !== action.stepId) throw new DomainError("Cette étape n'est plus d'actualité : la page a été rechargée.");
      const result = answer(state, action.stepId, action.values);
      if (!result.ok) throw new DomainError(result.error);
      next = result.state;
      break;
    }
    case "story": {
      if (nextStep(draftOf(state)).kind !== "story") throw new DomainError("Cette étape n'est plus d'actualité.");
      const result = storyAnswer(state, action.story);
      if (!result.ok) throw new DomainError(result.error);
      next = result.state;
      break;
    }
    case "back":
      next = back(state);
      break;
    case "roll":
      next = rollOnce(state);
      break;
    case "edit":
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= state.history.length) {
        throw new DomainError("Étape introuvable.");
      }
      next = editStep(state, action.index);
      break;
    case "cancelEdit":
      next = cancelEdit(state);
      break;
  }
  getBotStore().saveWizard(guildId(), discordId, next);
  return next;
}

export function abandonCreation(actor: GameActor): void {
  const discordId = requireDiscordId(actor);
  getBotStore().deleteWizard(guildId(), discordId);
}

/** Enregistre la fiche terminée, exactement comme le bouton « Enregistrer » de Discord. */
export function finishCreation(actor: GameActor): StoredCharacter {
  const { discordId, state } = requireWizard(actor);
  const step: Step = nextStep(draftOf(state));
  if (step.kind !== "done") throw new DomainError("La création n'est pas terminée.");
  const draft = draftOf(state);
  const validation = validateDraft(draft);
  if (validation.errors.length > 0) throw new DomainError("La fiche contient des erreurs à corriger.");
  if (!state.campaignId) throw new DomainError("Cette création n'est rattachée à aucune campagne. Recommencez-la.");
  requireCampaign(actor, state.campaignId);
  const store = getBotStore();
  const saved = store.addCharacter(guildId(), discordId, state.campaignId, state.name, draft);
  store.deleteWizard(guildId(), discordId);
  return saved;
}

/** Personnages visibles : les siens ; pour le MJ d'une campagne, tous ceux de la campagne. */
export function listVisibleCharacters(actor: GameActor): StoredCharacter[] {
  const store = getBotStore();
  return store
    .listCharacters(guildId())
    .filter((character) => character.userId === actor.discordId || canSeeAsMj(actor, character));
}

function canSeeAsMj(actor: GameActor, character: StoredCharacter): boolean {
  const campaign = getBotStore().getCampaign(character.campaignId);
  return campaign ? isMjOf(actor, campaign) : actor.isAdmin;
}

export function getVisibleCharacter(actor: GameActor, id: number): StoredCharacter {
  const character = getBotStore().getCharacter(id);
  if (!character || character.guildId !== guildId()) throw new NotFoundError("Fiche");
  if (character.userId !== actor.discordId && !canSeeAsMj(actor, character)) throw new NotFoundError("Fiche");
  return character;
}

export async function characterSheetPdf(actor: GameActor, id: number): Promise<{ buffer: Buffer; name: string }> {
  const character = getVisibleCharacter(actor, id);
  const player = character.userId === actor.discordId ? (actor.displayName ?? undefined) : undefined;
  return { buffer: await characterPdf(character.draft, player), name: character.name };
}

/** Fiche à cases vides (dés lancés à la table, résultats pas encore saisis). */
export async function blankSheetPdf(actor: GameActor): Promise<{ buffer: Buffer; name: string }> {
  const { state } = requireWizard(actor);
  return {
    buffer: await characterPdf(draftOf(state), actor.displayName ?? undefined, { pendingScores: true }),
    name: `${state.name} a completer`,
  };
}

export type PublicationStatus =
  | { state: "none" }
  | { state: "pending"; requestedAt: string }
  | { state: "published"; publishedAt: string }
  | { state: "failed"; error: string; willRetry: boolean };

/** État de la dernière demande de publication de la fiche dans le salon des fiches. */
export function publicationStatus(actor: GameActor, id: number): PublicationStatus {
  const character = getVisibleCharacter(actor, id);
  const request = getBotStore().latestPublication(character.id);
  if (!request) return { state: "none" };
  if (request.publishedAt) return { state: "published", publishedAt: request.publishedAt };
  if (request.error) return { state: "failed", error: request.error, willRetry: request.attempts < MAX_PUBLISH_ATTEMPTS };
  return { state: "pending", requestedAt: request.requestedAt };
}

/**
 * Demande au bot de publier la fiche (il vérifie les demandes toutes les 30 secondes) :
 * le site n'a pas besoin du jeton du bot. Propriétaire de la fiche ou MJ de la campagne.
 */
export function requestPublication(actor: GameActor, id: number): void {
  const character = getVisibleCharacter(actor, id);
  const campaign = getBotStore().getCampaign(character.campaignId);
  if (!campaign?.sheetsChannelId) {
    throw new DomainError("Le salon des fiches de cette campagne n'est pas enregistré : demandez au MJ de relancer /setup.");
  }
  getBotStore().requestPublication(character.id, actor.discordId ?? `site:${actor.userId}`);
}
