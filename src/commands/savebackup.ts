import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { saveBackup } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("savebackup")
  .setDescription("Sauvegarde la structure complète du serveur (salons, rôles, permissions)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild!;
  await guild.roles.fetch();
  await guild.channels.fetch();

  const roles = guild.roles.cache
    .filter((r) => r.id !== guild.id)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      mentionable: r.mentionable,
      permissions: r.permissions.bitfield.toString(),
      position: r.position,
      managed: r.managed,
    }));

  const channels = guild.channels.cache
    .filter((c) => !("threadId" in c))
    .map((c) => {
      const base: Record<string, unknown> = {
        id: c.id,
        name: c.name,
        type: c.type,
      };
      const anyC = c as unknown as Record<string, unknown>;
      if (typeof anyC["position"] !== "undefined") base.position = anyC["position"];
      if (typeof anyC["parentId"] !== "undefined") base.parentId = anyC["parentId"];
      if (typeof anyC["permissionOverwrites"] !== "undefined") {
        const po = anyC["permissionOverwrites"] as {
          cache: Map<string, { id: string; type: unknown; allow: { bitfield: bigint }; deny: { bitfield: bigint } }>;
        };
        base.permissionOverwrites = [...po.cache.values()].map((o) => ({
          id: o.id, type: o.type,
          allow: o.allow.bitfield.toString(),
          deny: o.deny.bitfield.toString(),
        }));
      }
      if (typeof anyC["topic"] !== "undefined") base.topic = anyC["topic"];
      if (typeof anyC["nsfw"] !== "undefined") base.nsfw = anyC["nsfw"];
      if (typeof anyC["rateLimitPerUser"] !== "undefined") base.slowmode = anyC["rateLimitPerUser"];
      if (typeof anyC["bitrate"] !== "undefined") base.bitrate = anyC["bitrate"];
      if (typeof anyC["userLimit"] !== "undefined") base.userLimit = anyC["userLimit"];
      return base;
    });

  saveBackup(guild.id, `backup-${Date.now()}`, {
    name: guild.name,
    icon: guild.iconURL(),
    roles,
    channels,
    savedAt: new Date().toISOString(),
    memberCount: guild.memberCount,
  });

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("💾 Sauvegarde effectuée")
    .addFields(
      { name: "📁 Salons sauvegardés", value: `${channels.length}`, inline: true },
      { name: "🎭 Rôles sauvegardés", value: `${roles.length}`, inline: true },
      { name: "📅 Date", value: new Date().toLocaleString("fr-FR"), inline: true }
    )
    .setDescription("Utilise `/loadbackup` pour restaurer cette sauvegarde en cas de raid.")
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
