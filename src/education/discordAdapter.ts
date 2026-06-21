import { ChannelType, type Guild, type TextChannel } from "discord.js";
import type { Blueprint } from "../config/schema.js";
import type { DiscordState } from "../state/loadState.js";
import { withDiscordRateLimitHandling } from "../discord/rateLimit.js";
import type { EducationChannel, EducationRenderedPayload } from "./types.js";

export async function buildEducationChannelMap(guild: Guild, blueprint: Blueprint, state: DiscordState): Promise<Record<string, EducationChannel | undefined>> {
  const discordChannels = await guild.channels.fetch();
  const map: Record<string, EducationChannel | undefined> = {};

  for (const category of blueprint.categories) {
    for (const channel of category.channels) {
      const id = state.channels[channel.key];
      const discordChannel =
        (id ? discordChannels.get(id) : undefined) ??
        [...discordChannels.values()].find((candidate) => candidate !== null && "name" in candidate && candidate.name === channel.name);
      if (!discordChannel || (discordChannel.type !== ChannelType.GuildText && discordChannel.type !== ChannelType.GuildAnnouncement)) {
        map[channel.key] = undefined;
        continue;
      }

      const textChannel = discordChannel as TextChannel;
      map[channel.key] = {
        id: textChannel.id,
        key: channel.key,
        name: textChannel.name,
        async send(payload: EducationRenderedPayload) {
          try {
            const message = await withDiscordRateLimitHandling(() =>
              textChannel.send({
                content: payload.content,
                embeds: payload.embeds,
                allowedMentions: payload.allowedMentions
              })
            );
            return { id: message.id, content: message.content };
          } catch (error) {
            if (!payload.embeds?.length) throw error;
            const fallback = educationPayloadAsPlainText(payload);
            const message = await withDiscordRateLimitHandling(() => textChannel.send(fallback));
            return { id: message.id, content: message.content };
          }
        }
      };
    }
  }

  return map;
}

function educationPayloadAsPlainText(payload: EducationRenderedPayload): EducationRenderedPayload {
  const embed = payload.embeds?.[0];
  if (!embed) return payload;
  return {
    content: [
      `📘 ${embed.title}`,
      embed.description,
      ...embed.fields.map((field) => `${field.name}:\n${field.value}`),
      embed.footer?.text
    ]
      .filter(Boolean)
      .join("\n\n"),
    allowedMentions: { parse: [] }
  };
}
