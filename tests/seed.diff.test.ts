import { describe, expect, it } from "vitest";
import { buildSeedPlan } from "../src/seed/plan.js";
import type { RenderedSeedPayload, SeedConfig, SeedWritableChannel, SeedWritableMessage } from "../src/seed/types.js";
import { emptyDiscordState } from "../src/state/loadState.js";

describe("seed diff generation", () => {
  it("plans creates and pins for untracked messages", async () => {
    const plan = await buildSeedPlan(seedConfig(), { bun_venit: mockChannel() }, emptyDiscordState());

    expect(plan.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "create", key: "bun_venit:intro" }),
        expect.objectContaining({ kind: "pin", key: "bun_venit:intro" })
      ])
    );
  });

  it("plans update when tracked message content differs", async () => {
    const state = emptyDiscordState();
    state.seedMessages["bun_venit:intro"] = "m1";
    const channel = mockChannel([mockMessage("m1", "vechi")]);

    const plan = await buildSeedPlan(seedConfig(), { bun_venit: channel }, state);

    expect(plan.operations).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "update", key: "bun_venit:intro" })]));
  });

  it("plans recreate when stored message ID is missing", async () => {
    const state = emptyDiscordState();
    state.seedMessages["bun_venit:intro"] = "missing";

    const plan = await buildSeedPlan(seedConfig(), { bun_venit: mockChannel() }, state);

    expect(plan.operations).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "recreate", key: "bun_venit:intro" })]));
  });
});

function seedConfig(): SeedConfig {
  return {
    messages: [
      {
        key: "intro",
        channelKey: "bun_venit",
        pin: true,
        mode: "plain",
        content: "Acest canal este pentru comunitate și educație."
      }
    ]
  };
}

function mockChannel(messages: SeedWritableMessage[] = []): SeedWritableChannel {
  const byId = new Map(messages.map((message) => [message.id, message]));
  return {
    id: "c1",
    key: "bun_venit",
    name: "bun-venit",
    type: "text",
    async fetchMessage(id: string) {
      return byId.get(id) ?? null;
    },
    async send(payload: RenderedSeedPayload) {
      const message = mockMessage("created", payload.content ?? "");
      byId.set(message.id, message);
      return message;
    }
  };
}

function mockMessage(id: string, content: string): SeedWritableMessage {
  return {
    id,
    content,
    embeds: [],
    pinned: false,
    async edit(payload: RenderedSeedPayload) {
      this.content = payload.content ?? "";
      return this;
    },
    async pin() {
      this.pinned = true;
    }
  };
}
