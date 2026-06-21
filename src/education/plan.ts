import type { EducationCalendar, EducationContentBank, EducationPlanItem, EducationScheduleConfig, EducationState } from "./types.js";
import { selectPostForChannel, wasChannelPostedToday } from "./selection.js";
import { todayInTimezone } from "./time.js";

export function buildEducationPlan(args: {
  schedule: EducationScheduleConfig;
  bank: EducationContentBank;
  calendar: EducationCalendar;
  state: EducationState;
  date?: string;
  only?: string;
  skip?: string[];
  now?: Date;
}): EducationPlanItem[] {
  const date = args.date ?? todayInTimezone(args.schedule.timezone, args.now);
  const skipSet = new Set(args.skip ?? []);

  return args.schedule.channels
    .filter((channel) => !args.only || channel.channelKey === args.only)
    .map((channel) => {
      if (!args.schedule.enabled) return skipped(date, args.schedule.timezone, channel.channelKey, channel.dailyTime, "Education schedule is disabled.");
      if (!channel.enabled || channel.skip || skipSet.has(channel.channelKey)) return skipped(date, args.schedule.timezone, channel.channelKey, channel.dailyTime, "Channel is disabled or skipped.");

      const selected = selectPostForChannel({
        date,
        timezone: args.schedule.timezone,
        channel,
        posts: args.bank.posts,
        calendar: args.calendar,
        state: args.state,
        defaultNoRepeatDays: args.schedule.defaultNoRepeatDays
      });
      if (!selected.post) return skipped(date, args.schedule.timezone, channel.channelKey, channel.dailyTime, selected.reason ?? "No content selected.");

      const alreadyPosted = wasChannelPostedToday(args.state, date, channel.channelKey);
      return {
        date,
        timezone: args.schedule.timezone,
        channelKey: channel.channelKey,
        scheduledTime: channel.dailyTime,
        postKey: selected.post.key,
        title: selected.post.title,
        alreadyPosted,
        skipped: alreadyPosted,
        reason: alreadyPosted ? "A post was already published today in this channel." : selected.reason
      };
    });
}

function skipped(date: string, timezone: string, channelKey: string, scheduledTime: string, reason: string): EducationPlanItem {
  return { date, timezone, channelKey, scheduledTime, alreadyPosted: false, skipped: true, reason };
}

export function printEducationPlan(items: EducationPlanItem[]) {
  console.log("\nDaily education plan\n");
  for (const item of items) {
    console.log(`${item.date} ${item.scheduledTime} ${item.timezone} | ${item.channelKey}`);
    console.log(`  post: ${item.postKey ?? "-"} | ${item.title ?? "-"}`);
    console.log(`  alreadyPosted: ${item.alreadyPosted ? "yes" : "no"} | skipped: ${item.skipped ? "yes" : "no"}`);
    if (item.reason) console.log(`  reason: ${item.reason}`);
    console.log("");
  }
}
