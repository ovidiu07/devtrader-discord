import "dotenv/config";
import { loadBlueprint } from "../config/loadBlueprint.js";
import { createDiscordClient, getGuildId } from "../discord/client.js";
import { buildSeedChannelMap } from "../seed/discordAdapter.js";
import { loadSeedConfig } from "../seed/loadSeedConfig.js";
import { buildSeedPlan } from "../seed/plan.js";
import { printSeedPlan } from "../seed/printSeedPlan.js";
import { validateSeedConfig } from "../seed/validation.js";
import { loadState } from "../state/loadState.js";
import { logger } from "../utils/logger.js";

export async function runSeedPlanCommand(options: { strict?: boolean; noPin?: boolean; only?: string } = {}) {
  const blueprint = await loadBlueprint();
  const config = await loadSeedConfig();
  const issues = validateSeedConfig(config, blueprint, { strict: options.strict });
  for (const issue of issues) {
    const line = `${issue.level.toUpperCase()}: ${issue.path}: ${issue.message}`;
    if (issue.level === "error") logger.error(line);
    else logger.warn(line);
  }
  if (issues.some((issue) => issue.level === "error")) {
    process.exitCode = 1;
    return;
  }

  const state = await loadState();
  const client = await createDiscordClient();
  try {
    const guild = await client.guilds.fetch(getGuildId());
    const channels = await buildSeedChannelMap(guild, blueprint, state);
    const plan = await buildSeedPlan(config, channels, state, options);
    printSeedPlan(plan);
  } finally {
    client.destroy();
  }
}
