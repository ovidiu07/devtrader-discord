import type { WeekdayType } from "./types.js";

const weekdayByIndex: WeekdayType[] = ["preparation", "concept", "mistake", "exercise", "reflection", "case_study", "recap"];

export function todayInTimezone(timezone = "Europe/Bucharest", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function weekdayTypeForDate(date: string, timezone = "Europe/Bucharest"): WeekdayType {
  const noonUtc = new Date(`${date}T12:00:00.000Z`);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(noonUtc);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return weekdayByIndex[index] ?? "concept";
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function bucharestDelayMs(date: string, time: string, now = new Date()): number {
  const [hour, minute] = time.split(":").map(Number);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const currentLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  const targetLocal = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), hour, minute, 0);
  return Math.max(0, targetLocal - currentLocal);
}
