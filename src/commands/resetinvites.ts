import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { resetInvites, getInviteStats } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("resetinvites")
  .setDescription("Remet à zéro le compteur d'invitations d'un membre")
  .addUserOption((opt) =>
    opt
      .setName("membre")
      .setDescription("Le membre à réinitialiser")
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser("membre", true);
  resetInvites(interaction.guildId!, target.id);
  const stats = getInviteStats(interaction.guildId!, target.id);

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🔄 Invitations réinitialisées")
    .setDescription(
      `Les invitations de ${target} ont été remises à **0**.\n` +
        `Il a invité **${stats.total}** personnes au total, dont **${stats.left}** ont quitté.`
    )
    .setThumbnail(target.displayAvatarURL())
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
