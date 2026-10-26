import type { Campaign, Store } from "./db.js";

export interface CampaignQuery {
  guildId: string;
  /** Nom donné par l'option « campagne ». */
  name?: string | null;
  /** Salon où la commande est tapée, et sa catégorie. */
  channelId?: string | null;
  parentId?: string | null;
  /** Rôles de la personne. */
  roleIds: readonly string[];
}

export type CampaignResult = { ok: true; campaign: Campaign } | { ok: false; error: string };

const norm = (t: string) =>
  t
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'");

/** Campagnes où cette personne a le rôle MJ ou Joueur. */
export function campaignsOfMember(store: Store, guildId: string, roleIds: readonly string[]): { campaign: Campaign; mj: boolean }[] {
  return store
    .listCampaigns(guildId)
    .filter((c) => roleIds.includes(c.mjRoleId) || (c.playerRoleId !== null && roleIds.includes(c.playerRoleId)))
    .map((c) => ({ campaign: c, mj: roleIds.includes(c.mjRoleId) }));
}

/**
 * Trouve la campagne visée, dans cet ordre : l'option « campagne », le salon ou la catégorie de la commande,
 * la seule campagne dont la personne fait partie, la seule campagne du serveur. Sinon, demande de préciser.
 */
export function resolveCampaign(store: Store, q: CampaignQuery): CampaignResult {
  const all = store.listCampaigns(q.guildId, true);
  if (all.length === 0) return { ok: false, error: "Aucune campagne sur ce serveur. Un administrateur doit lancer /setup." };
  if (q.name) {
    const found = all.find((c) => norm(c.name) === norm(q.name!));
    return found ? { ok: true, campaign: found } : { ok: false, error: `Campagne « ${q.name} » introuvable. Campagnes : ${names(all)}.` };
  }
  for (const id of [q.channelId, q.parentId]) {
    if (!id) continue;
    // Une campagne archivée ne s'applique plus automatiquement à ses anciens salons.
    const c = store.findCampaignForChannel(id);
    if (c && c.guildId === q.guildId && !c.archived) return { ok: true, campaign: c };
  }
  const active = all.filter((c) => !c.archived);
  const mine = campaignsOfMember(store, q.guildId, q.roleIds);
  if (mine.length === 1) return { ok: true, campaign: mine[0]!.campaign };
  if (active.length === 1) return { ok: true, campaign: active[0]! };
  return { ok: false, error: `Plusieurs campagnes existent : précise-la avec l’option campagne (${names(active.length ? active : all)}).` };
}

const names = (cs: Campaign[]) => cs.map((c) => `« ${c.name} »${c.archived ? " (archivée)" : ""}`).join(", ");

/** Suggestions pour l'autocomplétion de l'option « campagne ». */
export function campaignChoices(store: Store, guildId: string, typed: string, includeArchived = false): { name: string; value: string }[] {
  const q = norm(typed);
  return store
    .listCampaigns(guildId, includeArchived)
    .filter((c) => norm(c.name).includes(q))
    .slice(0, 25)
    .map((c) => ({ name: `${c.name}${c.archived ? " (archivée)" : ""}`.slice(0, 100), value: c.name.slice(0, 100) }));
}
