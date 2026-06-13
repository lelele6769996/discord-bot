import { Interaction, ChatInputCommandInteraction, ButtonInteraction, MessageFlags } from "discord.js";
import * as ghostping from "../commands/ghostping.js";
import * as traceinvite from "../commands/traceinvite.js";
import * as resetinvites from "../commands/resetinvites.js";
import * as stats from "../commands/stats.js";
import * as statdetail from "../commands/statdetail.js";
import * as dmall from "../commands/dmall.js";
import * as ticket from "../commands/ticket.js";
import * as savebackup from "../commands/savebackup.js";
import * as loadbackup from "../commands/loadbackup.js";
import * as loadspc from "../commands/loadspc.js";
import { handleCreateTicket, handleCloseTicket } from "../commands/ticket.js";

const commands: Record<
  string,
  { execute: (interaction: ChatInputCommandInteraction) => Promise<void> }
> = {
  ghostping,
  traceinvite,
  resetinvites,
  stats,
  statdetail,
  dmall,
  ticket,
  savebackup,
  loadbackup,
  loadspc,
};

export async function handleInteractionCreate(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    const cmd = commands[interaction.commandName];
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error(`Error in command ${interaction.commandName}:`, err);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: "❌ Une erreur est survenue." }).catch(() => {});
      } else {
        await interaction.reply({ content: "❌ Une erreur est survenue.", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isButton()) {
    try {
      if (interaction.customId === "create_ticket") {
        await handleCreateTicket(interaction as ButtonInteraction);
      } else if (interaction.customId === "close_ticket") {
        await handleCloseTicket(interaction as ButtonInteraction);
      }
    } catch (err) {
      console.error("Error in button handler:", err);
    }
  }
}
