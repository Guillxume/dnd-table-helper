import type { Draft, Story } from "./draft.js";
import { applyAnswer } from "./steps.js";
import type { CreationRules } from "./rules.js";

/**
 * État d'un assistant de création en cours : le nom, le tirage de dés (définitif) et la liste des réponses.
 * Le brouillon est reconstruit en rejouant les réponses, ce qui permet de revenir en arrière
 * sans jamais relancer les dés.
 */
export interface WizardState {
  name: string;
  /** Paramètres de la campagne figés au début de la création. */
  rules?: CreationRules;
  /** Campagne du personnage (salon de rappel de la campagne). */
  campaignId?: string;
  campaignName?: string;
  rolls?: number[];
  rollDice?: number[][];
  history: { id: string; values: string[] }[];
  /** Modification d'étape en cours : réponse d'origine et réponses suivantes, rejouées tant qu'elles restent valides. */
  edit?: { original: { id: string; values: string[] }; rest: { id: string; values: string[] }[] };
}

export function newState(name: string, rules?: CreationRules): WizardState {
  return { name, ...(rules ? { rules } : {}), history: [] };
}

export function draftOf(state: WizardState): Draft {
  let d: Draft = {
    name: state.name,
    ...(state.rules ? { rules: state.rules } : {}),
    ...(state.rolls ? { rolls: state.rolls } : {}),
    ...(state.rollDice ? { rollDice: state.rollDice } : {}),
  };
  for (const h of state.history) {
    const res = applyAnswer(d, h.id, h.values);
    if (!res.ok) throw new Error(`Historique incohérent à l’étape ${h.id} : ${res.error}`);
    d = res.draft;
  }
  return d;
}

export type StateResult = { ok: true; state: WizardState } | { ok: false; error: string };

export function answer(state: WizardState, id: string, values: string[]): StateResult {
  const res = applyAnswer(draftOf(state), id, values);
  if (!res.ok) return res;
  return { ok: true, state: replayPending({ ...state, history: [...state.history, { id, values }] }) };
}

/**
 * Rejoue les réponses mises de côté : chacune est réappliquée si l'étape suivante est la même et
 * que la réponse est encore valide. Dès qu'une réponse ne s'applique plus (un choix dépendant a changé),
 * le rejeu s'arrête et le joueur reprend la main à cette étape.
 */
function replayPending(state: WizardState): WizardState {
  if (!state.edit) return state;
  const { edit, ...base } = state;
  let s: WizardState = base;
  let d = draftOf(s);
  for (const h of edit.rest) {
    const res = applyAnswer(d, h.id, h.values);
    if (!res.ok) break;
    d = res.draft;
    s = { ...s, history: [...s.history, h] };
  }
  return s;
}

/** Revient sur la réponse n° `index` de l'historique en conservant les suivantes pour les rejouer. */
export function editStep(state: WizardState, index: number): WizardState {
  const original = state.history[index];
  if (!original) return state;
  const { edit: _drop, ...base } = state;
  return { ...base, history: state.history.slice(0, index), edit: { original, rest: state.history.slice(index + 1) } };
}

/** Annule une modification en cours : la réponse d'origine et les suivantes sont rejouées. */
export function cancelEdit(state: WizardState): WizardState {
  if (!state.edit) return state;
  const res = answer(state, state.edit.original.id, state.edit.original.values);
  return res.ok ? res.state : state;
}

/** Lance les dés une seule fois : sans effet si le tirage existe déjà. */
export function rollOnce(state: WizardState, rng?: () => number): WizardState {
  if (state.rolls) return state;
  const res = applyAnswer(draftOf(state), "roll", [], rng);
  if (!res.ok || !res.draft.rolls || !res.draft.rollDice) return state;
  return { ...state, rolls: res.draft.rolls, rollDice: res.draft.rollDice };
}

export function back(state: WizardState): WizardState {
  const { edit: _drop, ...rest } = state;
  return { ...rest, history: state.history.slice(0, -1) };
}

export function storyAnswer(state: WizardState, story: Story): StateResult {
  return answer(state, "story", [JSON.stringify(story)]);
}
