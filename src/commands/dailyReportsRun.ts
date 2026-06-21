import { runDailyReports } from "../dailyReports/run.js";
import type { ReportType } from "../dailyReports/types.js";

export async function runDailyReportsRunCommand(options: { only?: string; force?: boolean; dryRun?: boolean }) {
  await runDailyReports({ only: parseReportType(options.only), force: options.force, dryRun: options.dryRun });
}

function parseReportType(value: string | undefined): ReportType | undefined {
  if (!value) return undefined;
  if (value === "stiri-importante" || value === "calendar-economic" || value === "reuters-markets" || value === "currents-market-news") return value;
  throw new Error('--only must be "stiri-importante", "calendar-economic", "reuters-markets", or "currents-market-news".');
}
