import { ChannelType, type Guild, type TextChannel } from "discord.js";
import type { Blueprint } from "../config/schema.js";
import { withDiscordRateLimitHandling } from "../discord/rateLimit.js";
import type { DiscordState } from "../state/loadState.js";
import { logger } from "../utils/logger.js";
import { splitDiscordMessage } from "./messageSplit.js";
import type { DailyReportChannel, DailyReportConfig, ReportType } from "./types.js";

const channelFallbacks: Record<ReportType, { envId?: keyof DailyReportConfig; key: string; name: string }> = {
  "stiri-importante": { envId: "stiriImportanteChannelId", key: "stiri_importante", name: "stiri-importante" },
  "calendar-economic": { envId: "calendarEconomicChannelId", key: "calendar_economic", name: "calendar-economic" },
  "reuters-markets": { envId: "reutersMarketsChannelId", key: "stiri_importante", name: "stiri-importante" },
  "currents-market-news": { envId: "currentsMarketNewsChannelId", key: "stiri_importante", name: "stiri-importante" }
};

export async function resolveDailyReportChannel(args: {
  guild: Guild;
  blueprint: Blueprint;
  state: DiscordState;
  config: DailyReportConfig;
  reportType: ReportType;
}): Promise<DailyReportChannel | undefined> {
  const discordChannels = await args.guild.channels.fetch();
  const fallback = channelFallbacks[args.reportType];
  const configuredId = fallback.envId ? (args.config[fallback.envId] as string | undefined) : undefined;
  const blueprintName = findBlueprintChannelName(args.blueprint, fallback.key) ?? fallback.name;
  const stateId = args.state.channels[fallback.key];

  const discordChannel =
    (configuredId ? discordChannels.get(configuredId) : undefined) ??
    (stateId ? discordChannels.get(stateId) : undefined) ??
    [...discordChannels.values()].find((candidate) => candidate !== null && "name" in candidate && candidate.name === blueprintName) ??
    [...discordChannels.values()].find((candidate) => candidate !== null && "name" in candidate && candidate.name === fallback.name);

  if (!discordChannel || (discordChannel.type !== ChannelType.GuildText && discordChannel.type !== ChannelType.GuildAnnouncement)) {
    logger.error(`Daily report channel not found for ${args.reportType}. Configure ${envNameFor(args.reportType)} or create #${fallback.name}.`);
    return undefined;
  }

  const textChannel = discordChannel as TextChannel;
  return {
    id: textChannel.id,
    name: textChannel.name,
    async send(content: string) {
      const message = await withDiscordRateLimitHandling(() => textChannel.send({ content, allowedMentions: { parse: [] } }));
      return { id: message.id, content: message.content };
    }
  };
}

export async function sendDailyReport(channel: DailyReportChannel, content: string): Promise<string[]> {
  const messageIds: string[] = [];
  for (const chunk of splitDiscordMessage(content)) {
    const message = await channel.send(chunk);
    messageIds.push(message.id);
  }
  return messageIds;
}

function findBlueprintChannelName(blueprint: Blueprint, key: string): string | undefined {
  for (const category of blueprint.categories) {
    const channel = category.channels.find((candidate) => candidate.key === key);
    if (channel) return channel.name;
  }
  return undefined;
}

function envNameFor(reportType: ReportType): string {
  if (reportType === "stiri-importante") return "DISCORD_CHANNEL_STIRI_IMPORTANTE_ID";
  if (reportType === "reuters-markets") return "REUTERS_MARKETS_NEWS_CHANNEL_ID";
  if (reportType === "currents-market-news") return "CURRENTS_MARKET_NEWS_CHANNEL_ID";
  return "DISCORD_CHANNEL_CALENDAR_ECONOMIC_ID";
}
