import "server-only";
import type { Campaign } from "@bot/db";
import { canManageCampaign, isCampaignMember } from "@bot/permissions";
import { getAuth } from "../auth";
import { getDb } from "../db";
import { getGameGuildId } from "../env";
import { DomainError, logError } from "../errors";
import type { SessionUser } from "../session";
import { getBotStore } from "./bot-store";

/** Rôles Discord relus au plus toutes les 10 minutes (au chargement d'une page). */
const MEMBER_TTL_MS = 10 * 60 * 1000;

/**
 * Qui agit, du point de vue du jeu.
 * - Le MJ (rôle « admin » du site) a tous les droits, comme un administrateur Discord pour le bot.
 * - Un joueur est identifié par son compte Discord ; ses droits viennent de ses rôles sur le serveur.
 */
export type GameActor = {
  userId: string;
  isAdmin: boolean;
  /** Identifiant Discord (clé des personnages et brouillons du bot). Null pour un MJ connecté par e-mail. */
  discordId: string | null;
  displayName: string | null;
  roleIds: string[];
  inGuild: boolean;
};

type DiscordMemberResponse = { roles?: string[]; nick?: string | null; user?: { global_name?: string | null; username?: string } };

/** Relit les rôles du joueur sur le serveur avec son propre jeton (portée guilds.members.read). */
export async function refreshDiscordMember(userId: string): Promise<void> {
  const db = getDb();
  const account = await db.account.findFirst({ where: { userId, providerId: "discord" }, select: { id: true, accountId: true } });
  if (!account) return;
  const guildId = getGameGuildId();
  const { accessToken } = await getAuth().api.getAccessToken({ body: { accountId: account.id, userId } });
  const response = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(5000),
  });
  if (response.status !== 200 && response.status !== 404) {
    throw new Error(`Discord a répondu ${response.status} à la lecture des rôles.`);
  }
  const member = response.status === 200 ? ((await response.json()) as DiscordMemberResponse) : null;
  const data = {
    discordId: account.accountId,
    guildId,
    roleIds: member?.roles ?? [],
    displayName: member?.nick ?? member?.user?.global_name ?? member?.user?.username ?? null,
    inGuild: member !== null,
    fetchedAt: new Date(),
  };
  await db.discordMember.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

export async function getGameActor(user: SessionUser): Promise<GameActor> {
  const db = getDb();
  let member = await db.discordMember.findUnique({ where: { userId: user.id } });
  if (!member || Date.now() - member.fetchedAt.getTime() > MEMBER_TTL_MS) {
    try {
      await refreshDiscordMember(user.id);
      member = await db.discordMember.findUnique({ where: { userId: user.id } });
    } catch (error) {
      // Discord indisponible : on garde la dernière lecture connue, s'il y en a une.
      logError("game:discord-member", error);
    }
  }
  return {
    userId: user.id,
    isAdmin: user.role === "admin",
    discordId: member?.discordId ?? null,
    displayName: member?.displayName ?? null,
    roleIds: member?.roleIds ?? [],
    inGuild: member?.inGuild ?? false,
  };
}

/** Acteur au sens du bot (src/permissions.ts) : mêmes règles de droits que les commandes Discord. */
export function botActor(actor: GameActor) {
  return { isAdministrator: actor.isAdmin, roleIds: actor.roleIds };
}

/** Mêmes règles que le bot : rôle Joueurs ou MJ de la campagne, ou joueur ajouté par /campagne ajouter-joueur. */
export function isMemberOf(actor: GameActor, campaign: Campaign): boolean {
  if (actor.isAdmin) return true;
  if (!actor.inGuild || !actor.discordId) return false;
  if (isCampaignMember(botActor(actor), campaign)) return true;
  return getBotStore().listPlayers(campaign.channelId).includes(actor.discordId);
}

export function isMjOf(actor: GameActor, campaign: Campaign): boolean {
  return actor.isAdmin || (actor.inGuild && canManageCampaign(botActor(actor), campaign));
}

export function listMemberCampaigns(actor: GameActor): (Campaign & { mj: boolean })[] {
  return getBotStore()
    .listCampaigns(getGameGuildId())
    .filter((campaign) => isMemberOf(actor, campaign))
    .map((campaign) => ({ ...campaign, mj: isMjOf(actor, campaign) }));
}

export function requireCampaign(actor: GameActor, campaignId: string): Campaign {
  const campaign = getBotStore().getCampaign(campaignId);
  if (!campaign || campaign.guildId !== getGameGuildId() || !isMemberOf(actor, campaign)) {
    throw new DomainError("Campagne introuvable ou réservée à ses joueurs.");
  }
  return campaign;
}

/** Les actions de création demandent un compte Discord : brouillons et fiches lui sont rattachés. */
export function requireDiscordId(actor: GameActor): string {
  if (!actor.discordId) {
    throw new DomainError("Connectez-vous avec Discord pour créer un personnage : il sera rattaché à votre compte Discord.");
  }
  return actor.discordId;
}
