import { ChannelType, type Guild, type NonThreadGuildBasedChannel } from "discord.js";
import { permissionNamesFromBits } from "./applyPermissions.js";
import type { CurrentChannelState, CurrentGuildState } from "../diff/types.js";

export async function fetchCurrentState(guild: Guild): Promise<CurrentGuildState> {
  const channels = await guild.channels.fetch();
  const roles = await guild.roles.fetch();
  const channelList = [...channels.values()].filter(isPresent);
  const parentKeys = categoryKeyById(channelList);
  const categories = channelList.filter(isCategory).map((channel) => channelToState(channel, parentKeys));

  return {
    id: guild.id,
    name: guild.name,
    description: guild.description,
    roles: roles
      .filter((role) => role.name !== "@everyone")
      .map((role) => ({
        id: role.id,
        name: role.name,
        permissions: permissionNamesFromBits(role.permissions),
        position: role.position,
        managed: role.managed
      }))
      .sort((a, b) => b.position - a.position),
    categories,
    channels: channelList.filter((channel) => channel.type !== ChannelType.GuildCategory).map((channel) => channelToState(channel, parentKeys))
  };
}

function channelToState(channel: NonThreadGuildBasedChannel, parentKeys: Record<string, string>): CurrentChannelState {
  const permissionOverwrites = "permissionOverwrites" in channel ? channel.permissionOverwrites.cache : undefined;
  const parentId = "parentId" in channel ? channel.parentId : null;
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type === ChannelType.GuildCategory ? "category" : channel.type === ChannelType.GuildVoice ? "voice" : channel.type === ChannelType.GuildAnnouncement ? "announcement" : "text",
    parentId,
    parentKey: parentId ? parentKeys[parentId] : undefined,
    topic: "topic" in channel ? channel.topic : null,
    position: "position" in channel ? channel.position : undefined,
    overwrites: permissionOverwrites?.map((overwrite) => ({
      id: overwrite.id,
      type: overwrite.type === 0 ? "role" : "member",
      allow: permissionNamesFromBits(overwrite.allow),
      deny: permissionNamesFromBits(overwrite.deny)
    }))
  };
}

function categoryKeyById(channels: NonThreadGuildBasedChannel[]): Record<string, string> {
  const result: Record<string, string> = {};
  channels.filter(isCategory).forEach((channel) => {
    result[channel.id] = channel.name;
  });
  return result;
}

function isPresent(channel: NonThreadGuildBasedChannel | null): channel is NonThreadGuildBasedChannel {
  return Boolean(channel);
}

function isCategory(channel: NonThreadGuildBasedChannel) {
  return channel.type === ChannelType.GuildCategory;
}
