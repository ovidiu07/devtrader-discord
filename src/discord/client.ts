import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

export async function createDiscordClient(): Promise<Client> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is missing. Add it to .env; do not commit the token.");
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  return client;
}

export function getGuildId(): string {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    throw new Error("DISCORD_GUILD_ID is missing. Add it to .env.");
  }
  return guildId;
}
