import { execFileSync } from "node:child_process";
import { applyTestEnv } from "./test-env";

/** Applique les migrations sur la base de test et prépare le bucket, une fois par exécution. */
export default async function setup(): Promise<void> {
  applyTestEnv();
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: process.env,
    stdio: "pipe",
  });
  const { getStorage } = await import("../../src/server/storage");
  // Le stockage peut mettre une quinzaine de secondes à accepter des requêtes après son démarrage (CI).
  for (let attempt = 1; ; attempt += 1) {
    try {
      await getStorage().ensureReady();
      break;
    } catch (error) {
      if (attempt >= 30) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
