import type { RenderedSeedPayload, SeedMessageSnapshot } from "./types.js";

export function seedPayloadMatchesMessage(payload: RenderedSeedPayload, message: SeedMessageSnapshot): boolean {
  return normalized(message.content) === normalized(payload.content ?? "") && normalizedEmbeds(message.embeds) === normalizedEmbeds(payload.embeds ?? []);
}

export function seedPayloadChanges(payload: RenderedSeedPayload, message: SeedMessageSnapshot): string[] {
  const changes: string[] = [];
  if (normalized(message.content) !== normalized(payload.content ?? "")) {
    changes.push("content differs");
  }
  if (normalizedEmbeds(message.embeds) !== normalizedEmbeds(payload.embeds ?? [])) {
    changes.push("embed differs");
  }
  return changes;
}

function normalized(value: string): string {
  return value.trim().replace(/\r\n/g, "\n");
}

function normalizedEmbeds(embeds: RenderedSeedPayload["embeds"]): string {
  return JSON.stringify(
    (embeds ?? []).map((embed) => ({
      title: embed.title ?? "",
      description: normalized(embed.description ?? ""),
      footer: embed.footer?.text ?? "",
      color: embed.color ?? null
    }))
  );
}
