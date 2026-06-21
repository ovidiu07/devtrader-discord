import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ReutersMarketsArticle, ReutersMarketsReportCache } from "./types.js";

export const emptyReutersMarketsCache = (): ReutersMarketsReportCache => ({ reports: [] });

export async function loadReutersMarketsCache(path = "state/reuters-markets-news-cache.json"): Promise<ReutersMarketsReportCache> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<ReutersMarketsReportCache>;
    return { reports: parsed.reports ?? [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyReutersMarketsCache();
    throw error;
  }
}

export async function saveReutersMarketsCache(cache: ReutersMarketsReportCache, path = "state/reuters-markets-news-cache.json") {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

export function cacheReutersMarketsExtraction(args: {
  cache: ReutersMarketsReportCache;
  date: string;
  sourceUrl: string;
  extractedAt: string;
  articles: ReutersMarketsArticle[];
}) {
  const existing = args.cache.reports.find((report) => report.date === args.date);
  const payload = {
    date: args.date,
    sourceUrl: args.sourceUrl,
    extractedAt: args.extractedAt,
    articleHashes: args.articles.map((article) => article.hash),
    articles: args.articles
  };

  if (existing) Object.assign(existing, { ...payload, postedAt: existing.postedAt, discordChannelId: existing.discordChannelId, discordMessageIds: existing.discordMessageIds });
  else args.cache.reports.push(payload);
}

export function markReutersMarketsPosted(args: {
  cache: ReutersMarketsReportCache;
  date: string;
  postedAt: string;
  discordChannelId: string;
  discordMessageIds: string[];
}) {
  const existing = args.cache.reports.find((report) => report.date === args.date);
  if (!existing) return;
  existing.postedAt = args.postedAt;
  existing.discordChannelId = args.discordChannelId;
  existing.discordMessageIds = args.discordMessageIds;
}
