import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CurrentsMarketNewsCachedReport, CurrentsMarketNewsReportCache, MarketNewsItem } from "./types.js";

export const emptyCurrentsMarketNewsCache = (): CurrentsMarketNewsReportCache => ({ reports: [] });

export async function loadCurrentsMarketNewsCache(path = "state/currents-market-news-cache.json"): Promise<CurrentsMarketNewsReportCache> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<CurrentsMarketNewsReportCache>;
    return { reports: parsed.reports ?? [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyCurrentsMarketNewsCache();
    throw error;
  }
}

export async function saveCurrentsMarketNewsCache(cache: CurrentsMarketNewsReportCache, path = "state/currents-market-news-cache.json") {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

export function cacheCurrentsMarketNewsReport(args: {
  cache: CurrentsMarketNewsReportCache;
  reportDate: string;
  generatedAt: string;
  itemHashes: string[];
  items: MarketNewsItem[];
  status?: CurrentsMarketNewsCachedReport["status"];
  errorMessage?: string;
}) {
  const existing = args.cache.reports.find((report) => report.reportDate === args.reportDate);
  const payload: CurrentsMarketNewsCachedReport = {
    reportDate: args.reportDate,
    generatedAt: args.generatedAt,
    itemHashes: args.itemHashes,
    source: "Currents API",
    status: args.status ?? "generated",
    errorMessage: args.errorMessage,
    items: args.items
  };

  if (existing) {
    Object.assign(existing, {
      ...payload,
      postedAt: existing.postedAt,
      channelId: existing.channelId,
      discordMessageIds: existing.discordMessageIds
    });
  } else {
    args.cache.reports.push(payload);
  }
}

export function markCurrentsMarketNewsPosted(args: {
  cache: CurrentsMarketNewsReportCache;
  reportDate: string;
  postedAt: string;
  channelId: string;
  discordMessageIds: string[];
}) {
  const existing = args.cache.reports.find((report) => report.reportDate === args.reportDate);
  if (!existing) return;
  existing.status = "posted";
  existing.postedAt = args.postedAt;
  existing.channelId = args.channelId;
  existing.discordMessageIds = args.discordMessageIds;
}

export function markCurrentsMarketNewsFailed(args: { cache: CurrentsMarketNewsReportCache; reportDate: string; generatedAt: string; errorMessage: string }) {
  const existing = args.cache.reports.find((report) => report.reportDate === args.reportDate);
  if (existing) {
    existing.status = "failed";
    existing.generatedAt = args.generatedAt;
    existing.errorMessage = args.errorMessage;
    return;
  }
  args.cache.reports.push({
    reportDate: args.reportDate,
    generatedAt: args.generatedAt,
    itemHashes: [],
    source: "Currents API",
    status: "failed",
    errorMessage: args.errorMessage,
    items: []
  });
}
