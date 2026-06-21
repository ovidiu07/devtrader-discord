import { describe, expect, it } from "vitest";
import type { Blueprint } from "../src/config/schema.js";
import { buildPlan } from "../src/diff/buildPlan.js";
import type { CurrentGuildState } from "../src/diff/types.js";
import { emptyDiscordState } from "../src/state/loadState.js";

describe("idempotency logic", () => {
  it("does not plan duplicate creates when state maps logical keys to Discord IDs", () => {
    const blueprint: Blueprint = {
      server: { name: "Learn to win" },
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
    const current: CurrentGuildState = {
      id: "guild",
      name: "Learn to win",
      description: null,
      roles: [{ id: "role-1", name: "Membru", permissions: ["ViewChannel"], managed: false }],
      categories: [{ id: "cat-1", name: "START AICI", type: "category", position: 0, overwrites: [] }],
      channels: [
        {
          id: "chan-1",
          name: "bun-venit",
          type: "text",
          parentId: "cat-1",
          parentKey: "START AICI",
          topic: "Topic",
          position: 0,
          overwrites: []
        }
      ]
    };
    const state = emptyDiscordState();
    state.roles.member = "role-1";
    state.categories.start_here = "cat-1";
    state.channels.bun_venit = "chan-1";

    const plan = buildPlan(blueprint, current, state);

    expect(plan.operations.filter((operation) => operation.kind === "create")).toHaveLength(0);
  });
});
