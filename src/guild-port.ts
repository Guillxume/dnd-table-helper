import { ChannelType, PermissionFlagsBits, type Guild } from "discord.js";
import type { ChannelAccess, ChannelRef, GuildPort } from "./setup.js";

export function guildPort(guild: Guild, botId: string): GuildPort {
  /** Salon privé : invisible pour @everyone, visible et accessible en écriture pour les rôles et membres donnés. */
  const overwrites = (ids: string[]) => [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    ...ids.map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] })),
  ];
  const P = PermissionFlagsBits;
  /** Lisible par tout le serveur, personne n'écrit (sauf le bot). */
  const readOnly = () => [
    {
      id: guild.roles.everyone.id,
      allow: [P.ViewChannel, P.ReadMessageHistory],
      deny: [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads, P.AddReactions],
    },
    { id: botId, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] },
  ];
  /** Invisible sauf pour les administrateurs (qui voient tout) et le bot. */
  const hidden = () => [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: botId, allow: [P.ViewChannel, P.SendMessages] },
  ];
  const accessOverwrites = (a: ChannelAccess) => (a === "readonly" ? readOnly() : a === "hidden" ? hidden() : overwrites(a.privateTo));
  const reason = "jdr-helper : archivage de campagne";
  return {
    everyoneRoleId: guild.roles.everyone.id,
    botId,
    async listRoles() {
      const roles = await guild.roles.fetch();
      return [...roles.values()].map((r) => ({ id: r.id, name: r.name }));
    },
    async createRole(name) {
      // Mentionnable : le rappel de séance notifie les rôles MJ et Joueurs même si le bot
      // n'a pas le droit « Mentionner @everyone, @here et tous les rôles ».
      const r = await guild.roles.create({ name, mentionable: true, reason: "Configuration jdr-helper" });
      return { id: r.id, name: r.name };
    },
    async listChannels() {
      const all = await guild.channels.fetch();
      return [...all.values()].flatMap((c): ChannelRef[] =>
        c
          ? [
              {
                id: c.id,
                name: c.name,
                type:
                  c.type === ChannelType.GuildCategory ? "category" : c.type === ChannelType.GuildText ? "text" : "other",
                parentId: c.parentId,
              },
            ]
          : [],
      );
    },
    async createCategory(name, privateTo) {
      const c = await guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
        reason: "Configuration jdr-helper",
        ...(privateTo ? { permissionOverwrites: overwrites(privateTo) } : {}),
      });
      return { id: c.id, name: c.name, type: "category", parentId: null };
    },
    async createText({ name, parentId, topic, privateTo }) {
      const c = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: parentId,
        topic,
        reason: "Configuration jdr-helper",
        ...(privateTo ? { permissionOverwrites: overwrites(privateTo) } : {}),
      });
      return { id: c.id, name: c.name, type: "text", parentId };
    },
    async addMemberRole(userId, roleId) {
      const m = await guild.members.fetch(userId);
      await m.roles.add(roleId, "jdr-helper : ajout à une campagne");
    },
    async removeMemberRole(userId, roleId) {
      const m = await guild.members.fetch(userId);
      await m.roles.remove(roleId, "jdr-helper : retrait d’une campagne");
    },
    async createArchiveCategory(name) {
      const c = await guild.channels.create({ name, type: ChannelType.GuildCategory, reason, permissionOverwrites: readOnly() });
      return { id: c.id, name: c.name, type: "category", parentId: null };
    },
    async moveChannel(id, { parentId, name, access }) {
      await guild.channels.edit(id, { name, parent: parentId, lockPermissions: false, permissionOverwrites: accessOverwrites(access), reason });
    },
    async deleteChannel(id) {
      await guild.channels.delete(id, reason);
    },
    async deleteRole(id) {
      await guild.roles.delete(id, reason);
    },
  };
}
