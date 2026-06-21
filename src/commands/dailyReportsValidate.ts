import { loadDailyReportConfig } from "../dailyReports/config.js";
import { logger } from "../utils/logger.js";

export async function runDailyReportsValidateCommand() {
  const config = loadDailyReportConfig();
  if (config.news.rssFeeds.length === 0) logger.warn("NEWS_RSS_FEEDS is empty. The news report will use the no-news fallback.");
  if (config.calendar.sourceType === "investinglive") {
    logger.info("Economic calendar source: investingLive Economic Calendar.");
  } else if (config.calendar.sourceType === "forexfactory") {
    logger.info("Economic calendar source: ForexFactory weekly feed.");
  } else if (!config.calendar.apiUrl) {
    logger.warn("ECONOMIC_CALENDAR_API_URL is empty. The calendar report will use the configured fallback behavior.");
  }
  if (config.reutersMarkets.enabled) {
    logger.info(`Reuters Markets source: ${config.reutersMarkets.sourceUrl}. Schedule: ${config.reutersMarkets.cron} ${config.reutersMarkets.timezone}.`);
  } else {
    logger.warn("Reuters Markets report is disabled. Set REUTERS_MARKETS_NEWS_ENABLED=true to enable it.");
  }
  if (config.currentsMarketNews.enabled) {
    if (!config.currentsMarketNews.channelId) {
      logger.error("Currents market news report is enabled but CURRENTS_MARKET_NEWS_CHANNEL_ID is missing.");
    } else {
      logger.info(`Currents market news source: Currents API. Schedule: ${config.currentsMarketNews.cron} ${config.currentsMarketNews.timezone}.`);
    }
  } else {
    logger.warn("Currents market news report is disabled. Set CURRENTS_MARKET_NEWS_ENABLED=true to enable it.");
  }
  logger.info(`Daily reports validation passed. Schedule: ${config.time} ${config.timezone}, enabled=${config.enabled}.`);
}
