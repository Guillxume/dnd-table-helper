import { openStore, type Store } from "@bot/db";
import { getEnv } from "../env";

/**
 * Accès à la base SQLite du bot Discord (campagnes, joueurs, assistants de
 * création, personnages). Le site et le bot partagent ce fichier : un brouillon
 * commencé sur Discord se reprend sur le site, et inversement.
 *
 * SQLite en mode WAL accepte plusieurs processus sur la même machine ; les
 * écritures sont courtes et better-sqlite3 attend jusqu'à 5 s si la base est verrouillée.
 */
const globalForStore = globalThis as unknown as { botStore?: Store };

export function getBotStore(): Store {
  if (!globalForStore.botStore) {
    globalForStore.botStore = openStore(getEnv().JDR_DB_PATH);
  }
  return globalForStore.botStore;
}

/** Réservé aux tests. */
export function setBotStoreForTests(store: Store | undefined): void {
  globalForStore.botStore = store;
}
