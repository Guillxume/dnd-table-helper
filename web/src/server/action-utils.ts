import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { DomainError, isRecordNotFound, logError } from "./errors";
import { requireMember, requireUser, type SessionUser } from "./session";

/**
 * Enveloppe commune des Server Actions :
 * 1. vérifie la session (une action est un point d'entrée HTTP public) ;
 * 2. convertit les erreurs de validation et métier en message affichable ;
 * 3. journalise les erreurs techniques et renvoie un message générique.
 */
export async function runAction<T = undefined>(
  context: string,
  handler: () => Promise<ActionResult<T> | void>,
): Promise<ActionResult<T>> {
  await requireUser();
  return handleErrors(context, handler);
}

/** Variante pour l'espace des personnages : tout utilisateur connecté ; les droits fins sont vérifiés par le service. */
export async function runMemberAction<T = undefined>(
  context: string,
  handler: (user: SessionUser) => Promise<ActionResult<T> | void>,
): Promise<ActionResult<T>> {
  const user = await requireMember();
  return handleErrors(context, () => handler(user));
}

async function handleErrors<T>(
  context: string,
  handler: () => Promise<ActionResult<T> | void>,
): Promise<ActionResult<T>> {
  try {
    const result = await handler();
    return result ?? { ok: true };
  } catch (error) {
    // Laisse passer les signaux internes de Next (redirect, notFound…).
    unstable_rethrow(error);
    if (error instanceof z.ZodError) {
      const flat = z.flattenError(error);
      return {
        ok: false,
        error: flat.formErrors[0] ?? "Certains champs sont invalides.",
        fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
      };
    }
    if (error instanceof DomainError) return { ok: false, error: error.message };
    if (isRecordNotFound(error)) return { ok: false, error: "L'élément n'existe plus. Rechargez la page." };
    logError(context, error);
    return { ok: false, error: "Une erreur inattendue est survenue. Réessayez." };
  }
}

/** Les pages sont dynamiques : on invalide tout l'arbre, ce qui reste simple et sûr pour un seul utilisateur. */
export function refreshAll(): void {
  revalidatePath("/", "layout");
}

/** Lecture d'un FormData en objet simple (les champs répétés deviennent des tableaux). */
export function formToObject(form: FormData, arrayFields: readonly string[] = []): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = form.getAll(key).filter((value): value is string => typeof value === "string");
    result[key] = arrayFields.includes(key) ? values : values[0];
  }
  return result;
}

/** Champ JSON transmis par un formulaire client (listes de références, etc.). */
export function parseJsonField(value: unknown): unknown {
  if (typeof value !== "string" || value === "") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new DomainError("Données de formulaire illisibles.");
  }
}

export const idSchema = z.uuid({ message: "Identifiant invalide." });
export const idListSchema = z.array(idSchema).min(1, "Aucun élément sélectionné.").max(500);
