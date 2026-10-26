import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth, type UserRole } from "./auth";

export type SessionUser = { id: string; email: string; name: string; role: UserRole };

function toSessionUser(user: { id: string; email: string; name: string; role?: unknown }): SessionUser {
  // Tout rôle inattendu est traité comme le moins privilégié.
  const role: UserRole = user.role === "admin" ? "admin" : "player";
  return { id: user.id, email: user.email, name: user.name, role };
}

/** Session de la requête courante, mémorisée pour la durée du rendu. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // headers() d'abord : la page est ainsi marquée dynamique avant toute lecture de
  // configuration, ce qui permet à `next build` de tourner sans les secrets.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session ? toSessionUser(session.user) : null;
});

/**
 * Atelier (bibliothèque, référentiel, briefs, générations) : réservé au MJ.
 * À appeler en tête de chaque page, Server Action et route de l'atelier.
 * Le proxy ne fait qu'une redirection optimiste sur la présence du cookie :
 * c'est ce contrôle-ci qui fait foi.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/personnages");
  return user;
}

/** Espace des personnages : tout utilisateur connecté (MJ ou joueur). Les droits fins sont vérifiés par campagne. */
export async function requireMember(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Route handlers de l'atelier : null si la session est absente ou n'est pas celle du MJ. */
export async function getUserFromRequest(request: Request): Promise<SessionUser | null> {
  const user = await getMemberFromRequest(request);
  return user?.role === "admin" ? user : null;
}

/** Route handlers de l'espace des personnages : tout utilisateur connecté. */
export async function getMemberFromRequest(request: Request): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  return session ? toSessionUser(session.user) : null;
}
