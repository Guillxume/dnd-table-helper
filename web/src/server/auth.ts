import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "./db";
import { getEnv } from "./env";

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Bibliothèque privée : l'inscription publique est désactivée.
 * Le seul moyen de créer un compte est le script `pnpm user:create`,
 * qui instancie une configuration avec `allowSignUp: true`.
 */
export const USER_ROLES = ["admin", "player"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Deux façons de se connecter :
 * - e-mail et mot de passe : comptes du MJ (rôle « admin »), créés en ligne de commande ;
 * - Discord : joueurs (rôle « player »). Le compte est créé à la première connexion ;
 *   l'accès aux campagnes dépend ensuite des rôles Discord (src/server/game/membership.ts).
 */
export function createAuth({ allowSignUp }: { allowSignUp: boolean }) {
  const env = getEnv();
  const discord =
    env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
      ? {
          discord: {
            clientId: env.DISCORD_CLIENT_ID,
            clientSecret: env.DISCORD_CLIENT_SECRET,
            // Lecture des rôles du joueur sur le serveur de la table, sans le jeton du bot.
            scope: ["guilds.members.read"],
          },
        }
      : undefined;
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      autoSignIn: false,
    },
    socialProviders: discord,
    user: {
      additionalFields: {
        // Jamais modifiable par le client (input: false) : seul le serveur attribue le rôle.
        role: { type: "string", required: false, defaultValue: "player", input: false },
      },
    },
    account: {
      // Les jetons Discord sont chiffrés en base avec BETTER_AUTH_SECRET.
      encryptOAuthTokens: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      // Actif aussi en développement pour que le comportement soit testable.
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
      },
    },
    // nextCookies doit rester le dernier plugin : il pose les cookies
    // lorsque l'authentification est appelée depuis une Server Action.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { auth?: Auth };

export function getAuth(): Auth {
  if (!globalForAuth.auth) {
    globalForAuth.auth = createAuth({ allowSignUp: false });
  }
  return globalForAuth.auth;
}
