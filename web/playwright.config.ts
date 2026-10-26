import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import { config } from "dotenv";
import { E2E_GAME } from "./tests/e2e/credentials";

config({ quiet: true });

/**
 * Tests de bout en bout sur un build de production, branché sur la base et le
 * bucket de TEST (jamais ceux de développement) : la configuration globale
 * vide ces données avant l'exécution.
 */
const PORT = Number(process.env.E2E_PORT ?? 3210);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth/user.json" },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: `${baseURL}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      S3_BUCKET: process.env.S3_TEST_BUCKET ?? "",
      BETTER_AUTH_URL: baseURL,
      JDR_DB_PATH: resolve(E2E_GAME.dbPath),
      DISCORD_GUILD_ID: E2E_GAME.guildId,
      // Indépendant du .env local : pas de connexion Discord (formulaire e-mail déplié),
      // pas de clé Anthropic (aucun appel réel au modèle pendant les tests).
      DISCORD_CLIENT_ID: "",
      DISCORD_CLIENT_SECRET: "",
      ANTHROPIC_API_KEY: "",
      // Chemin absolu : le serveur autonome change de répertoire de travail au démarrage.
      SHEET_TEMPLATE: resolve("../ref/DD5-eFeuillePersoDD5.pdf"),
    },
  },
});
