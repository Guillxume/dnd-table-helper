import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Redirection optimiste vers /login quand aucun cookie de session n'est présent.
 * Ce n'est PAS le contrôle d'accès : chaque page, action et route vérifie la
 * session côté serveur (src/server/session.ts). Le proxy évite seulement de
 * rendre une page pour un visiteur manifestement non connecté.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const loginUrl = new URL("/login", request.url);
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (target !== "/") loginUrl.searchParams.set("next", target);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Exclus : /login, les routes /api (elles répondent 401 elles-mêmes et
  // l'upload ne doit pas être mis en mémoire tampon par le proxy), les assets Next,
  // et le logo (public/brand), affiché sur la page de connexion.
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|brand/).*)"],
};
