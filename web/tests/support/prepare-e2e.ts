/**
 * Prépare la base et le bucket de TEST pour les tests de bout en bout :
 * migrations, données vidées, comptes de test (MJ et joueuse), base SQLite du bot
 * de test avec une campagne. Lancé par tsx (alias « @/ » résolus).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { openStore } from "@bot/db";
import { E2E_GAME, E2E_PLAYER, E2E_USER } from "../e2e/credentials";
import { applyTestEnv } from "./test-env";

async function main() {
  applyTestEnv();
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], { env: process.env, stdio: "pipe" });
  const { getStorage } = await import("../../src/server/storage");
  await getStorage().ensureReady();
  const { resetTestState } = await import("./fixtures");
  await resetTestState();

  const { createAuth } = await import("../../src/server/auth");
  const { getDb } = await import("../../src/server/db");
  const auth = createAuth({ allowSignUp: true });
  await auth.api.signUpEmail({ body: E2E_USER });
  await getDb().user.update({ where: { email: E2E_USER.email }, data: { role: "admin" } });

  // La joueuse se connecte par e-mail dans les tests (la connexion Discord réelle n'est pas
  // automatisable) ; ses rôles Discord sont posés directement, comme après une lecture réussie.
  await auth.api.signUpEmail({ body: E2E_PLAYER });
  const player = await getDb().user.findUniqueOrThrow({ where: { email: E2E_PLAYER.email } });
  await getDb().discordMember.create({
    data: {
      userId: player.id,
      discordId: E2E_GAME.playerDiscordId,
      guildId: E2E_GAME.guildId,
      roleIds: [E2E_GAME.playerRoleId],
      displayName: "Joueuse",
      inGuild: true,
      fetchedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  await getDb().$disconnect();

  rmSync(dirname(E2E_GAME.dbPath), { recursive: true, force: true });
  mkdirSync(dirname(E2E_GAME.dbPath), { recursive: true });
  const store = openStore(E2E_GAME.dbPath);
  store.createCampaign({ channelId: E2E_GAME.campaignId, guildId: E2E_GAME.guildId, name: E2E_GAME.campaignName, mjRoleId: E2E_GAME.mjRoleId });
  store.setCampaignStructure(E2E_GAME.campaignId, { playerRoleId: E2E_GAME.playerRoleId, sheetsChannelId: "900000000000000005" });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
