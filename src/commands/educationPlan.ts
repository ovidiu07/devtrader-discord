import { loadEducationCalendar, loadEducationContentBank, loadEducationSchedule } from "../education/loadConfig.js";
import { buildEducationPlan, printEducationPlan } from "../education/plan.js";
import { loadEducationState } from "../education/state.js";

export async function runEducationPlanCommand(options: { only?: string; skip?: string } = {}) {
  const [schedule, bank, calendar, state] = await Promise.all([loadEducationSchedule(), loadEducationContentBank(), loadEducationCalendar(), loadEducationState()]);
  const plan = buildEducationPlan({
    schedule,
    bank,
    calendar,
    state,
    only: options.only,
    skip: parseSkip(options.skip)
  });
  printEducationPlan(plan);
}

export function parseSkip(value?: string): string[] {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
