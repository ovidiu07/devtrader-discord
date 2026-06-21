import "dotenv/config";
import { loadBlueprint } from "../config/loadBlueprint.js";
import { createDiscordClient, getGuildId } from "../discord/client.js";
import { buildEducationChannelMap } from "../education/discordAdapter.js";
import { applyEducationPlan } from "../education/apply.js";
import { loadEducationCalendar, loadEducationContentBank, loadEducationSchedule } from "../education/loadConfig.js";
import { buildEducationPlan, printEducationPlan } from "../education/plan.js";
import { loadEducationState, saveEducationState } from "../education/state.js";
import { loadState } from "../state/loadState.js";
import { parseSkip } from "./educationPlan.js";

export async function runEducationRunCommand(options: { only?: string; skip?: string; dryRun?: boolean } = {}) {
  if (options.dryRun) {
    const { runEducationPlanCommand } = await import("./educationPlan.js");
    await runEducationPlanCommand(options);
    return;
  }

  const [blueprint, schedule, bank, calendar, educationState, discordState] = await Promise.all([
    loadBlueprint(),
    loadEducationSchedule(),
    loadEducationContentBank(),
    loadEducationCalendar(),
    loadEducationState(),
    loadState()
  ]);

  const plan = buildEducationPlan({ schedule, bank, calendar, state: educationState, only: options.only, skip: parseSkip(options.skip) });
  printEducationPlan(plan);

  const client = await createDiscordClient();
  try {
    const guild = await client.guilds.fetch(getGuildId());
    const channels = await buildEducationChannelMap(guild, blueprint, discordState);
    await applyEducationPlan({ plan, bank, channels, state: educationState });
    await saveEducationState(educationState);
  } finally {
    client.destroy();
  }
}
