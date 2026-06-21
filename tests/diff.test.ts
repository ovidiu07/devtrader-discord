import { describe, expect, it } from "vitest";
import type { Blueprint } from "../src/config/schema.js";
import { buildPlan } from "../src/diff/buildPlan.js";
import type { CurrentGuildState } from "../src/diff/types.js";
import { emptyDiscordState } from "../src/state/loadState.js";

const blueprint: Blueprint = {
  server: { name: "Learn to win", description: "Desc" },
  roles: [{ key: "member", name: "Membru", permissions: ["View Channels"], deny: [], managed: true }],
  categories: [
    {
      key: "start_here",
      name: "START AICI",
      premiumOnly: false,
      moderatorOnly: false,
      overwrites: [],
      channels: [
        {
          key: "bun_venit",
          name: "bun-venit",
          type: "text",
          topic: "Topic",
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

const emptyCurrent: CurrentGuildState = {
  id: "guild",
  name: "Other",
  description: null,
  roles: [],
  categories: [],
  channels: []
};

describe("diff generation", () => {
  it("plans creates for missing resources", () => {
    const plan = buildPlan(blueprint, emptyCurrent, emptyDiscordState());

    expect(plan.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "create", resource: "role", key: "member" }),
        expect.objectContaining({ kind: "create", resource: "category", key: "start_here" }),
        expect.objectContaining({ kind: "create", resource: "channel", key: "bun_venit" })
      ])
    );
  });

  it("plans updates when tracked resource names differ", () => {
    const state = emptyDiscordState();
    state.roles.member = "role-1";
    const plan = buildPlan(
      blueprint,
      {
        ...emptyCurrent,
        roles: [{ id: "role-1", name: "Old", permissions: [], managed: false }]
      },
      state
    );

    expect(plan.operations).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "update", resource: "role", key: "member" })]));
  });
});
