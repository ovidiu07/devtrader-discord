import { loadDailyReportConfig } from "../dailyReports/config.js";
import { nextDailyReportTarget } from "../dailyReports/scheduler.js";
import { runDailyReports } from "../dailyReports/run.js";
import { loadEducationSchedule } from "../education/loadConfig.js";
import { bucharestDelayMs, todayInTimezone, addDays } from "../education/time.js";
import { logger } from "../utils/logger.js";
import { runEducationRunCommand } from "./educationRun.js";

export async function runSchedulerStartCommand() {
  logger.info("Scheduler process started. Keep this process running; for cron or launchd use `npm run generate-all` instead.");
  scheduleDailyReports();
  const schedule = await loadEducationSchedule();
  if (!schedule.enabled) {
    logger.warn("Education schedule is disabled. Scheduler will stay idle.");
  }

  const channelsByTime = new Map<string, string[]>();
  for (const channel of schedule.channels.filter((item) => item.enabled && !item.skip)) {
    const channels = channelsByTime.get(channel.dailyTime) ?? [];
    channels.push(channel.channelKey);
    channelsByTime.set(channel.dailyTime, channels);
  }

  for (const [dailyTime, channelKeys] of channelsByTime) {
    scheduleChannels(channelKeys, dailyTime);
  }
}

function scheduleDailyReports() {
  const config = loadDailyReportConfig();
  if (!config.enabled && !config.reutersMarkets.enabled && !config.currentsMarketNews.enabled) {
    logger.warn("Daily reports are disabled. Scheduler will not post market reports.");
    return;
  }

  if (config.enabled) {
    scheduleReportGroup({
      label: "stiri-importante and calendar-economic",
      time: config.time,
      timezone: config.timezone,
      run: async () => {
        await runDailyReports({ only: "stiri-importante" });
        await runDailyReports({ only: "calendar-economic" });
      }
    });
  }

  if (config.reutersMarkets.enabled) {
    scheduleReportGroup({
      label: "Reuters Markets report",
      time: config.reutersMarkets.time,
      timezone: config.reutersMarkets.timezone,
      run: () => runDailyReports({ only: "reuters-markets" })
    });
  }

  if (config.currentsMarketNews.enabled) {
    if (!config.currentsMarketNews.channelId) {
      logger.error("Currents market news scheduler is disabled because CURRENTS_MARKET_NEWS_CHANNEL_ID is missing.");
    } else {
      scheduleReportGroup({
        label: "Currents market news report",
        time: config.currentsMarketNews.time,
        timezone: config.currentsMarketNews.timezone,
        run: () => runDailyReports({ only: "currents-market-news" })
      });
    }
  }
}

function scheduleReportGroup(args: { label: string; time: string; timezone: string; run: () => Promise<void> }) {
  const target = nextDailyReportTarget({ time: args.time, timezone: args.timezone });
  logger.info(`Next ${args.label}: ${target.date} ${args.time} ${args.timezone}.`);
  setTimeout(async () => {
    try {
      await args.run();
    } catch (error) {
      logger.warn(`${args.label} scheduler run failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      scheduleReportGroup(args);
    }
  }, target.delayMs);
}

function scheduleChannels(channelKeys: string[], dailyTime: string) {
  const target = nextTarget(dailyTime);
  logger.info(`Next education posts for ${channelKeys.join(", ")}: ${target.date} ${dailyTime} Europe/Bucharest.`);
  setTimeout(async () => {
    try {
      for (const channelKey of channelKeys) {
        await runEducationRunCommand({ only: channelKey });
      }
    } finally {
      scheduleChannels(channelKeys, dailyTime);
    }
  }, target.delayMs);
}

function nextTarget(dailyTime: string): { date: string; delayMs: number } {
  const today = todayInTimezone("Europe/Bucharest");
  const todayDelay = bucharestDelayMs(today, dailyTime);
  if (todayDelay > 0) return { date: today, delayMs: todayDelay };
  const tomorrow = addDays(today, 1);
  return { date: tomorrow, delayMs: bucharestDelayMs(tomorrow, dailyTime) };
}
