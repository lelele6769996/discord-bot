import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { getInvitedUsers } from "../database.js";

const PAGE_SIZE = 10;

export const data = new SlashCommandBuilder()
  .setName("statdetail")
  .setDescription("Affiche la liste détaillée des membres invités")
  .addUserOption((opt) =>
    opt
      .setName("membre")
      .setDescription("Le membre à consulter")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser("membre", true);
  const invited = getInvitedUsers(interaction.guildId!, target.id);

  if (invited.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`📋 Détails de ${target.username}`)
      .setDescription("Cet utilisateur n'a encore invité personne.");
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const totalPages = Math.ceil(invited.length / PAGE_SIZE);
  let currentPage = 0;

  function buildEmbed(page: number): EmbedBuilder {
    const start = page * PAGE_SIZE;
    const slice = invited.slice(start, start + PAGE_SIZE);
    const lines = slice.map((u, i) => {
      const status = u.is_active ? "✅" : "🚪";
      const date = new Date(u.joined_at).toLocaleDateString("fr-FR");
      return `${start + i + 1}. ${status} <@${u.user_id}> — rejoint le ${date}`;
    });

    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 Invités par ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(lines.join("\n"))
      .setFooter({
        text: `Page ${page + 1}/${totalPages} • Total: ${invited.length} invités`,
      })
      .setTimestamp();
  }

  function buildRow(page: number): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("◀ Précédent")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Suivant ▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages - 1)
    );
  }

  const reply = await interaction.reply({
    embeds: [buildEmbed(0)],
    components: totalPages > 1 ? [buildRow(0)] : [],
    fetchReply: true,
  });

  if (totalPages <= 1) return;

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", async (btnInteraction) => {
    if (btnInteraction.customId === "prev" && currentPage > 0) currentPage--;
    else if (btnInteraction.customId === "next" && currentPage < totalPages - 1)
      currentPage++;

    await btnInteraction.update({
      embeds: [buildEmbed(currentPage)],
      components: [buildRow(currentPage)],
    });
  });

  collector.on("end", async () => {
    try {
      await reply.edit({ components: [] });
    } catch {}
  });
}
