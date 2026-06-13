import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  OverwriteType,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("loadspc")
  .setDescription("Réinitialise complètement le serveur avec la structure SPC")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const STRUCTURE = [
  {
    category: "...",
    emoji: false as false,
    everyoneView: true,
    everyoneTalk: false,
    adminOnly: false,
    channels: [
      { name: "giveaway 1", emoji: "🎁" },
      { name: "giveaway 2", emoji: "🎁" },
      { name: "giveaway 3", emoji: "🎁" },
      { name: "event", emoji: "🎉" },
    ],
  },
  {
    category: "ticket",
    emoji: "🎫" as string | false,
    everyoneView: true,
    everyoneTalk: false,
    adminOnly: false,
    channels: [{ name: "ticket", emoji: "🎫" }],
  },
  {
    category: "ticket opened",
    emoji: false as string | false,
    everyoneView: false,
    everyoneTalk: false,
    adminOnly: true,
    channels: [] as { name: string; emoji: string }[],
  },
];

export async function execute(interaction: ChatInputCommandInteraction) {
  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("confirm_spc").setLabel("✅ Confirmer").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("cancel_spc").setLabel("❌ Annuler").setStyle(ButtonStyle.Secondary)
  );

  const warnEmbed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("⚠️ Chargement SPC — Confirmation")
    .setDescription(
      "Cette commande va :\n\n" +
      "• 🗑️ Supprimer **TOUS** les salons\n" +
      "• 🗑️ Supprimer **TOUS** les rôles\n" +
      "• ✨ Recréer la structure SPC complète\n\n" +
      "**Cette action est irréversible !**"
    );

  const reply = await interaction.reply({
    embeds: [warnEmbed],
    components: [confirmRow],
    flags: MessageFlags.Ephemeral,
    fetchReply: true,
  });

  try {
    const btn = await reply.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 30_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    if (btn.customId === "cancel_spc") {
      await btn.update({ content: "❌ Opération annulée.", embeds: [], components: [] });
      return;
    }

    await btn.update({ content: "⏳ Réinitialisation en cours...", embeds: [], components: [] });
  } catch {
    await interaction.editReply({ content: "⏰ Temps écoulé.", embeds: [], components: [] });
    return;
  }

  const guild = interaction.guild!;

  // Suppression de tous les salons
  await guild.channels.fetch();
  const allChannels = [...guild.channels.cache.values()];
  await Promise.allSettled(allChannels.map((ch) => ch.delete("loadSPC").catch(() => {})));

  // Suppression de tous les rôles éditables
  await guild.roles.fetch();
  const deletableRoles = guild.roles.cache.filter(
    (r) => r.id !== guild.id && !r.managed && r.editable
  );
  await Promise.allSettled([...deletableRoles.values()].map((r) => r.delete("loadSPC").catch(() => {})));

  const everyoneId = guild.id;

  type Overwrite = { id: string; type: OverwriteType; allow?: bigint[]; deny?: bigint[] };

  for (const block of STRUCTURE) {
    let perms: Overwrite[] = [];

    if (block.adminOnly) {
      perms = [{ id: everyoneId, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] }];
    } else if (block.everyoneView) {
      perms = [{
        id: everyoneId,
        type: OverwriteType.Role,
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [PermissionFlagsBits.SendMessages],
      }];
    }

    const catName = block.emoji ? `${block.emoji} ${block.category}` : block.category;

    let category;
    try {
      category = await guild.channels.create({
        name: catName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: perms,
      });
    } catch (e) {
      console.error(`Erreur création catégorie ${catName}:`, e);
      continue;
    }

    for (const ch of block.channels) {
      try {
        await guild.channels.create({
          name: `${ch.emoji} ${ch.name}`,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: perms,
        });
      } catch (e) {
        console.error(`Erreur création salon ${ch.name}:`, e);
      }
    }
  }

  // Envoyer un embed de confirmation dans le premier salon disponible
  try {
    await guild.channels.fetch();
    const firstChan = guild.channels.cache.find(
      (c): c is TextChannel => c.type === ChannelType.GuildText
    );
    if (firstChan) {
      const successEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Structure SPC chargée")
        .setDescription(
          "**`...`** — 🎁 giveaway 1/2/3 + 🎉 event (voir ✅ / parler ❌)\n" +
          "**`🎫 ticket`** — 🎫 ticket (voir ✅ / parler ❌)\n" +
          "**`ticket opened`** — privé admins uniquement 🔒"
        )
        .setTimestamp();
      await firstChan.send({ embeds: [successEmbed] });
    }
  } catch {}

  try {
    await interaction.editReply({ content: "✅ Structure SPC créée avec succès !", embeds: [], components: [] });
  } catch {}
}
