import { formatRomanianDate } from "./date.js";
import { newsCategoryPriority, newsCategoryRo, newsImpactRo, newsKeywords } from "./newsRules.js";
import type { NewsCategory, NewsConfig, NewsItem, ScoredNewsItem } from "./types.js";

export function buildImportantNewsReport(args: { date: string; timezone: string; items: NewsItem[]; config: NewsConfig }): string {
  const selected = selectImportantNews(args.items, args.config, new Date());
  const dateRo = formatRomanianDate(args.date, args.timezone);

  if (selected.length === 0) {
    return [
      `ȘTIRI IMPORTANTE — ${dateRo}`,
      "",
      `Astăzi nu au fost găsite știri majore în sursele configurate pentru ultimele ${args.config.lookbackHours} ore.`,
      "",
      "Totuși, piața poate reacționa la:",
      "",
      "* randamentele obligațiunilor;",
      "* mișcările dolarului;",
      "* petrol și energie;",
      "* știri geopolitice;",
      "* sentimentul general risk-on / risk-off.",
      "",
      "Conținut educațional. Nu reprezintă recomandare financiară."
    ].join("\n");
  }

  return [
    `ȘTIRI IMPORTANTE — ${dateRo}`,
    "",
    "Context",
    "Acestea sunt cele mai relevante știri selectate automat din sursele configurate, pe baza impactului potențial asupra piețelor financiare.",
    "",
    "Știri selectate",
    "",
    selected
      .map(
        (item, index) =>
          `${index + 1}. ${truncate(item.title, 220)}\n` +
          `    Sursă: ${item.source}\n` +
          `    Categorie: ${item.categoryRo}\n` +
          `    Piețe urmărite: ${item.affectedMarkets.join(", ")}\n` +
          `    ${item.whyItMatters}\n` +
          `    Link: ${item.url}`
      )
      .join("\n\n"),
    "",
    "Ce urmărim azi",
    "",
    "* Reacția indicilor DAX și Nasdaq la știrile macro și la randamente.",
    "* Direcția USD și impactul asupra EURUSD / GBPUSD.",
    "* Mișcarea petrolului, aurului și randamentelor obligațiunilor.",
    "* Confirmări pe chart, nu doar reacții la titluri.",
    "",
    "Conținut educațional. Nu reprezintă recomandare financiară."
  ].join("\n");
}

export function selectImportantNews(items: NewsItem[], config: NewsConfig, now = new Date()): ScoredNewsItem[] {
  const cutoff = now.getTime() - config.lookbackHours * 60 * 60 * 1000;
  const deduped = dedupeNewsItems(items).filter((item) => !item.publishedAt || item.publishedAt.getTime() >= cutoff);

  return deduped
    .map(scoreNewsItem)
    .filter((item): item is ScoredNewsItem => Boolean(item))
    .sort((a, b) => b.score - a.score || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, config.maxItems);
}

export function scoreNewsItem(item: NewsItem): ScoredNewsItem | undefined {
  const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
  let best: { category: NewsCategory; score: number } | undefined;

  for (const [category, keywords] of Object.entries(newsKeywords) as [NewsCategory, string[]][]) {
    const matches = keywords.filter((keyword) => haystack.includes(keyword.toLowerCase())).length;
    if (matches === 0) continue;
    const score = newsCategoryPriority[category] + matches * 5 + (item.publishedAt ? 2 : 0);
    if (!best || score > best.score) best = { category, score };
  }

  if (!best) return undefined;
  const impact = newsImpactRo[best.category];
  return {
    ...item,
    category: best.category,
    categoryRo: newsCategoryRo[best.category],
    score: best.score,
    affectedMarkets: impact.markets,
    whyItMatters: impact.why
  };
}

export function dedupeNewsItems(items: NewsItem[]): NewsItem[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const result: NewsItem[] = [];

  for (const item of items) {
    const urlKey = normalizeUrl(item.url);
    const titleKey = normalizeText(item.title);
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    result.push(item);
  }

  return result;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trim()}…`;
}
