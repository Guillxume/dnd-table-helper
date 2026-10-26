import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { handleInteraction } from "./commands.js";
import { loadConfig } from "./config.js";
import { openStore } from "./db.js";
import { createAnthropicCompleter } from "./summarize.js";
import { startReminders } from "./schedule.js";
import { startHeartbeat } from "./heartbeat.js";
import { startPublications } from "./publish.js";

const config = loadConfig();
const store = openStore(config.dbPath);
const complete = createAnthropicCompleter(config.anthropicApiKey, config.anthropicModel);
// Aucune mention ne notifie par défaut (un rappel écrit par Haiku pourrait contenir @everyone) :
// les messages qui doivent mentionner un rôle le déclarent eux-mêmes avec allowedMentions.
const client = new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: { parse: [] } });

client.on(Events.Error, (err) => console.error("Erreur du client Discord :", err));
client.on(Events.Warn, (message) => console.warn("Avertissement Discord :", message));
process.on("unhandledRejection", (reason) => console.error("Promesse rejetée non gérée :", reason));

client.once(Events.ClientReady, (c) => {
  console.log(`Connecté en tant que ${c.user.tag}`);
  const guilds = [...c.guilds.cache.values()].map((g) => `${g.name} (${g.id})`);
  console.log(
    guilds.length > 0
      ? `Serveurs où le bot est présent : ${guilds.join(", ")}`
      : "Le bot n'est présent sur aucun serveur : il faut l'inviter avec le lien d'invitation.",
  );
  console.log(`Serveur attendu (DISCORD_GUILD_ID) : ${config.discordGuildId}`);
  startReminders(c, store);
  startPublications(c, store);
  if (config.heartbeatUrl) {
    startHeartbeat(config.heartbeatUrl, () => client.isReady());
    console.log("Surveillance activée (HEARTBEAT_URL).");
  }
});

client.on(Events.InteractionCreate, (interaction) => {
  handleInteraction(interaction, { store, complete }).catch((err: unknown) => {
    console.error("Erreur d'interaction :", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      interaction.reply({ content: "Une erreur est survenue.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
    } else if (interaction.isRepliable() && interaction.deferred) {
      interaction.editReply({ content: "Une erreur est survenue." }).catch(() => undefined);
    }
  });
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    store.close();
    void client.destroy().finally(() => process.exit(0));
  });
}

await client.login(config.discordToken);
