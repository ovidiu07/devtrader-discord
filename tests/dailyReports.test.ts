import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildEconomicCalendarReport, classifyEconomicEvent, enrichEconomicEvent, selectImportantEconomicEvents } from "../src/dailyReports/calendarService.js";
import { normalizeEconomicCalendarPayload, normalizeForexFactoryCalendarPayload, parseInvestingLiveCalendarHtml } from "../src/dailyReports/calendarSource.js";
import { loadDailyReportConfig } from "../src/dailyReports/config.js";
import {
  CurrentsMarketNewsError,
  deduplicateNews,
  fetchAvailableCategories,
  fetchMarketNewsCandidates,
  generateRomanianReport,
  hashMarketNewsItem,
  mapRelatedAssets as mapCurrentsRelatedAssets,
  scoreNewsImportance,
  selectTopSevenNews
} from "../src/dailyReports/currentsMarketNewsService.js";
import { resolveDailyReportChannel, sendDailyReport } from "../src/dailyReports/discordAdapter.js";
import { splitDiscordMessage } from "../src/dailyReports/messageSplit.js";
import { buildImportantNewsReport, dedupeNewsItems, scoreNewsItem, selectImportantNews } from "../src/dailyReports/newsService.js";
import { parseRssItems } from "../src/dailyReports/newsSource.js";
import {
  buildReutersMarketsReport,
  classifyReutersImportance,
  dedupeReutersArticles,
  mapRelatedAssets,
  parseReutersMarketsHtml,
  translateReutersTitle
} from "../src/dailyReports/reutersMarketsService.js";
import { nextDailyReportTarget } from "../src/dailyReports/scheduler.js";
import { emptyDailyReportState, wasReportPosted } from "../src/dailyReports/state.js";
import { emptyDiscordState } from "../src/state/loadState.js";
import type { Blueprint } from "../src/config/schema.js";
import type { DailyReportConfig, DailyReportState, EconomicCalendarEvent, MarketNewsItem, NewsItem } from "../src/dailyReports/types.js";

describe("daily report scheduler", () => {
  it("uses the configured 09:00 Europe/Bucharest weekday time", () => {
    const target = nextDailyReportTarget({ time: "09:00", timezone: "Europe/Bucharest", now: new Date("2026-06-17T05:24:00.000Z") });
    expect(target.date).toBe("2026-06-17");
    expect(target.delayMs).toBe(36 * 60 * 1000);
  });

  it("skips Saturday and Sunday", () => {
    const target = nextDailyReportTarget({ time: "09:00", timezone: "Europe/Bucharest", now: new Date("2026-06-20T05:00:00.000Z") });
    expect(target.date).toBe("2026-06-22");
  });

  it("defaults timezone to Europe/Bucharest", () => {
    expect(loadDailyReportConfig({}).timezone).toBe("Europe/Bucharest");
  });

  it("auto-detects ForexFactory calendar URLs", () => {
    const value = loadDailyReportConfig({ ECONOMIC_CALENDAR_API_URL: "https://www.forexfactory.com" });
    expect(value.calendar.sourceType).toBe("forexfactory");
  });

  it("auto-detects investingLive calendar URLs", () => {
    const value = loadDailyReportConfig({ ECONOMIC_CALENDAR_API_URL: "https://investinglive.com/EconomicCalendar" });
    expect(value.calendar.sourceType).toBe("investinglive");
  });

  it("loads Reuters Markets schedule from the recommended cron", () => {
    const value = loadDailyReportConfig({ REUTERS_MARKETS_NEWS_ENABLED: "true", REUTERS_MARKETS_NEWS_CRON: "0 0 9 * * 1-5" });
    expect(value.reutersMarkets.enabled).toBe(true);
    expect(value.reutersMarkets.time).toBe("09:00");
    expect(value.reutersMarkets.timezone).toBe("Europe/Bucharest");
  });

  it("requires a Currents API key when Currents market news is enabled", () => {
    expect(() => loadDailyReportConfig({ CURRENTS_MARKET_NEWS_ENABLED: "true" })).toThrow("CURRENTS_API_KEY is missing");
  });

  it("loads Currents market news schedule and channel config", () => {
    const value = loadDailyReportConfig({
      CURRENTS_MARKET_NEWS_ENABLED: "true",
      CURRENTS_API_KEY: "test-key",
      CURRENTS_MARKET_NEWS_CHANNEL_ID: "news-channel",
      CURRENTS_MARKET_NEWS_CRON: "0 0 9 * * 1-5"
    });
    expect(value.currentsMarketNews.enabled).toBe(true);
    expect(value.currentsMarketNews.time).toBe("09:00");
    expect(value.currentsMarketNews.timezone).toBe("Europe/Bucharest");
    expect(value.currentsMarketNews.channelId).toBe("news-channel");
  });
});

describe("daily report Discord channel resolution", () => {
  it("selects stiri-importante by configured channel id", async () => {
    const channel = fakeTextChannel("configured", "custom-stiri");
    const resolved = await resolveDailyReportChannel({
      guild: fakeGuild([channel]),
      blueprint: blueprint(),
      state: emptyDiscordState(),
      config: { ...config(), stiriImportanteChannelId: "configured" },
      reportType: "stiri-importante"
    });
    expect(resolved?.id).toBe("configured");
  });

  it("selects calendar-economic by blueprint name fallback", async () => {
    const channel = fakeTextChannel("calendar-id", "calendar-economic");
    const resolved = await resolveDailyReportChannel({
      guild: fakeGuild([channel]),
      blueprint: blueprint(),
      state: emptyDiscordState(),
      config: config(),
      reportType: "calendar-economic"
    });
    expect(resolved?.id).toBe("calendar-id");
  });

  it("selects Currents market news by configured channel id", async () => {
    const channel = fakeTextChannel("currents-id", "market-news");
    const resolved = await resolveDailyReportChannel({
      guild: fakeGuild([channel]),
      blueprint: blueprint(),
      state: emptyDiscordState(),
      config: { ...config(), currentsMarketNewsChannelId: "currents-id" },
      reportType: "currents-market-news"
    });
    expect(resolved?.id).toBe("currents-id");
  });
});

describe("daily report duplicate guard", () => {
  it("prevents duplicate successful reports for the same date", () => {
    const state: DailyReportState = { posts: [{ date: "2026-06-17", reportType: "stiri-importante", status: "posted" }] };
    expect(wasReportPosted(state, "2026-06-17", "stiri-importante")).toBe(true);
  });

  it("allows force mode by checking guard outside the state helper", () => {
    const state = emptyDailyReportState();
    expect(wasReportPosted(state, "2026-06-17", "calendar-economic")).toBe(false);
  });

  it("prevents duplicate Reuters reports through the shared daily state", () => {
    const state: DailyReportState = { posts: [{ date: "2026-06-17", reportType: "reuters-markets", status: "posted" }] };
    expect(wasReportPosted(state, "2026-06-17", "reuters-markets")).toBe(true);
  });

  it("prevents duplicate Currents reports through the shared daily state", () => {
    const state: DailyReportState = { posts: [{ date: "2026-06-17", reportType: "currents-market-news", status: "posted" }] };
    expect(wasReportPosted(state, "2026-06-17", "currents-market-news")).toBe(true);
  });
});

describe("RSS news reports", () => {
  it("fetches and normalizes RSS news items", () => {
    const items = parseRssItems(
      `<?xml version="1.0"?><rss><channel><title>Market Feed</title><item><title>Fed rate decision moves dollar</title><link>https://example.com/a</link><pubDate>Wed, 17 Jun 2026 06:00:00 GMT</pubDate><description>FOMC details</description></item></channel></rss>`,
      "https://example.com/feed.xml"
    );
    expect(items[0]).toMatchObject({ title: "Fed rate decision moves dollar", url: "https://example.com/a", source: "Market Feed" });
  });

  it("deduplicates by normalized URL and title", () => {
    const items = dedupeNewsItems([
      news("Fed decision", "https://example.com/a?utm=1"),
      news("Fed decision", "https://example.com/b"),
      news("Other Fed decision", "https://example.com/a")
    ]);
    expect(items).toHaveLength(1);
  });

  it("matches keywords case-insensitively and maps categories", () => {
    const scored = scoreNewsItem(news("POWELL signals Fed rate cut", "https://example.com/fed"));
    expect(scored?.category).toBe("CENTRAL_BANKS");
    expect(scored?.whyItMatters).toContain("băncilor centrale");
  });

  it("ranks top relevant news items", () => {
    const selected = selectImportantNews(
      [news("Nvidia launches product", "https://example.com/nvda"), news("Fed FOMC interest rate decision", "https://example.com/fed")],
      { rssFeeds: [], maxItems: 1, lookbackHours: 24, fetchTimeoutSeconds: 10 },
      new Date("2026-06-17T08:00:00.000Z")
    );
    expect(selected[0].category).toBe("CENTRAL_BANKS");
  });

  it("renders no-news fallback in Romanian", () => {
    const report = buildImportantNewsReport({ date: "2026-06-17", timezone: "Europe/Bucharest", items: [], config: config().news });
    expect(report).toContain("Astăzi nu au fost găsite știri majore");
    expect(report).toContain("Conținut educațional");
  });
});

describe("economic calendar reports", () => {
  it("normalizes JSON calendar events", () => {
    const events = normalizeEconomicCalendarPayload({ events: [{ event: "CPI", country: "US", date: "2026-06-17T12:30:00Z", impact: "high", forecast: "3.4%" }] });
    expect(events[0]).toMatchObject({ eventName: "CPI", country: "US", importance: "high", forecast: "3.4%" });
  });

  it("normalizes ForexFactory weekly feed events", () => {
    const events = normalizeForexFactoryCalendarPayload([
      { title: "FOMC Statement", country: "USD", date: "2026-06-17T14:00:00-04:00", impact: "High", forecast: "", previous: "" }
    ]);
    expect(events[0]).toMatchObject({
      eventName: "FOMC Statement",
      country: "US",
      currency: "USD",
      importance: "high",
      source: "ForexFactory"
    });
  });

  it("parses investingLive calendar HTML with actual consensus and previous", () => {
    const events = parseInvestingLiveCalendarHtml(investingLiveSampleHtml(), new Date("2026-06-17T08:00:00.000Z"));
    expect(events[0]).toMatchObject({
      eventName: "Retail Sales (MoM) (May)",
      country: "US",
      impact: "Vol. 3",
      actual: "N/A",
      consensus: "0.5%",
      previous: "0.5%",
      source: "investingLive Economic Calendar"
    });
  });

  it("normalizes missing investingLive actual consensus and previous values", () => {
    const events = parseInvestingLiveCalendarHtml(investingLiveSampleHtml({ actual: "", consensus: "", previous: "" }), new Date("2026-06-17T08:00:00.000Z"));
    expect(events[0]).toMatchObject({ actual: "N/A", consensus: "N/A", previous: "N/A" });
  });

  it("filters investingLive events by impact and country aliases", () => {
    const value = config({ ECONOMIC_CALENDAR_SOURCE_TYPE: "investinglive", ECONOMIC_CALENDAR_COUNTRIES: "US,EU,DE,GB,CN,JP", ECONOMIC_CALENDAR_INCLUDE_MEDIUM_IMPACT: "true" });
    const events = selectImportantEconomicEvents(parseInvestingLiveCalendarHtml(investingLiveSampleHtml(), new Date("2026-06-17T08:00:00.000Z")), value, "2026-06-17");
    expect(events.map((event) => event.eventName)).toContain("Retail Sales (MoM) (May)");
  });

  it("removes secondary interest-rate projection rows from the final selection", () => {
    const value = config({ ECONOMIC_CALENDAR_SOURCE_TYPE: "investinglive", ECONOMIC_CALENDAR_INCLUDE_MEDIUM_IMPACT: "true" });
    const events = selectImportantEconomicEvents(
      [calendarEvent("FOMC Economic Projections", "high"), calendarEvent("Interest Rate Projections - 1st year", "high"), calendarEvent("Fed Interest Rate Decision", "high")],
      value,
      "2026-06-17"
    );

    expect(events.map((event) => event.eventName)).toEqual(["FOMC Economic Projections", "Fed Interest Rate Decision"]);
  });

  it("caps repeated medium-impact release families", () => {
    const value = config({ ECONOMIC_CALENDAR_SOURCE_TYPE: "investinglive", ECONOMIC_CALENDAR_INCLUDE_MEDIUM_IMPACT: "true" });
    const events = selectImportantEconomicEvents(
      [calendarEvent("Producer Price Index - Output (YoY)", "medium"), calendarEvent("PPI Core Output (MoM)", "medium"), calendarEvent("Producer Price Index - Output (MoM)", "medium")],
      value,
      "2026-06-17"
    );

    expect(events.map((event) => event.eventName)).toEqual(["Producer Price Index - Output (YoY)", "PPI Core Output (MoM)"]);
  });

  it("keeps ForexFactory events when configured countries use regions", () => {
    const value = config({ ECONOMIC_CALENDAR_SOURCE_TYPE: "forexfactory" });
    const events = selectImportantEconomicEvents(
      normalizeForexFactoryCalendarPayload([{ title: "FOMC Statement", country: "USD", date: "2026-06-17T14:00:00-04:00", impact: "High" }]),
      value,
      "2026-06-17"
    );
    expect(events).toHaveLength(1);
  });

  it("filters high-impact events for today", () => {
    const events = selectImportantEconomicEvents([calendarEvent("CPI", "high")], config(), "2026-06-17");
    expect(events).toHaveLength(1);
  });

  it("maps event type to Romanian explanation", () => {
    const mapped = enrichEconomicEvent(calendarEvent("Core CPI", "high"));
    expect(mapped.eventType).toBe("CPI");
    expect(mapped.impactRo).toContain("Inflația");
  });

  it("classifies crude oil inventories", () => {
    expect(classifyEconomicEvent("EIA Crude Oil Inventories")).toBe("CRUDE_OIL_INVENTORIES");
  });

  it("renders no-source fallback", () => {
    const report = buildEconomicCalendarReport({ date: "2026-06-17", timezone: "Europe/Bucharest", events: [], config: config() });
    expect(report).toContain("Nu există încă o sursă de calendar economic configurată");
  });

  it("renders required Discord fields for investingLive calendar events", () => {
    const value = config({ ECONOMIC_CALENDAR_SOURCE_TYPE: "investinglive", ECONOMIC_CALENDAR_API_URL: "https://investinglive.com/EconomicCalendar", ECONOMIC_CALENDAR_INCLUDE_MEDIUM_IMPACT: "true" });
    const report = buildEconomicCalendarReport({
      date: "2026-06-17",
      timezone: "Europe/Bucharest",
      events: parseInvestingLiveCalendarHtml(investingLiveSampleHtml(), new Date("2026-06-17T08:00:00.000Z")),
      config: value
    });

    expect(report).toContain("Ore afișate: Europe/Bucharest");
    expect(report).toContain("Impact: 🔴 **Vol. 3**");
    expect(report).toContain("Actual: Nepublicat");
    expect(report).toContain("Consensus: 0.5%");
    expect(report).toContain("Previous: 0.5%");
    expect(report).toContain("Tip: Report");
    expect(report).toContain("Sursă: investingLive Economic Calendar");
  });

  it("does not render actual consensus and previous fields for speeches", () => {
    const value = config({ ECONOMIC_CALENDAR_SOURCE_TYPE: "investinglive", ECONOMIC_CALENDAR_API_URL: "https://investinglive.com/EconomicCalendar", ECONOMIC_CALENDAR_INCLUDE_MEDIUM_IMPACT: "true" });
    const report = buildEconomicCalendarReport({
      date: "2026-06-17",
      timezone: "Europe/Bucharest",
      events: [calendarEvent("FOMC Press Conference", "high")],
      config: value
    });

    expect(report).toContain("Tip: Speech");
    expect(report).not.toContain("Actual:");
    expect(report).not.toContain("Consensus:");
    expect(report).not.toContain("Previous:");
  });
});

describe("Reuters Markets reports", () => {
  const fixture = () => readFileSync("tests/fixtures/reuters-markets.html", "utf8");

  it("parses visible headlines from the Reuters Markets HTML fixture", () => {
    const articles = parseReutersMarketsHtml(fixture(), { sourceUrl: "https://www.reuters.com/markets/", extractedAt: new Date("2026-06-17T06:00:00.000Z") });
    expect(articles.map((article) => article.titleOriginal)).toContain("Oil falls on Iran supply hopes");
    expect(articles).toHaveLength(3);
  });

  it("parses category relative time and source URL", () => {
    const articles = parseReutersMarketsHtml(fixture(), { sourceUrl: "https://www.reuters.com/markets/", extractedAt: new Date("2026-06-17T06:00:00.000Z") });
    const dollar = articles.find((article) => article.titleOriginal.includes("Dollar"));
    expect(dollar).toMatchObject({
      category: "Currencies",
      relativeTime: "3 hours ago",
      sourceUrl: "https://www.reuters.com/markets/currencies/dollar-weakens-before-fed-decision-2026-06-17/?utm_source=test"
    });
  });

  it("normalizes missing snippets to N/A", () => {
    const articles = parseReutersMarketsHtml(fixture(), { sourceUrl: "https://www.reuters.com/markets/", extractedAt: new Date("2026-06-17T06:00:00.000Z") });
    const europe = articles.find((article) => article.titleOriginal.includes("European shares"));
    expect(europe?.snippetOriginal).toBe("N/A");
  });

  it("deduplicates by URL title slug and title similarity", () => {
    const articles = parseReutersMarketsHtml(fixture(), { sourceUrl: "https://www.reuters.com/markets/", extractedAt: new Date("2026-06-17T06:00:00.000Z") });
    const deduped = dedupeReutersArticles([...articles, { ...articles[0], sourceUrl: "https://www.reuters.com/markets/commodities/oil-falls-iran-supply-hopes-2026-06-17/?x=1" }]);
    expect(deduped).toHaveLength(3);
  });

  it("translates known market titles to Romanian wording", () => {
    expect(translateReutersTitle("Oil falls on Iran supply hopes", "Commodities")).toContain("Petrolul scade");
  });

  it("generates Romanian summary and market impact without copying article text", () => {
    const articles = parseReutersMarketsHtml(fixture(), { sourceUrl: "https://www.reuters.com/markets/", extractedAt: new Date("2026-06-17T06:00:00.000Z") });
    expect(articles[0].summaryRo).toContain("Rezumatul este construit doar din titlul si snippet-ul vizibil");
    expect(articles[0].marketImpactRo).toContain("Pentru traderi");
  });

  it("classifies importance score and maps related assets", () => {
    expect(classifyReutersImportance("Fed rate decision and inflation")).toBe(5);
    expect(mapRelatedAssets("Fed rates and yields")).toEqual(expect.arrayContaining(["USD", "US10Y", "Nasdaq", "S&P 500", "Gold"]));
  });

  it("generates the Discord Reuters report with sources and trader impact", async () => {
    const articles = parseReutersMarketsHtml(fixture(), { sourceUrl: "https://www.reuters.com/markets/", extractedAt: new Date("2026-06-17T06:00:00.000Z") });
    const report = await buildReutersMarketsReport({
      date: "2026-06-17",
      timezone: "Europe/Bucharest",
      articles,
      sourceUrl: "https://www.reuters.com/markets/",
      now: new Date("2026-06-17T06:00:00.000Z")
    });
    expect(report).toContain("REUTERS MARKETS - RAPORT ZILNIC");
    expect(report).toContain("De ce conteaza pentru traderi");
    expect(report).toContain("https://www.reuters.com/markets/");
    expect(report).toContain("Raport informativ si educational");
  });

  it("renders an empty Reuters report only when explicitly allowed", async () => {
    await expect(
      buildReutersMarketsReport({ date: "2026-06-17", timezone: "Europe/Bucharest", articles: [], sourceUrl: "https://www.reuters.com/markets/", allowEmptyReport: false })
    ).rejects.toThrow("No Reuters Markets articles");
    await expect(
      buildReutersMarketsReport({ date: "2026-06-17", timezone: "Europe/Bucharest", articles: [], sourceUrl: "https://www.reuters.com/markets/", allowEmptyReport: true })
    ).resolves.toContain("Nu au fost gasite stiri Reuters Markets");
  });
});

describe("Currents API market news reports", () => {
  it("fetches available v2 categories with the configured key in the Authorization header", async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: "test-key" });
      return jsonResponse({ status: "ok", categories: ["economy_business_finance", "politics_government"] });
    }) as unknown as typeof fetch;

    const categories = await fetchAvailableCategories(config({ CURRENTS_MARKET_NEWS_ENABLED: "true", CURRENTS_API_KEY: "test-key" }).currentsMarketNews, fetchMock);
    expect(categories).toContain("economy_business_finance");
  });

  it("fetches Currents search results and normalizes market news candidates", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        status: "ok",
        news: [
          currentsArticle("1", "Fed rate decision moves bond yields", "Policy details matter for inflation expectations.", "https://example.com/fed"),
          currentsArticle("2", "Oil jumps on Middle East supply risk", "Crude markets watch Iran and supply routes.", "https://example.com/oil")
        ]
      })
    ) as unknown as typeof fetch;

    const items = await fetchMarketNewsCandidates(config({ CURRENTS_MARKET_NEWS_ENABLED: "true", CURRENTS_API_KEY: "test-key" }).currentsMarketNews, fetchMock, new Date("2026-06-17T06:00:00.000Z"));
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      titleOriginal: "Fed rate decision moves bond yields",
      importanceScore: 5
    });
    expect(items[0].relatedAssets).toEqual(expect.arrayContaining(["USD", "US10Y", "Nasdaq"]));
  });

  it("deduplicates Currents news by id url title hash and similarity", () => {
    const first = marketNewsItem("1", "Fed decision moves yields", "https://example.com/a?utm_source=x");
    const items = deduplicateNews([
      first,
      { ...marketNewsItem("1", "Different title", "https://example.com/b"), id: "1" },
      marketNewsItem("2", "Other title", "https://example.com/a"),
      marketNewsItem("3", "Fed decision moves yields", "https://example.com/c"),
      { ...marketNewsItem("4", "Fed decision moves yields", "https://example.com/d"), published: first.published },
      marketNewsItem("5", "Fed decision moves bond yields", "https://example.com/e")
    ]);
    expect(items).toHaveLength(1);
  });

  it("scores importance maps assets and selects exactly seven sorted items", () => {
    expect(scoreNewsImportance(marketNewsItem("1", "Fed CPI rate decision", "https://example.com/fed"))).toBe(5);
    expect(mapCurrentsRelatedAssets("Fed rates and yields")).toEqual(expect.arrayContaining(["USD", "US10Y", "Nasdaq", "S&P 500", "Gold"]));
    const items = Array.from({ length: 9 }, (_, index) => ({
      ...marketNewsItem(String(index), index === 8 ? "Fed rate decision" : `Regional business update ${index}`, `https://example.com/${index}`),
      importanceScore: index === 8 ? 5 : 2
    }));
    const selected = selectTopSevenNews(items);
    expect(selected).toHaveLength(7);
    expect(selected[0].titleOriginal).toBe("Fed rate decision");
  });

  it("generates a Romanian Discord report with sources links compact cards and disclaimer", () => {
    const report = generateRomanianReport({
      date: "2026-06-17",
      timezone: "Europe/Bucharest",
      now: new Date("2026-06-17T06:00:00.000Z"),
      items: [
        marketNewsItem("1", "Fed rate decision moves yields", "https://example.com/fed"),
        marketNewsItem("2", "Oil jumps on Middle East supply risk", "https://example.com/oil"),
        marketNewsItem("3", "Nvidia earnings lift AI chip stocks", "https://example.com/nvidia")
      ]
    });
    expect(report).toContain("TOP 7 ȘTIRI IMPORTANTE PENTRU TRADERI");
    expect(report).toContain("Sursă principală: Currents API");
    expect(report).toContain("Link: https://example.com/fed");
    expect(report).toContain("REZUMAT COMPACT PENTRU NEWS CARDS");
    expect(report).toContain("Nu reprezintă recomandare de investiții");
  });

  it("rejects 401 429 and 400 Currents responses with safe messages", async () => {
    const value = config({ CURRENTS_MARKET_NEWS_ENABLED: "true", CURRENTS_API_KEY: "test-key" }).currentsMarketNews;
    await expect(fetchAvailableCategories(value, vi.fn(async () => jsonResponse({ status: "401", msg: "Authentication required" }, 401)) as unknown as typeof fetch)).rejects.toMatchObject({
      status: 401,
      message: "Currents API invalid API key."
    });
    await expect(fetchAvailableCategories(value, vi.fn(async () => jsonResponse({ status: "429", msg: "Too many requests" }, 429)) as unknown as typeof fetch)).rejects.toMatchObject({
      status: 429,
      message: "Currents API rate limit exceeded."
    });
    await expect(fetchAvailableCategories(value, vi.fn(async () => jsonResponse({ status: "400", msg: "Invalid parameters" }, 400)) as unknown as typeof fetch)).rejects.toBeInstanceOf(CurrentsMarketNewsError);
  });
});

describe("daily report message splitting and isolation", () => {
  it("splits long Discord messages with part labels", () => {
    const chunks = splitDiscordMessage(["Titlu", "x".repeat(120), "Link: https://example.com/article"].join("\n\n"), 80);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain("Partea 1/");
    expect(chunks.at(-1)).toContain("https://example.com/article");
  });

  it("sends every split chunk", async () => {
    const sent: string[] = [];
    await sendDailyReport(
      {
        id: "1",
        name: "stiri-importante",
        async send(content: string) {
          sent.push(content);
          return { id: String(sent.length), content };
        }
      },
      ["Titlu", "x".repeat(2500), "Final"].join("\n\n")
    );
    expect(sent.length).toBeGreaterThan(1);
  });

  it("can run independent report tasks even if one fails", async () => {
    const tasks = [
      vi.fn(async () => {
        throw new Error("RSS failed");
      }),
      vi.fn(async () => "calendar ok")
    ];
    const results = await Promise.allSettled(tasks.map((task) => task()));
    expect(results[0].status).toBe("rejected");
    expect(results[1]).toMatchObject({ status: "fulfilled", value: "calendar ok" });
  });
});

function config(overrides: NodeJS.ProcessEnv = {}): DailyReportConfig {
  return loadDailyReportConfig({
    DAILY_REPORT_TIME: "09:00",
    DAILY_REPORT_TIMEZONE: "Europe/Bucharest",
    DAILY_REPORT_ENABLED: "true",
    POST_FALLBACK_WHEN_NO_DATA: "true",
    REPORT_DUPLICATE_GUARD_ENABLED: "true",
    ...overrides
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function currentsArticle(id: string, title: string, description: string, url: string) {
  return {
    id,
    title,
    description,
    url,
    author: null,
    image: null,
    language: "en",
    category: ["economy_business_finance"],
    published: "2026-06-17 06:00:00 +0000"
  };
}

function marketNewsItem(id: string, title: string, url: string): MarketNewsItem {
  const seed = {
    id,
    titleOriginal: title,
    descriptionOriginal: "Market context for traders.",
    category: ["economy_business_finance"],
    author: null,
    source: "example.com",
    url,
    image: null,
    language: "en",
    published: "2026-06-17T06:00:00.000Z",
    extractedAt: "2026-06-17T06:00:00.000Z"
  };
  return {
    ...seed,
    titleRo: "Știre economică relevantă pentru traderi",
    summaryRo: "Rezumat educațional bazat pe sursă.",
    importanceScore: scoreNewsImportance(seed),
    relatedAssets: mapCurrentsRelatedAssets(seed),
    keywordsMatched: [],
    marketImpactRo: "Impact posibil asupra piețelor globale."
  };
}

function news(title: string, url: string): NewsItem {
  return { title, url, source: "Test", publishedAt: new Date("2026-06-17T07:00:00.000Z") };
}

function calendarEvent(eventName: string, importance: string): EconomicCalendarEvent {
  return {
    eventName,
    country: "US",
    currency: "USD",
    dateTime: new Date("2026-06-17T12:30:00.000Z"),
    importance,
    source: "Test"
  };
}

function blueprint(): Blueprint {
  return {
    server: { name: "Test" },
    roles: [],
    categories: [
      {
        key: "piata_zilnica",
        name: "PIAȚA ZILNICĂ",
        premiumOnly: false,
        moderatorOnly: false,
        overwrites: [],
        channels: [
          { key: "stiri_importante", name: "stiri-importante", type: "text", readonly: false, premiumOnly: false, moderatorOnly: false, overwrites: [] },
          { key: "calendar_economic", name: "calendar-economic", type: "text", readonly: false, premiumOnly: false, moderatorOnly: false, overwrites: [] }
        ]
      }
    ],
    messages: []
  };
}

function fakeTextChannel(id: string, name: string) {
  return { id, name, type: 0, send: vi.fn() };
}

function fakeGuild(channels: ReturnType<typeof fakeTextChannel>[]) {
  return {
    channels: {
      async fetch() {
        return new Map(channels.map((channel) => [channel.id, channel]));
      }
    }
  } as never;
}

function investingLiveSampleHtml(values: { actual?: string; consensus?: string; previous?: string } = {}) {
  const actual = values.actual ?? "";
  const consensus = values.consensus ?? "0.5%";
  const previous = values.previous ?? "0.5%";
  return `
    <table id="fxst-calendartable">
      <thead><tr><th id="fxst-thtime">GMT+3</th></tr></thead>
      <tbody>
        <tr class="fxst-dateRow"><td colspan="9">Wednesday, Jun 17</td></tr>
        <tr class="fxst-tr-event fxit-eventrow" data-countryname="United States">
          <td>15:30</td>
          <td><b class="fxst-flag fxst-i-us" title="United States">US</b></td>
          <td class="fxst-txt-left"><a class="fxit-eventurl">Retail Sales (MoM) (May)</a></td>
          <td><span class="fxst-i-vol fxst-i-vol3">3</span></td>
          <td class="fxit-actual">${actual}</td>
          <td>${consensus}</td>
          <td class="fxst-td-previous fxit-previous">${previous}</td>
          <td></td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;
}
