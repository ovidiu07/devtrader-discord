import { loadBlueprint } from "../config/loadBlueprint.js";
import { createDiscordClient, getGuildId } from "../discord/client.js";
import { loadState } from "../state/loadState.js";
import { logger } from "../utils/logger.js";
import type { Guild } from "discord.js";
import { fetchEconomicCalendarEvents } from "./calendarSource.js";
import { buildEconomicCalendarReport } from "./calendarService.js";
import { loadDailyReportConfig } from "./config.js";
import { cacheCurrentsMarketNewsReport, loadCurrentsMarketNewsCache, markCurrentsMarketNewsFailed, markCurrentsMarketNewsPosted, saveCurrentsMarketNewsCache } from "./currentsMarketNewsState.js";
import { fetchAvailableCategories, fetchMarketNewsCandidates, generateRomanianReport, hashMarketNewsItem, selectTopSevenNews } from "./currentsMarketNewsService.js";
import { todayInReportTimezone } from "./date.js";
import { resolveDailyReportChannel, sendDailyReport } from "./discordAdapter.js";
import { buildImportantNewsReport } from "./newsService.js";
import { fetchRssNewsItems } from "./newsSource.js";
import { buildReutersMarketsReport, fetchReutersMarketsHtml, parseReutersMarketsHtml } from "./reutersMarketsService.js";
import { cacheReutersMarketsExtraction, loadReutersMarketsCache, markReutersMarketsPosted, saveReutersMarketsCache } from "./reutersMarketsState.js";
import { loadDailyReportState, saveDailyReportState, wasReportPosted } from "./state.js";
import type { DailyReportConfig, DailyReportPostRecord, DailyReportState, ReportType } from "./types.js";

interface BuiltReportPayload {
  content: string;
  articleHashes?: string[];
  articleCount?: number;
}

export async function runDailyReports(options: { only?: ReportType; force?: boolean; dryRun?: boolean } = {}) {
  const config = loadDailyReportConfig();
  if (!config.enabled && !config.reutersMarkets.enabled && !config.currentsMarketNews.enabled) {
    logger.warn("Daily reports are disabled.");
    return;
  }

  const state = await loadDailyReportState();
  const reportTypes = resolveReportTypes(config, options.only);
  if (reportTypes.length === 0) {
    logger.warn("No enabled daily reports match the requested options.");
    return;
  }

  if (options.dryRun) {
    for (const reportType of reportTypes) {
      if (shouldSkipNoCalendarSource(reportType, config)) {
        logger.warn("daily-report:calendar-economic: skipped because ECONOMIC_CALENDAR_API_URL is not configured and POST_FALLBACK_WHEN_NO_DATA=false.");
        continue;
      }
      const date = dateForReport(reportType, config);
      const payload = await buildReportPayload(reportType, config, date, { cacheExtraction: false });
      logger.info(`\n${payload.content}\n`);
    }
    return;
  }

  const [blueprint, discordState] = await Promise.all([loadBlueprint(), loadState()]);
  const client = await createDiscordClient();
  try {
    const guild = await client.guilds.fetch(getGuildId());
    for (const reportType of reportTypes) {
      const date = dateForReport(reportType, config);
      try {
        await runOneReport({
          reportType,
          config,
          state,
          date,
          force: options.force ?? shouldForceReport(reportType, config),
          guild,
          blueprint,
          discordState
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`daily-report:${reportType}: unexpected failure. ${message}`);
        state.posts.push({ date, reportType, status: "failed", postedAt: new Date().toISOString(), error: message });
      }
      await saveDailyReportState(state);
    }
  } finally {
    client.destroy();
  }
}

export async function runOneReport(args: {
  reportType: ReportType;
  config: DailyReportConfig;
  state: DailyReportState;
  date: string;
  force: boolean;
  guild: Guild;
  blueprint: Awaited<ReturnType<typeof loadBlueprint>>;
  discordState: Awaited<ReturnType<typeof loadState>>;
}) {
  if (args.config.duplicateGuardEnabled && !args.force && wasReportPosted(args.state, args.date, args.reportType)) {
      logger.info(`daily-report:${args.reportType}: skipped duplicate for ${args.date}.`);
    args.state.posts.push({ date: args.date, reportType: args.reportType, status: "skipped", error: "Report already posted today." });
    return;
  }

  if (shouldSkipNoCalendarSource(args.reportType, args.config)) {
    logger.warn("daily-report:calendar-economic: skipped because ECONOMIC_CALENDAR_API_URL is not configured and POST_FALLBACK_WHEN_NO_DATA=false.");
    args.state.posts.push({ date: args.date, reportType: args.reportType, status: "skipped", error: "Economic calendar source is not configured." });
    return;
  }
  if (shouldSkipNoCurrentsChannel(args.reportType, args.config)) {
    logger.error("daily-report:currents-market-news: skipped because CURRENTS_MARKET_NEWS_CHANNEL_ID is missing.");
    args.state.posts.push({ date: args.date, reportType: args.reportType, status: "skipped", error: "CURRENTS_MARKET_NEWS_CHANNEL_ID is missing." });
    return;
  }

  const channel = await resolveDailyReportChannel({
    guild: args.guild,
    blueprint: args.blueprint,
    state: args.discordState,
    config: args.config,
    reportType: args.reportType
  });
  if (!channel) {
    args.state.posts.push({ date: args.date, reportType: args.reportType, status: "failed", error: "Discord channel not found." });
    return;
  }

  try {
    const payload = await buildReportPayload(args.reportType, args.config, args.date, { cacheExtraction: true });
    const discordMessageIds = await sendDailyReport(channel, payload.content);
    const postedAt = new Date().toISOString();
    const record: DailyReportPostRecord = {
      date: args.date,
      reportType: args.reportType,
      status: "posted",
      discordChannelId: channel.id,
      discordMessageIds,
      articleHashes: payload.articleHashes,
      articleCount: payload.articleCount,
      postedAt
    };
    if (args.reportType === "reuters-markets") {
      const cache = await loadReutersMarketsCache();
      markReutersMarketsPosted({ cache, date: args.date, postedAt, discordChannelId: channel.id, discordMessageIds });
      await saveReutersMarketsCache(cache);
    }
    if (args.reportType === "currents-market-news") {
      const cache = await loadCurrentsMarketNewsCache();
      markCurrentsMarketNewsPosted({ cache, reportDate: args.date, postedAt, channelId: channel.id, discordMessageIds });
      await saveCurrentsMarketNewsCache(cache);
    }
    args.state.posts.push(record);
    logger.info(`daily-report:${args.reportType}: posted to #${channel.name}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    args.state.posts.push({ date: args.date, reportType: args.reportType, status: "failed", discordChannelId: channel.id, postedAt: new Date().toISOString(), error: message });
    if (args.reportType === "currents-market-news") {
      const cache = await loadCurrentsMarketNewsCache();
      markCurrentsMarketNewsFailed({ cache, reportDate: args.date, generatedAt: new Date().toISOString(), errorMessage: message });
      await saveCurrentsMarketNewsCache(cache);
    }
    logger.warn(`daily-report:${args.reportType}: failed. ${message}`);
  }
}

export async function buildReportContent(reportType: ReportType, config: DailyReportConfig, date = todayInReportTimezone(config.timezone)): Promise<string> {
  return (await buildReportPayload(reportType, config, date, { cacheExtraction: false })).content;
}

async function buildReportPayload(reportType: ReportType, config: DailyReportConfig, date = todayInReportTimezone(config.timezone), options: { cacheExtraction: boolean }): Promise<BuiltReportPayload> {
  if (reportType === "stiri-importante") {
    const items = config.news.rssFeeds.length > 0 ? await fetchRssNewsItems(config.news) : [];
    return { content: buildImportantNewsReport({ date, timezone: config.timezone, items, config: config.news }) };
  }

  if (reportType === "calendar-economic") {
    const events = config.calendar.sourceType === "forexfactory" || config.calendar.apiUrl ? await fetchEconomicCalendarEvents(config.calendar) : [];
    return { content: buildEconomicCalendarReport({ date, timezone: config.timezone, events, config }) };
  }

  if (reportType === "currents-market-news") {
    return buildCurrentsMarketNewsPayload(config, date, options);
  }

  let html: string;
  try {
    html = await fetchReutersMarketsHtml(config.reutersMarkets);
  } catch (error) {
    if (!config.reutersMarkets.postFallbackWhenNoData) throw error;
    logger.warn(`daily-report:reuters-markets: source unavailable; posting configured fallback. ${error instanceof Error ? error.message : String(error)}`);
    return {
      content: await buildReutersMarketsReport({
        date,
        timezone: config.reutersMarkets.timezone,
        articles: [],
        sourceUrl: config.reutersMarkets.sourceUrl,
        allowEmptyReport: true
      }),
      articleHashes: [],
      articleCount: 0
    };
  }
  const extractedAt = new Date();
  const articles = parseReutersMarketsHtml(html, { sourceUrl: config.reutersMarkets.sourceUrl, extractedAt });
  if (options.cacheExtraction) {
    const cache = await loadReutersMarketsCache();
    cacheReutersMarketsExtraction({ cache, date, sourceUrl: config.reutersMarkets.sourceUrl, extractedAt: extractedAt.toISOString(), articles });
    await saveReutersMarketsCache(cache);
  }
  return {
    content: await buildReutersMarketsReport({
      date,
      timezone: config.reutersMarkets.timezone,
      articles,
      sourceUrl: config.reutersMarkets.sourceUrl,
      now: extractedAt,
      allowEmptyReport: config.reutersMarkets.postFallbackWhenNoData
    }),
    articleHashes: articles.map((article) => article.hash),
    articleCount: articles.length
  };
}

async function buildCurrentsMarketNewsPayload(config: DailyReportConfig, date: string, options: { cacheExtraction: boolean }): Promise<BuiltReportPayload> {
  logger.info("daily-report:currents-market-news: starting Currents API fetch.");
  const categories = await fetchAvailableCategories(config.currentsMarketNews);
  if (!categories.includes("economy_business_finance")) {
    throw new Error("Currents API category economy_business_finance is not available.");
  }

  const candidates = await fetchMarketNewsCandidates(config.currentsMarketNews);
  logger.info(`daily-report:currents-market-news: ${candidates.length} deduplicated candidates after API fetch and fallback.`);
  const selected = selectTopSevenNews(candidates, config.currentsMarketNews.limit);
  if (selected.length < 3 && config.currentsMarketNews.minItemsToPost < 3) {
    logger.warn(`daily-report:currents-market-news: development mode allows posting with only ${selected.length} valid news items.`);
  }
  logger.info(`daily-report:currents-market-news: selected titles: ${selected.map((item) => item.titleOriginal).join(" | ")}`);
  const generatedAt = new Date();
  const itemHashes = selected.map(hashMarketNewsItem);
  if (options.cacheExtraction) {
    const cache = await loadCurrentsMarketNewsCache();
    cacheCurrentsMarketNewsReport({ cache, reportDate: date, generatedAt: generatedAt.toISOString(), itemHashes, items: selected });
    await saveCurrentsMarketNewsCache(cache);
  }
  return {
    content: generateRomanianReport({
      date,
      timezone: config.currentsMarketNews.timezone,
      items: selected,
      now: generatedAt,
      minItems: config.currentsMarketNews.minItemsToPost
    }),
    articleHashes: itemHashes,
    articleCount: selected.length
  };
}

function shouldSkipNoCalendarSource(reportType: ReportType, config: DailyReportConfig): boolean {
  return reportType === "calendar-economic" && config.calendar.sourceType !== "forexfactory" && !config.calendar.apiUrl && !config.postFallbackWhenNoData;
}

function shouldSkipNoCurrentsChannel(reportType: ReportType, config: DailyReportConfig): boolean {
  return reportType === "currents-market-news" && !config.currentsMarketNews.channelId;
}

function resolveReportTypes(config: DailyReportConfig, only?: ReportType): ReportType[] {
  if (only) {
    if (only === "reuters-markets") return config.reutersMarkets.enabled ? [only] : [];
    if (only === "currents-market-news") return config.currentsMarketNews.enabled ? [only] : [];
    return config.enabled ? [only] : [];
  }
  return [
    ...(config.enabled ? (["stiri-importante", "calendar-economic"] as ReportType[]) : []),
    ...(config.reutersMarkets.enabled ? (["reuters-markets"] as ReportType[]) : []),
    ...(config.currentsMarketNews.enabled ? (["currents-market-news"] as ReportType[]) : [])
  ];
}

function shouldForceReport(reportType: ReportType, config: DailyReportConfig): boolean {
  if (reportType === "currents-market-news") return config.currentsMarketNews.forceRepost;
  return reportType === "reuters-markets" && config.reutersMarkets.forceRepost;
}

function dateForReport(reportType: ReportType, config: DailyReportConfig): string {
  if (reportType === "currents-market-news") return todayInReportTimezone(config.currentsMarketNews.timezone);
  return todayInReportTimezone(reportType === "reuters-markets" ? config.reutersMarkets.timezone : config.timezone);
}
