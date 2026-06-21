import { describe, expect, it } from "vitest";
import { buildEducationPlan } from "../src/education/plan.js";
import { selectPostForChannel, wasPostedRecently } from "../src/education/selection.js";
import { bucharestDelayMs, weekdayTypeForDate } from "../src/education/time.js";
import type { EducationContentBank, EducationScheduleConfig, EducationState } from "../src/education/types.js";

describe("education selection", () => {
  it("maps weekdays to the configured rhythm", () => {
    expect(weekdayTypeForDate("2026-06-15")).toBe("concept");
    expect(weekdayTypeForDate("2026-06-16")).toBe("mistake");
    expect(weekdayTypeForDate("2026-06-17")).toBe("exercise");
    expect(weekdayTypeForDate("2026-06-18")).toBe("reflection");
    expect(weekdayTypeForDate("2026-06-19")).toBe("case_study");
    expect(weekdayTypeForDate("2026-06-20")).toBe("recap");
    expect(weekdayTypeForDate("2026-06-21")).toBe("preparation");
  });

  it("avoids posts used inside the no-repeat window", () => {
    const state: EducationState = { posts: [{ date: "2026-06-01", timezone: "Europe/Bucharest", channelKey: "bazele_tradingului", postKey: "p1", status: "posted" }] };

    expect(wasPostedRecently(state, "bazele_tradingului", "p1", "2026-06-15", 45)).toBe(true);
    expect(selectPostForChannel({ date: "2026-06-15", timezone: "Europe/Bucharest", channel: schedule().channels[0], posts: bank().posts, calendar: { days: [] }, state, defaultNoRepeatDays: 45 }).post?.key).toBe("p2");
  });

  it("marks dry-run plan items as skipped when already posted today", () => {
    const state: EducationState = { posts: [{ date: "2026-06-15", timezone: "Europe/Bucharest", channelKey: "bazele_tradingului", postKey: "p1", status: "posted" }] };
    const plan = buildEducationPlan({ schedule: schedule(), bank: bank(), calendar: { days: [] }, state, date: "2026-06-15" });

    expect(plan[0]).toMatchObject({ alreadyPosted: true, skipped: true });
  });

  it("computes Europe/Bucharest scheduler delays", () => {
    const now = new Date("2026-06-15T04:30:00.000Z");
    expect(bucharestDelayMs("2026-06-15", "08:00", now)).toBe(30 * 60 * 1000);
  });
});

function schedule(): EducationScheduleConfig {
  return {
    timezone: "Europe/Bucharest",
    enabled: true,
    defaultNoRepeatDays: 45,
    channels: [{ channelKey: "bazele_tradingului", enabled: true, dailyTime: "08:00", contentCategory: "bazele_tradingului" }]
  };
}

function bank(): EducationContentBank {
  return {
    posts: [
      post("p1", "concept"),
      post("p2", "concept"),
      post("p3", "mistake")
    ]
  };
}

function post(key: string, weekdayType: "concept" | "mistake") {
  return {
    key,
    category: "bazele_tradingului",
    weekdayType,
    difficulty: "beginner" as const,
    title: "Conceptul zilei: context",
    body: "Acest conținut este pentru educație și observarea pieței.",
    question: "Ce observi?",
    disclaimer: "Conținut educațional."
  };
}
