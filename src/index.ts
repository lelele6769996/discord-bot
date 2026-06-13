import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { handleReady } from "./events/ready.js";
import { handleGuildMemberAdd } from "./events/guildMemberAdd.js";
import { handleGuildMemberRemove } from "./events/guildMemberRemove.js";
import { handleInteractionCreate } from "./events/interactionCreate.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token) {
  console.error(
    "❌ DISCORD_TOKEN manquant. Ajoute-le dans les variables d'environnement."
  );
  process.exit(1);
}

if (!clientId) {
  console.error(
    "❌ DISCORD_CLIENT_ID manquant. Ajoute-le dans les variables d'environnement."
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

client.once("ready", (c) => handleReady(c));
client.on("guildMemberAdd", (m) => handleGuildMemberAdd(m));
client.on("guildMemberRemove", (m) => handleGuildMemberRemove(m));
client.on("interactionCreate", (i) => handleInteractionCreate(i));

client.on("guildCreate", async (guild) => {
  try {
    const { cacheInvites } = await import("./events/guildMemberAdd.js");
    const invites = await guild.invites.fetch();
    await cacheInvites(guild.id, invites as any);
    console.log(`✅ Bot ajouté à ${guild.name} — invitations mises en cache`);
  } catch {}
});

client.login(token).catch((err) => {
  console.error("❌ Connexion échouée :", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
