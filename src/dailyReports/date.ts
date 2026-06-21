export function todayInReportTimezone(timezone = "Europe/Bucharest", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function formatRomanianDate(date: string, timezone = "Europe/Bucharest"): string {
  const noonUtc = new Date(`${date}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(noonUtc);
}

export function formatRomanianTime(date: Date, timezone = "Europe/Bucharest"): string {
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function isWeekdayInTimezone(timezone = "Europe/Bucharest", now = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
  return weekday !== "Sat" && weekday !== "Sun";
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function reportDelayMs(date: string, time: string, timezone: string, now = new Date()): number {
  const [hour, minute] = time.split(":").map(Number);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  const localNow = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  const target = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), hour, minute, 0);
  return target - localNow;
}
