import "dotenv/config";
import { stringify } from "yaml";
import { loadBlueprint } from "../config/loadBlueprint.js";
import { createDiscordClient, getGuildId } from "../discord/client.js";
import { buildSeedChannelMap } from "../seed/discordAdapter.js";
import { loadSeedConfig } from "../seed/loadSeedConfig.js";
import { seedStateKey } from "../seed/renderSeedMessage.js";
import { loadState } from "../state/loadState.js";
import { logger } from "../utils/logger.js";

export async function runSeedExportCommand() {
  const blueprint = await loadBlueprint();
  const config = await loadSeedConfig();
  const state = await loadState();
  const client = await createDiscordClient();

  try {
    const guild = await client.guilds.fetch(getGuildId());
    const channels = await buildSeedChannelMap(guild, blueprint, state);
    const messages = [];

    for (const seed of config.messages) {
      const key = seedStateKey(seed);
      const id = state.seedMessages[key];
      const channel = channels[seed.channelKey];
      if (!id || !channel) continue;
      const existing = await channel.fetchMessage(id);
      if (!existing) continue;

      const embed = existing.embeds[0];
      messages.push({
        key: seed.key,
        channelKey: seed.channelKey,
        pin: existing.pinned,
        mode: embed ? "embed" : "plain",
        content: existing.content || undefined,
        embed: embed
          ? {
              title: embed.title,
              description: embed.description,
              footer: embed.footer?.text,
              color: embed.color
            }
          : undefined
      });
    }

    console.log(stringify({ messages }));
    logger.info(`Exported ${messages.length} managed seed messages.`);
  } finally {
    client.destroy();
  }
}
