import { XMLParser } from "fast-xml-parser";
import type { NewsConfig, NewsItem } from "./types.js";
import { logger } from "../utils/logger.js";

export async function fetchRssNewsItems(config: NewsConfig, fetchImpl: typeof fetch = fetch): Promise<NewsItem[]> {
  const results = await Promise.allSettled(config.rssFeeds.map((feedUrl) => fetchRssFeed(feedUrl, config.fetchTimeoutSeconds, fetchImpl)));
  return results.flatMap((result) => {
    if (result.status === "fulfilled") return result.value;
    logger.warn(`RSS fetch failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    return [];
  });
}

export async function fetchRssFeed(feedUrl: string, timeoutSeconds: number, fetchImpl: typeof fetch = fetch): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    const response = await fetchImpl(feedUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`${feedUrl} returned HTTP ${response.status}`);
    const xml = await response.text();
    return parseRssItems(xml, feedUrl);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseRssItems(xml: string, fallbackSource: string): NewsItem[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const rss = parsed.rss as { channel?: { title?: string; item?: unknown } } | undefined;
  if (rss?.channel) {
    const source = textValue(rss.channel.title) || hostname(fallbackSource);
    return asArray(rss.channel.item).map((item) => normalizeRssItem(item, source)).filter((item): item is NewsItem => Boolean(item));
  }

  const feed = parsed.feed as { title?: string; entry?: unknown } | undefined;
  if (feed) {
    const source = textValue(feed.title) || hostname(fallbackSource);
    return asArray(feed.entry).map((item) => normalizeAtomItem(item, source)).filter((item): item is NewsItem => Boolean(item));
  }

  throw new Error("Invalid RSS/Atom XML.");
}

function normalizeRssItem(value: unknown, source: string): NewsItem | undefined {
  const item = value as Record<string, unknown>;
  const title = cleanText(textValue(item.title));
  const url = cleanText(textValue(item.link) || textValue(item.guid));
  if (!title || !url) return undefined;
  return {
    title,
    url,
    source,
    publishedAt: parseDate(textValue(item.pubDate) || textValue(item.isoDate) || textValue(item.date)),
    rawCategory: textValue(item.category),
    description: cleanText(textValue(item.description) || textValue(item.summary))
  };
}

function normalizeAtomItem(value: unknown, source: string): NewsItem | undefined {
  const item = value as Record<string, unknown>;
  const title = cleanText(textValue(item.title));
  const link = normalizeAtomLink(item.link);
  if (!title || !link) return undefined;
  return {
    title,
    url: link,
    source,
    publishedAt: parseDate(textValue(item.published) || textValue(item.updated)),
    rawCategory: textValue(item.category),
    description: cleanText(textValue(item.summary) || textValue(item.content))
  };
}

function normalizeAtomLink(value: unknown): string {
  if (typeof value === "string") return value;
  const first = asArray(value).find((item) => {
    const link = item as Record<string, unknown>;
    return !link["@_rel"] || link["@_rel"] === "alternate";
  }) as Record<string, unknown> | undefined;
  return textValue(first?.["@_href"]) || textValue(first);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return textValue(object["#text"] ?? object._text ?? object.value);
  }
  return "";
}

function cleanText(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function hostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}
