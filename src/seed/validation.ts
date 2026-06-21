import type { Blueprint, ChannelBlueprint } from "../config/schema.js";
import { renderSeedPayload } from "./renderSeedMessage.js";
import type { SeedConfig, SeedMessageConfig, SeedValidationIssue } from "./types.js";

const tradingTopicChannels = new Set([
  "bazele_tradingului",
  "managementul_riscului",
  "macroeconomie",
  "stiri_importante",
  "calendar_economic",
  "analiza_zilei",
  "discutii_grafice",
  "analize_premium",
  "setup_uri_discutate",
  "sesiuni_live",
  "trading_room"
]);

const tradingWords = /\b(trading|trade|setup|grafic|analiz|macroeconom|știr|stiri|calendar economic|premium|piaț|piat|risc|risk|bullish|bearish)\b/i;
const disclaimerWords = /(educațional|educational|nu reprezintă|nu reprezinta|consultanță financiară|consultanta financiara|recomandare de cumpărare|recomandare de vânzare|semnale garantate|implică risc|implica risc)/i;
const romanianSignals = /\b(și|sau|pentru|este|sunt|acest|această|comunitate|învăț|invăț|risc|piață|piata|membri|întrebări|intrebari|folosește|foloseste|te rog|conținut|continut)\b/i;
const englishSentenceSignals = /\b(the|this|that|with|without|members|channel|community|financial advice|guaranteed profit|get rich|signal service)\b/i;
const unsafePromiseSignals = /(profit garantat în|profit garantat in|sigur crește acum|sigur creste acum|get rich|luxury trading)/i;

export function validateSeedConfig(config: SeedConfig, blueprint: Blueprint, options: { strict?: boolean } = {}): SeedValidationIssue[] {
  const issues: SeedValidationIssue[] = [];
  const channelLookup = blueprintChannelLookup(blueprint);
  const seenKeys = new Set<string>();

  for (const [index, seed] of config.messages.entries()) {
    const path = `messages.${index}`;
    if (seenKeys.has(seed.key)) {
      issues.push({ level: "error", path: `${path}.key`, message: `Duplicate seed message key "${seed.key}".` });
    }
    seenKeys.add(seed.key);

    const channel = channelLookup.get(seed.channelKey);
    if (!channel) {
      issues.push({
        level: options.strict ? "error" : "warning",
        path: `${path}.channelKey`,
        message: `Seed message references missing channel "${seed.channelKey}".`
      });
    } else if (channel.type === "voice") {
      issues.push({
        level: "warning",
        path: `${path}.channelKey`,
        message: `Channel "${seed.channelKey}" is voice; no seed message will be posted unless a linked text channel is added later.`
      });
    }

    validateMessageLimits(seed, path, issues);
    validateRomanianText(seed, path, issues);
    validateDisclaimer(seed, path, issues);
    validateResponsibleTone(seed, path, issues);
  }

  return issues;
}

export function blueprintChannelLookup(blueprint: Blueprint): Map<string, ChannelBlueprint> {
  const channels = new Map<string, ChannelBlueprint>();
  for (const category of blueprint.categories) {
    for (const channel of category.channels) {
      channels.set(channel.key, channel);
    }
  }
  return channels;
}

function validateMessageLimits(seed: SeedMessageConfig, path: string, issues: SeedValidationIssue[]) {
  const payload = renderSeedPayload(seed);
  if ((payload.content?.length ?? 0) > 2000) {
    issues.push({ level: "error", path: `${path}.content`, message: "Discord message content exceeds 2000 characters." });
  }

  const embed = payload.embeds?.[0];
  if (!embed) return;

  if ((embed.title?.length ?? 0) > 256) {
    issues.push({ level: "error", path: `${path}.embed.title`, message: "Discord embed title exceeds 256 characters." });
  }
  if ((embed.description?.length ?? 0) > 4096) {
    issues.push({ level: "error", path: `${path}.embed.description`, message: "Discord embed description exceeds 4096 characters." });
  }
  if ((embed.footer?.text.length ?? 0) > 2048) {
    issues.push({ level: "error", path: `${path}.embed.footer`, message: "Discord embed footer exceeds 2048 characters." });
  }

  const total = (embed.title?.length ?? 0) + (embed.description?.length ?? 0) + (embed.footer?.text.length ?? 0);
  if (total > 6000) {
    issues.push({ level: "error", path: `${path}.embed`, message: "Discord embed total visible text exceeds 6000 characters." });
  }
}

function validateRomanianText(seed: SeedMessageConfig, path: string, issues: SeedValidationIssue[]) {
  const text = visibleText(seed);
  if (!romanianSignals.test(text) || englishSentenceSignals.test(text)) {
    issues.push({ level: "error", path, message: "Visible seed message text must be Romanian." });
  }
}

function validateDisclaimer(seed: SeedMessageConfig, path: string, issues: SeedValidationIssue[]) {
  const text = visibleText(seed);
  if ((tradingTopicChannels.has(seed.channelKey) || tradingWords.test(text)) && !disclaimerWords.test(text)) {
    issues.push({
      level: "error",
      path,
      message: "Trading-related seed messages need a clear educational disclaimer."
    });
  }
}

function validateResponsibleTone(seed: SeedMessageConfig, path: string, issues: SeedValidationIssue[]) {
  const text = visibleText(seed);
  if (unsafePromiseSignals.test(text)) {
    issues.push({
      level: "error",
      path,
      message: "Seed message contains language that could imply hype, urgency, or guaranteed profit."
    });
  }
}

function visibleText(seed: SeedMessageConfig): string {
  const payload = renderSeedPayload(seed);
  return [payload.content, ...(payload.embeds ?? []).flatMap((embed) => [embed.title, embed.description, embed.footer?.text])].filter(Boolean).join("\n");
}
