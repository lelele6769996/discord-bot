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
  .setName("ghostping")
  .setDescription("Définit le salon pour le ghost ping automatique à l'arrivée d'un membre")
  .addChannelOption((opt) =>
    opt
      .setName("salon")
      .setDescription("Le salon où envoyer le ghost ping")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel("salon", true);
  setSetting(interaction.guildId!, "ghostping_channel", channel.id);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("✅ Ghost Ping configuré")
    .setDescription(`Les nouveaux membres seront ghost pingés dans <#${channel.id}>.`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
