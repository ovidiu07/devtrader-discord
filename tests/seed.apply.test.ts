import { describe, expect, it } from "vitest";
import { applySeedMessages } from "../src/seed/apply.js";
import type { RenderedSeedPayload, SeedConfig, SeedWritableChannel, SeedWritableMessage } from "../src/seed/types.js";
import { emptyDiscordState } from "../src/state/loadState.js";

describe("seed apply idempotency", () => {
  it("does not create duplicate messages on repeated apply", async () => {
    const channel = mockChannel();
    const state = emptyDiscordState();

    await applySeedMessages(seedConfig(), { bun_venit: channel }, state);
    await applySeedMessages(seedConfig(), { bun_venit: channel }, state);

    expect(channel.sendPayloads).toHaveLength(1);
    expect(state.seedMessages["bun_venit:intro"]).toBe("created-1");
  });

  it("recovers state when the stored message ID is missing", async () => {
    const channel = mockChannel();
    const state = emptyDiscordState();
    state.seedMessages["bun_venit:intro"] = "missing";

    await applySeedMessages(seedConfig(), { bun_venit: channel }, state);

    expect(channel.sendPayloads).toHaveLength(1);
    expect(state.seedMessages["bun_venit:intro"]).toBe("created-1");
  });

  it("sets allowedMentions on every sent and edited message", async () => {
    const existing = mockMessage("m1", "vechi");
    const channel = mockChannel([existing]);
    const state = emptyDiscordState();
    state.seedMessages["bun_venit:intro"] = "m1";

    await applySeedMessages(seedConfig(), { bun_venit: channel }, state);

    expect(existing.editPayloads[0]?.allowedMentions).toEqual({ parse: [] });

    const freshChannel = mockChannel();
    await applySeedMessages(seedConfig(), { bun_venit: freshChannel }, emptyDiscordState());
    expect(freshChannel.sendPayloads[0]?.allowedMentions).toEqual({ parse: [] });
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

type MockChannel = SeedWritableChannel & {
  sendPayloads: RenderedSeedPayload[];
};

function mockChannel(messages: SeedWritableMessage[] = []): MockChannel {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const sendPayloads: RenderedSeedPayload[] = [];
  return {
    id: "c1",
    key: "bun_venit",
    name: "bun-venit",
    type: "text",
    sendPayloads,
    async fetchMessage(id: string) {
      return byId.get(id) ?? null;
    },
    async send(payload: RenderedSeedPayload) {
      sendPayloads.push(payload);
      const message = mockMessage(`created-${sendPayloads.length}`, payload.content ?? "");
      byId.set(message.id, message);
      return message;
    }
  };
}

function mockMessage(id: string, content: string): SeedWritableMessage & { editPayloads: RenderedSeedPayload[] } {
  const message: SeedWritableMessage & { editPayloads: RenderedSeedPayload[] } = {
    id,
    content,
    embeds: [],
    pinned: false,
    editPayloads: [],
    async edit(payload: RenderedSeedPayload) {
      message.editPayloads.push(payload);
      message.content = payload.content ?? "";
      return message;
    },
    async pin() {
      message.pinned = true;
    }
  };
  return message;
}
