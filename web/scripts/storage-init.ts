/** Crée le bucket configuré (S3_BUCKET) s'il n'existe pas. Idempotent. */
import "dotenv/config";
import { getEnv } from "../src/server/env";
import { getStorage } from "../src/server/storage";

const ATTEMPTS = 30;
const DELAY_MS = 2000;

/** Le stockage peut mettre quelques secondes à accepter des requêtes après son démarrage. */
async function main() {
  // Une configuration invalide ne se corrige pas en attendant : erreur immédiate.
  getEnv();
  for (let attempt = 1; ; attempt += 1) {
    try {
      await getStorage().ensureReady();
      console.log(`Stockage prêt (bucket « ${getEnv().S3_BUCKET} »).`);
      return;
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
      console.log(`Stockage indisponible (tentative ${attempt}/${ATTEMPTS}), nouvel essai…`);
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }
}

main().catch((error: unknown) => {
  console.error("Initialisation du stockage impossible :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
