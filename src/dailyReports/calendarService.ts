import { formatRomanianDate, formatRomanianTime, todayInReportTimezone } from "./date.js";
import { economicEventKeywords, economicImpactRo } from "./calendarRules.js";
import type { DailyReportConfig, EconomicCalendarEvent, EconomicEventType, EnrichedEconomicCalendarEvent } from "./types.js";

export function buildEconomicCalendarReport(args: { date: string; timezone: string; events: EconomicCalendarEvent[]; config: DailyReportConfig }): string {
  const dateRo = formatRomanianDate(args.date, args.timezone);

  if (args.config.calendar.sourceType !== "forexfactory" && !args.config.calendar.apiUrl && args.config.postFallbackWhenNoData) {
    return [
      `CALENDAR ECONOMIC — ${dateRo}`,
      "",
      "Nu există încă o sursă de calendar economic configurată pentru automatizare.",
      "",
      "Configurează ECONOMIC_CALENDAR_API_URL și, dacă este necesar, ECONOMIC_CALENDAR_API_KEY.",
      "",
      "Până atunci, verifică manual evenimentele importante ale zilei: CPI, PPI, NFP, decizii Fed/ECB/BoE, PMI/ISM, Retail Sales și stocurile de petrol.",
      "",
      "Conținut educațional. Nu reprezintă recomandare financiară."
    ].join("\n");
  }

  const selected = selectImportantEconomicEvents(args.events, args.config, args.date);
  if (selected.length === 0) {
    return [
      `CALENDAR ECONOMIC — ${dateRo}`,
      "",
      "Nu sunt evenimente macro majore filtrate pentru astăzi.",
      "",
      "Atenție totuși la știri neprogramate, geopolitică și reacția pieței la nivelurile tehnice.",
      "",
      sourceFooter(args.config)
    ].join("\n");
  }

  return [
    `CALENDAR ECONOMIC — ${dateRo}`,
    `Ore afișate: ${args.timezone}`,
    "",
    "Evenimente importante pentru traderi:",
    "",
    selected
      .map(renderCalendarEvent)
      .join("\n\n"),
    "",
    sourceFooter(args.config),
    "",
    "Conținut educațional. Nu reprezintă recomandare financiară."
  ].join("\n");
}

export function selectImportantEconomicEvents(events: EconomicCalendarEvent[], config: DailyReportConfig, date: string): EnrichedEconomicCalendarEvent[] {
  const selected = events
    .filter((event) => todayInReportTimezone(config.timezone, event.dateTime) === date)
    .filter((event) => matchesConfiguredCountry(event, config.calendar.countries))
    .map((event) => enrichEconomicEvent(event, config.timezone))
    .filter((event) => isImportantEvent(event, config))
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

  return pruneCalendarNoise(selected).slice(0, config.calendar.maxEvents);
}

function matchesConfiguredCountry(event: EconomicCalendarEvent, countries: string[]): boolean {
  if (countries.length === 0) return true;
  const allowed = new Set(countries.flatMap(countryAliases));
  return countryAliases(event.country).some((country) => allowed.has(country)) || Boolean(event.currency && countryAliases(event.currency).some((country) => allowed.has(country)));
}

function countryAliases(value: string): string[] {
  const normalized = value.toUpperCase();
  const aliases: Record<string, string[]> = {
    EU: ["EU", "EMU", "EUR"],
    EMU: ["EU", "EMU", "EUR"],
    EUR: ["EU", "EMU", "EUR"],
    GB: ["GB", "UK", "GBP"],
    UK: ["GB", "UK", "GBP"],
    GBP: ["GB", "UK", "GBP"],
    US: ["US", "USD"],
    USD: ["US", "USD"],
    DE: ["DE", "GERMANY"],
    CN: ["CN", "CNY", "CHINA"],
    JP: ["JP", "JPY", "JAPAN"]
  };
  return aliases[normalized] ?? [normalized];
}

export function enrichEconomicEvent(event: EconomicCalendarEvent, timezone = "Europe/Bucharest"): EnrichedEconomicCalendarEvent {
  const eventType = classifyEconomicEvent(event.eventName);
  const impact = economicImpactRo[eventType];
  return {
    ...event,
    eventType,
    impactRo: impact.why,
    affectedMarkets: impact.markets,
    timeRo: formatRomanianTime(event.dateTime, timezone)
  };
}

export function classifyEconomicEvent(eventName: string): EconomicEventType {
  const haystack = eventName.toLowerCase();
  for (const [type, keywords] of Object.entries(economicEventKeywords) as [EconomicEventType, string[]][]) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return type;
  }
  return "OTHER_IMPORTANT";
}

function isImportantEvent(event: EnrichedEconomicCalendarEvent, config: DailyReportConfig): boolean {
  if (meetsMinimumImportance(event.importance, config.calendar.minImportance)) {
    if (event.importance === "medium" && !config.calendar.includeMediumImpact && config.calendar.minImportance === "high") return false;
    return true;
  }
  return event.eventType !== "OTHER_IMPORTANT";
}

function meetsMinimumImportance(value: string, minimum: "high" | "medium" | "low"): boolean {
  const order: Record<string, number> = { low: 1, medium: 2, high: 3 };
  return (order[value] ?? 0) >= order[minimum];
}

function impactRo(value: string): string {
  if (value === "high") return "ridicat";
  if (value === "medium") return "mediu";
  if (value === "low") return "scăzut";
  return value || "n/a";
}

function pruneCalendarNoise(events: EnrichedEconomicCalendarEvent[]): EnrichedEconomicCalendarEvent[] {
  const counts = new Map<string, number>();
  const result: EnrichedEconomicCalendarEvent[] = [];

  for (const event of events) {
    if (isSecondaryProjectionRow(event.eventName)) continue;
    const key = `${event.timeRo}|${event.country}|${eventFamily(event.eventName)}`;
    const limit = event.importance === "high" ? 4 : 2;
    const count = counts.get(key) ?? 0;
    if (count >= limit) continue;
    counts.set(key, count + 1);
    result.push(event);
  }

  return result;
}

function isSecondaryProjectionRow(eventName: string): boolean {
  return /^interest rate projections\s+-/i.test(eventName);
}

function eventFamily(eventName: string): string {
  const value = eventName.toLowerCase();
  if (/(fomc|fed|federal funds|interest rate|monetary policy)/.test(value)) return "rates";
  if (/(ppi|producer price)/.test(value)) return "ppi";
  if (/(cpi|consumer prices|harmonized index)/.test(value)) return "cpi";
  if (/retail sales/.test(value)) return "retail-sales";
  if (/(pmi|ism)/.test(value)) return "pmi-ism";
  if (/(jobless|payroll|unemployment|labor|earnings)/.test(value)) return "labor";
  if (/(oil|energy|inventories|crude)/.test(value)) return "energy";
  return value.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

function impactLabel(event: EnrichedEconomicCalendarEvent): string {
  if (event.impact?.startsWith("Vol.")) return event.impact;
  if (event.importance === "high") return "Vol. 3";
  if (event.importance === "medium") return "Vol. 2";
  if (event.importance === "low") return "Vol. 1";
  return event.impact || impactRo(event.importance);
}

function valueOrNa(value: string | undefined): string {
  return value && value.trim() && value.trim() !== "N/A" ? value : "Nepublicat";
}

function countryRo(value: string): string {
  const map: Record<string, string> = {
    US: "SUA",
    GB: "Regatul Unit",
    UK: "Regatul Unit",
    EU: "Zona Euro",
    EMU: "Zona Euro",
    DE: "Germania",
    CN: "China",
    JP: "Japonia"
  };
  return map[value.toUpperCase()] ?? value;
}

function watchText(eventType: string | undefined, eventName: string): string {
  const value = `${eventType ?? ""} ${eventName}`.toLowerCase();
  if (/(cpi|ppi|pce|inflation)/.test(value)) return "poate influența inflația, dobânzile, USD, indicii și aurul.";
  if (/(speech|speaks|testifies|press conference)/.test(value)) return "poate crește volatilitatea dacă apar comentarii hawkish sau dovish.";
  if (/(fed|fomc|ecb|boe|rate decision|federal funds|interest rate|policy rate|cash rate)/.test(value)) return "poate crește volatilitatea pe dobânzi, valută, indici și randamente.";
  if (/retail sales/.test(value)) return "poate influența consumul, USD și indicii.";
  if (/(gdp|gross domestic product)/.test(value)) return "poate influența perspectiva de creștere economică, valuta și indicii.";
  if (/(pmi|ism)/.test(value)) return "merită urmărit pentru sentimentul economic și reacția indicilor.";
  if (/(jobless|nfp|payroll|unemployment|labor|earnings)/.test(value)) return "poate influența așteptările pentru Fed, USD și Nasdaq.";
  if (/(oil|energy|inventories|eia|crude)/.test(value)) return "poate influența petrolul, inflația, CAD și sectorul energetic.";
  if (/(auction|bond|treasury)/.test(value)) return "poate influența randamentele, USD și indicii.";
  return "merită urmărit pentru reacția pieței, fără a presupune o mișcare garantată.";
}

function displayEventType(eventName: string): string {
  const value = eventName.toLowerCase();
  if (/(speaks|speech|testifies|press conference)/.test(value)) return "Speech";
  if (/(cpi|ppi|pce|consumer price|producer price|harmonized index|payroll|jobless|retail sales|gdp|pmi|ism|rate decision|fomc|federal funds|interest rate|monetary policy|auction|inventories|production|confidence|sentiment)/.test(value)) return "Report";
  return "N/A";
}

function renderCalendarEvent(event: EnrichedEconomicCalendarEvent): string {
  const type = displayEventType(event.eventName);
  const lines = [
    `**${event.timeRo} — ${countryRo(event.country)} — ${event.eventName}**`,
    `Impact: ${styledImpactLabel(event)}`,
    `Tip: ${type}`
  ];

  if (type !== "Speech") {
    lines.push(`Actual: ${valueOrNa(event.actual)}`, `Consensus: ${valueOrNa(event.consensus ?? event.forecast)}`, `Previous: ${valueOrNa(event.previous)}`);
  }

  lines.push(`De urmărit: ${watchText(event.eventType, event.eventName)}`);
  return lines.join("\n");
}

function styledImpactLabel(event: EnrichedEconomicCalendarEvent): string {
  const label = impactLabel(event);
  if (label.includes("3")) return "🔴 **Vol. 3**";
  if (label.includes("2")) return "🟠 **Vol. 2**";
  if (label.includes("1")) return "🟢 **Vol. 1**";
  return `**${label}**`;
}

function sourceFooter(config: DailyReportConfig): string {
  if (config.calendar.sourceType === "investinglive") {
    return ["Sursă: investingLive Economic Calendar", "Link: https://investinglive.com/EconomicCalendar"].join("\n");
  }
  if (config.calendar.sourceType === "forexfactory") {
    return ["Sursă: ForexFactory Calendar", "Link: https://www.forexfactory.com/calendar"].join("\n");
  }
  return ["Sursă: Calendar economic configurat", `Link: ${config.calendar.apiUrl ?? "N/A"}`].join("\n");
}
