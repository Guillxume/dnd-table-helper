export interface Actor {
  isAdministrator: boolean;
  roleIds: readonly string[];
}

export interface CampaignAccess {
  mjRoleId: string;
  playerRoleId?: string | null;
}

/** Un administrateur du serveur ou le MJ désigné pour la campagne (rôle Discord). */
export function canManageCampaign(actor: Actor, campaign: CampaignAccess): boolean {
  return actor.isAdministrator || actor.roleIds.includes(campaign.mjRoleId);
}

/** Joueur, MJ ou administrateur de la campagne (sans rôle Joueurs défini, tout le serveur en fait partie). */
export function isCampaignMember(actor: Actor, campaign: CampaignAccess): boolean {
  return canManageCampaign(actor, campaign) || !campaign.playerRoleId || actor.roleIds.includes(campaign.playerRoleId);
}
