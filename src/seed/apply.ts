import type { DiscordState } from "../state/loadState.js";
import { logger } from "../utils/logger.js";
import { seedPayloadMatchesMessage } from "./compare.js";
import { renderSeedPayload, seedStateKey } from "./renderSeedMessage.js";
import type { SeedConfig, SeedWritableMessage } from "./types.js";
import type { SeedChannelMap } from "./plan.js";

const auditReason = "devtrader-discord-provisioner seed message sync";

export async function applySeedMessages(
  config: SeedConfig,
  channels: SeedChannelMap,
  state: DiscordState,
  options: { noPin?: boolean; only?: string } = {}
) {
  for (const seed of config.messages) {
    if (options.only && seed.channelKey !== options.only) continue;

    const key = seedStateKey(seed);
    const channel = channels[seed.channelKey];
    if (!channel) {
      logger.warn(`seed:${key}: canalul nu există sau nu este urmărit. Sar peste mesaj.`);
      continue;
    }
    if (channel.type !== "text" && channel.type !== "announcement") {
      logger.warn(`seed:${key}: canalul este de tip "${channel.type}". Nu postez mesaj seed aici.`);
      continue;
    }

    const payload = renderSeedPayload(seed);
    let message: SeedWritableMessage | null = null;
    const storedId = state.seedMessages[key];

    if (storedId) {
      message = await channel.fetchMessage(storedId);
      if (!message) {
        logger.warn(`seed:${key}: mesajul stocat nu mai există. Creez unul nou și actualizez state-ul.`);
        delete state.seedMessages[key];
      }
    }

    if (message) {
      if (!seedPayloadMatchesMessage(payload, message)) {
        message = await message.edit(payload);
        logger.info(`seed:${key}: mesaj actualizat.`);
      } else {
        logger.info(`seed:${key}: mesaj neschimbat.`);
      }
    } else {
      message = await channel.send(payload);
      state.seedMessages[key] = message.id;
      logger.info(`seed:${key}: mesaj creat în #${channel.name}.`);
    }

    if (seed.pin && !options.noPin && !message.pinned) {
      try {
        await message.pin(auditReason);
        logger.info(`seed:${key}: mesaj fixat.`);
      } catch (error) {
        logger.warn(`seed:${key}: nu am putut fixa mesajul. ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
