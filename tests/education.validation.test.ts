import { describe, expect, it } from "vitest";
import type { Blueprint } from "../src/config/schema.js";
import type { EducationContentBank, EducationScheduleConfig } from "../src/education/types.js";
import { validateEducationConfig } from "../src/education/validation.js";

describe("education validation", () => {
  it("accepts valid Romanian content", () => {
    expect(validateEducationConfig(schedule(), bank(), blueprint())).toEqual([]);
  });

  it("rejects missing channel keys", () => {
    const value = schedule();
    value.channels[0].channelKey = "lipsa";

    expect(validateEducationConfig(value, bank(), blueprint())).toEqual(expect.arrayContaining([expect.objectContaining({ message: 'Unknown channel reference "lipsa".' })]));
  });

  it("detects forbidden phrases and non-Romanian content", () => {
    const value = bank();
    value.posts[0].body = "This is a guaranteed signal.";
    value.posts[0].question = "profit garantat?";

    const issues = validateEducationConfig(schedule(), value, blueprint());

    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ message: "Visible education content must be Romanian." })]));
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ message: 'Forbidden phrase detected: "profit garantat".' })]));
  });
});

function blueprint(): Blueprint {
  return {
    server: { name: "DevTrader" },
    roles: [],
    categories: [
      {
        key: "educatie_trading",
        name: "EDUCAȚIE TRADING",
        premiumOnly: false,
        moderatorOnly: false,
        overwrites: [],
        channels: [
          {
            key: "bazele_tradingului",
            name: "bazele-tradingului",
            type: "text",
            readonly: false,
            premiumOnly: false,
            moderatorOnly: false,
            overwrites: []
          }
        ]
      }
    ],
    messages: []
  };
}

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
    posts: Array.from({ length: 30 }, (_, index) => ({
      key: `bazele_${index}`,
      category: "bazele_tradingului",
      weekdayType: "concept" as const,
      difficulty: "beginner" as const,
      title: "Conceptul zilei: ce este contextul",
      body: "Acest material explică pentru începători cum se citește piața și cum se gândește educațional.",
      practical: "Aplică pe un grafic și notează observațiile.",
      question: "Ce ai observat pe piață în acest exemplu?",
      disclaimer: "Conținut educațional. Nu reprezintă consultanță financiară."
    }))
  };
}
