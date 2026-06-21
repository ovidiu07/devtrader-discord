import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import * as cheerio from "cheerio";
import type { EconomicCalendarConfig, EconomicCalendarEvent } from "./types.js";

const forexFactoryThisWeekUrl = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const investingLivePageUrl = "https://investinglive.com/EconomicCalendar";
const investingLiveCalendarEndpoint = "https://calendar.fxstreet.com/EventDateWidget/GetMain";
const fxStreetAuthorizationUrl = "https://authorization.fxstreet.com/token";
const investingLiveCountryCodes = "US,UK,EMU,DE,CN,JP";

export async function fetchEconomicCalendarEvents(config: EconomicCalendarConfig, fetchImpl: typeof fetch = fetch): Promise<EconomicCalendarEvent[]> {
  if (config.sourceType === "investinglive") {
    return fetchInvestingLiveCalendarEvents(config, fetchImpl);
  }

  if (config.sourceType === "forexfactory") {
    return fetchForexFactoryCalendarEvents(config, fetchImpl);
  }

  if (!config.apiUrl) return [];

  const response = await fetchImpl(config.apiUrl, {
    headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined
  });
  if (!response.ok) throw new Error(`Economic calendar API returned HTTP ${response.status}`);
  const payload = (await response.json()) as unknown;
  return normalizeEconomicCalendarPayload(payload);
}

export async function fetchInvestingLiveCalendarEvents(config: EconomicCalendarConfig, fetchImpl: typeof fetch = fetch): Promise<EconomicCalendarEvent[]> {
  const token = await fetchFxStreetDomainToken(fetchImpl);
  const url = new URL(investingLiveCalendarEndpoint);
  url.searchParams.set("timezone", "E. Europe Standard Time");
  url.searchParams.set("rows", "");
  url.searchParams.set("view", "current");
  url.searchParams.set("culture", "en-us");
  url.searchParams.set("countrycode", countriesForInvestingLive(config.countries));
  url.searchParams.set("volatility", config.includeMediumImpact ? "2" : "3");
  url.searchParams.set("callback", "calendarCallback");
  url.searchParams.set("authorization", `${token.token_type} ${token.access_token}`);

  const response = await fetchImpl(url, {
    headers: {
      Origin: "https://investinglive.com",
      Referer: investingLivePageUrl,
      "User-Agent": "Mozilla/5.0"
    }
  });
  if (!response.ok) throw new Error(`investingLive calendar widget returned HTTP ${response.status}`);
  const jsonp = await response.text();
  const html = extractJsonpHtml(jsonp);
  const events = parseInvestingLiveCalendarHtml(html, new Date());
  await writeEconomicCalendarCache("investinglive", events);
  return events;
}

export async function fetchForexFactoryCalendarEvents(config: EconomicCalendarConfig, fetchImpl: typeof fetch = fetch): Promise<EconomicCalendarEvent[]> {
  const url = normalizeForexFactoryUrl(config.apiUrl);
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`ForexFactory calendar feed returned HTTP ${response.status}`);
  const payload = (await response.json()) as unknown;
  return normalizeForexFactoryCalendarPayload(payload);
}

export function parseInvestingLiveCalendarHtml(html: string, now = new Date()): EconomicCalendarEvent[] {
  const $ = cheerio.load(html);
  const timezoneLabel = cleanText($("#fxst-thtime").text()) || "GMT+3";
  const offset = offsetFromTimezoneLabel(timezoneLabel);
  let currentDate = "";
  const events: EconomicCalendarEvent[] = [];

  $("#fxst-calendartable tbody tr").each((_, row) => {
    const item = $(row);
    if (item.hasClass("fxst-dateRow")) {
      currentDate = parseInvestingLiveDate(cleanText(item.text()), now);
      return;
    }
    if (!item.hasClass("fxit-eventrow") || !currentDate) return;

    const cells = item.children("td");
    const time = cleanText($(cells[0]).text());
    const code = cleanText($(cells[1]).text());
    const countryName = cleanText(item.attr("data-countryname") ?? code);
    const eventName = cleanText($(cells[2]).text());
    const volatility = cleanText($(cells[3]).text());
    if (!time || !eventName) return;

    events.push({
      eventName,
      country: countryFromInvestingLive(code, countryName),
      currency: code,
      dateTime: parseInvestingLiveDateTime(currentDate, time, offset),
      importance: importanceFromVolatility(volatility),
      impact: `Vol. ${volatility || "N/A"}`,
      actual: emptyAsNa($(cells[4]).text()),
      consensus: emptyAsNa($(cells[5]).text()),
      forecast: emptyAsNa($(cells[5]).text()),
      previous: emptyAsNa($(cells[6]).text()),
      eventType: eventTypeFromName(eventName),
      source: "investingLive Economic Calendar",
      url: investingLivePageUrl,
      sourceUrl: investingLivePageUrl
    });
  });

  return events;
}

export function normalizeForexFactoryCalendarPayload(payload: unknown): EconomicCalendarEvent[] {
  if (!Array.isArray(payload)) return [];
  return payload.map(normalizeForexFactoryEvent).filter((event): event is EconomicCalendarEvent => Boolean(event));
}

export function normalizeEconomicCalendarPayload(payload: unknown): EconomicCalendarEvent[] {
  const rows = extractRows(payload);
  return rows.map(normalizeEconomicEvent).filter((event): event is EconomicCalendarEvent => Boolean(event));
}

function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const object = payload as Record<string, unknown>;
  for (const key of ["events", "data", "calendar", "results"]) {
    if (Array.isArray(object?.[key])) return object[key];
  }
  return [];
}

function normalizeEconomicEvent(value: unknown): EconomicCalendarEvent | undefined {
  const row = value as Record<string, unknown>;
  const eventName = text(row.eventName ?? row.event ?? row.name ?? row.title);
  const country = text(row.country ?? row.region ?? row.countryCode ?? row.zone);
  const dateValue = text(row.dateTime ?? row.datetime ?? row.date ?? row.time ?? row.timestamp);
  const dateTime = parseDate(dateValue);
  if (!eventName || !country || !dateTime) return undefined;

  return {
    eventName,
    country,
    currency: text(row.currency),
    dateTime,
    importance: normalizeImportance(text(row.importance ?? row.impact ?? row.priority)),
    forecast: optionalText(row.forecast ?? row.consensus),
    consensus: optionalText(row.consensus ?? row.forecast),
    previous: optionalText(row.previous ?? row.prior),
    actual: optionalText(row.actual),
    eventType: optionalText(row.eventType ?? row.type),
    source: text(row.source) || "Calendar economic",
    url: optionalText(row.url ?? row.link),
    sourceUrl: optionalText(row.sourceUrl ?? row.url ?? row.link)
  };
}

function normalizeForexFactoryEvent(value: unknown): EconomicCalendarEvent | undefined {
  const row = value as Record<string, unknown>;
  const eventName = text(row.title);
  const currency = text(row.country);
  const dateTime = parseDate(text(row.date));
  if (!eventName || !currency || !dateTime) return undefined;

  return {
    eventName,
    country: countryFromCurrency(currency),
    currency,
    dateTime,
    importance: normalizeImportance(text(row.impact)),
    impact: `Vol. ${volatilityFromImportance(text(row.impact))}`,
    forecast: optionalText(row.forecast),
    consensus: optionalText(row.forecast),
    previous: optionalText(row.previous),
    actual: optionalText(row.actual),
    eventType: eventTypeFromName(eventName),
    source: "ForexFactory",
    url: "https://www.forexfactory.com/calendar",
    sourceUrl: "https://www.forexfactory.com/calendar"
  };
}

async function fetchFxStreetDomainToken(fetchImpl: typeof fetch): Promise<{ token_type: string; access_token: string }> {
  const response = await fetchImpl(fxStreetAuthorizationUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://investinglive.com",
      Referer: investingLivePageUrl
    },
    body: new URLSearchParams({ grant_type: "domain", client_id: "client_id" })
  });
  if (!response.ok) throw new Error(`FXStreet authorization returned HTTP ${response.status}`);
  const token = (await response.json()) as { token_type?: string; access_token?: string; error?: string; error_description?: string };
  if (!token.token_type || !token.access_token) {
    throw new Error(token.error_description || token.error || "FXStreet authorization did not return a token.");
  }
  return { token_type: token.token_type, access_token: token.access_token };
}

function extractJsonpHtml(jsonp: string): string {
  const start = jsonp.indexOf("(");
  const end = jsonp.lastIndexOf(")");
  if (start === -1 || end === -1 || end <= start) throw new Error("Invalid investingLive calendar JSONP response.");
  const parsed = JSON.parse(jsonp.slice(start + 1, end)) as { Html?: string };
  if (!parsed.Html) throw new Error("investingLive calendar response did not include Html.");
  return parsed.Html;
}

function countriesForInvestingLive(countries: string[]): string {
  if (countries.length === 0) return investingLiveCountryCodes;
  const aliases: Record<string, string> = { GB: "UK", EU: "EMU" };
  return countries.map((country) => aliases[country.toUpperCase()] ?? country.toUpperCase()).join(",");
}

function parseInvestingLiveDate(value: string, now: Date): string {
  const match = value.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) return now.toISOString().slice(0, 10);
  const month = monthIndex(match[1]);
  const day = Number(match[2]);
  const year = now.getUTCFullYear();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseInvestingLiveDateTime(date: string, time: string, offset: string): Date {
  return new Date(`${date}T${time.padStart(5, "0")}:00${offset}`);
}

function offsetFromTimezoneLabel(value: string): string {
  const match = value.match(/GMT([+-])(\d{1,2})/i);
  if (!match) return "+03:00";
  return `${match[1]}${match[2].padStart(2, "0")}:00`;
}

function monthIndex(value: string): number {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const index = months.indexOf(value.slice(0, 3).toLowerCase());
  return index === -1 ? new Date().getUTCMonth() : index;
}

function countryFromInvestingLive(code: string, name: string): string {
  const normalized = code.toUpperCase();
  const map: Record<string, string> = {
    US: "US",
    UK: "GB",
    EMU: "EU",
    DE: "DE",
    CN: "CN",
    JP: "JP"
  };
  return map[normalized] ?? countryFromName(name) ?? normalized;
}

function countryFromName(name: string): string | undefined {
  const normalized = name.toLowerCase();
  if (normalized.includes("united states")) return "US";
  if (normalized.includes("united kingdom")) return "GB";
  if (normalized.includes("euro")) return "EU";
  if (normalized.includes("germany")) return "DE";
  if (normalized.includes("china")) return "CN";
  if (normalized.includes("japan")) return "JP";
  return undefined;
}

function importanceFromVolatility(value: string): "low" | "medium" | "high" | string {
  if (value === "3") return "high";
  if (value === "2") return "medium";
  if (value === "1") return "low";
  return value || "unknown";
}

function volatilityFromImportance(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === "high") return "3";
  if (normalized === "medium") return "2";
  if (normalized === "low") return "1";
  return "N/A";
}

function eventTypeFromName(eventName: string): string | undefined {
  const value = eventName.toLowerCase();
  if (/(speaks|speech|testifies|press conference)/i.test(value)) return "Speech";
  if (/(cpi|ppi|pce|payroll|jobless|retail sales|gdp|pmi|ism|rate decision|auction|inventories|production|confidence|sentiment)/i.test(value)) return "Report";
  return undefined;
}

async function writeEconomicCalendarCache(sourceType: string, events: EconomicCalendarEvent[]) {
  const path = "state/economic-calendar-cache.json";
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(
      {
        sourceType,
        fetchedAt: new Date().toISOString(),
        events: events.map((event) => ({ ...event, dateTime: event.dateTime.toISOString() }))
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function normalizeForexFactoryUrl(value: string | undefined): string {
  if (!value) return forexFactoryThisWeekUrl;
  try {
    const parsed = new URL(value);
    if (parsed.hostname === "www.forexfactory.com" || parsed.hostname === "forexfactory.com") {
      return forexFactoryThisWeekUrl;
    }
  } catch {
    // Fall through and let fetch report the invalid URL.
  }
  return value;
}

function countryFromCurrency(currency: string): string {
  const normalized = currency.toUpperCase();
  const map: Record<string, string> = {
    USD: "US",
    EUR: "EU",
    GBP: "GB",
    JPY: "JP",
    CAD: "CA",
    AUD: "AU",
    NZD: "NZ",
    CHF: "CH",
    CNY: "CN",
    ALL: "ALL"
  };
  return map[normalized] ?? normalized;
}

function emptyAsNa(value: unknown): string {
  const result = text(value);
  return result || "N/A";
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeImportance(value: string): "low" | "medium" | "high" | string {
  const normalized = value.toLowerCase();
  if (["3", "high", "important", "ridicat"].includes(normalized)) return "high";
  if (["2", "medium", "mediu"].includes(normalized)) return "medium";
  if (["1", "low", "scăzut", "scazut"].includes(normalized)) return "low";
  return normalized || "unknown";
}

function optionalText(value: unknown): string | undefined {
  const result = text(value);
  return result || undefined;
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}
