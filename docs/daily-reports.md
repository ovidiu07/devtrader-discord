# Daily Market Reports

This automation posts deterministic Romanian market reports to:

- `stiri-importante`
- `calendar-economic`
- optional Reuters Markets report for `stiri-importante` or a configured channel ID
- optional Currents API market-news report for a configured news channel ID

The existing RSS, economic-calendar, Reuters, and Currents reports do not use AI, OpenAI, LLMs, prompt building, or text-generation models. Reports are built from RSS/API/HTML/JSON data, fixed Romanian templates, keyword rules, and predefined market-impact mappings.

## Schedule

Default schedule:

- Monday to Friday
- `09:00`
- `Europe/Bucharest`

The long-running scheduler runs these reports independently from the education posts:

```bash
npm run scheduler:start
```

Weekend posting is disabled for daily market reports.

## Environment

```bash
DAILY_REPORT_ENABLED=true
DAILY_REPORT_TIME=09:00
DAILY_REPORT_TIMEZONE=Europe/Bucharest

DISCORD_CHANNEL_STIRI_IMPORTANTE_ID=
DISCORD_CHANNEL_CALENDAR_ECONOMIC_ID=

REUTERS_MARKETS_NEWS_ENABLED=false
REUTERS_MARKETS_NEWS_SOURCE_URL=https://www.reuters.com/markets/
REUTERS_MARKETS_NEWS_CRON=0 0 9 * * 1-5
REUTERS_MARKETS_NEWS_TIMEZONE=Europe/Bucharest
REUTERS_MARKETS_NEWS_CHANNEL_ID=
REUTERS_MARKETS_NEWS_FETCH_TIMEOUT_SECONDS=15
REUTERS_MARKETS_FORCE_REPOST=false
REUTERS_MARKETS_POST_FALLBACK_WHEN_NO_DATA=

CURRENTS_API_KEY=
CURRENTS_MARKET_NEWS_ENABLED=false
CURRENTS_MARKET_NEWS_CHANNEL_ID=
CURRENTS_MARKET_NEWS_CRON=0 0 9 * * 1-5
CURRENTS_MARKET_NEWS_TIMEZONE=Europe/Bucharest
CURRENTS_MARKET_NEWS_LANGUAGE=en
CURRENTS_MARKET_NEWS_LIMIT=7
CURRENTS_MARKET_NEWS_FORCE_REPOST=false
CURRENTS_MARKET_NEWS_FETCH_TIMEOUT_SECONDS=15

NEWS_RSS_FEEDS=https://feeds.marketwatch.com/marketwatch/topstories/,https://www.investing.com/rss/news_25.rss,https://www.fxstreet.com/rss/news
NEWS_MAX_ITEMS=7
NEWS_LOOKBACK_HOURS=24
NEWS_FETCH_TIMEOUT_SECONDS=10

ECONOMIC_CALENDAR_API_URL=https://investinglive.com/EconomicCalendar
ECONOMIC_CALENDAR_API_KEY=
ECONOMIC_CALENDAR_SOURCE_TYPE=investinglive
ECONOMIC_CALENDAR_LOOKAHEAD_DAYS=1
ECONOMIC_CALENDAR_MIN_IMPORTANCE=high
ECONOMIC_CALENDAR_COUNTRIES=US,EU,DE,GB,CN,JP
ECONOMIC_CALENDAR_INCLUDE_MEDIUM_IMPACT=true
ECONOMIC_CALENDAR_MAX_EVENTS=12

POST_FALLBACK_WHEN_NO_DATA=true
REPORT_DUPLICATE_GUARD_ENABLED=true
```

Channel IDs are preferred. If they are not configured, the bot falls back to the blueprint channel keys/names `stiri_importante` / `stiri-importante` and `calendar_economic` / `calendar-economic`.

`REUTERS_MARKETS_NEWS_CHANNEL_ID` is preferred for Reuters. If it is empty, the bot falls back to `DISCORD_CHANNEL_STIRI_IMPORTANTE_ID`, then to the blueprint `stiri_importante` / `stiri-importante` channel.

`CURRENTS_MARKET_NEWS_CHANNEL_ID` is required when `CURRENTS_MARKET_NEWS_ENABLED=true`. `CURRENTS_API_KEY` is required and must be provided only through the environment; do not commit it, log it, or paste it into Discord.

Required Discord permissions:

- View Channel
- Send Messages
- Read Message History

## News Report

`stiri-importante` uses the configured RSS feeds. Items are normalized, filtered to the lookback window, deduplicated by URL/title, and scored with deterministic keyword categories:

- banks and monetary policy
- inflation
- labor market
- bonds and yields
- indices and forex
- energy
- geopolitics
- technology companies
- economy

The report keeps the top `NEWS_MAX_ITEMS` and adds fixed Romanian impact text and affected markets. If there are no relevant items, it posts a Romanian fallback message.

Known working RSS examples:

- `https://feeds.marketwatch.com/marketwatch/topstories/`
- `https://www.investing.com/rss/news_25.rss`
- `https://www.fxstreet.com/rss/news`

Some finance sites block server-side RSS access with Cloudflare or rate limits. If a feed is blocked, the bot logs the failed feed and continues with the remaining sources.

## Reuters Markets Report

Enable it with:

```bash
REUTERS_MARKETS_NEWS_ENABLED=true
REUTERS_MARKETS_NEWS_CRON=0 0 9 * * 1-5
REUTERS_MARKETS_NEWS_TIMEZONE=Europe/Bucharest
REUTERS_MARKETS_NEWS_CHANNEL_ID=<discord_channel_id>
```

The implementation fetches `https://www.reuters.com/markets/` with a normal, low-frequency HTML request and parses visible article cards with Cheerio. It extracts visible public fields only:

- original title
- Reuters category when visible or derivable from the URL
- publication/update/relative time when visible
- source URL
- short visible snippet when present
- extraction timestamp

The bot does not open article bodies, copy full Reuters articles, use login, bypass paywalls, bypass CAPTCHA, or bypass anti-bot protection. If Reuters returns a JS/CAPTCHA challenge, the run logs the failure and does not post an empty production report.

The final Discord report is written in Romanian from deterministic rules:

- Romanian title wording based on market topic/action patterns
- short cautious summary based only on the visible title/snippet
- "De ce conteaza pentru traderi" impact text
- related asset mapping
- importance score from 1 to 5
- Reuters source link for every item

All visible Reuters articles found on the page are included after deduplication. Deduplication uses normalized source URL, original title, URL slug, and title similarity. Sorting uses importance score first, then headline/recency.

Reuters extraction cache is stored in `state/reuters-markets-news-cache.json`. Successful posts are also tracked in `state/daily-reports-state.json`, so the same Reuters report is not posted twice on the same day unless forced.

## Currents API Market News Report

Enable it with:

```bash
CURRENTS_API_KEY=<currents_api_key>
CURRENTS_MARKET_NEWS_ENABLED=true
CURRENTS_MARKET_NEWS_CHANNEL_ID=<discord_channel_id>
CURRENTS_MARKET_NEWS_CRON=0 0 9 * * 1-5
CURRENTS_MARKET_NEWS_TIMEZONE=Europe/Bucharest
```

The implementation uses Currents API as the primary source:

- `/v2/available/categories` to verify canonical v2 categories.
- `/v2/search` with `economy_business_finance` plus controlled secondary searches for geopolitics, technology, and energy.
- `/v1/latest-news` only as a final fallback when search returns too few relevant items.

The API key is sent in the `Authorization` header. It is never added to query strings, persisted state, Discord messages, or logs.

Selection flow:

- fetch recent English news from the last 24 hours;
- normalize each item into a `MarketNewsItem`;
- deduplicate by id, URL, normalized title, title/published hash, and simple title similarity;
- score importance from 1 to 5 using trading-related macro, markets, geopolitical, energy, and mega-cap keywords;
- map likely related assets such as USD, US10Y, Nasdaq, S&P 500, Gold, Oil, DAX, EURUSD, and Risk sentiment;
- select the top `CURRENTS_MARKET_NEWS_LIMIT`, default 7.

The final Discord report is Romanian, educational, and cautious. Without an LLM integration, titles and summaries are deterministic Romanian rewrites from the available title/description/category fields. The bot does not invent missing facts and every item keeps its original source link.

Currents extraction cache is stored in `state/currents-market-news-cache.json`. Successful posts are also tracked in `state/daily-reports-state.json`, so the same Currents report is not posted twice on the same day unless `--force` or `CURRENTS_MARKET_NEWS_FORCE_REPOST=true` is used.

Known Currents free-plan limitations:

- daily and burst rate limits apply;
- `429` means quota or burst limits were exceeded, and the bot will not retry aggressively;
- query volume is intentionally small because the free plan is limited;
- if fewer than 3 valid market-news items are available in production, the bot does not post.

## Economic Calendar Report

`calendar-economic` uses `ECONOMIC_CALENDAR_API_URL` when configured.

For investingLive, use:

```bash
ECONOMIC_CALENDAR_SOURCE_TYPE=investinglive
ECONOMIC_CALENDAR_API_URL=https://investinglive.com/EconomicCalendar
ECONOMIC_CALENDAR_COUNTRIES=US,EU,DE,GB,CN,JP
ECONOMIC_CALENDAR_INCLUDE_MEDIUM_IMPACT=true
ECONOMIC_CALENDAR_MAX_EVENTS=12
```

The implementation uses the same embedded economic-calendar widget data that the investingLive page loads from FXStreet. It requests the public domain token used by the widget, fetches the calendar HTML payload, parses the event table, and caches extracted events in `state/economic-calendar-cache.json`. It does not bypass CAPTCHA, login, paywalls, or anti-bot protections.

The final Discord post removes secondary rows such as detailed interest-rate projection maturities and caps repeated same-time release families so the message stays readable. Use `ECONOMIC_CALENDAR_MAX_EVENTS` to control the final maximum number of events.

Every rendered event includes:

- Actual
- Consensus
- Previous
- impact/volatility
- event type where detected

For ForexFactory, use:

```bash
ECONOMIC_CALENDAR_SOURCE_TYPE=forexfactory
ECONOMIC_CALENDAR_API_URL=https://www.forexfactory.com
```

The implementation uses ForexFactory's machine-readable weekly calendar feed at `https://nfs.faireconomy.media/ff_calendar_thisweek.json` instead of scraping the HTML calendar page. ForexFactory feed rows are normalized from `title`, `country` currency code, `date`, `impact`, `forecast`, `previous`, and optional `actual`.

For a generic JSON API, use:

```bash
ECONOMIC_CALENDAR_SOURCE_TYPE=json
ECONOMIC_CALENDAR_API_URL=https://your-provider.example/calendar
```

The generic JSON response may be an array or an object containing `events`, `data`, `calendar`, or `results`.

Normalized fields:

- event name
- country/region, with ForexFactory currency codes mapped to regions such as `USD -> US`, `EUR -> EU`, `GBP -> GB`
- currency
- date/time
- importance/impact
- forecast
- previous
- actual
- source
- URL

Events are filtered for today in `Europe/Bucharest`, configured countries, high impact by default, and important macro keywords such as CPI, PPI, PCE, NFP, GDP, PMI/ISM, central-bank decisions/speeches, crude oil inventories, and Treasury auctions.

If no calendar source is configured:

- with `POST_FALLBACK_WHEN_NO_DATA=true`, the bot posts a Romanian fallback message;
- with `POST_FALLBACK_WHEN_NO_DATA=false`, the calendar report is skipped and a warning is logged.

## Duplicate Protection

Successful posts are stored in `state/daily-reports-state.json` with keys based on report type and date. With `REPORT_DUPLICATE_GUARD_ENABLED=true`, the same report is not posted twice on the same date unless `--force` is used.

Reuters also stores the extracted article list and article hashes in `state/reuters-markets-news-cache.json`. In development, `REUTERS_MARKETS_FORCE_REPOST=true` or `--force` bypasses duplicate protection.

## Manual Runs

Post all enabled market reports and all education channels:

```bash
npm run generate-all
```

Preview without Discord:

```bash
npm run daily-reports:run -- --dry-run
```

Post both reports:

```bash
npm run daily-reports:run
```

Post one report:

```bash
npm run generate-stiri-importante
npm run generate-calendar-economic
npm run reuters-markets-report
npm run daily-market-news
npm run daily-reports:run -- --only reuters-markets
npm run daily-reports:run -- --only currents-market-news
```

Bypass duplicate protection:

```bash
npm run generate-daily-reports -- --force
npm run reuters-markets-report -- --force
npm run daily-market-news -- --force
```

Validate configuration:

```bash
npm run daily-reports:validate
```

Run tests:

```bash
npm test
```
