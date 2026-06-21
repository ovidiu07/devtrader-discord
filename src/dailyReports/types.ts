export type ReportType = "stiri-importante" | "calendar-economic" | "reuters-markets" | "currents-market-news";

export interface DailyReportConfig {
  enabled: boolean;
  time: string;
  timezone: string;
  stiriImportanteChannelId?: string;
  calendarEconomicChannelId?: string;
  reutersMarketsChannelId?: string;
  currentsMarketNewsChannelId?: string;
  postFallbackWhenNoData: boolean;
  duplicateGuardEnabled: boolean;
  news: NewsConfig;
  calendar: EconomicCalendarConfig;
  reutersMarkets: ReutersMarketsNewsConfig;
  currentsMarketNews: CurrentsMarketNewsConfig;
}

export interface NewsConfig {
  rssFeeds: string[];
  maxItems: number;
  lookbackHours: number;
  fetchTimeoutSeconds: number;
}

export interface EconomicCalendarConfig {
  apiUrl?: string;
  apiKey?: string;
  sourceType: "json" | "forexfactory" | "investinglive";
  lookaheadDays: number;
  minImportance: "high" | "medium" | "low";
  countries: string[];
  includeMediumImpact: boolean;
  maxEvents: number;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt?: Date;
  rawCategory?: string;
  description?: string;
}

export interface ReutersMarketsNewsConfig {
  enabled: boolean;
  sourceUrl: string;
  cron: string;
  time: string;
  timezone: string;
  fetchTimeoutSeconds: number;
  forceRepost: boolean;
  postFallbackWhenNoData: boolean;
}

export interface CurrentsMarketNewsConfig {
  enabled: boolean;
  apiKey?: string;
  channelId?: string;
  cron: string;
  time: string;
  timezone: string;
  language: string;
  limit: number;
  forceRepost: boolean;
  fetchTimeoutSeconds: number;
  minItemsToPost: number;
}

export interface MarketNewsItem {
  id: string | null;
  titleOriginal: string;
  titleRo: string;
  descriptionOriginal: string | null;
  summaryRo: string;
  category: string[];
  author: string | null;
  source: string | null;
  url: string;
  image: string | null;
  language: string;
  published: string;
  extractedAt: string;
  importanceScore: number;
  relatedAssets: string[];
  keywordsMatched: string[];
  marketImpactRo: string;
}

export interface CurrentsMarketNewsReportCache {
  reports: CurrentsMarketNewsCachedReport[];
}

export interface CurrentsMarketNewsCachedReport {
  reportDate: string;
  generatedAt: string;
  postedAt?: string;
  channelId?: string;
  discordMessageIds?: string[];
  itemHashes: string[];
  source: "Currents API";
  status: "generated" | "posted" | "failed";
  errorMessage?: string;
  items: MarketNewsItem[];
}

export interface ReutersMarketsArticle {
  titleOriginal: string;
  titleRo: string;
  category: string;
  publishedTime: string;
  updatedTime: string;
  relativeTime: string;
  sourceUrl: string;
  snippetOriginal: string;
  summaryRo: string;
  marketImpactRo: string;
  relatedAssets: string[];
  importanceScore: number;
  extractedAt: string;
  hash: string;
  isLead: boolean;
  publishedAt?: string;
}

export interface ReutersMarketsReportCache {
  reports: ReutersMarketsCachedReport[];
}

export interface ReutersMarketsCachedReport {
  date: string;
  sourceUrl: string;
  extractedAt: string;
  articleHashes: string[];
  articles: ReutersMarketsArticle[];
  postedAt?: string;
  discordChannelId?: string;
  discordMessageIds?: string[];
}

export interface ScoredNewsItem extends NewsItem {
  category: NewsCategory;
  categoryRo: string;
  score: number;
  affectedMarkets: string[];
  whyItMatters: string;
}

export type NewsCategory =
  | "CENTRAL_BANKS"
  | "INFLATION"
  | "LABOR_MARKET"
  | "BONDS_YIELDS"
  | "INDICES"
  | "FOREX"
  | "ENERGY"
  | "GEOPOLITICS"
  | "TECH_COMPANIES"
  | "ECONOMY";

export interface EconomicCalendarEvent {
  eventName: string;
  country: string;
  currency?: string;
  dateTime: Date;
  importance: "low" | "medium" | "high" | string;
  impact?: string;
  forecast?: string;
  consensus?: string;
  previous?: string;
  actual?: string;
  eventType?: string;
  source: string;
  url?: string;
  sourceUrl?: string;
}

export interface EnrichedEconomicCalendarEvent extends EconomicCalendarEvent {
  eventType: EconomicEventType;
  impactRo: string;
  affectedMarkets: string[];
  timeRo: string;
}

export type EconomicEventType =
  | "CPI"
  | "PPI"
  | "PCE"
  | "NFP"
  | "UNEMPLOYMENT"
  | "RETAIL_SALES"
  | "GDP"
  | "PMI_ISM"
  | "RATE_DECISION"
  | "CENTRAL_BANK_SPEECH"
  | "CRUDE_OIL_INVENTORIES"
  | "TREASURY_AUCTION"
  | "OTHER_IMPORTANT";

export interface DailyReportState {
  posts: DailyReportPostRecord[];
}

export interface DailyReportPostRecord {
  date: string;
  reportType: ReportType;
  status: "posted" | "skipped" | "failed";
  discordChannelId?: string;
  discordMessageIds?: string[];
  articleHashes?: string[];
  articleCount?: number;
  postedAt?: string;
  error?: string;
}

export interface DailyReportChannel {
  id: string;
  name: string;
  send(content: string): Promise<{ id: string; content: string }>;
}
