import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { getInviteStats } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Affiche les statistiques d'invitation d'un membre")
  .addUserOption((opt) =>
    opt
      .setName("membre")
      .setDescription("Le membre à consulter")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser("membre", true);
  const stats = getInviteStats(interaction.guildId!, target.id);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📊 Statistiques de ${target.username}`)
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      {
        name: "✅ Invitations actives",
        value: `**${stats.active}**`,
        inline: true,
      },
      {
        name: "📥 Total invités",
        value: `**${stats.total}**`,
        inline: true,
      },
      {
        name: "🚪 Partis",
        value: `**${stats.left}**`,
        inline: true,
      }
    )
    .setFooter({ text: `Invitations nettes : ${stats.active}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
