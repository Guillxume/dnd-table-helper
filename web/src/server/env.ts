import { z } from "zod";
import { DomainError } from "./errors";

/**
 * Configuration serveur validée au premier accès (et non à l'import) :
 * `next build` charge les modules sans disposer forcément des secrets de production.
 */
const booleanFromString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

/** Variable facultative : une ligne vide (`CLE=`) dans le fichier .env vaut « absente ». */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET doit contenir au moins 32 caractères"),
  BETTER_AUTH_URL: z.url(),
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanFromString.default(true),
  UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(200).default(40),
  /** Base SQLite du bot Discord, partagée avec le site. */
  JDR_DB_PATH: z.string().min(1, "JDR_DB_PATH doit indiquer la base SQLite du bot"),
  /** Serveur Discord de la table (même valeur que pour le bot). Sans elle, seul l'atelier fonctionne. */
  DISCORD_GUILD_ID: optional(z.string().regex(/^\d+$/, "DISCORD_GUILD_ID doit être un identifiant Discord")),
  /** Application Discord du bot, réutilisée pour la connexion des joueurs (OAuth2). Facultatif en local. */
  DISCORD_CLIENT_ID: optional(z.string().regex(/^\d+$/)),
  DISCORD_CLIENT_SECRET: optional(z.string().min(1)),
  /** Aides rédigées par Claude pendant la création (idées, conseil de sorts). Sans clé, les boutons n'apparaissent pas. */
  ANTHROPIC_API_KEY: optional(z.string().min(1)),
  ANTHROPIC_MODEL: optional(z.string().min(1)),
  /** Nombre maximal de demandes à l'assistant par joueur et par heure (protège le crédit prépayé). */
  ASSISTANT_HOURLY_LIMIT: z.coerce.number().int().min(1).max(500).default(12),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Valide un jeu de variables (exporté pour les tests). */
export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Seuls les noms de variables sont journalisés, jamais leurs valeurs.
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configuration invalide : ${issues}`);
  }
  return parsed.data;
}

/** L'espace des personnages est utilisable (serveur Discord de la table configuré). */
export function gameEnabled(): boolean {
  return Boolean(getEnv().DISCORD_GUILD_ID);
}

/** Serveur Discord de la table, exigé par l'espace des joueurs (campagnes, personnages). */
export function getGameGuildId(): string {
  const guildId = getEnv().DISCORD_GUILD_ID;
  if (!guildId) {
    throw new DomainError("L'espace des personnages n'est pas encore configuré (DISCORD_GUILD_ID manquant). Prévenez le MJ.");
  }
  return guildId;
}

/** La connexion Discord n'est proposée que si l'application est configurée. */
export function discordLoginEnabled(): boolean {
  const env = getEnv();
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
}

/** Les aides rédigées par Claude sont proposées seulement si une clé est configurée. */
export function assistantEnabled(): boolean {
  return Boolean(getEnv().ANTHROPIC_API_KEY);
}

export function getUploadMaxBytes(): number {
  return getEnv().UPLOAD_MAX_MB * 1024 * 1024;
}
