import type { DiscordState } from "../state/loadState.js";
import { seedPayloadChanges, seedPayloadMatchesMessage } from "./compare.js";
import { renderSeedPayload, seedStateKey } from "./renderSeedMessage.js";
import type { SeedConfig, SeedPlan, SeedPlanOperation, SeedWritableChannel } from "./types.js";

export type SeedChannelMap = Record<string, SeedWritableChannel | undefined>;

export async function buildSeedPlan(config: SeedConfig, channels: SeedChannelMap, state: DiscordState, options: { noPin?: boolean; only?: string } = {}): Promise<SeedPlan> {
  const operations: SeedPlanOperation[] = [];

  for (const seed of config.messages) {
    if (options.only && seed.channelKey !== options.only) continue;

    const key = seedStateKey(seed);
    const channel = channels[seed.channelKey];
    if (!channel) {
      operations.push({
        kind: "warning",
        key,
        channelKey: seed.channelKey,
        messageKey: seed.key,
        reason: "Channel is missing or is not tracked in the current guild state."
      });
      continue;
    }

    if (channel.type !== "text" && channel.type !== "announcement") {
      operations.push({
        kind: "skip",
        key,
        channelKey: seed.channelKey,
        messageKey: seed.key,
        reason: `Channel type "${channel.type}" cannot receive seed messages.`
      });
      continue;
    }

    const payload = renderSeedPayload(seed);
    const messageId = state.seedMessages[key];
    if (!messageId) {
      operations.push({ kind: "create", key, channelKey: seed.channelKey, messageKey: seed.key, reason: "Seed message is not tracked yet." });
      if (seed.pin && !options.noPin) {
        operations.push({ kind: "pin", key, channelKey: seed.channelKey, messageKey: seed.key, reason: "Seed message will be pinned after creation." });
      }
      continue;
    }

    const existing = await channel.fetchMessage(messageId);
    if (!existing) {
      operations.push({ kind: "recreate", key, channelKey: seed.channelKey, messageKey: seed.key, reason: "Stored seed message ID no longer exists." });
      if (seed.pin && !options.noPin) {
        operations.push({ kind: "pin", key, channelKey: seed.channelKey, messageKey: seed.key, reason: "Recreated seed message will be pinned." });
      }
      continue;
    }

    if (!seedPayloadMatchesMessage(payload, existing)) {
      operations.push({
        kind: "update",
        key,
        channelKey: seed.channelKey,
        messageKey: seed.key,
        reason: "Seed message content differs.",
        changes: seedPayloadChanges(payload, existing)
      });
    } else {
      operations.push({ kind: "unchanged", key, channelKey: seed.channelKey, messageKey: seed.key, reason: "Seed message already matches." });
    }

    if (seed.pin && !options.noPin && !existing.pinned) {
      operations.push({ kind: "pin", key, channelKey: seed.channelKey, messageKey: seed.key, reason: "Seed message is not pinned yet." });
    }
  }

  return { operations };
}
