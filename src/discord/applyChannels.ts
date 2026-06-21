import { ChannelType, type CategoryChannel, type Guild, type NonThreadGuildBasedChannel, type TextChannel, type VoiceChannel } from "discord.js";
import type { Blueprint, CategoryBlueprint, ChannelBlueprint } from "../config/schema.js";
import { desiredOverwritesForCategory, desiredOverwritesForChannel, desiredPermissionOverwritesForDiscord } from "./applyPermissions.js";
import { withDiscordRateLimitHandling } from "./rateLimit.js";
import type { DiscordState } from "../state/loadState.js";

const auditReason = "devtrader-discord-provisioner channel sync";

export async function applyChannels(guild: Guild, blueprint: Blueprint, state: DiscordState) {
  const roleIds = { ...state.roles, "@everyone": guild.id };
  const channels = await guild.channels.fetch();

  for (const [categoryIndex, category] of blueprint.categories.entries()) {
    const categoryById = state.categories[category.key] ? channels.get(state.categories[category.key]) : undefined;
    const categoryByName = channels.find((channel) => channel?.type === ChannelType.GuildCategory && channel.name === category.name);
    let categoryChannel: CategoryChannel | undefined = isCategoryChannel(categoryById)
      ? categoryById
      : isCategoryChannel(categoryByName)
        ? categoryByName
        : undefined;

    if (!categoryChannel) {
      categoryChannel = await withDiscordRateLimitHandling(() => createCategoryChannel(guild, category, roleIds));
    } else {
      await editCategoryIfNeeded(categoryChannel, category, roleIds, guild.id);
    }

    state.categories[category.key] = categoryChannel.id;
    await withDiscordRateLimitHandling(() => categoryChannel.setPosition(categoryIndex, { reason: auditReason }).then(() => undefined));

    for (const [channelIndex, channel] of category.channels.entries()) {
      await applyChannel(guild, category, channel, categoryChannel.id, channelIndex, roleIds, state);
    }
  }
}

async function applyChannel(
  guild: Guild,
  category: CategoryBlueprint,
  channel: ChannelBlueprint,
  parentId: string,
  position: number,
  roleIds: Record<string, string>,
  state: DiscordState
) {
  const channels = await guild.channels.fetch();
  let existing: NonThreadGuildBasedChannel | undefined =
    (state.channels[channel.key] ? channels.get(state.channels[channel.key]) : undefined) ??
    channels.find((guildChannel) => guildChannel?.name === channel.name && guildChannel.parentId === parentId) ??
    undefined;

  if (!existing) {
    existing = await withDiscordRateLimitHandling(() => createManagedChannel(guild, category, channel, parentId, roleIds));
  } else {
    await editChannelIfNeeded(existing, channel, category, parentId, roleIds, guild.id);
  }

  state.channels[channel.key] = existing.id;
  if ("setPosition" in existing) {
    await withDiscordRateLimitHandling(() => existing.setPosition(position, { reason: auditReason }).then(() => undefined));
  }
}

async function createCategoryChannel(guild: Guild, category: CategoryBlueprint, roleIds: Record<string, string>): Promise<CategoryChannel> {
  const created = await guild.channels.create({
    name: category.name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: desiredPermissionOverwritesForDiscord(desiredOverwritesForCategory(category), roleIds, guild.id),
    reason: auditReason
  });
  if (created.type !== ChannelType.GuildCategory) {
    throw new Error(`Discord returned unexpected channel type while creating category "${category.key}".`);
  }
  return created;
}

async function createManagedChannel(
  guild: Guild,
  category: CategoryBlueprint,
  channel: ChannelBlueprint,
  parentId: string,
  roleIds: Record<string, string>
): Promise<NonThreadGuildBasedChannel> {
  return guild.channels.create({
    name: channel.name,
    type: channelTypeForCreate(channel.type),
    parent: parentId,
    topic: channel.type === "voice" ? undefined : channel.topic,
    permissionOverwrites: desiredPermissionOverwritesForDiscord(desiredOverwritesForChannel(channel, category), roleIds, guild.id),
    reason: auditReason
  });
}

async function editCategoryIfNeeded(categoryChannel: NonThreadGuildBasedChannel, category: CategoryBlueprint, roleIds: Record<string, string>, guildId: string) {
  if (categoryChannel.type !== ChannelType.GuildCategory) return;
  await withDiscordRateLimitHandling(() =>
    categoryChannel.edit({
      name: category.name,
      permissionOverwrites: desiredPermissionOverwritesForDiscord(desiredOverwritesForCategory(category), roleIds, guildId),
      reason: auditReason
    })
  );
}

async function editChannelIfNeeded(
  guildChannel: NonThreadGuildBasedChannel,
  channel: ChannelBlueprint,
  category: CategoryBlueprint,
  parentId: string,
  roleIds: Record<string, string>,
  guildId: string
) {
  const base = {
    name: channel.name,
    parent: parentId,
    permissionOverwrites: desiredPermissionOverwritesForDiscord(desiredOverwritesForChannel(channel, category), roleIds, guildId),
    reason: auditReason
  };

  if (guildChannel.type === ChannelType.GuildText || guildChannel.type === ChannelType.GuildAnnouncement) {
    await withDiscordRateLimitHandling(() => (guildChannel as TextChannel).edit({ ...base, topic: channel.topic }));
    return;
  }

  if (guildChannel.type === ChannelType.GuildVoice) {
    await withDiscordRateLimitHandling(() => (guildChannel as VoiceChannel).edit(base));
  }
}

function channelTypeForCreate(type: ChannelBlueprint["type"]) {
  if (type === "voice") return ChannelType.GuildVoice;
  if (type === "announcement") return ChannelType.GuildAnnouncement;
  return ChannelType.GuildText;
}

function isCategoryChannel(channel: NonThreadGuildBasedChannel | null | undefined): channel is CategoryChannel {
  return channel?.type === ChannelType.GuildCategory;
}
