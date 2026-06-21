import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DiscordState } from "./loadState.js";

export async function saveState(state: DiscordState, path = "state/discord-state.json") {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
