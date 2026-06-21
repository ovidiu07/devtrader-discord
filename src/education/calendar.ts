import { stringify } from "yaml";
import { writeFile } from "node:fs/promises";
import type { EducationCalendar, EducationContentBank, EducationScheduleConfig, EducationState } from "./types.js";
import { selectPostForChannel } from "./selection.js";
import { addDays, todayInTimezone } from "./time.js";

export function generateEducationCalendar(args: {
  schedule: EducationScheduleConfig;
  bank: EducationContentBank;
  state?: EducationState;
  startDate?: string;
  days?: number;
  now?: Date;
}): EducationCalendar {
  const days = args.days ?? 30;
  const calendar: EducationCalendar = { days: [] };
  const rollingState: EducationState = { posts: [...(args.state?.posts ?? [])] };
  const startDate = args.startDate ?? todayInTimezone(args.schedule.timezone, args.now);

  for (let index = 0; index < days; index += 1) {
    const date = addDays(startDate, index);
    const posts = [];
    for (const channel of args.schedule.channels.filter((item) => item.enabled && !item.skip)) {
      const selected = selectPostForChannel({
        date,
        timezone: args.schedule.timezone,
        channel,
        posts: args.bank.posts,
        calendar: { days: [] },
        state: rollingState,
        defaultNoRepeatDays: args.schedule.defaultNoRepeatDays
      });
      if (!selected.post) continue;
      posts.push({ channelKey: channel.channelKey, postKey: selected.post.key });
      rollingState.posts.push({
        date,
        timezone: args.schedule.timezone,
        channelKey: channel.channelKey,
        postKey: selected.post.key,
        status: "posted"
      });
    }
    calendar.days.push({ date, posts });
  }

  return calendar;
}

export async function writeEducationCalendar(calendar: EducationCalendar, path = "config/education-calendar.yml") {
  await writeFile(path, stringify(calendar), "utf8");
}
