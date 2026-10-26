import sharp from "sharp";
import { getDb } from "../../src/server/db";
import { getStorage } from "../../src/server/storage";

type Format = "jpeg" | "png" | "webp" | "avif";

let counter = 0;

/**
 * Image de test unique : la couleur varie à chaque appel pour que deux images
 * générées n'aient jamais la même empreinte (sauf réutilisation volontaire du buffer).
 */
export async function makeImage(options: { width?: number; height?: number; format?: Format } = {}): Promise<Buffer> {
  counter += 1;
  const { width = 1200, height = 800, format = "png" } = options;
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: (counter * 37) % 256, g: (counter * 91) % 256, b: (counter * 53) % 256 },
    },
  });
  return image.toFormat(format).toBuffer();
}

/** Vide toutes les tables métier et le bucket de test. */
export async function resetTestState(): Promise<void> {
  const tables = [
    "BattleMap",
    "GenerationReference",
    "GenerationRecord",
    "BriefReference",
    "Brief",
    "StyleGuideAsset",
    "StyleGuideRule",
    "StyleGuideVersion",
    "StyleGuide",
    "CharacterAsset",
    "CharacterTrait",
    "Character",
    "CollectionAsset",
    "Collection",
    "AssetTag",
    "Tag",
    "Asset",
    "Category",
    "session",
    "account",
    "verification",
    "user",
  ];
  await getDb().$executeRawUnsafe(`TRUNCATE ${tables.map((table) => `"${table}"`).join(", ")} CASCADE`);
  const storage = getStorage();
  const keys: string[] = [];
  for await (const key of storage.listKeys("")) keys.push(key);
  await storage.deleteMany(keys);
}

export async function readObject(key: string): Promise<Buffer | null> {
  const object = await getStorage().get(key);
  if (!object) return null;
  return Buffer.from(await new Response(object.body).arrayBuffer());
}
