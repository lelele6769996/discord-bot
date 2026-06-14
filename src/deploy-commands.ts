import { REST, Routes } from "discord.js";
import * as ghostping from "./commands/ghostping.js";
import * as traceinvite from "./commands/traceinvite.js";
import * as resetinvites from "./commands/resetinvites.js";
import * as resetall from "./commands/resetall.js";
import * as stats from "./commands/stats.js";
import * as statdetail from "./commands/statdetail.js";
import * as dmall from "./commands/dmall.js";
import * as ticket from "./commands/ticket.js";
import * as savebackup from "./commands/savebackup.js";
import * as loadbackup from "./commands/loadbackup.js";
import * as loadspc from "./commands/loadspc.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error("❌ DISCORD_TOKEN et DISCORD_CLIENT_ID sont requis.");
  process.exit(1);
}

const commands = [
  ghostping.data,
  traceinvite.data,
  resetinvites.data,
  resetall.data,
  stats.data,
  statdetail.data,
  dmall.data,
  ticket.data,
  savebackup.data,
  loadbackup.data,
  loadspc.data,
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(`📤 Déploiement de ${commands.length} commandes slash...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("✅ Commandes déployées avec succès !");
  } catch (err) {
    console.error("❌ Erreur lors du déploiement :", err);
    process.exit(1);
  }
})();
