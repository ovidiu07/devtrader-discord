import "dotenv/config";
import { loadBlueprint } from "../config/loadBlueprint.js";
import { createDiscordClient, getGuildId } from "../discord/client.js";
import { applySeedMessages } from "../seed/apply.js";
import { buildSeedChannelMap } from "../seed/discordAdapter.js";
import { loadSeedConfig } from "../seed/loadSeedConfig.js";
import { buildSeedPlan } from "../seed/plan.js";
import { printSeedPlan } from "../seed/printSeedPlan.js";
import { validateSeedConfig } from "../seed/validation.js";
import { loadState } from "../state/loadState.js";
import { saveState } from "../state/saveState.js";
import { confirm } from "../utils/confirm.js";
import { logger } from "../utils/logger.js";

export async function runSeedApplyCommand(options: { yes?: boolean; noPin?: boolean; only?: string; dryRun?: boolean; strict?: boolean } = {}) {
  if (options.dryRun) {
    const { runSeedPlanCommand } = await import("./seedPlan.js");
    await runSeedPlanCommand(options);
    return;
  }

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

    if (options.noPin) {
      logger.info("--no-pin activ: mesajele vor fi create/editate fără pin.");
    } else {
      logger.info("Pinning is enabled. The bot needs PIN_MESSAGES in channels where seed messages are pinned.");
    }

    if (!options.yes) {
      const ok = await confirm("Seed apply will create or edit managed onboarding messages.");
      if (!ok) {
        logger.warn("Seed apply cancelled.");
        return;
      }
    }

    await applySeedMessages(config, channels, state, options);
    await saveState(state);
    logger.info("Seed apply completed. State saved to state/discord-state.json.");
  } finally {
    client.destroy();
  }
}
