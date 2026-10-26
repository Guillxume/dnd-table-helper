import "server-only";
import { listCharacterOptions } from "../characters/characters";
import { listStyleGuideOptions } from "../style-guides/style-guides";

/** Listes de choix du formulaire de brief. */
export async function getBriefFormOptions() {
  const [characters, guides] = await Promise.all([listCharacterOptions(), listStyleGuideOptions()]);
  return { characters, guides };
}
