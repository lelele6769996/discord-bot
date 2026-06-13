import { GuildMember, PartialGuildMember } from "discord.js";
import { recordLeave } from "../database.js";

export async function handleGuildMemberRemove(
  member: GuildMember | PartialGuildMember
) {
  recordLeave(member.guild.id, member.id);
}
