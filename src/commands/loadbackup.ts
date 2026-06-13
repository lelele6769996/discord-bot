import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  OverwriteType,
  PermissionsBitField,
  MessageFlags,
} from "discord.js";
import { loadBackup } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("loadbackup")
  .setDescription("Restaure la dernière sauvegarde du serveur")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

type BackupChannel = Record<string, unknown>;
type BackupRole = Record<string, unknown>;
type BackupOverwrite = { id: string; type: OverwriteType; allow: string; deny: string };

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;
  const backup = loadBackup(guild.id) as Record<string, unknown> | null;

  if (!backup) {
    await interaction.reply({
      content: "❌ Aucune sauvegarde trouvée. Lance d'abord `/savebackup`.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("confirm_load").setLabel("✅ Confirmer la restauration").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("cancel_load").setLabel("❌ Annuler").setStyle(ButtonStyle.Secondary)
  );

  const warnEmbed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("⚠️ Confirmation requise")
    .setDescription(
      `Tu es sur le point de restaurer la sauvegarde du **${new Date(backup["savedAt"] as string).toLocaleString("fr-FR")}**.\n\n` +
      `Cela va :\n` +
      `• Supprimer tous les salons actuels\n` +
      `• Supprimer tous les rôles actuels (sauf @everyone)\n` +
      `• Recréer les salons et rôles depuis la sauvegarde\n\n` +
      `**Cette action est irréversible !**`
    );

  const reply = await interaction.reply({
    embeds: [warnEmbed],
    components: [confirmRow],
    flags: MessageFlags.Ephemeral,
    fetchReply: true,
  });

  let confirmed = false;
  try {
    const btn = await reply.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 30_000,
      filter: (i) => i.user.id === interaction.user.id,
    });
    if (btn.customId === "cancel_load") {
      await btn.update({ content: "❌ Restauration annulée.", embeds: [], components: [] });
      return;
    }
    confirmed = true;
    await btn.update({ content: "⏳ Restauration en cours...", embeds: [], components: [] });
  } catch {
    await interaction.editReply({ content: "⏰ Temps écoulé.", embeds: [], components: [] });
    return;
  }

  if (!confirmed) return;

  await guild.roles.fetch();
  await guild.channels.fetch();

  const progress: string[] = [];
  const backupChannels = (backup["channels"] as BackupChannel[]) ?? [];
  const backupRoles = (backup["roles"] as BackupRole[]) ?? [];

  try {
    const currentChannels = guild.channels.cache.clone();
    await Promise.allSettled([...currentChannels.values()].map((ch) => ch.delete("Restauration backup").catch(() => {})));
    progress.push("✅ Salons supprimés");
  } catch { progress.push("⚠️ Erreur suppression salons"); }

  try {
    const currentRoles = guild.roles.cache
      .filter((r) => r.id !== guild.id && !r.managed && r.editable)
      .clone();
    await Promise.allSettled([...currentRoles.values()].map((r) => r.delete("Restauration backup").catch(() => {})));
    progress.push("✅ Rôles supprimés");
  } catch { progress.push("⚠️ Erreur suppression rôles"); }

  const roleIdMap: Record<string, string> = {};
  const sortedRoles = [...backupRoles].sort((a, b) => (a["position"] as number) - (b["position"] as number));

  for (const role of sortedRoles) {
    if (role["managed"]) continue;
    try {
      const newRole = await guild.roles.create({
        name: role["name"] as string,
        color: role["color"] as number,
        hoist: role["hoist"] as boolean,
        mentionable: role["mentionable"] as boolean,
        permissions: new PermissionsBitField(BigInt(role["permissions"] as string)),
      });
      roleIdMap[role["id"] as string] = newRole.id;
    } catch {}
  }
  progress.push(`✅ ${Object.keys(roleIdMap).length} rôles recréés`);

  const categories = backupChannels.filter((c) => c["type"] === ChannelType.GuildCategory);
  const channelIdMap: Record<string, string> = {};

  for (const cat of [...categories].sort((a, b) => (a["position"] as number) - (b["position"] as number))) {
    try {
      const rawOverwrites = (cat["permissionOverwrites"] as BackupOverwrite[]) ?? [];
      const newCat = await guild.channels.create({
        name: cat["name"] as string,
        type: ChannelType.GuildCategory,
        permissionOverwrites: rawOverwrites.map((o) => ({
          id: roleIdMap[o.id] ?? o.id,
          type: o.type,
          allow: new PermissionsBitField(BigInt(o.allow)),
          deny: new PermissionsBitField(BigInt(o.deny)),
        })),
      });
      channelIdMap[cat["id"] as string] = newCat.id;
    } catch {}
  }

  const textAndVoice = backupChannels.filter(
    (c) => c["type"] !== ChannelType.GuildCategory &&
      (c["type"] === ChannelType.GuildText || c["type"] === ChannelType.GuildVoice || c["type"] === ChannelType.GuildAnnouncement)
  );

  for (const ch of [...textAndVoice].sort((a, b) => (a["position"] as number) - (b["position"] as number))) {
    try {
      const rawOverwrites = (ch["permissionOverwrites"] as BackupOverwrite[]) ?? [];
      const chPerms = rawOverwrites.map((o) => ({
        id: roleIdMap[o.id] ?? o.id,
        type: o.type,
        allow: new PermissionsBitField(BigInt(o.allow)),
        deny: new PermissionsBitField(BigInt(o.deny)),
      }));
      const parentId = ch["parentId"] as string | null;
      const parent = (parentId && channelIdMap[parentId]) ? channelIdMap[parentId] : undefined;

      if (ch["type"] === ChannelType.GuildText || ch["type"] === ChannelType.GuildAnnouncement) {
        await guild.channels.create({
          name: ch["name"] as string,
          type: ch["type"] as ChannelType.GuildText | ChannelType.GuildAnnouncement,
          parent,
          topic: ch["topic"] ? (ch["topic"] as string) : undefined,
          nsfw: (ch["nsfw"] as boolean) ?? false,
          rateLimitPerUser: (ch["slowmode"] as number) ?? 0,
          permissionOverwrites: chPerms,
        });
      } else if (ch["type"] === ChannelType.GuildVoice) {
        await guild.channels.create({
          name: ch["name"] as string,
          type: ChannelType.GuildVoice,
          parent,
          bitrate: (ch["bitrate"] as number) ?? 64000,
          userLimit: (ch["userLimit"] as number) ?? 0,
          permissionOverwrites: chPerms,
        });
      }
    } catch {}
  }

  progress.push(`✅ ${categories.length + textAndVoice.length} salons recréés`);

  const resultEmbed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ Restauration terminée")
    .setDescription(progress.join("\n"))
    .addFields({ name: "📅 Sauvegarde du", value: new Date(backup["savedAt"] as string).toLocaleString("fr-FR") })
    .setTimestamp();

  try {
    await guild.channels.fetch();
    const logChannel = guild.channels.cache.find((c) => "send" in c);
    if (logChannel) {
      await (logChannel as unknown as { send: (o: unknown) => Promise<unknown> }).send({ embeds: [resultEmbed] });
    }
  } catch {}
}
