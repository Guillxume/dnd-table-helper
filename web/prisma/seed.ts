/**
 * Catégories initiales, proposées une seule fois : si la table contient déjà
 * des catégories (même une seule), rien n'est fait. Elles restent ensuite
 * entièrement modifiables et supprimables depuis l'application.
 */
import "dotenv/config";
import { getDb } from "../src/server/db";
import { slugify } from "../src/lib/text";

const INITIAL_CATEGORIES = [
  "Portraits",
  "Personnages complets",
  "Fiches de personnages illustrées",
  "PNJ",
  "Créatures et monstres",
  "Armes et équipements",
  "Objets magiques",
  "Effets magiques",
  "Environnements",
  "Villes et architectures",
  "Donjons",
  "Cartes de bataille",
  "Compositions",
  "Palettes et éclairages",
  "Textures et techniques picturales",
];

async function main() {
  const db = getDb();
  if ((await db.category.count()) > 0) {
    console.log("Catégories déjà présentes : seed ignoré.");
    return;
  }
  await db.category.createMany({
    data: INITIAL_CATEGORIES.map((name, index) => ({ name, slug: slugify(name), sortOrder: index * 10 })),
  });
  console.log(`${INITIAL_CATEGORIES.length} catégories initiales créées.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
