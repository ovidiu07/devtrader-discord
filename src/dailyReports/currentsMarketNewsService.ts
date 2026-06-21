import { createHash } from "node:crypto";
import { formatRomanianDate, formatRomanianTime } from "./date.js";
import type { CurrentsMarketNewsConfig, MarketNewsItem } from "./types.js";

const searchEndpoint = "https://api.currentsapi.services/v2/search";
const categoriesEndpoint = "https://api.currentsapi.services/v2/available/categories";
const latestNewsEndpoint = "https://api.currentsapi.services/v1/latest-news";

const canonicalCategories = [
  "general",
  "society",
  "science_technology",
  "politics_government",
  "economy_business_finance",
  "arts_culture_entertainment",
  "lifestyle_leisure",
  "human_interest",
  "sport",
  "crime_law_justice",
  "education",
  "environment",
  "labour",
  "health",
  "automotive",
  "real_estate"
];

const tradingKeywords = [
  "fed",
  "federal reserve",
  "ecb",
  "european central bank",
  "boe",
  "bank of england",
  "interest rates",
  "rate decision",
  "inflation",
  "cpi",
  "ppi",
  "pce",
  "gdp",
  "unemployment",
  "nfp",
  "payrolls",
  "jobless claims",
  "pmi",
  "ism",
  "retail sales",
  "consumer sentiment",
  "markets",
  "stocks",
  "equities",
  "futures",
  "s&p 500",
  "nasdaq",
  "dow",
  "dax",
  "stoxx",
  "ftse",
  "nikkei",
  "yields",
  "bonds",
  "treasury",
  "dollar",
  "euro",
  "sterling",
  "yen",
  "forex",
  "gold",
  "oil",
  "brent",
  "wti",
  "commodities",
  "war",
  "conflict",
  "sanctions",
  "tariffs",
  "trade deal",
  "iran",
  "israel",
  "russia",
  "ukraine",
  "china",
  "middle east",
  "strait of hormuz",
  "nato",
  "g7",
  "eu",
  "earnings",
  "ipo",
  "merger",
  "acquisition",
  "bankruptcy",
  "regulation",
  "antitrust",
  "nvidia",
  "microsoft",
  "apple",
  "tesla",
  "amazon",
  "meta",
  "alphabet",
  "google",
  "spacex",
  "openai",
  "chips",
  "semiconductors",
  "ai",
  "crypto",
  "bitcoin",
  "ethereum",
  "binance"
];

const searchRequests = [
  {
    category: "economy_business_finance",
    query: "(markets OR stocks OR bonds OR yields OR oil OR Fed OR ECB OR inflation)"
  },
  {
    category: "politics_government",
    query: "(tariffs OR sanctions OR war OR Iran OR China OR Russia OR Ukraine OR \"central bank\")"
  },
  {
    category: "science_technology",
    query: "(AI OR semiconductors OR Nvidia OR Apple OR Microsoft OR Tesla OR SpaceX OR chips)"
  },
  {
    category: "environment",
    query: "(oil OR gas OR energy OR OPEC OR climate OR supply)"
  }
];

export class CurrentsMarketNewsError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

type FetchLike = typeof fetch;

interface CurrentsApiArticle {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  author?: string | null;
  image?: string | null;
  language?: string | null;
  category?: string[] | string | null;
  published?: string | null;
}

interface CurrentsApiResponse {
  status?: string | number;
  msg?: string;
  news?: CurrentsApiArticle[];
  categories?: string[];
}

export async function fetchAvailableCategories(config: CurrentsMarketNewsConfig, fetchImpl: FetchLike = fetch): Promise<string[]> {
  const payload = await fetchCurrentsJson(categoriesEndpoint, config, {}, fetchImpl);
  const fromApi = Array.isArray(payload.categories) ? payload.categories.filter((item): item is string => typeof item === "string") : [];
  return fromApi.length > 0 ? fromApi : canonicalCategories;
}

export async function fetchMarketNewsCandidates(config: CurrentsMarketNewsConfig, fetchImpl: FetchLike = fetch, now = new Date()): Promise<MarketNewsItem[]> {
  const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const endDate = now.toISOString();
  const extractedAt = now.toISOString();
  const responses: CurrentsApiArticle[][] = [];

  for (const request of searchRequests) {
    const payload = await fetchCurrentsJson(
      searchEndpoint,
      config,
      {
        language: config.language,
        category: request.category,
        query: request.query,
        start_date: startDate,
        end_date: endDate,
        page_size: "30"
      },
      fetchImpl
    );
    responses.push(payload.news ?? []);
  }

  let items = deduplicateNews(responses.flat().map((article) => normalizeArticle(article, extractedAt)).filter((item): item is MarketNewsItem => item !== undefined));
  if (items.length >= config.limit) return items;

  const fallbackQueries = ["Fed", "inflation", "oil", "stocks", "markets", "bonds", "Nasdaq", "dollar", "China", "ECB"];
  for (const keyword of fallbackQueries) {
    if (items.length >= config.limit) break;
    const payload = await fetchCurrentsJson(
      searchEndpoint,
      config,
      {
        language: config.language,
        query: keyword,
        start_date: startDate,
        end_date: endDate,
        page_size: "10"
      },
      fetchImpl
    );
    items = deduplicateNews([...items, ...(payload.news ?? []).map((article) => normalizeArticle(article, extractedAt)).filter((item): item is MarketNewsItem => item !== undefined)]);
  }

  if (items.length >= config.minItemsToPost) return items;

  const latest = await fetchCurrentsJson(
    latestNewsEndpoint,
    config,
    {
      language: config.language,
      page_size: "20"
    },
    fetchImpl
  );
  return deduplicateNews([...items, ...(latest.news ?? []).map((article) => normalizeArticle(article, extractedAt)).filter((item): item is MarketNewsItem => item !== undefined)]).filter(
    (item) => item.keywordsMatched.length > 0
  );
}

export function selectTopSevenNews(items: MarketNewsItem[], limit = 7): MarketNewsItem[] {
  return [...items]
    .sort((a, b) => {
      const scoreDiff = b.importanceScore - a.importanceScore;
      if (scoreDiff !== 0) return scoreDiff;
      const dateDiff = safeTime(b.published) - safeTime(a.published);
      if (dateDiff !== 0) return dateDiff;
      return b.keywordsMatched.length - a.keywordsMatched.length;
    })
    .slice(0, limit);
}

export function deduplicateNews(items: MarketNewsItem[]): MarketNewsItem[] {
  const result: MarketNewsItem[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const seenHashes = new Set<string>();

  for (const item of items) {
    const id = item.id?.trim();
    const url = normalizeUrl(item.url);
    const title = normalizeTitle(item.titleOriginal);
    const hash = hashMarketNewsItem(item);
    if ((id && seenIds.has(id)) || seenUrls.has(url) || seenTitles.has(title) || seenHashes.has(hash)) continue;
    if (result.some((existing) => titleSimilarity(existing.titleOriginal, item.titleOriginal) >= 0.8)) continue;
    if (id) seenIds.add(id);
    seenUrls.add(url);
    seenTitles.add(title);
    seenHashes.add(hash);
    result.push(item);
  }

  return result;
}

export function scoreNewsImportance(item: Pick<MarketNewsItem, "titleOriginal" | "descriptionOriginal" | "category">): number {
  const value = `${item.titleOriginal} ${item.descriptionOriginal ?? ""} ${item.category.join(" ")}`.toLowerCase();
  if (
    matchesAny(value, [
      "fed",
      "federal reserve",
      "ecb",
      "boe",
      "rate decision",
      "interest rate",
      "cpi",
      "ppi",
      "pce",
      "nfp",
      "unemployment",
      "oil shock",
      "bond yield",
      "bond yields",
      "market crash",
      "market rally",
      "iran",
      "russia",
      "ukraine",
      "sanctions",
      "tariffs",
      "nvidia",
      "microsoft",
      "apple",
      "tesla",
      "alphabet",
      "amazon",
      "meta"
    ])
  ) {
    return 5;
  }
  if (matchesAny(value, ["retail sales", "pmi", "ism", "gdp", "earnings", "bank", "crypto regulation", "ipo", "energy", "oil", "gas", "china macro", "eurozone"])) return 4;
  if (matchesAny(value, ["business", "sector", "stocks", "shares", "regulation", "merger", "acquisition", "antitrust"])) return 3;
  if (matchesAny(value, ["economy", "finance", "markets", "company"])) return 2;
  return 1;
}

export function mapRelatedAssets(item: Pick<MarketNewsItem, "titleOriginal" | "descriptionOriginal"> | string): string[] {
  const value = (typeof item === "string" ? item : `${item.titleOriginal} ${item.descriptionOriginal ?? ""}`).toLowerCase();
  const assets = new Set<string>();
  const add = (items: string[]) => items.forEach((asset) => assets.add(asset));

  if (matchesAny(value, ["fed", "rate", "rates", "inflation", "cpi", "ppi", "pce", "yield", "yields"])) add(["USD", "US10Y", "Nasdaq", "S&P 500", "Gold"]);
  if (matchesAny(value, ["ecb", "eurozone", "germany", "europe"])) add(["EURUSD", "DAX", "Euro STOXX", "DE10Y"]);
  if (matchesAny(value, ["boe", "uk", "sterling", "bank of england"])) add(["GBPUSD", "FTSE", "UK10Y"]);
  if (matchesAny(value, ["oil", "crude", "brent", "wti", "opec", "iran", "middle east", "hormuz", "energy"])) add(["Oil", "Energy stocks", "USD", "Gold", "DAX", "Nasdaq"]);
  if (value.includes("china")) add(["China stocks", "Hang Seng", "Copper", "Oil", "DAX", "Risk sentiment"]);
  if (matchesAny(value, ["japan", "yen", "boj"])) add(["JPY", "USDJPY", "Nikkei", "JP10Y"]);
  if (matchesAny(value, ["ai", "chips", "semiconductor", "semiconductors", "nvidia", "microsoft", "apple", "tesla", "spacex"])) add(["Nasdaq", "S&P 500", "Tech stocks"]);
  if (matchesAny(value, ["crypto", "bitcoin", "ethereum", "binance"])) add(["Crypto", "Bitcoin", "Risk sentiment"]);
  if (assets.size === 0) add(["Global markets"]);
  return [...assets];
}

export function generateRomanianReport(args: {
  date: string;
  timezone: string;
  items: MarketNewsItem[];
  now?: Date;
  intervalLabel?: string;
  minItems?: number;
}): string {
  if (args.items.length < (args.minItems ?? 3)) {
    throw new CurrentsMarketNewsError("Not enough valid market news items.");
  }

  const dateRo = formatRomanianDate(args.date, args.timezone);
  const now = args.now ?? new Date();
  const reportTime = formatRomanianTime(now, args.timezone);
  const themes = extractReportThemes(args.items);
  const assets = topAssets(args.items);

  return [
    "TOP 7 ȘTIRI IMPORTANTE PENTRU TRADERI",
    "",
    `Data raportului: ${dateRo}`,
    `Ora actualizării: ${reportTime} ${args.timezone}`,
    "Sursă principală: Currents API",
    `Interval analizat: ${args.intervalLabel ?? "ultimele 24 de ore"}`,
    "",
    "Rezumat general:",
    `Temele dominante sunt ${joinRomanian(themes)}. Pentru traderi, merită urmărite reacțiile pe ${assets.slice(0, 7).join(", ")}, fără a transforma știrile în semnale de tranzacționare.`,
    "",
    "==================================================",
    "",
    args.items.map(renderNewsItem).join("\n\n==================================================\n\n"),
    "",
    "==================================================",
    "",
    "CONCLUZIE PENTRU SESIUNEA DE AZI",
    "================================",
    "",
    ...buildConclusion(themes, assets, args.items),
    "",
    "Disclaimer:",
    "Raport informativ și educațional. Nu reprezintă recomandare de investiții sau semnal de tranzacționare.",
    "",
    "==================================================",
    "REZUMAT COMPACT PENTRU NEWS CARDS",
    "=================================",
    "",
    ...args.items.map((item, index) => `${index + 1}. ${shortTitle(item)}\n   ${compactSummary(item)}`),
    "",
    "==================================================",
    "DESCRIERE GENERALĂ PENTRU SOCIAL MEDIA",
    "======================================",
    "",
    buildSocialDescription(themes, assets),
    "",
    "Hashtag-uri:",
    "#stiri #economie #geopolitica #piete #trading #energie #business #actualitate"
  ].join("\n");
}

export function hashMarketNewsItem(item: Pick<MarketNewsItem, "titleOriginal" | "published">): string {
  return createHash("sha256").update(`${normalizeTitle(item.titleOriginal)}|${item.published}`).digest("hex");
}

async function fetchCurrentsJson(url: string, config: CurrentsMarketNewsConfig, params: Record<string, string>, fetchImpl: FetchLike): Promise<CurrentsApiResponse> {
  if (!config.apiKey) throw new CurrentsMarketNewsError("CURRENTS_API_KEY is missing.");
  const requestUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) requestUrl.searchParams.set(key, value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.fetchTimeoutSeconds * 1000);
  try {
    const response = await fetchImpl(requestUrl, {
      signal: controller.signal,
      headers: {
        Authorization: config.apiKey,
        accept: "application/json",
        "user-agent": "DevTraderDiscordBot/0.1"
      }
    });
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? ((await response.json()) as CurrentsApiResponse) : ({ msg: await response.text() } satisfies CurrentsApiResponse);
    if (!response.ok) throw currentsHttpError(response.status, payload, sanitizeParams(params));
    if (payload.status === "error") throw new CurrentsMarketNewsError(payload.msg ?? "Currents API returned an error.");
    return payload;
  } catch (error) {
    if (error instanceof CurrentsMarketNewsError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new CurrentsMarketNewsError(`Currents API request failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function currentsHttpError(status: number, payload: CurrentsApiResponse, params: Record<string, string>): CurrentsMarketNewsError {
  if (status === 401) return new CurrentsMarketNewsError("Currents API invalid API key.", status);
  if (status === 429) return new CurrentsMarketNewsError("Currents API rate limit exceeded.", status);
  if (status === 400) return new CurrentsMarketNewsError(`Currents API invalid parameters: ${JSON.stringify(params)}.`, status);
  return new CurrentsMarketNewsError(`Currents API returned HTTP ${status}: ${payload.msg ?? "unknown error"}.`, status);
}

function sanitizeParams(params: Record<string, string>): Record<string, string> {
  const result = { ...params };
  delete result.apiKey;
  return result;
}

function normalizeArticle(article: CurrentsApiArticle, extractedAt: string): MarketNewsItem | undefined {
  const titleOriginal = normalizeWhitespace(article.title ?? "");
  const url = normalizeWhitespace(article.url ?? "");
  if (!titleOriginal || !url || !/^https?:\/\//i.test(url)) return undefined;

  const descriptionOriginal = normalizeWhitespace(article.description ?? "") || null;
  const category = normalizeCategory(article.category);
  const seed = {
    id: article.id ?? null,
    titleOriginal,
    descriptionOriginal,
    category,
    author: article.author ?? null,
    source: sourceFromUrl(url),
    url,
    image: article.image ?? null,
    language: article.language ?? "N/A",
    published: article.published ?? "N/A",
    extractedAt
  };
  const keywordsMatched = matchKeywords(`${titleOriginal} ${descriptionOriginal ?? ""}`);
  const relatedAssets = mapRelatedAssets(seed);
  const importanceScore = scoreNewsImportance(seed);
  const titleRo = buildRomanianTitle(seed, keywordsMatched);
  return {
    ...seed,
    titleRo,
    summaryRo: buildRomanianSummary(seed, titleRo),
    importanceScore,
    relatedAssets,
    keywordsMatched,
    marketImpactRo: buildMarketImpact(seed, relatedAssets)
  };
}

function normalizeCategory(value: CurrentsApiArticle["category"]): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return ["N/A"];
}

function matchKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return tradingKeywords.filter((keyword) => lower.includes(keyword));
}

function buildRomanianTitle(item: Pick<MarketNewsItem, "titleOriginal" | "descriptionOriginal" | "category">, keywordsMatched: string[]): string {
  const text = `${item.titleOriginal} ${item.descriptionOriginal ?? ""}`.toLowerCase();
  if (matchesAny(text, ["fed", "federal reserve", "fomc"])) return "Actualizare despre Fed și politica monetară";
  if (matchesAny(text, ["ecb", "european central bank"])) return "Actualizare despre BCE și zona euro";
  if (matchesAny(text, ["boe", "bank of england"])) return "Actualizare despre BoE și lira sterlină";
  if (matchesAny(text, ["inflation", "cpi", "ppi", "pce"])) return "Date despre inflație relevante pentru piețe";
  if (matchesAny(text, ["payroll", "nfp", "unemployment", "jobless"])) return "Date despre piața muncii urmărite de traderi";
  if (matchesAny(text, ["oil", "crude", "brent", "wti", "opec", "energy"])) return "Știre importantă despre petrol și energie";
  if (matchesAny(text, ["china"])) return "Știre despre China cu impact pe sentimentul global";
  if (matchesAny(text, ["iran", "israel", "russia", "ukraine", "war", "sanctions", "tariffs"])) return "Risc geopolitic relevant pentru piețe";
  if (matchesAny(text, ["nvidia", "microsoft", "apple", "tesla", "amazon", "meta", "alphabet", "google", "ai", "semiconductor", "chips"])) return "Știre despre tehnologie și companii mari";
  if (matchesAny(text, ["stocks", "equities", "nasdaq", "s&p", "dow", "dax"])) return "Mișcare importantă pe indicii bursieri";
  if (matchesAny(text, ["dollar", "euro", "yen", "sterling", "forex"])) return "Actualizare importantă pe piața valutară";
  if (keywordsMatched.length > 0) return `Știre de piață despre ${keywordsMatched.slice(0, 2).join(" și ")}`;
  return "Știre economică relevantă pentru traderi";
}

function buildRomanianSummary(item: Pick<MarketNewsItem, "titleOriginal" | "descriptionOriginal" | "source">, titleRo: string): string {
  const detail = item.descriptionOriginal ? "Articolul include context suplimentar în descrierea publicată de sursă." : "Sursa nu oferă o descriere completă în răspunsul API.";
  return `${titleRo}. Selecția este bazată pe titlul și descrierea disponibile în Currents API, fără adăugarea de detalii care nu apar în sursă. ${detail}`;
}

function buildMarketImpact(item: Pick<MarketNewsItem, "titleOriginal" | "descriptionOriginal">, relatedAssets: string[]): string {
  const text = `${item.titleOriginal} ${item.descriptionOriginal ?? ""}`.toLowerCase();
  const assets = relatedAssets.slice(0, 6).join(", ");
  if (matchesAny(text, ["fed", "ecb", "boe", "rate", "inflation", "cpi", "ppi", "pce", "yield"])) {
    return `Poate schimba așteptările privind dobânzile, randamentele și apetitul pentru risc. Active de urmărit: ${assets}.`;
  }
  if (matchesAny(text, ["oil", "energy", "opec", "iran", "middle east", "hormuz"])) {
    return `Poate influența inflația, costurile energiei și sentimentul global. Active de urmărit: ${assets}.`;
  }
  if (matchesAny(text, ["china", "war", "sanctions", "tariffs", "russia", "ukraine"])) {
    return `Poate produce mișcări de tip risk-on/risk-off, mai ales dacă piața confirmă știrea. Active de urmărit: ${assets}.`;
  }
  if (matchesAny(text, ["ai", "chips", "semiconductor", "nvidia", "microsoft", "apple", "tesla"])) {
    return `Poate influența sectorul tech și indicii cu pondere mare în tehnologie. Active de urmărit: ${assets}.`;
  }
  return `Impactul posibil ține de sentimentul general și de lichiditatea sesiunii. Active de urmărit: ${assets}.`;
}

function renderNewsItem(item: MarketNewsItem, index: number): string {
  return [
    `${index + 1}. ${item.titleRo}`,
    "================================",
    "",
    `Categorie: ${item.category.join(", ")}`,
    `Publicare: ${formatPublished(item.published)}`,
    `Importanță: ${item.importanceScore}/5`,
    `Active urmărite: ${item.relatedAssets.join(", ")}`,
    `Sursă: ${item.source ?? "N/A"}`,
    `Link: ${item.url}`,
    "",
    "Pe scurt:",
    item.summaryRo,
    "",
    "De ce contează pentru traderi:",
    item.marketImpactRo,
    "",
    "Ce rămâne de urmărit:",
    `Urmărește dacă reacția din preț confirmă tema știrii pe ${item.relatedAssets.slice(0, 4).join(", ")}.`
  ].join("\n");
}

function buildConclusion(themes: string[], assets: string[], items: MarketNewsItem[]): string[] {
  const maxScore = Math.max(...items.map((item) => item.importanceScore));
  return [
    `* Tema principală: ${joinRomanian(themes)}.`,
    `* Active care pot avea volatilitate: ${assets.slice(0, 8).join(", ")}.`,
    "* În sesiunea SUA, urmărește confirmarea în USD, randamente, indici și petrol, unde este relevant.",
    `* Nivelul de atenție este ${maxScore >= 5 ? "ridicat" : maxScore >= 3 ? "moderat" : "redus"}, pe baza scorurilor de importanță.`,
    "* Raportul este context educațional, nu recomandare de cumpărare sau vânzare."
  ];
}

function extractReportThemes(items: MarketNewsItem[]): string[] {
  const weights = new Map<string, number>();
  for (const item of items) {
    for (const theme of themeLabels(`${item.titleOriginal} ${item.descriptionOriginal ?? ""}`)) {
      weights.set(theme, (weights.get(theme) ?? 0) + item.importanceScore);
    }
  }
  const themes = [...weights.entries()].sort((a, b) => b[1] - a[1]).map(([theme]) => theme).slice(0, 4);
  return themes.length > 0 ? themes : ["sentimentul global al pieței"];
}

function themeLabels(text: string): string[] {
  const lower = text.toLowerCase();
  const result: string[] = [];
  if (matchesAny(lower, ["fed", "ecb", "boe", "rate", "inflation", "yield", "cpi", "ppi", "pce"])) result.push("dobânzi și inflație");
  if (matchesAny(lower, ["oil", "energy", "opec", "gas", "brent", "wti"])) result.push("energie și petrol");
  if (matchesAny(lower, ["war", "sanctions", "tariffs", "iran", "russia", "ukraine", "china"])) result.push("geopolitică și risc");
  if (matchesAny(lower, ["ai", "chips", "semiconductor", "nvidia", "microsoft", "apple", "tesla"])) result.push("tehnologie și mega-cap");
  if (matchesAny(lower, ["stocks", "equities", "nasdaq", "s&p", "dow", "dax"])) result.push("indici bursieri");
  if (matchesAny(lower, ["dollar", "euro", "yen", "sterling", "forex"])) result.push("valute majore");
  return result;
}

function topAssets(items: MarketNewsItem[]): string[] {
  const weights = new Map<string, number>();
  for (const item of items) {
    for (const asset of item.relatedAssets) weights.set(asset, (weights.get(asset) ?? 0) + item.importanceScore);
  }
  return [...weights.entries()].sort((a, b) => b[1] - a[1]).map(([asset]) => asset);
}

function shortTitle(item: MarketNewsItem): string {
  return item.titleRo.length <= 80 ? item.titleRo : `${item.titleRo.slice(0, 77)}...`;
}

function compactSummary(item: MarketNewsItem): string {
  const assets = item.relatedAssets.slice(0, 3).join(", ");
  return `Scor ${item.importanceScore}/5. Știrea poate conta pentru ${assets}; verifică sursa originală și confirmarea din piață înainte de orice decizie.`;
}

function buildSocialDescription(themes: string[], assets: string[]): string {
  return `Raportul de azi urmărește ${joinRomanian(themes)} și posibile reacții pe ${assets.slice(0, 5).join(", ")}. Conținut informativ și educațional, fără semnale de tranzacționare.`;
}

function joinRomanian(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "piața";
  return `${items.slice(0, -1).join(", ")} și ${items.at(-1)}`;
}

function formatPublished(value: string): string {
  if (value === "N/A") return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().toLowerCase();
  }
}

function normalizeTitle(value: string): string {
  return normalizeWhitespace(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function titleSimilarity(a: string, b: string): number {
  const left = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const right = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = [...left].filter((word) => right.has(word)).length;
  return intersection / Math.max(left.size, right.size);
}

function safeTime(value: string): number {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sourceFromUrl(value: string): string | null {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function matchesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}
