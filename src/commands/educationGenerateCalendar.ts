import { generateEducationCalendar, writeEducationCalendar } from "../education/calendar.js";
import { loadEducationContentBank, loadEducationSchedule } from "../education/loadConfig.js";
import { loadEducationState } from "../education/state.js";
import { logger } from "../utils/logger.js";

export async function runEducationGenerateCalendarCommand(options: { days?: string; start?: string } = {}) {
  const [schedule, bank, state] = await Promise.all([loadEducationSchedule(), loadEducationContentBank(), loadEducationState()]);
  const calendar = generateEducationCalendar({
    schedule,
    bank,
    state,
    startDate: options.start,
    days: options.days ? Number(options.days) : 30
  });
  await writeEducationCalendar(calendar);
  logger.info(`Generated ${calendar.days.length} education calendar days in config/education-calendar.yml.`);
}
