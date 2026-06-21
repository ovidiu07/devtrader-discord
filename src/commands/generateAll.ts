import { runDailyReports } from "../dailyReports/run.js";
import { logger } from "../utils/logger.js";
import { runEducationRunCommand } from "./educationRun.js";

export async function runGenerateAllCommand(options: { force?: boolean; dryRun?: boolean } = {}) {
  const results = await Promise.allSettled([
    runDailyReports({ force: options.force, dryRun: options.dryRun }),
    runEducationRunCommand({ dryRun: options.dryRun })
  ]);
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length === 0) return;

  for (const failure of failures) {
    logger.error(failure.reason instanceof Error ? failure.reason.message : String(failure.reason));
  }
  throw new Error(`${failures.length} generate-all task(s) failed.`);
}
