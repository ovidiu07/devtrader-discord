import { loadEducationCalendar, loadEducationContentBank, loadEducationSchedule } from "../education/loadConfig.js";
import { buildEducationPlan } from "../education/plan.js";
import { renderEducationPayload } from "../education/render.js";
import { loadEducationState } from "../education/state.js";
import { parseSkip } from "./educationPlan.js";

export async function runEducationPreviewCommand(options: { only?: string; skip?: string } = {}) {
  const [schedule, bank, calendar, state] = await Promise.all([loadEducationSchedule(), loadEducationContentBank(), loadEducationCalendar(), loadEducationState()]);
  const plan = buildEducationPlan({ schedule, bank, calendar, state, only: options.only, skip: parseSkip(options.skip) });

  console.log("\nDaily education preview\n");
  for (const item of plan) {
    console.log(`--- ${item.channelKey} | ${item.scheduledTime} | ${item.postKey ?? "skip"} ---`);
    if (item.skipped || !item.postKey) {
      console.log(`Sarit: ${item.reason ?? "fără conținut selectat"}\n`);
      continue;
    }
    const post = bank.posts.find((candidate) => candidate.key === item.postKey);
    if (!post) continue;
    const payload = renderEducationPayload(post, new Date(), false);
    console.log(`${payload.content}\n`);
  }
}
