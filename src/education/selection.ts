import type { EducationCalendar, EducationPost, EducationScheduleChannel, EducationState, WeekdayType } from "./types.js";
import { weekdayTypeForDate } from "./time.js";

export function selectPostForChannel(args: {
  date: string;
  timezone: string;
  channel: EducationScheduleChannel;
  posts: EducationPost[];
  calendar: EducationCalendar;
  state: EducationState;
  defaultNoRepeatDays: number;
}): { post?: EducationPost; reason?: string } {
  const calendarPostKey = args.calendar.days.find((day) => day.date === args.date)?.posts.find((post) => post.channelKey === args.channel.channelKey)?.postKey;
  if (calendarPostKey) {
    const calendarPost = args.posts.find((post) => post.key === calendarPostKey);
    if (!calendarPost) return { reason: `Calendar references missing post "${calendarPostKey}".` };
    if (wasPostedToday(args.state, args.date, args.channel.channelKey, calendarPost.key)) return { post: calendarPost, reason: "Already posted today." };
    return { post: calendarPost };
  }

  const weekdayType = weekdayTypeForDate(args.date, args.timezone);
  const noRepeatDays = args.channel.noRepeatDays ?? args.defaultNoRepeatDays;
  const candidates = args.posts
    .filter((post) => post.category === args.channel.contentCategory)
    .filter((post) => post.weekdayType === weekdayType)
    .sort((a, b) => a.key.localeCompare(b.key));

  const fresh = candidates.find((post) => !wasPostedRecently(args.state, args.channel.channelKey, post.key, args.date, noRepeatDays));
  if (fresh) return { post: fresh };
  if (candidates[0]) return { post: candidates[0], reason: `All matching posts were used within ${noRepeatDays} days; selecting oldest deterministic fallback.` };
  return { reason: `No posts found for category "${args.channel.contentCategory}" and weekday type "${weekdayType}".` };
}

export function wasPostedToday(state: EducationState, date: string, channelKey: string, postKey: string): boolean {
  return state.posts.some((record) => record.date === date && record.channelKey === channelKey && record.postKey === postKey && record.status === "posted");
}

export function wasChannelPostedToday(state: EducationState, date: string, channelKey: string): boolean {
  return state.posts.some((record) => record.date === date && record.channelKey === channelKey && record.status === "posted");
}

export function wasPostedRecently(state: EducationState, channelKey: string, postKey: string, date: string, days: number): boolean {
  const target = Date.parse(`${date}T00:00:00.000Z`);
  const windowMs = days * 24 * 60 * 60 * 1000;
  return state.posts.some((record) => {
    if (record.channelKey !== channelKey || record.postKey !== postKey || record.status !== "posted") return false;
    const postedDate = Date.parse(`${record.date}T00:00:00.000Z`);
    return postedDate <= target && target - postedDate < windowMs;
  });
}

export function weekdayTypes(): WeekdayType[] {
  return ["concept", "mistake", "exercise", "reflection", "case_study", "recap", "preparation"];
}
