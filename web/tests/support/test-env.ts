import { config } from "dotenv";

/**
 * Bascule la configuration vers la base et le bucket de test.
 * Refuse de démarrer si la base de test n'est pas distincte de la base de
 * développement : les tests vident les tables.
 */
export function applyTestEnv(): void {
  // Le setup global s'exécute dans le processus principal ; les workers héritent
  // de son environnement déjà basculé.
  if (process.env.JDR_TEST_ENV_APPLIED === "1") return;
  config({ quiet: true });
  const testUrl = process.env.TEST_DATABASE_URL;
  const testBucket = process.env.S3_TEST_BUCKET;
  if (!testUrl || !testBucket) {
    throw new Error("TEST_DATABASE_URL et S3_TEST_BUCKET doivent être définis (voir .env.example).");
  }
  if (testUrl === process.env.DATABASE_URL || testBucket === process.env.S3_BUCKET) {
    throw new Error("La base et le bucket de test doivent être distincts de ceux de développement.");
  }
  process.env.DATABASE_URL = testUrl;
  process.env.S3_BUCKET = testBucket;
  // Serveur Discord fictif : les tests ne dépendent jamais de la configuration réelle.
  process.env.DISCORD_GUILD_ID = "424242424242424242";
  // Active l'assistant ; les tests remplacent le modèle par une doublure (aucun appel réel).
  process.env.ANTHROPIC_API_KEY = "cle-de-test-jamais-utilisee";
  process.env.ASSISTANT_HOURLY_LIMIT = "3";
  process.env.JDR_TEST_ENV_APPLIED = "1";
}
