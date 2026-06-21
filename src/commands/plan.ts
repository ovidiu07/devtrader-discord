import "dotenv/config";
import { loadBlueprint } from "../config/loadBlueprint.js";
import { createDiscordClient, getGuildId } from "../discord/client.js";
import { fetchCurrentState } from "../discord/fetchCurrentState.js";
import { buildPlan } from "../diff/buildPlan.js";
import { printPlan } from "../diff/printPlan.js";
import { loadState } from "../state/loadState.js";

export async function runPlanCommand() {
  const blueprint = await loadBlueprint();
  const state = await loadState();
  const client = await createDiscordClient();

  try {
    const guild = await client.guilds.fetch(getGuildId());
    const current = await fetchCurrentState(guild);
    const plan = buildPlan(blueprint, current, state);
    printPlan(plan);
  } finally {
    client.destroy();
  }
}
