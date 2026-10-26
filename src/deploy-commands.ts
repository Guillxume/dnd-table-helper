import { REST, Routes } from "discord.js";
import { commandDefinitions } from "./commands.js";
import { loadDiscordConfig } from "./config.js";

const config = loadDiscordConfig();
const rest = new REST().setToken(config.discordToken);
const body = commandDefinitions.map((c) => c.toJSON());
await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId), { body });
console.log(`${body.length} commandes enregistrées pour le serveur ${config.discordGuildId}.`);
