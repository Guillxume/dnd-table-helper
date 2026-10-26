export const E2E_USER = { email: "e2e@atelier.test", password: "mot-de-passe-e2e-solide", name: "E2E" };
export const E2E_PLAYER = { email: "joueuse@atelier.test", password: "mot-de-passe-joueuse", name: "Joueuse" };

/** Données de jeu de test : serveur, campagne et joueuse (base SQLite du bot dédiée aux E2E). */
export const E2E_GAME = {
  guildId: "424242424242424242",
  dbPath: "tests/e2e/.data/jdr.sqlite",
  campaignId: "900000000000000001",
  campaignName: "L'Étoile (test)",
  playerRoleId: "900000000000000002",
  mjRoleId: "900000000000000003",
  playerDiscordId: "900000000000000004",
};
