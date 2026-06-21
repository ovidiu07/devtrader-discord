import { addDays, isWeekdayInTimezone, reportDelayMs, todayInReportTimezone } from "./date.js";

export function nextDailyReportTarget(args: { time: string; timezone: string; now?: Date }): { date: string; delayMs: number } {
  const now = args.now ?? new Date();
  let date = todayInReportTimezone(args.timezone, now);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidateDate = offset === 0 ? date : addDays(date, offset);
    const delayMs = reportDelayMs(candidateDate, args.time, args.timezone, now);
    const candidateNow = new Date(now.getTime() + Math.max(delayMs, 0));
    if (delayMs > 0 && isWeekdayInTimezone(args.timezone, candidateNow)) {
      return { date: candidateDate, delayMs };
    }
  }

  date = addDays(date, 1);
  return { date, delayMs: reportDelayMs(date, args.time, args.timezone, now) };
}
