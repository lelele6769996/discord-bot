import { Client } from "discord.js";
import { cacheInvites } from "./guildMemberAdd.js";

export async function handleReady(client: Client<true>) {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);

  for (const [, guild] of client.guilds.cache) {
    try {
      const invites = await guild.invites.fetch();
      await cacheInvites(guild.id, invites as any);
      console.log(`📋 Invitations cachées pour ${guild.name} (${invites.size})`);
    } catch {
      console.log(`⚠️ Impossible de récupérer les invitations pour ${guild.name}`);
    }
  }

  console.log(`🚀 Bot prêt sur ${client.guilds.cache.size} serveur(s)`);
}
