/**
 * Structure du serveur créée par /setup. Chaque campagne a sa propre catégorie (au nom de la campagne),
 * ses salons et ses rôles « MJ <nom> » et « Joueurs <nom> ». La catégorie « Table » est commune.
 */
export const SHARED_CATEGORY = {
  name: "Table",
  channels: [
    { name: "général", topic: "Discussion générale de la table" },
    { name: "calendrier", topic: "Dates des séances" },
  ],
};

export interface ChannelSpec {
  name: string;
  topic: string;
  /** Visible uniquement par le rôle MJ de la campagne (et le bot). */
  mjOnly?: boolean;
  recap?: boolean;
  prep?: boolean;
  sheets?: boolean;
}

export const CAMPAIGN_CHANNELS: ChannelSpec[] = [
  { name: "rappel-de-séance", topic: "Rappel de la séance précédente (commandes /seance et /rappel)", recap: true },
  { name: "fiches-personnages", topic: "Fiches des personnages de la campagne (commande /personnage)", sheets: true },
  { name: "illustrations", topic: "Illustrations de la campagne" },
  { name: "aide-mj", topic: "Préparation de séance, réservé au MJ (commande /preparer)", mjOnly: true, prep: true },
];

export const mjRoleName = (campaign: string) => `MJ ${campaign}`.slice(0, 100);
export const playerRoleName = (campaign: string) => `Joueurs ${campaign}`.slice(0, 100);
export const categoryName = (campaign: string) => campaign.slice(0, 100);

export interface RoleRef {
  id: string;
  name: string;
}

export interface ChannelRef {
  id: string;
  name: string;
  type: "category" | "text" | "other";
  parentId: string | null;
}

/**
 * Droits d'un salon : « readonly » (lisible par tout le serveur, personne n'écrit), « hidden » (administrateurs et bot
 * seulement), ou privé à une liste de rôles.
 */
export type ChannelAccess = "readonly" | "hidden" | { privateTo: string[] };

/** Ce dont /setup et l'archivage ont besoin du serveur (adapté à discord.js dans guild-port.ts). */
export interface GuildPort {
  everyoneRoleId: string;
  botId: string;
  listRoles(): Promise<RoleRef[]>;
  createRole(name: string): Promise<RoleRef>;
  listChannels(): Promise<ChannelRef[]>;
  createCategory(name: string, privateTo?: string[]): Promise<ChannelRef>;
  createText(opts: { name: string; parentId: string; topic: string; privateTo?: string[] }): Promise<ChannelRef>;
  addMemberRole(userId: string, roleId: string): Promise<void>;
  removeMemberRole(userId: string, roleId: string): Promise<void>;
  /** Catégorie en lecture seule pour tout le serveur. */
  createArchiveCategory(name: string): Promise<ChannelRef>;
  /** Déplace et renomme un salon, et remplace ses droits. */
  moveChannel(id: string, opts: { parentId: string; name: string; access: ChannelAccess }): Promise<void>;
  deleteChannel(id: string): Promise<void>;
  deleteRole(id: string): Promise<void>;
}

export interface SetupResult {
  mjRoleId: string;
  playerRoleId: string;
  categoryId: string;
  recapChannelId: string;
  prepChannelId: string;
  sheetsChannelId: string;
  created: string[];
  reused: string[];
}

export interface SetupOptions {
  /** Salons de la campagne visibles par tout le serveur (sinon : MJ et joueurs de la campagne seulement). */
  public?: boolean;
}

/** Idempotent : un rôle, une catégorie ou un salon qui existe déjà (même nom) est réutilisé, jamais modifié. */
export async function runSetup(port: GuildPort, campaign: string, opts: SetupOptions = {}): Promise<SetupResult> {
  const name = campaign.trim();
  if (!name) throw new Error("Le nom de la campagne est vide.");
  const created: string[] = [];
  const reused: string[] = [];

  const roles = await port.listRoles();
  const ensureRole = async (roleName: string): Promise<RoleRef> => {
    const found = roles.find((r) => r.name === roleName);
    if (found) {
      reused.push(`rôle ${roleName}`);
      return found;
    }
    const role = await port.createRole(roleName);
    created.push(`rôle ${roleName}`);
    return role;
  };
  const mj = await ensureRole(mjRoleName(name));
  const player = await ensureRole(playerRoleName(name));
  const table = [mj.id, player.id, port.botId];

  const channels = await port.listChannels();
  const ensureCategory = async (catName: string, privateTo?: string[]) => {
    const found = channels.find((c) => c.type === "category" && c.name === catName);
    if (found) {
      reused.push(`catégorie ${catName}`);
      return found;
    }
    const c = await port.createCategory(catName, privateTo);
    created.push(`catégorie ${catName}`);
    return c;
  };
  const ensureText = async (spec: ChannelSpec, parentId: string, privateTo?: string[]) => {
    const found = channels.find((c) => c.type === "text" && c.name === spec.name && c.parentId === parentId);
    if (found) {
      reused.push(`salon #${spec.name}`);
      return found;
    }
    const c = await port.createText({ name: spec.name, parentId, topic: spec.topic, ...(privateTo ? { privateTo } : {}) });
    created.push(`salon #${spec.name}`);
    return c;
  };

  // Salons communs : un salon du même nom ailleurs sur le serveur (le #général créé par Discord avec le serveur,
  // par exemple) est réutilisé tel quel. La catégorie « Table » n'est créée que s'il reste un salon à y mettre.
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const missingShared: ChannelSpec[] = [];
  for (const spec of SHARED_CATEGORY.channels) {
    const found = channels.find((c) => c.type === "text" && sameName(c.name, spec.name));
    if (found) reused.push(`salon #${found.name}`);
    else missingShared.push(spec);
  }
  if (missingShared.length > 0) {
    const shared = await ensureCategory(SHARED_CATEGORY.name);
    for (const spec of missingShared) await ensureText(spec, shared.id);
  }

  const category = await ensureCategory(categoryName(name), opts.public ? undefined : table);
  let recapChannelId = "";
  let prepChannelId = "";
  let sheetsChannelId = "";
  for (const spec of CAMPAIGN_CHANNELS) {
    const privateTo = spec.mjOnly ? [mj.id, port.botId] : opts.public ? undefined : table;
    const ch = await ensureText(spec, category.id, privateTo);
    if (spec.recap) recapChannelId = ch.id;
    if (spec.prep) prepChannelId = ch.id;
    if (spec.sheets) sheetsChannelId = ch.id;
  }
  return { mjRoleId: mj.id, playerRoleId: player.id, categoryId: category.id, recapChannelId, prepChannelId, sheetsChannelId, created, reused };
}
