import "server-only";
import { DEFAULT_MODEL } from "@bot/config";
import { createAnthropicCompleter, type Completer } from "@bot/summarize";
import { getEnv } from "../env";
import { DomainError, logError } from "../errors";

/**
 * Accès au modèle (Claude, clé ANTHROPIC_API_KEY du site) pour toutes les aides rédigées :
 * assistant de création des joueurs, outils du MJ. Un seul client, un plafond par personne.
 */

const HOUR_MS = 60 * 60 * 1000;

let completer: Completer | undefined;

export function getCompleter(): Completer {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) throw new DomainError("L'assistant n'est pas activé sur ce site.");
  completer ??= createAnthropicCompleter(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL ?? DEFAULT_MODEL);
  return completer;
}

/** Remplaçable en test : aucun appel réel au modèle. */
export function setCompleterForTests(fake: Completer | undefined): void {
  completer = fake;
}

/**
 * Plafond de demandes par personne sur une heure glissante. En mémoire : le site tourne dans un
 * seul conteneur, et un redémarrage qui remet les compteurs à zéro est sans gravité.
 */
const recentCalls = new Map<string, number[]>();

export function consumeQuota(userId: string, limit = getEnv().ASSISTANT_HOURLY_LIMIT, now = Date.now()): void {
  const calls = (recentCalls.get(userId) ?? []).filter((time) => now - time < HOUR_MS);
  if (calls.length >= limit) {
    const waitMinutes = Math.max(1, Math.ceil((HOUR_MS - (now - (calls[0] ?? now))) / 60000));
    throw new DomainError(`Tu as beaucoup sollicité l'assistant. Réessaie dans ${waitMinutes} minute${waitMinutes > 1 ? "s" : ""}.`);
  }
  calls.push(now);
  recentCalls.set(userId, calls);
}

export function resetQuotasForTests(): void {
  recentCalls.clear();
}

/** Appelle le modèle ; une panne (réseau, crédit épuisé) devient un message simple, le détail va au journal. */
export async function runModel<T>(context: string, call: (complete: Completer) => Promise<T>): Promise<T> {
  const complete = getCompleter();
  try {
    return await call(complete);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    logError(context, error);
    throw new DomainError("L'assistant ne répond pas pour le moment. Réessaie dans quelques minutes, ou écris ton texte toi-même.");
  }
}
