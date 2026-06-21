import "dotenv/config";
import type { DailyReportConfig } from "./types.js";

const timePattern = /^[0-2][0-9]:[0-5][0-9]$/;

export function loadDailyReportConfig(env: NodeJS.ProcessEnv = process.env): DailyReportConfig {
  const time = env.DAILY_REPORT_TIME || "09:00";
  const calendarApiUrl = emptyToUndefined(env.ECONOMIC_CALENDAR_API_URL);
  const reutersCron = env.REUTERS_MARKETS_NEWS_CRON || "0 0 9 * * 1-5";
  const reutersTime = parseTimeFromCron(reutersCron) ?? "09:00";
  const currentsEnabled = parseBoolean(env.CURRENTS_MARKET_NEWS_ENABLED, false);
  const currentsCron = env.CURRENTS_MARKET_NEWS_CRON || "0 0 9 * * 1-5";
  const currentsTime = parseTimeFromCron(currentsCron) ?? "09:00";
  if (!timePattern.test(time)) {
    throw new Error("DAILY_REPORT_TIME must use HH:mm format.");
  }
  if (!timePattern.test(reutersTime)) {
    throw new Error("REUTERS_MARKETS_NEWS_CRON must resolve to an HH:mm time.");
  }
  if (!timePattern.test(currentsTime)) {
    throw new Error("CURRENTS_MARKET_NEWS_CRON must resolve to an HH:mm time.");
  }
  if (currentsEnabled && !emptyToUndefined(env.CURRENTS_API_KEY)) {
    throw new Error("CURRENTS_API_KEY is missing. Add it to .env; do not commit the key.");
  }

  return {
    enabled: parseBoolean(env.DAILY_REPORT_ENABLED, true),
    time,
    timezone: env.DAILY_REPORT_TIMEZONE || "Europe/Bucharest",
    stiriImportanteChannelId: emptyToUndefined(env.DISCORD_CHANNEL_STIRI_IMPORTANTE_ID),
    calendarEconomicChannelId: emptyToUndefined(env.DISCORD_CHANNEL_CALENDAR_ECONOMIC_ID),
    reutersMarketsChannelId: emptyToUndefined(env.REUTERS_MARKETS_NEWS_CHANNEL_ID) ?? emptyToUndefined(env.DISCORD_CHANNEL_STIRI_IMPORTANTE_ID),
    currentsMarketNewsChannelId: emptyToUndefined(env.CURRENTS_MARKET_NEWS_CHANNEL_ID),
    postFallbackWhenNoData: parseBoolean(env.POST_FALLBACK_WHEN_NO_DATA, true),
    duplicateGuardEnabled: parseBoolean(env.REPORT_DUPLICATE_GUARD_ENABLED, true),
    news: {
      rssFeeds: splitList(env.NEWS_RSS_FEEDS),
      maxItems: parsePositiveInt(env.NEWS_MAX_ITEMS, 7),
      lookbackHours: parsePositiveInt(env.NEWS_LOOKBACK_HOURS, 24),
      fetchTimeoutSeconds: parsePositiveInt(env.NEWS_FETCH_TIMEOUT_SECONDS, 10)
    },
    calendar: {
      apiUrl: calendarApiUrl,
      apiKey: emptyToUndefined(env.ECONOMIC_CALENDAR_API_KEY),
      sourceType: parseCalendarSourceType(env.ECONOMIC_CALENDAR_SOURCE_TYPE, calendarApiUrl),
      lookaheadDays: parsePositiveInt(env.ECONOMIC_CALENDAR_LOOKAHEAD_DAYS, 1),
      minImportance: parseImportance(env.ECONOMIC_CALENDAR_MIN_IMPORTANCE),
      countries: splitList(env.ECONOMIC_CALENDAR_COUNTRIES || "US,EU,DE,GB"),
      includeMediumImpact: parseBoolean(env.ECONOMIC_CALENDAR_INCLUDE_MEDIUM_IMPACT, false),
      maxEvents: parsePositiveInt(env.ECONOMIC_CALENDAR_MAX_EVENTS, 12)
    },
    reutersMarkets: {
      enabled: parseBoolean(env.REUTERS_MARKETS_NEWS_ENABLED, false),
      sourceUrl: env.REUTERS_MARKETS_NEWS_SOURCE_URL || "https://www.reuters.com/markets/",
      cron: reutersCron,
      time: reutersTime,
      timezone: env.REUTERS_MARKETS_NEWS_TIMEZONE || "Europe/Bucharest",
      fetchTimeoutSeconds: parsePositiveInt(env.REUTERS_MARKETS_NEWS_FETCH_TIMEOUT_SECONDS, 15),
      forceRepost: parseBoolean(env.REUTERS_MARKETS_FORCE_REPOST, false),
      postFallbackWhenNoData: parseBoolean(env.REUTERS_MARKETS_POST_FALLBACK_WHEN_NO_DATA, env.NODE_ENV !== "production")
    },
    currentsMarketNews: {
      enabled: currentsEnabled,
      apiKey: emptyToUndefined(env.CURRENTS_API_KEY),
      channelId: emptyToUndefined(env.CURRENTS_MARKET_NEWS_CHANNEL_ID),
      cron: currentsCron,
      time: currentsTime,
      timezone: env.CURRENTS_MARKET_NEWS_TIMEZONE || "Europe/Bucharest",
      language: env.CURRENTS_MARKET_NEWS_LANGUAGE || "en",
      limit: parsePositiveInt(env.CURRENTS_MARKET_NEWS_LIMIT, 7),
      forceRepost: parseBoolean(env.CURRENTS_MARKET_NEWS_FORCE_REPOST, false),
      fetchTimeoutSeconds: parsePositiveInt(env.CURRENTS_MARKET_NEWS_FETCH_TIMEOUT_SECONDS, 15),
      minItemsToPost: parsePositiveInt(env.CURRENTS_MARKET_NEWS_MIN_ITEMS_TO_POST, env.NODE_ENV === "production" ? 3 : 1)
    }
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseImportance(value: string | undefined): "high" | "medium" | "low" {
  const normalized = (value || "high").trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") return normalized;
  return "high";
}

function parseCalendarSourceType(value: string | undefined, apiUrl: string | undefined): "json" | "forexfactory" | "investinglive" {
  const normalized = (value || "json").trim().toLowerCase();
  if (normalized === "forexfactory") return "forexfactory";
  if (normalized === "investinglive") return "investinglive";
  if (apiUrl) {
    try {
      const hostname = new URL(apiUrl).hostname;
      if (hostname === "forexfactory.com" || hostname.endsWith(".forexfactory.com") || hostname === "nfs.faireconomy.media") return "forexfactory";
      if (hostname === "investinglive.com" || hostname.endsWith(".investinglive.com") || hostname === "calendar.fxstreet.com") return "investinglive";
    } catch {
      return "json";
    }
  }
  return "json";
}

function splitList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseTimeFromCron(cron: string): string | undefined {
  const parts = cron.trim().split(/\s+/);
  const fields = parts.length === 6 ? parts.slice(1) : parts;
  if (fields.length !== 5) return undefined;
  const [minute, hour, , , dayOfWeek] = fields;
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return undefined;
  if (dayOfWeek && !/(^1-5$|^\*$|^MON-FRI$|^mon-fri$)/.test(dayOfWeek)) return undefined;
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  if (hourNumber < 0 || hourNumber > 23 || minuteNumber < 0 || minuteNumber > 59) return undefined;
  return `${String(hourNumber).padStart(2, "0")}:${String(minuteNumber).padStart(2, "0")}`;
}
