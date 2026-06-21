import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DailyReportState, ReportType } from "./types.js";

export const emptyDailyReportState = (): DailyReportState => ({ posts: [] });

export async function loadDailyReportState(path = "state/daily-reports-state.json"): Promise<DailyReportState> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<DailyReportState>;
    return { posts: parsed.posts ?? [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyDailyReportState();
    throw error;
  }
}

export async function saveDailyReportState(state: DailyReportState, path = "state/daily-reports-state.json") {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function wasReportPosted(state: DailyReportState, date: string, reportType: ReportType): boolean {
  return state.posts.some((post) => post.date === date && post.reportType === reportType && post.status === "posted");
}
