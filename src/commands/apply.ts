import "dotenv/config";
import { loadBlueprint } from "../config/loadBlueprint.js";
import { applyChannels } from "../discord/applyChannels.js";
import { createDiscordClient, getGuildId } from "../discord/client.js";
import { fetchCurrentState } from "../discord/fetchCurrentState.js";
import { applyMessages } from "../discord/applyMessages.js";
import { applyRoles } from "../discord/applyRoles.js";
import { buildPlan } from "../diff/buildPlan.js";
import { printPlan } from "../diff/printPlan.js";
import { loadState } from "../state/loadState.js";
import { saveState } from "../state/saveState.js";
import { confirm } from "../utils/confirm.js";
import { logger } from "../utils/logger.js";

export type ApplyOptions = {
  yes?: boolean;
  noDelete?: boolean;
};

export async function runApplyCommand(options: ApplyOptions = {}) {
  const blueprint = await loadBlueprint();
  const state = await loadState();
  const client = await createDiscordClient();

  try {
    const guild = await client.guilds.fetch(getGuildId());
    const current = await fetchCurrentState(guild);
    const plan = buildPlan(blueprint, current, state);
    printPlan(plan);

    if (options.noDelete) {
      logger.info("--no-delete enabled: deletion operations are blocked.");
    }

    if (plan.destructive.length > 0 && !options.noDelete && !options.yes) {
      const ok = await confirm("Destructive operations are planned.");
      if (!ok) {
        logger.warn("Apply cancelled.");
        return;
      }
    }

    if (plan.destructive.length > 0 && options.noDelete) {
      throw new Error("Refusing to apply because destructive operations exist and --no-delete was passed.");
    }

    await guild.setName(blueprint.server.name, "devtrader-discord-provisioner server sync");
    const guildWithDescription = guild as typeof guild & {
      setDescription?: (description: string, reason?: string) => Promise<unknown>;
    };
    if (blueprint.server.description && typeof guildWithDescription.setDescription === "function") {
      await guildWithDescription.setDescription(blueprint.server.description, "devtrader-discord-provisioner server sync");
    }
    await applyRoles(guild, blueprint, state);
    await applyChannels(guild, blueprint, state);
    await applyMessages(guild, blueprint, state);
    await saveState(state);
    logger.info("Apply completed. State saved to state/discord-state.json.");
  } finally {
    client.destroy();
  }
}
