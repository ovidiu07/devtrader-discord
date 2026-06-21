import { ChannelType, type Guild, type TextChannel } from "discord.js";
import type { Blueprint } from "../config/schema.js";
import type { DiscordState } from "../state/loadState.js";
import { withDiscordRateLimitHandling } from "./rateLimit.js";

const auditReason = "devtrader-discord-provisioner message sync";

export async function applyMessages(guild: Guild, blueprint: Blueprint, state: DiscordState) {
  const channels = await guild.channels.fetch();
  const me = guild.client.user;

  for (const message of blueprint.messages) {
    if (message.mode === "print-only") {
      console.log(`\nSuggested content for ${message.channelKey}:\n${message.body}\n`);
      continue;
    }

    const channelId = state.channels[message.channelKey];
    const channel = channelId ? channels.get(channelId) : undefined;
    if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
      console.log(`Cannot post managed message "${message.key}": channel "${message.channelKey}" is not a text channel.`);
      console.log(message.body);
      continue;
    }

    const textChannel = channel as TextChannel;
    const body = `${message.body.trim()}\n\n[managed:devtrader:${message.key}]`;

    if (state.messages[message.key]) {
      try {
        const existing = await textChannel.messages.fetch(state.messages[message.key]);
        if (existing.content !== body) {
          await withDiscordRateLimitHandling(() => existing.edit(body));
        }
        continue;
      } catch {
        delete state.messages[message.key];
      }
    }

    const recent = await textChannel.messages.fetch({ limit: 50 });
    const matching = recent.find((candidate) => candidate.author.id === me?.id && candidate.content.includes(`[managed:devtrader:${message.key}]`));
    if (matching) {
      state.messages[message.key] = matching.id;
      if (matching.content !== body) {
        await withDiscordRateLimitHandling(() => matching.edit(body));
      }
      continue;
    }

    const created = await withDiscordRateLimitHandling(() => textChannel.send({ content: body, allowedMentions: { parse: [] } }));
    state.messages[message.key] = created.id;
  }
}
