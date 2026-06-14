import { GuildMember, TextChannel, Invite } from "discord.js";
import { getSetting, recordJoin, getInviterOf } from "../database.js";

const cachedInvites = new Map<string, Map<string, Invite>>();

export async function cacheInvites(guildId: string, invites: Map<string, Invite>) {
  cachedInvites.set(guildId, invites);
}

export async function handleGuildMemberAdd(member: GuildMember) {
  const guild = member.guild;

  let inviterId: string | null = null;
  let inviterTag = "Inconnu";
  let inviterUses = 0;

  try {
    const newInvites = await guild.invites.fetch();
    const oldInvites = cachedInvites.get(guild.id) ?? new Map<string, Invite>();

    let usedInvite: Invite | null = null;
    for (const [code, invite] of newInvites) {
      const old = oldInvites.get(code);
      const oldUses = old?.uses ?? 0;
      const newUses = invite.uses ?? 0;
      if (newUses > oldUses) {
        usedInvite = invite;
        break;
      }
    }

    if (usedInvite?.inviter) {
      inviterId = usedInvite.inviter.id;
      inviterTag = usedInvite.inviter.username;
      inviterUses = usedInvite.uses ?? 0;
    }

    cachedInvites.set(guild.id, newInvites as unknown as Map<string, Invite>);
  } catch {}

  recordJoin(guild.id, member.id, inviterId);

  const ghostChanId = getSetting(guild.id, "ghostping_channel");
  if (ghostChanId) {
    try {
      const ch = guild.channels.cache.get(ghostChanId) as TextChannel | undefined;
      if (ch) {
        const msg = await ch.send(`<@${member.id}>`);
        await msg.delete();
      }
    } catch {}
  }

  const traceChanId = getSetting(guild.id, "traceinvite_channel");
  if (traceChanId) {
    try {
      const ch = guild.channels.cache.get(traceChanId) as TextChannel | undefined;
      if (ch) {
        // If live invite detection failed, try to resolve the inviter from the DB
        if (!inviterId) {
          const storedInviterId = getInviterOf(guild.id, member.id);
          if (storedInviterId) {
            inviterId = storedInviterId;
            try {
              const inviterUser = await guild.client.users.fetch(storedInviterId);
              inviterTag = inviterUser.username;
            } catch {
              inviterTag = `Utilisateur inconnu (${storedInviterId})`;
            }
          }
        }

        const inviterMention = inviterId ? `<@${inviterId}>` : `**${inviterTag}**`;
        await ch.send(
          `📥 **${member.user.username}** a rejoint **${guild.name}**, invité par ${inviterMention} qui a maintenant **${inviterUses}** invitation${inviterUses !== 1 ? "s" : ""}.`
        );
      }
    } catch {}
  }
}
