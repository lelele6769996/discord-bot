import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("dmall")
  .setDescription("Envoie un DM à tous les membres du serveur")
  .addStringOption((opt) =>
    opt
      .setName("message")
      .setDescription("Le message à envoyer à tous les membres")
      .setRequired(true)
  )
  .addUserOption((opt) =>
    opt
      .setName("wndm")
      .setDescription("Membre à exclure de l'envoi (optionnel)")
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const rawMessage = interaction.options.getString("message", true);
  const excludedUser = interaction.options.getUser("wndm");

  const guild = interaction.guild!;

  // Récupérer TOUS les membres (nécessite l'intent GuildMembers dans le portail Discord)
  try {
    await guild.members.fetch();
  } catch (err) {
    console.error("[dmall] Erreur lors du fetch des membres:", err);
    await interaction.editReply(
      "❌ Impossible de récupérer les membres. Vérifie que l'intent **Server Members** est activé dans le portail Discord Developer."
    );
    return;
  }

  const allMembers = guild.members.cache;
  console.log(`[dmall] Membres en cache: ${allMembers.size}`);

  const members = allMembers.filter(
    (m: GuildMember) =>
      !m.user.bot &&
      (!excludedUser || m.id !== excludedUser.id)
    // Note: l'auteur de la commande est inclus intentionnellement
  );

  console.log(`[dmall] Membres à contacter: ${members.size}`);

  if (members.size === 0) {
    await interaction.editReply("❌ Aucun membre à contacter.");
    return;
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const startTime = Date.now();

  const BATCH = 5;
  const memberArray = [...members.values()];

  for (let i = 0; i < memberArray.length; i += BATCH) {
    const batch = memberArray.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((m: GuildMember) => m.send(rawMessage))
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        sent++;
      } else {
        failed++;
        const reason = (r.reason as Error)?.message ?? "inconnu";
        console.log(`[dmall] Échec DM pour ${batch[j].user.username}: ${reason}`);
        if (!errors.includes(reason)) errors.push(reason);
      }
    }
    if (i + BATCH < memberArray.length) {
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[dmall] Terminé: ${sent} envoyés, ${failed} échoués en ${elapsed}s`);

  // DM de résumé envoyé à l'auteur de la commande
  try {
    const summary =
      `📬 **DM All terminé !**\n\n` +
      `👥 Membres ciblés : **${members.size}**\n` +
      `✅ Reçus : **${sent}**\n` +
      `❌ Échoués : **${failed}**\n` +
      `⏱️ Durée : **${elapsed}s**` +
      (excludedUser ? `\n🚫 Exclu : ${excludedUser.username}` : "") +
      (failed > 0 && sent === 0 ? `\n\n⚠️ Tous les DMs ont échoué (DMs désactivés ou bot bloqué).` : "");
    await interaction.user.send(summary);
  } catch {
    console.log("[dmall] Impossible d'envoyer le résumé à l'auteur (DMs fermés).");
  }

  await interaction.editReply(
    `✅ DM All terminé — **${sent}** reçus, **${failed}** échoués en **${elapsed}s**. Résumé envoyé en DM.`
  );
}
