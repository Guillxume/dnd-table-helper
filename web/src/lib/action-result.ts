/** Résultat uniforme des Server Actions, sérialisable vers le client. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** État des formulaires pilotés par useActionState, avant toute soumission. */
export type FormState<T = undefined> = ActionResult<T> | { ok: null };

export const IDLE_FORM: { ok: null } = { ok: null };
