import { ChannelType, PermissionFlagsBits, type Guild, type Message, type TextChannel } from "discord.js";
import type { Blueprint } from "../config/schema.js";
import type { DiscordState } from "../state/loadState.js";
import { withDiscordRateLimitHandling } from "../discord/rateLimit.js";
import type { RenderedSeedPayload, SeedWritableChannel, SeedWritableMessage } from "./types.js";
import type { SeedChannelMap } from "./plan.js";

export async function buildSeedChannelMap(guild: Guild, blueprint: Blueprint, state: DiscordState): Promise<SeedChannelMap> {
  const discordChannels = await guild.channels.fetch();
  const map: SeedChannelMap = {};

  for (const category of blueprint.categories) {
    for (const blueprintChannel of category.channels) {
      const stateId = state.channels[blueprintChannel.key];
      const discordChannel =
        (stateId ? discordChannels.get(stateId) : undefined) ??
        [...discordChannels.values()].find((candidate) => candidate !== null && "name" in candidate && candidate.name === blueprintChannel.name);

      if (!discordChannel) {
        map[blueprintChannel.key] = undefined;
        continue;
      }

      const type = discordChannel.type === ChannelType.GuildText ? "text" : discordChannel.type === ChannelType.GuildAnnouncement ? "announcement" : discordChannel.type === ChannelType.GuildVoice ? "voice" : discordChannel.type === ChannelType.GuildCategory ? "category" : "unknown";

      if (type !== "text" && type !== "announcement") {
        map[blueprintChannel.key] = {
          id: discordChannel.id,
          key: blueprintChannel.key,
          name: discordChannel.name,
          type,
          async fetchMessage() {
            return null;
          },
          async send() {
            throw new Error(`Channel "${blueprintChannel.key}" is not a text channel.`);
          }
        };
        continue;
      }

      const textChannel = discordChannel as TextChannel;
      map[blueprintChannel.key] = {
        id: textChannel.id,
        key: blueprintChannel.key,
        name: textChannel.name,
        type,
        async fetchMessage(id: string) {
          try {
            const message = await withDiscordRateLimitHandling(() => textChannel.messages.fetch(id));
            return toSeedWritableMessage(message);
          } catch (error) {
            const code = (error as { code?: number }).code;
            if (code === 10008) return null;
            throw error;
          }
        },
        async send(payload: RenderedSeedPayload) {
          const message = await withDiscordRateLimitHandling(() =>
            textChannel.send({
              content: payload.content,
              embeds: payload.embeds,
              allowedMentions: payload.allowedMentions
            })
          );
          return toSeedWritableMessage(message);
        }
      };
    }
  }

  return map;
}

export async function collectPinPermissionWarnings(channels: SeedChannelMap): Promise<string[]> {
  const warnings: string[] = [];
  for (const channel of Object.values(channels)) {
    if (!channel || (channel.type !== "text" && channel.type !== "announcement")) continue;
    const discordChannel = channel as SeedWritableChannel & { raw?: TextChannel };
    const raw = discordChannel.raw;
    if (!raw?.guild.members.me) continue;
    if (!raw.permissionsFor(raw.guild.members.me)?.has(PermissionFlagsBits.PinMessages)) {
      warnings.push(`Botul nu pare să aibă PIN_MESSAGES în #${raw.name}. Mesajul va fi postat/editat, dar pin-ul poate eșua.`);
    }
  }
  return warnings;
}

function toSeedWritableMessage(message: Message): SeedWritableMessage {
  return {
    id: message.id,
    content: message.content,
    embeds: message.embeds.map((embed) => ({
      title: embed.title ?? undefined,
      description: embed.description ?? undefined,
      color: embed.color ?? undefined,
      footer: embed.footer ? { text: embed.footer.text } : undefined
    })),
    pinned: message.pinned,
    async edit(payload: RenderedSeedPayload) {
      const edited = await withDiscordRateLimitHandling(() =>
        message.edit({
          content: payload.content,
          embeds: payload.embeds,
          allowedMentions: payload.allowedMentions
        })
      );
      return toSeedWritableMessage(edited);
    },
    async pin(reason?: string) {
      await withDiscordRateLimitHandling(() => message.pin(reason));
    }
  };
}
