import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { formatRomanianDate, formatRomanianTime } from "./date.js";
import type { ReutersMarketsArticle, ReutersMarketsNewsConfig } from "./types.js";

interface ParsedReutersArticle {
  titleOriginal: string;
  category: string;
  publishedTime: string;
  updatedTime: string;
  relativeTime: string;
  sourceUrl: string;
  snippetOriginal: string;
  extractedAt: string;
  isLead: boolean;
  publishedAt?: string;
}

export class ReutersMarketsUnavailableError extends Error {}

export async function fetchReutersMarketsHtml(config: ReutersMarketsNewsConfig): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.fetchTimeoutSeconds * 1000);
  try {
    const response = await fetch(config.sourceUrl, {
      signal: controller.signal,
      headers: {
        "user-agent": "DevTraderDiscordBot/0.1 (+https://www.reuters.com/markets/)",
        accept: "text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) throw new ReutersMarketsUnavailableError(`Reuters Markets returned HTTP ${response.status}.`);
    const html = await response.text();
    if (isAccessChallenge(html)) {
      throw new ReutersMarketsUnavailableError("Reuters Markets returned an access challenge. The bot will not bypass CAPTCHA or anti-bot protection.");
    }
    return html;
  } catch (error) {
    if (error instanceof ReutersMarketsUnavailableError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ReutersMarketsUnavailableError(`Reuters Markets could not be fetched: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseReutersMarketsHtml(html: string, args: { sourceUrl?: string; extractedAt?: Date } = {}): ReutersMarketsArticle[] {
  const sourceUrl = args.sourceUrl ?? "https://www.reuters.com/markets/";
  const extractedAtDate = args.extractedAt ?? new Date();
  const extractedAt = extractedAtDate.toISOString();
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const parsed: ParsedReutersArticle[] = [];
  $("a[href]").each((index, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    if (!href) return;
    const articleUrl = normalizeReutersUrl(href, sourceUrl);
    if (!articleUrl || !isReutersMarketsArticleUrl(articleUrl)) return;

    const title = normalizeWhitespace(anchor.text());
    if (!looksLikeNewsTitle(title)) return;

    const container = findArticleContainer($, anchor);
    const snippet = extractSnippet($, container, title);
    const time = extractTime($, container);
    parsed.push({
      titleOriginal: title,
      category: extractCategory(articleUrl, container),
      publishedTime: time.publishedTime,
      updatedTime: time.updatedTime,
      relativeTime: time.relativeTime,
      publishedAt: time.publishedAt,
      sourceUrl: articleUrl,
      snippetOriginal: snippet || "N/A",
      extractedAt,
      isLead: index === 0 || isLeadContainer(container)
    });
  });

  return sortReutersArticles(enrichReutersArticles(dedupeParsedReutersArticles(parsed)));
}

export async function buildReutersMarketsReport(args: {
  date: string;
  timezone: string;
  articles: ReutersMarketsArticle[];
  sourceUrl: string;
  now?: Date;
  allowEmptyReport?: boolean;
}): Promise<string> {
  const dateRo = formatRomanianDate(args.date, args.timezone);
  const now = args.now ?? new Date();
  const reportTime = formatRomanianTime(now, args.timezone);
  if (args.articles.length === 0) {
    if (!args.allowEmptyReport) {
      throw new ReutersMarketsUnavailableError("No Reuters Markets articles were extracted.");
    }
    return [
      "REUTERS MARKETS - RAPORT ZILNIC",
      `Data: ${dateRo}, ${reportTime} RO`,
      "Sursa: Reuters Markets",
      `Link: ${args.sourceUrl}`,
      "",
      "Nu au fost gasite stiri Reuters Markets pentru raportul de azi. Verifica parserul sau structura paginii.",
      "",
      "Disclaimer:",
      "Raport informativ si educational. Nu reprezinta recomandare de investitii sau semnal de tranzactionare."
    ].join("\n");
  }

  const themes = extractReportThemes(args.articles);
  return [
    "REUTERS MARKETS - RAPORT ZILNIC",
    `Data: ${dateRo}, ${reportTime} RO`,
    "Sursa: Reuters Markets",
    `Link: ${args.sourceUrl}`,
    "",
    "Rezumat rapid:",
    buildQuickSummary(themes, args.articles),
    "",
    "Cele mai importante stiri pentru traderi:",
    "",
    args.articles.map(renderReutersArticle).join("\n\n"),
    "",
    "Concluzie pentru sesiunea de azi:",
    "",
    ...buildSessionConclusion(themes, args.articles),
    "",
    "Disclaimer:",
    "Raport informativ si educational. Nu reprezinta recomandare de investitii sau semnal de tranzactionare."
  ].join("\n");
}

export function enrichReutersArticles(items: ParsedReutersArticle[]): ReutersMarketsArticle[] {
  return items.map((item) => {
    const relatedAssets = mapRelatedAssets(`${item.titleOriginal} ${item.snippetOriginal}`);
    const importanceScore = classifyReutersImportance(`${item.titleOriginal} ${item.snippetOriginal}`);
    const titleRo = translateReutersTitle(item.titleOriginal, item.category);
    const summaryRo = buildRomanianSummary(item, titleRo);
    const marketImpactRo = buildMarketImpact(item, relatedAssets);
    const hash = hashReutersArticle(item);
    return { ...item, titleRo, summaryRo, marketImpactRo, relatedAssets, importanceScore, hash };
  });
}

export function dedupeReutersArticles(items: ReutersMarketsArticle[]): ReutersMarketsArticle[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const seenSlugs = new Set<string>();
  const result: ReutersMarketsArticle[] = [];

  for (const item of items) {
    const urlKey = normalizeUrlForDedupe(item.sourceUrl);
    const titleKey = normalizeTitleForDedupe(item.titleOriginal);
    const slugKey = slugFromUrl(item.sourceUrl);
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey) || (slugKey && seenSlugs.has(slugKey))) continue;
    if (result.some((existing) => titleSimilarity(existing.titleOriginal, item.titleOriginal) >= 0.86)) continue;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    if (slugKey) seenSlugs.add(slugKey);
    result.push(item);
  }

  return result;
}

export function sortReutersArticles(items: ReutersMarketsArticle[]): ReutersMarketsArticle[] {
  return [...items].sort((a, b) => {
    const scoreDiff = b.importanceScore - a.importanceScore;
    if (scoreDiff !== 0) return scoreDiff;
    if (a.isLead !== b.isLead) return a.isLead ? -1 : 1;
    return safeTime(b.publishedAt) - safeTime(a.publishedAt);
  });
}

export function classifyReutersImportance(text: string): number {
  const value = text.toLowerCase();
  if (matchesAny(value, ["fed", "fomc", "ecb", "boe", "rate decision", "interest rate", "cpi", "ppi", "pce", "nfp", "unemployment", "oil shock", "geopolit", "market crash", "market rally", "bond yield shock", "iran", "russia", "ukraine"])) return 5;
  if (matchesAny(value, ["retail sales", "pmi", "ism", "gdp", "nvidia", "apple", "microsoft", "tesla", "alphabet", "amazon", "bank", "brent", "crude", "dollar rises", "dollar falls", "yen", "euro"])) return 4;
  if (matchesAny(value, ["sector", "stocks", "shares", "ipo", "regulator", "lawsuit", "china", "japan", "europe", "wall street", "nasdaq", "s&p", "dow"])) return 3;
  if (matchesAny(value, ["business", "finance", "markets", "deal", "fund"])) return 2;
  return 1;
}

export function mapRelatedAssets(text: string): string[] {
  const value = text.toLowerCase();
  const assets = new Set<string>();
  const add = (items: string[]) => items.forEach((item) => assets.add(item));

  if (matchesAny(value, ["fed", "rate", "rates", "yield", "yields", "inflation", "cpi", "ppi", "pce"])) add(["USD", "US10Y", "Nasdaq", "S&P 500", "Gold"]);
  if (matchesAny(value, ["ecb", "eurozone", "germany", "europe"])) add(["EURUSD", "DAX", "Euro STOXX", "DE10Y"]);
  if (matchesAny(value, ["boe", "uk", "sterling", "britain"])) add(["GBPUSD", "FTSE", "UK10Y"]);
  if (matchesAny(value, ["oil", "crude", "brent", "iran", "middle east", "energy"])) add(["Oil", "Energy stocks", "USD", "Gold", "DAX", "NQ"]);
  if (value.includes("china")) add(["China stocks", "Hang Seng", "Copper", "Oil", "DAX", "risk sentiment"]);
  if (matchesAny(value, ["japan", "yen", "boj"])) add(["JPY", "Nikkei", "USDJPY", "bonds"]);
  if (matchesAny(value, ["spacex", "tech", "ai", "semiconductor", "chip"])) add(["Nasdaq", "Tech stocks", "S&P 500"]);
  if (matchesAny(value, ["crypto", "binance", "bitcoin"])) add(["Crypto", "Bitcoin", "risk sentiment"]);
  if (matchesAny(value, ["bank", "banks"])) add(["Banks", "S&P 500", "DAX", "US10Y"]);
  if (assets.size === 0) add(["S&P 500", "DAX", "USD"]);
  return [...assets];
}

export function translateReutersTitle(title: string, category: string): string {
  const lower = title.toLowerCase();
  const replacements: Array<[RegExp, string]> = [
    [/^oil (prices )?(fall|falls|drop|drops|slip|slips)\b/i, "Petrolul scade"],
    [/^oil (prices )?(rise|rises|gain|gains|climb|climbs)\b/i, "Petrolul creste"],
    [/^dollar (falls|weakens|slips)\b/i, "Dolarul scade"],
    [/^dollar (rises|gains|strengthens)\b/i, "Dolarul se apreciaza"],
    [/^gold (falls|slips|drops)\b/i, "Aurul scade"],
    [/^gold (rises|gains|climbs)\b/i, "Aurul creste"],
    [/^wall st(reet)? (rises|gains|climbs)\b/i, "Wall Street creste"],
    [/^wall st(reet)? (falls|drops|slips)\b/i, "Wall Street scade"],
    [/^european shares (rise|gain|climb)\b/i, "Actiunile europene cresc"],
    [/^european shares (fall|drop|slip)\b/i, "Actiunile europene scad"],
    [/^japan shares (rise|gain|climb)\b/i, "Actiunile japoneze cresc"],
    [/^japan shares (fall|drop|slip)\b/i, "Actiunile japoneze scad"]
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(title)) return capitalizeFirst(title.replace(pattern, replacement));
  }

  const topic = detectRomanianTopic(lower, category);
  const action = detectRomanianAction(lower);
  return `${topic} ${action}`.replace(/\s+/g, " ").trim();
}

function dedupeParsedReutersArticles(items: ParsedReutersArticle[]): ParsedReutersArticle[] {
  const enriched = enrichReutersArticles(items);
  return dedupeReutersArticles(enriched).map((item) => ({
    titleOriginal: item.titleOriginal,
    category: item.category,
    publishedTime: item.publishedTime,
    updatedTime: item.updatedTime,
    relativeTime: item.relativeTime,
    sourceUrl: item.sourceUrl,
    snippetOriginal: item.snippetOriginal,
    extractedAt: item.extractedAt,
    isLead: item.isLead,
    publishedAt: item.publishedAt
  }));
}

function renderReutersArticle(article: ReutersMarketsArticle, index: number): string {
  return [
    `${index + 1}. ${article.titleRo}`,
    `   Categorie: ${article.category}`,
    `   Publicare: ${article.relativeTime !== "N/A" ? article.relativeTime : article.publishedTime}`,
    `   Importanta: ${article.importanceScore}/5`,
    `   Active urmarite: ${article.relatedAssets.join(", ")}`,
    "",
    "Rezumat:",
    article.summaryRo,
    "",
    "De ce conteaza pentru traderi:",
    article.marketImpactRo,
    "",
    "Sursa:",
    article.sourceUrl
  ].join("\n");
}

function buildQuickSummary(themes: string[], articles: ReutersMarketsArticle[]): string {
  const assets = topAssets(articles).slice(0, 6);
  return `Temele dominante din pagina Reuters Markets sunt ${joinRomanian(themes)}. Pentru traderi, merita urmarite reactiile pe ${assets.join(", ")}, fara a trata titlurile ca semnale directe de intrare.`;
}

function buildSessionConclusion(themes: string[], articles: ReutersMarketsArticle[]): string[] {
  const assets = topAssets(articles).slice(0, 7);
  const maxScore = Math.max(...articles.map((article) => article.importanceScore));
  const risk = maxScore >= 5 ? "ridicat" : maxScore >= 3 ? "moderat" : "redus";
  return [
    `* Temele principale sunt ${joinRomanian(themes)}.`,
    `* Activele care pot avea volatilitate: ${assets.join(", ")}.`,
    "* In sesiunea SUA, urmareste daca stirile sunt confirmate de USD, bond yields si indicii americani.",
    `* Contextul pare de risc ${risk}, in functie de confirmarea din piata.`,
    "* Informatia este educationala si trebuie folosita ca fundal, nu ca recomandare financiara."
  ];
}

function buildRomanianSummary(item: ParsedReutersArticle, titleRo: string): string {
  if (item.snippetOriginal !== "N/A") {
    return `${titleRo}. Rezumatul este construit doar din titlul si snippet-ul vizibil pe Reuters, fara detalii suplimentare din articol.`;
  }
  return `${titleRo}. Reuters afiseaza doar titlul in zona vizibila; interpretarea trebuie tratata prudent pana apar detalii suplimentare.`;
}

function buildMarketImpact(item: ParsedReutersArticle, relatedAssets: string[]): string {
  const assets = relatedAssets.slice(0, 5).join(", ");
  const haystack = `${item.titleOriginal} ${item.snippetOriginal}`.toLowerCase();
  if (matchesAny(haystack, ["fed", "ecb", "boe", "rate", "inflation", "yield"])) {
    return `Stirea poate influenta asteptarile pentru dobanzile bancilor centrale, bond yields si apetitul pentru risc. Pentru traderi, merita urmarite reactiile pe ${assets}.`;
  }
  if (matchesAny(haystack, ["oil", "crude", "brent", "energy", "iran", "middle east"])) {
    return `Energia poate schimba asteptarile de inflatie si sentimentul global. Pentru traderi, miscarea trebuie confirmata in ${assets}, nu tratata ca semnal izolat.`;
  }
  if (matchesAny(haystack, ["china", "japan", "europe", "wall street", "nasdaq", "s&p", "dow"])) {
    return `Stirea conteaza prin efectul asupra indicilor si sentimentului risk-on / risk-off. Urmareste daca reactia se vede coerent in ${assets}.`;
  }
  return `Impactul potential tine de sentimentul general al pietei. Pentru traderi, activele de urmarit sunt ${assets}, cu confirmare pe pret si volum.`;
}

function extractReportThemes(articles: ReutersMarketsArticle[]): string[] {
  const labels = new Map<string, number>();
  for (const article of articles) {
    for (const label of themeLabels(`${article.titleOriginal} ${article.snippetOriginal}`)) {
      labels.set(label, (labels.get(label) ?? 0) + article.importanceScore);
    }
  }
  const result = [...labels.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label).slice(0, 4);
  return result.length > 0 ? result : ["sentimentul global al pietei"];
}

function themeLabels(text: string): string[] {
  const value = text.toLowerCase();
  const result: string[] = [];
  if (matchesAny(value, ["fed", "ecb", "boe", "rate", "yield", "inflation"])) result.push("dobanzi si randamente");
  if (matchesAny(value, ["oil", "crude", "brent", "energy"])) result.push("petrol si energie");
  if (matchesAny(value, ["nasdaq", "s&p", "dow", "wall street", "stocks", "shares"])) result.push("indici bursieri");
  if (matchesAny(value, ["dollar", "euro", "sterling", "yen", "currency", "forex"])) result.push("valute majore");
  if (matchesAny(value, ["china", "japan", "europe", "us economy", "gdp", "pmi"])) result.push("macro global");
  if (matchesAny(value, ["bank", "finance"])) result.push("sectorul bancar");
  if (matchesAny(value, ["crypto", "bitcoin"])) result.push("crypto");
  return result;
}

function topAssets(articles: ReutersMarketsArticle[]): string[] {
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const asset of article.relatedAssets) counts.set(asset, (counts.get(asset) ?? 0) + article.importanceScore);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([asset]) => asset);
}

function findArticleContainer($: cheerio.CheerioAPI, anchor: cheerio.Cheerio<AnyNode>): cheerio.Cheerio<AnyNode> {
  const container = anchor.closest("article, li, [data-testid*='story'], [class*='story'], [class*='media'], [class*='card']");
  return container.length > 0 ? container : anchor.parent();
}

function extractSnippet($: cheerio.CheerioAPI, container: cheerio.Cheerio<AnyNode>, title: string): string {
  const candidates: string[] = [];
  container.find("p, [data-testid*='description'], [class*='description'], [class*='summary'], [class*='blurb']").each((_, element) => {
    const text = normalizeWhitespace($(element).text());
    if (text && text !== title && !looksLikeTimestamp(text)) candidates.push(text);
  });
  return candidates.find((candidate) => candidate.length >= 20 && candidate.length <= 280) ?? "";
}

function extractTime($: cheerio.CheerioAPI, container: cheerio.Cheerio<AnyNode>): { publishedTime: string; updatedTime: string; relativeTime: string; publishedAt?: string } {
  const timeElement = container.find("time").first();
  const dateTime = timeElement.attr("datetime") || timeElement.attr("dateTime");
  const textCandidates: string[] = [];
  if (timeElement.length) textCandidates.push(normalizeWhitespace(timeElement.text()));
  container.find("[class*='time'], [data-testid*='time'], [class*='date']").each((_, element) => {
    textCandidates.push(normalizeWhitespace($(element).text()));
  });
  const text = textCandidates.find(looksLikeTimestamp) ?? "";
  return {
    publishedTime: dateTime ? new Date(dateTime).toISOString() : text || "N/A",
    updatedTime: text.toLowerCase().includes("updated") ? text : "N/A",
    relativeTime: extractRelativeTime(text),
    publishedAt: dateTime ? new Date(dateTime).toISOString() : undefined
  };
}

function extractCategory(articleUrl: string, container: cheerio.Cheerio<AnyNode>): string {
  const label = container.find("[data-testid*='section'], [class*='section'], [class*='kicker'], [class*='label']").first().text();
  const normalizedLabel = normalizeWhitespace(label);
  if (normalizedLabel && normalizedLabel.length <= 40 && !looksLikeTimestamp(normalizedLabel)) return normalizedLabel;
  const parts = new URL(articleUrl).pathname.split("/").filter(Boolean);
  const marketIndex = parts.indexOf("markets");
  const segment = marketIndex >= 0 ? parts[marketIndex + 1] : undefined;
  if (!segment || segment.length > 35 || segment.includes("-202")) return "Markets";
  const known: Record<string, string> = {
    "asia": "Asian Markets",
    "europe": "European Markets",
    "us": "U.S. Markets",
    "commodities": "Commodities",
    "currencies": "Currencies",
    "rates-bonds": "Rates & Bonds",
    "stocks": "Stocks",
    "deals": "Deals",
    "finance": "Finance",
    "energy": "Energy"
  };
  return known[segment] ?? titleCase(segment.replace(/-/g, " "));
}

function normalizeReutersUrl(href: string, base: string): string | undefined {
  try {
    const url = new URL(href, base);
    if (url.hostname !== "www.reuters.com" && url.hostname !== "reuters.com") return undefined;
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function isReutersMarketsArticleUrl(url: string): boolean {
  const parsed = new URL(url);
  const path = parsed.pathname;
  if (!path.startsWith("/markets/")) return false;
  if (path === "/markets/" || path.split("/").filter(Boolean).length < 3) return false;
  return /-\d{4}-\d{2}-\d{2}\/?$/.test(path) || path.split("/").filter(Boolean).length >= 4;
}

function looksLikeNewsTitle(text: string): boolean {
  if (text.length < 16 || text.length > 220) return false;
  if (looksLikeTimestamp(text)) return false;
  if (/^(read more|learn more|markets|world|business|legal|about reuters)$/i.test(text)) return false;
  return /[a-zA-Z]/.test(text);
}

function looksLikeTimestamp(text: string): boolean {
  return /\b(mins?|minutes?|hours?|days?) ago\b/i.test(text) || /\bupdated\b/i.test(text) || /\bGMT[+-]?\d*\b/i.test(text);
}

function extractRelativeTime(text: string): string {
  const match = text.match(/\b(\d+\s+(?:mins?|minutes?|hours?|days?) ago)\b/i);
  return match ? match[1] : "N/A";
}

function isLeadContainer(container: cheerio.Cheerio<AnyNode>): boolean {
  const value = `${container.attr("data-testid") ?? ""} ${container.attr("class") ?? ""}`.toLowerCase();
  return value.includes("lead") || value.includes("hero") || value.includes("top");
}

function hashReutersArticle(item: ParsedReutersArticle): string {
  return createHash("sha256").update(`${normalizeUrlForDedupe(item.sourceUrl)}|${normalizeTitleForDedupe(item.titleOriginal)}`).digest("hex");
}

function normalizeUrlForDedupe(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/$/, "").toLowerCase();
}

function slugFromUrl(url: string): string {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  return parts.at(-1)?.replace(/-\d{4}-\d{2}-\d{2}$/, "") ?? "";
}

function normalizeTitleForDedupe(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleSimilarity(a: string, b: string): number {
  const aTokens = new Set(normalizeTitleForDedupe(a).split(" ").filter(Boolean));
  const bTokens = new Set(normalizeTitleForDedupe(b).split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
}

function detectRomanianTopic(lower: string, category: string): string {
  if (lower.includes("fed")) return "Fed";
  if (lower.includes("ecb")) return "ECB";
  if (lower.includes("boe")) return "BoE";
  if (matchesAny(lower, ["oil", "crude", "brent"])) return "Petrolul";
  if (lower.includes("gold")) return "Aurul";
  if (matchesAny(lower, ["dollar", "usd"])) return "Dolarul";
  if (matchesAny(lower, ["euro", "eur"])) return "Euro";
  if (lower.includes("yen")) return "Yenul";
  if (matchesAny(lower, ["wall street", "nasdaq", "s&p", "dow"])) return "Indicii americani";
  if (matchesAny(lower, ["european shares", "europe stocks"])) return "Actiunile europene";
  if (lower.includes("china")) return "China";
  if (lower.includes("japan")) return "Japonia";
  if (lower.includes("bank")) return "Sectorul bancar";
  if (matchesAny(lower, ["crypto", "bitcoin"])) return "Piata crypto";
  return `Stire Reuters din categoria ${category}`;
}

function detectRomanianAction(lower: string): string {
  if (matchesAny(lower, ["fall", "falls", "drop", "drops", "slip", "slips", "weakens"])) return "este sub presiune";
  if (matchesAny(lower, ["rise", "rises", "gain", "gains", "climb", "climbs", "strengthens"])) return "creste";
  if (matchesAny(lower, ["ahead of", "before", "awaits", "eyes"])) return "este urmarit(a) atent inaintea unui eveniment important";
  if (matchesAny(lower, ["after", "as"])) return "reactioneaza la noile informatii";
  return "poate influenta sentimentul pietei";
}

function isAccessChallenge(html: string): boolean {
  const value = html.toLowerCase();
  return value.includes("captcha-delivery") || value.includes("please enable js") || value.includes("disable any ad blocker");
}

function matchesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function joinRomanian(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "sentimentul pietei";
  if (items.length === 2) return `${items[0]} si ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} si ${items.at(-1)}`;
}

function safeTime(value: string | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}
