export interface DiscordConfig {
  discordToken: string;
  discordClientId: string;
  discordGuildId: string;
}

export interface Config extends DiscordConfig {
  anthropicApiKey: string;
  anthropicModel: string;
  dbPath: string;
  /** URL appelée toutes les 5 minutes tant que le bot est connecté (surveillance), ou null. */
  heartbeatUrl: string | null;
}

export const DEFAULT_MODEL = "claude-haiku-5-5";
export const DEFAULT_DB_PATH = "./data/jdr.sqlite";

function readRequired(env: NodeJS.ProcessEnv, names: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const value = env[name]?.trim() ?? "";
    if (value === "") {
      missing.push(name);
    } else {
      values[name] = value;
    }
  }
  if (missing.length > 0) {
    // Seuls les noms des variables sont affichés, jamais leurs valeurs.
    throw new Error(
      `Variables d'environnement manquantes : ${missing.join(", ")}. Copiez .env.example vers .env et remplissez-le.`,
    );
  }
  return values;
}

export function loadDiscordConfig(env: NodeJS.ProcessEnv = process.env): DiscordConfig {
  const v = readRequired(env, ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID"]);
  return {
    discordToken: v["DISCORD_TOKEN"] ?? "",
    discordClientId: v["DISCORD_CLIENT_ID"] ?? "",
    discordGuildId: v["DISCORD_GUILD_ID"] ?? "",
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const discord = loadDiscordConfig(env);
  const v = readRequired(env, ["ANTHROPIC_API_KEY"]);
  return {
    ...discord,
    anthropicApiKey: v["ANTHROPIC_API_KEY"] ?? "",
    anthropicModel: env["ANTHROPIC_MODEL"]?.trim() || DEFAULT_MODEL,
    dbPath: env["DB_PATH"]?.trim() || DEFAULT_DB_PATH,
    heartbeatUrl: env["HEARTBEAT_URL"]?.trim() || null,
  };
}
