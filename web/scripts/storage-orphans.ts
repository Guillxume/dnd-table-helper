/**
 * Repère les fichiers du stockage qui ne correspondent à aucune illustration
 * (import interrompu, suppression de fichier échouée).
 *
 *   pnpm storage:orphans            liste les orphelins
 *   pnpm storage:orphans --delete   les supprime
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { getDb } from "../src/server/db";
import { getStorage } from "../src/server/storage";

async function main() {
  const { values } = parseArgs({ options: { delete: { type: "boolean", default: false } } });
  const storage = getStorage();
  const assets = await getDb().asset.findMany({
    select: { originalKey: true, thumbnailKey: true, previewKey: true },
  });
  const known = new Set(assets.flatMap((asset) => [asset.originalKey, asset.thumbnailKey, asset.previewKey]));

  const orphans: string[] = [];
  for await (const key of storage.listKeys("assets/")) {
    if (!known.has(key)) orphans.push(key);
  }
  if (orphans.length === 0) {
    console.log("Aucun fichier orphelin.");
    return;
  }
  for (const key of orphans) console.log(key);
  if (values.delete) {
    await storage.deleteMany(orphans);
    console.log(`${orphans.length} fichier(s) orphelin(s) supprimé(s).`);
  } else {
    console.log(`${orphans.length} fichier(s) orphelin(s). Relancer avec --delete pour les supprimer.`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
