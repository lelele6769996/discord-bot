import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { resetAllInvites } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("resetall")
  .setDescription("Remet à zéro le compteur d'invitations de TOUS les membres")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const count = resetAllInvites(interaction.guildId!);

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🔄 Réinitialisation globale des invitations")
    .setDescription(
      count > 0
        ? `Les invitations de **${count}** membre${count !== 1 ? "s" : ""} ont été remises à **0**.`
        : `Aucune invitation à réinitialiser.`
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
