import { describe, expect, it } from "vitest";
import { applyEducationPlan } from "../src/education/apply.js";
import { renderEducationPayload } from "../src/education/render.js";
import type { EducationChannel, EducationContentBank, EducationPlanItem, EducationRenderedPayload, EducationState } from "../src/education/types.js";

describe("education apply", () => {
  it("sends allowed mentions with Discord payloads", () => {
    expect(renderEducationPayload(bank().posts[0]).allowedMentions).toEqual({ parse: [] });
  });

  it("continues when one channel fails", async () => {
    const state: EducationState = { posts: [] };
    const sent: EducationRenderedPayload[] = [];
    const channels: Record<string, EducationChannel> = {
      bazele_tradingului: {
        id: "c1",
        key: "bazele_tradingului",
        name: "bazele",
        async send(payload) {
          sent.push(payload);
          return { id: "m1", content: "" };
        }
      },
      macroeconomie: {
        id: "c2",
        key: "macroeconomie",
        name: "macro",
        async send() {
          throw new Error("missing permission");
        }
      }
    };

    const records = await applyEducationPlan({ plan: plan(), bank: bank(), channels, state, now: new Date("2026-06-15T05:00:00.000Z") });

    expect(records).toEqual(expect.arrayContaining([expect.objectContaining({ channelKey: "bazele_tradingului", status: "posted" })]));
    expect(records).toEqual(expect.arrayContaining([expect.objectContaining({ channelKey: "macroeconomie", status: "failed" })]));
    expect(sent[0]?.allowedMentions).toEqual({ parse: [] });
  });
});

function bank(): EducationContentBank {
  return {
    posts: [
      {
        key: "p1",
        category: "bazele_tradingului",
        weekdayType: "concept",
        difficulty: "beginner",
        title: "Conceptul zilei: context",
        body: "Acest conținut este pentru educație și observarea pieței.",
        question: "Ce observi?",
        disclaimer: "Conținut educațional."
      },
      {
        key: "p2",
        category: "macroeconomie",
        weekdayType: "concept",
        difficulty: "beginner",
        title: "Macro pe scurt: context",
        body: "Acest conținut este pentru educație și observarea pieței.",
        question: "Ce observi?",
        disclaimer: "Conținut educațional."
      }
    ]
  };
}

function plan(): EducationPlanItem[] {
  return [
    { date: "2026-06-15", timezone: "Europe/Bucharest", channelKey: "bazele_tradingului", scheduledTime: "08:00", postKey: "p1", title: "A", alreadyPosted: false, skipped: false },
    { date: "2026-06-15", timezone: "Europe/Bucharest", channelKey: "macroeconomie", scheduledTime: "08:20", postKey: "p2", title: "B", alreadyPosted: false, skipped: false }
  ];
}
