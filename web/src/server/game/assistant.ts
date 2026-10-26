import "server-only";
import { characterIdeas, spellAdvice } from "@bot/character/assist";
import { draftOf } from "@bot/character/state";
import { nextStep } from "@bot/character/steps";
import { isSpellStep } from "@bot/character/wizard-view";
import { styleBlock } from "@bot/style";
import type { Completer } from "@bot/summarize";
import { assistantEnabled } from "../env";
import { DomainError } from "../errors";
import { consumeQuota, getCompleter, runModel } from "./ai";
import { getBotStore } from "./bot-store";
import { requireWizard } from "./character-creation";
import type { GameActor } from "./membership";

/**
 * Aides de l'assistant de création, rédigées par Claude :
 * mêmes consignes et mêmes textes que les boutons de l'assistant Discord.
 */

export type AssistantKind = "ideas" | "spells";

/** Demande une aide pour l'étape en cours ; l'étape doit correspondre au type d'aide. */
export async function askAssistant(actor: GameActor, kind: AssistantKind): Promise<string> {
  if (!assistantEnabled()) throw new DomainError("L'assistant n'est pas activé sur ce site.");
  const { state } = requireWizard(actor);
  const draft = draftOf(state);
  const step = nextStep(draft);
  let run: (complete: Completer) => Promise<string>;
  if (kind === "ideas") {
    if (step.kind !== "story") throw new DomainError("Les idées sont proposées à l'étape de l'histoire du personnage.");
    const style = state.campaignId ? (getBotStore().getCampaign(state.campaignId)?.style ?? {}) : {};
    run = (complete) => characterIdeas(complete, draft, styleBlock(style));
  } else {
    if ((step.kind !== "multi" && step.kind !== "select") || !isSpellStep(step.id)) {
      throw new DomainError("Le conseil est proposé aux étapes de choix des sorts.");
    }
    run = (complete) => spellAdvice(complete, draft, step);
  }
  getCompleter();
  consumeQuota(actor.userId);
  const text = await runModel("game:assistant", run);
  if (text === "") throw new DomainError("L'assistant n'a rien proposé. Réessaie.");
  return text;
}
