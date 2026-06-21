import { readFile } from "node:fs/promises";

export type DiscordState = {
  roles: Record<string, string>;
  categories: Record<string, string>;
  channels: Record<string, string>;
  messages: Record<string, string>;
  seedMessages: Record<string, string>;
};

export const emptyDiscordState = (): DiscordState => ({
  roles: {},
  categories: {},
  channels: {},
  messages: {},
  seedMessages: {}
});

export async function loadState(path = "state/discord-state.json"): Promise<DiscordState> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<DiscordState>;
    return {
      roles: parsed.roles ?? {},
      categories: parsed.categories ?? {},
      channels: parsed.channels ?? {},
      messages: parsed.messages ?? {},
      seedMessages: parsed.seedMessages ?? {}
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyDiscordState();
    throw error;
  }
}
