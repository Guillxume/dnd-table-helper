/**
 * Côté Discord de l'archivage, de la réactivation et de la suppression d'une campagne.
 * Archiver : les salons de la catégorie de la campagne vont dans la catégorie commune « Archives » (lecture seule pour
 * tout le serveur, #aide-mj visible des seuls administrateurs), renommés avec le nom de la campagne ; la catégorie et les
 * rôles « MJ <nom> » et « Joueurs <nom> » sont supprimés. Les données du bot ne sont pas touchées ici.
 */
import type { ArchivedChannel } from "./db.js";
import { categoryName, mjRoleName, playerRoleName, runSetup, type GuildPort, type SetupResult } from "./setup.js";

export const ARCHIVE_CATEGORY = "Archives";
/** Discord accepte au plus 50 salons par catégorie. */
export const CATEGORY_LIMIT = 50;

/** Ce que l'archivage doit savoir de la campagne. */
export interface CampaignDiscord {
  name: string;
  categoryId: string | null;
  mjRoleId: string;
  playerRoleId: string | null;
  prepChannelId: string | null;
  archivedChannels: ArchivedChannel[];
}

export interface DiscordReport {
  done: string[];
  notes: string[];
  /** Salons rangés dans Archives (liste à enregistrer, même après une erreur en cours de route). */
  channels: ArchivedChannel[];
  error?: string;
}

export interface RestoreReport extends DiscordReport {
  setup?: SetupResult;
}

/** « Les Mines d'Or » -> « les-mines-d-or » (forme des noms de salons Discord). */
export function campaignSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "campagne"
  );
}

export const archivedChannelName = (campaign: string, channel: string) => `${campaignSlug(campaign)}-${channel}`.slice(0, 100);

const message = (e: unknown) => (e instanceof Error ? e.message : "erreur inconnue");

/**
 * Supprime les rôles « MJ <nom> » et « Joueurs <nom> ». Un rôle rattaché à la campagne mais portant un autre nom
 * (rôle partagé d'une campagne créée avant les campagnes multiples) n'est jamais supprimé.
 */
async function deleteCampaignRoles(port: GuildPort, c: CampaignDiscord, r: DiscordReport): Promise<void> {
  const roles = await port.listRoles();
  const targets: [string | null, string][] = [
    [c.mjRoleId, mjRoleName(c.name)],
    [c.playerRoleId, playerRoleName(c.name)],
  ];
  for (const [id, expected] of targets) {
    const role = id ? roles.find((x) => x.id === id) : undefined;
    if (!role) continue;
    if (role.name !== expected) {
      r.notes.push(`le rôle ${role.name} n’est pas propre à la campagne, il est conservé`);
      continue;
    }
    await port.deleteRole(role.id);
    r.done.push(`rôle ${role.name} supprimé`);
  }
}

export async function archiveCampaignDiscord(port: GuildPort, c: CampaignDiscord): Promise<DiscordReport> {
  const r: DiscordReport = { done: [], notes: [], channels: [...c.archivedChannels] };
  try {
    const channels = await port.listChannels();
    const category = c.categoryId ? channels.find((ch) => ch.id === c.categoryId && ch.type === "category") : undefined;
    const children = category ? channels.filter((ch) => ch.parentId === category.id) : [];
    if (!category && !c.archivedChannels.length) r.notes.push("la campagne n’a pas de catégorie propre : ses salons restent en place");
    if (children.length) {
      let archive = channels.find((ch) => ch.type === "category" && ch.name === ARCHIVE_CATEGORY);
      const used = archive ? channels.filter((ch) => ch.parentId === archive!.id).length : 0;
      if (used + children.length > CATEGORY_LIMIT) {
        throw new Error(
          `la catégorie ${ARCHIVE_CATEGORY} contient déjà ${used} salons et Discord en accepte ${CATEGORY_LIMIT} par catégorie. Supprime d’anciens salons archivés, ou renomme la catégorie ${ARCHIVE_CATEGORY} pour que le bot en crée une nouvelle`,
        );
      }
      if (!archive) {
        archive = await port.createArchiveCategory(ARCHIVE_CATEGORY);
        r.done.push(`catégorie ${ARCHIVE_CATEGORY} créée`);
      }
      for (const ch of children) {
        await port.moveChannel(ch.id, {
          parentId: archive.id,
          name: archivedChannelName(c.name, ch.name),
          access: ch.id === c.prepChannelId ? "hidden" : "readonly",
        });
        r.channels = [...r.channels.filter((x) => x.id !== ch.id), { id: ch.id, name: ch.name }];
        r.done.push(`#${ch.name} rangé dans ${ARCHIVE_CATEGORY}`);
      }
    }
    if (category) {
      await port.deleteChannel(category.id);
      r.done.push(`catégorie ${category.name} supprimée`);
    }
    await deleteCampaignRoles(port, c, r);
  } catch (e) {
    r.error = message(e);
  }
  return r;
}

/** Recrée les rôles et la catégorie, y remet les salons archivés (noms et droits d'origine), puis complète avec /setup. */
export async function restoreCampaignDiscord(port: GuildPort, c: CampaignDiscord): Promise<RestoreReport> {
  const r: RestoreReport = { done: [], notes: [], channels: [...c.archivedChannels] };
  try {
    const roles = await port.listRoles();
    const ensureRole = async (name: string) => {
      const found = roles.find((x) => x.name === name);
      if (found) return found;
      const role = await port.createRole(name);
      r.done.push(`rôle ${name} créé`);
      return role;
    };
    const mj = await ensureRole(mjRoleName(c.name));
    const player = await ensureRole(playerRoleName(c.name));
    const table = [mj.id, player.id, port.botId];
    const channels = await port.listChannels();
    let category = channels.find((ch) => ch.type === "category" && ch.name === categoryName(c.name));
    if (!category) {
      category = await port.createCategory(categoryName(c.name), table);
      r.done.push(`catégorie ${category.name} créée`);
    }
    const existing = new Set(channels.map((ch) => ch.id));
    for (const a of c.archivedChannels) {
      if (existing.has(a.id)) {
        await port.moveChannel(a.id, {
          parentId: category.id,
          name: a.name,
          access: { privateTo: a.id === c.prepChannelId ? [mj.id, port.botId] : table },
        });
        r.done.push(`#${a.name} remis dans ${category.name}`);
      } else r.notes.push(`#${a.name} avait été supprimé des archives`);
      r.channels = r.channels.filter((x) => x.id !== a.id);
    }
    r.setup = await runSetup(port, c.name);
    r.done.push(...r.setup.created.map((x) => `${x} créé`));
  } catch (e) {
    r.error = message(e);
  }
  return r;
}

/** Supprime les salons de la campagne (catégorie et archives), sa catégorie et ses rôles. */
export async function deleteCampaignDiscord(port: GuildPort, c: CampaignDiscord): Promise<DiscordReport> {
  const r: DiscordReport = { done: [], notes: [], channels: [] };
  try {
    const channels = await port.listChannels();
    const ids = new Set(c.archivedChannels.map((a) => a.id));
    const category = c.categoryId ? channels.find((ch) => ch.id === c.categoryId && ch.type === "category") : undefined;
    if (category) for (const ch of channels) if (ch.parentId === category.id) ids.add(ch.id);
    if (!category && !c.archivedChannels.length) r.notes.push("la campagne n’a pas de catégorie propre : ses salons restent en place");
    for (const ch of channels.filter((x) => ids.has(x.id))) {
      await port.deleteChannel(ch.id);
      r.done.push(`#${ch.name} supprimé`);
    }
    if (category) {
      await port.deleteChannel(category.id);
      r.done.push(`catégorie ${category.name} supprimée`);
    }
    await deleteCampaignRoles(port, c, r);
  } catch (e) {
    r.error = message(e);
  }
  return r;
}

/** Compte rendu pour Discord (2000 caractères au plus). */
export function reportText(title: string, r: DiscordReport): string {
  const lines = [title];
  if (r.done.length) lines.push(`Fait : ${r.done.join(", ")}.`);
  if (r.notes.length) lines.push(`À noter : ${r.notes.join(" ; ")}.`);
  if (r.error) {
    lines.push(
      `Erreur : ${r.error}. Vérifie que le bot a les droits Gérer les salons et Gérer les rôles et que son rôle est au-dessus des rôles de campagne, puis relance la commande : elle reprend là où elle s’est arrêtée.`,
    );
  }
  const text = lines.join("\n");
  return text.length > 1990 ? `${text.slice(0, 1985)}…` : text;
}
