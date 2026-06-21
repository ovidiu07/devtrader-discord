import { renderDisclaimerRefs } from "./disclaimers.js";
import type { RenderedSeedPayload, SeedMessageConfig } from "./types.js";

export function renderSeedPayload(seed: SeedMessageConfig): RenderedSeedPayload {
  const footer = [seed.embed?.footer, renderDisclaimerRefs(seed.disclaimers)].filter(Boolean).join(" ").trim();

  if (seed.mode === "plain") {
    const content = [seed.content?.trim(), footer].filter(Boolean).join("\n\n");
    return {
      content,
      allowedMentions: { parse: [] }
    };
  }

  if (!seed.embed) {
    return {
      content: seed.content?.trim(),
      allowedMentions: { parse: [] }
    };
  }

  return {
    content: seed.content?.trim(),
    embeds: [
      {
        title: seed.embed.title,
        description: seed.embed.description.trim(),
        color: seed.embed.color,
        footer: footer ? { text: footer } : undefined
      }
    ],
    allowedMentions: { parse: [] }
  };
}

export function seedStateKey(seed: Pick<SeedMessageConfig, "channelKey" | "key">): string {
  return `${seed.channelKey}:${seed.key}`;
}
