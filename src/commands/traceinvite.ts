import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { setSetting } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("traceinvite")
  .setDescription("Définit le salon de suivi des invitations")
  .addChannelOption((opt) =>
    opt
      .setName("salon")
      .setDescription("Le salon où afficher les logs d'invitation")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel("salon", true);
  setSetting(interaction.guildId!, "traceinvite_channel", channel.id);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ Trace d'invitation configurée")
    .setDescription(`Les arrivées seront tracées dans <#${channel.id}>.`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
