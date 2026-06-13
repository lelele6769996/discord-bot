import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  OverwriteType,
  TextChannel,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonInteraction,
  MessageFlags,
} from "discord.js";
import { setSetting, getSetting } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Configure le système de tickets")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild!;
  await guild.roles.fetch();
  await guild.channels.fetch();

  const staffRoles = guild.roles.cache
    .filter((r) => !r.managed && r.id !== guild.id)
    .first(24);

  const roleOptions = staffRoles.map((r) =>
    new StringSelectMenuOptionBuilder().setLabel(r.name).setValue(r.id)
  );

  if (roleOptions.length === 0) {
    await interaction.editReply("Aucun rôle trouvé sur le serveur.");
    return;
  }

  const roleSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_roles")
      .setPlaceholder("Choisis les rôles qui verront les tickets")
      .setMinValues(1)
      .setMaxValues(Math.min(staffRoles.length, 5))
      .addOptions(roleOptions)
  );

  const step1 = await interaction.editReply({
    content: "**Étape 1/2** — Quels rôles peuvent voir les tickets ?",
    components: [roleSelectRow],
  });

  let selectedRoleIds: string[] = [];

  try {
    const roleInteraction = await step1.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    });
    selectedRoleIds = roleInteraction.values;
    await roleInteraction.update({
      content: `✅ Rôles : ${selectedRoleIds.map((id) => `<@&${id}>`).join(", ")}\n\n**Étape 2/2** — Dans quelle catégorie stocker les tickets ?`,
      components: [],
    });
  } catch {
    await interaction.editReply({ content: "⏰ Temps écoulé. Relance `/ticket`.", components: [] });
    return;
  }

  const categories = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildCategory)
    .first(24);

  if (categories.length === 0) {
    await interaction.editReply({ content: "Aucune catégorie trouvée.", components: [] });
    return;
  }

  const catSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Choisis la catégorie des tickets")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        categories.map((c) => new StringSelectMenuOptionBuilder().setLabel(c.name).setValue(c.id))
      )
  );

  const step2 = await interaction.editReply({ components: [catSelectRow] });

  let categoryId = "";
  try {
    const catInteraction = await step2.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    });
    categoryId = catInteraction.values[0];
    await catInteraction.update({ content: "✅ Configuration enregistrée ! Envoi de l'embed...", components: [] });
  } catch {
    await interaction.editReply({ content: "⏰ Temps écoulé. Relance `/ticket`.", components: [] });
    return;
  }

  setSetting(guild.id, "ticket_roles", JSON.stringify(selectedRoleIds));
  setSetting(guild.id, "ticket_category", categoryId);

  const channel = interaction.channel as TextChannel;
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    await channel.bulkDelete(messages, true);
  } catch {}

  const ticketEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🎫 Support — Créer un ticket")
    .setDescription("Besoin d'aide ? Clique sur le bouton ci-dessous pour ouvrir un ticket.\nNous te répondrons dès que possible.")
    .setTimestamp();

  const ticketRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("create_ticket")
      .setLabel("📩 Créer un ticket")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [ticketEmbed], components: [ticketRow] });
}

export async function handleCreateTicket(interaction: ButtonInteraction) {
  const guild = interaction.guild!;
  const userId = interaction.user.id;

  const rolesRaw = getSetting(guild.id, "ticket_roles");
  const categoryId = getSetting(guild.id, "ticket_category");

  if (!rolesRaw || !categoryId) {
    await interaction.reply({ content: "❌ Le système de tickets n'est pas configuré.", flags: MessageFlags.Ephemeral });
    return;
  }

  const staffRoleIds: string[] = JSON.parse(rolesRaw);

  const existing = guild.channels.cache.find(
    (c) =>
      c.name === `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}` &&
      c.parentId === categoryId
  );

  if (existing) {
    await interaction.reply({ content: `❌ Tu as déjà un ticket ouvert : <#${existing.id}>`, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const permOverwrites: {
    id: string;
    type: OverwriteType;
    allow?: bigint[];
    deny?: bigint[];
  }[] = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
    {
      id: userId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      type: OverwriteType.Member,
    },
  ];

  for (const roleId of staffRoleIds) {
    permOverwrites.push({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
      type: OverwriteType.Role,
    });
  }

  const ticketChannel = (await guild.channels.create({
    name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)}`,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites: permOverwrites,
  })) as TextChannel;

  const openEmbed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("🎫 Ticket ouvert")
    .setDescription(`Bonjour ${interaction.user} ! L'équipe support va te répondre rapidement.\n\nDécris ton problème ci-dessous.`)
    .setTimestamp();

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒 Fermer le ticket").setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({
    content: `${interaction.user} ${staffRoleIds.map((id) => `<@&${id}>`).join(" ")}`,
    embeds: [openEmbed],
    components: [closeRow],
  });

  await interaction.editReply({ content: `✅ Ton ticket a été créé : <#${ticketChannel.id}>` });
}

export async function handleCloseTicket(interaction: ButtonInteraction) {
  const channel = interaction.channel as TextChannel;

  const confirmEmbed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🔒 Fermeture du ticket")
    .setDescription("Ce ticket va être supprimé dans 5 secondes...");

  await interaction.reply({ embeds: [confirmEmbed] });
  setTimeout(async () => { try { await channel.delete("Ticket fermé"); } catch {} }, 5000);
}
