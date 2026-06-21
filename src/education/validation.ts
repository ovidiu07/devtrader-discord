import type { Blueprint } from "../config/schema.js";
import { blueprintChannelLookup } from "../seed/validation.js";
import type { EducationContentBank, EducationScheduleConfig, EducationValidationIssue } from "./types.js";

const romanianSignals = /\b(și|sau|pentru|este|sunt|acest|această|trading|risc|piață|piata|întrebare|intrebare|educațional|educational|aplică|aplica|învață|invata|conceptul|regula|exercițiul|exercitiul|disciplina|macro|de ce|cum|ce)\b/i;
const englishSignals = /\b(the|this|that|with|without|financial advice|guaranteed|buy now|sell now|signal)\b/i;
const disclaimerSignals = /(educațional|educational|nu reprezintă|nu reprezinta|consultanță financiară|consultanta financiara|tradingul implică risc|studiu|exercițiu educațional|exercitiu educational|semnale garantate)/i;
const forbiddenPhrases = [
  "profit garantat",
  "sigur crește",
  "sigur creste",
  "sigur scade",
  "intră acum",
  "intra acum",
  "semnal garantat",
  "cumpără acum",
  "cumpara acum",
  "vinde acum",
  "bani rapizi",
  "îmbogățire rapidă",
  "imbogatire rapida"
];
const adviceSignals = /(trebuie să cumperi|trebuie sa cumperi|trebuie să vinzi|trebuie sa vinzi|îți recomand să cumperi|iti recomand sa cumperi|îți recomand să vinzi|iti recomand sa vinzi|intră long|intra long|intră short|intra short)/i;

export function validateEducationConfig(schedule: EducationScheduleConfig, bank: EducationContentBank, blueprint: Blueprint): EducationValidationIssue[] {
  const issues: EducationValidationIssue[] = [];
  const channels = blueprintChannelLookup(blueprint);
  const postKeys = new Set<string>();
  const scheduleKeys = new Set<string>();

  if (schedule.timezone !== "Europe/Bucharest") {
    issues.push({ level: "error", path: "schedule.timezone", message: "Education schedule must use Europe/Bucharest." });
  }

  for (const [index, channel] of schedule.channels.entries()) {
    const path = `schedule.channels.${index}`;
    if (scheduleKeys.has(channel.channelKey)) {
      issues.push({ level: "error", path: `${path}.channelKey`, message: `Duplicate schedule channel "${channel.channelKey}".` });
    }
    scheduleKeys.add(channel.channelKey);

    const blueprintChannel = channels.get(channel.channelKey);
    if (!blueprintChannel) {
      issues.push({ level: "error", path: `${path}.channelKey`, message: `Unknown channel reference "${channel.channelKey}".` });
    } else if (blueprintChannel.type !== "text" && blueprintChannel.type !== "announcement") {
      issues.push({ level: "error", path: `${path}.channelKey`, message: `Channel "${channel.channelKey}" is not a text channel.` });
    }
  }

  for (const [index, post] of bank.posts.entries()) {
    const path = `posts.${index}`;
    if (postKeys.has(post.key)) {
      issues.push({ level: "error", path: `${path}.key`, message: `Duplicate post key "${post.key}".` });
    }
    postKeys.add(post.key);

    if (!post.title.trim()) issues.push({ level: "error", path: `${path}.title`, message: "Post title is required." });
    if (!post.body.trim()) issues.push({ level: "error", path: `${path}.body`, message: "Post body is required." });
    if (!schedule.channels.some((channel) => channel.contentCategory === post.category)) {
      issues.push({ level: "warning", path: `${path}.category`, message: `Post category "${post.category}" is not used by the schedule.` });
    }

    validateVisibleRomanian([post.title, post.body, post.practical, post.question, post.disclaimer].filter(Boolean).join("\n"), path, issues);
    validateLimits(post, path, issues);
    validateForbiddenLanguage(post, path, issues);
    if (!post.disclaimer || !disclaimerSignals.test(post.disclaimer)) {
      issues.push({ level: "error", path: `${path}.disclaimer`, message: "Trading-related education posts need a clear educational disclaimer." });
    }
  }

  for (const channel of schedule.channels) {
    const count = bank.posts.filter((post) => post.category === channel.contentCategory).length;
    if (count < 30) {
      issues.push({ level: "error", path: `posts.${channel.contentCategory}`, message: `Category "${channel.contentCategory}" needs at least 30 posts; found ${count}.` });
    }
  }

  return issues;
}

function validateVisibleRomanian(text: string, path: string, issues: EducationValidationIssue[]) {
  if (!romanianSignals.test(text) || englishSignals.test(text)) {
    issues.push({ level: "error", path, message: "Visible education content must be Romanian." });
  }
}

function validateLimits(post: { title: string; body: string; practical?: string; question: string; disclaimer?: string }, path: string, issues: EducationValidationIssue[]) {
  if (post.title.length > 256) issues.push({ level: "error", path: `${path}.title`, message: "Discord embed title exceeds 256 characters." });
  if (post.body.length > 4096) issues.push({ level: "error", path: `${path}.body`, message: "Discord embed description exceeds 4096 characters." });
  for (const [field, value] of [
    ["practical", post.practical],
    ["question", post.question]
  ] as const) {
    if ((value?.length ?? 0) > 1024) issues.push({ level: "error", path: `${path}.${field}`, message: "Discord embed field exceeds 1024 characters." });
  }
  if ((post.disclaimer?.length ?? 0) > 2048) issues.push({ level: "error", path: `${path}.disclaimer`, message: "Discord embed footer exceeds 2048 characters." });
  const total = post.title.length + post.body.length + (post.practical?.length ?? 0) + post.question.length + (post.disclaimer?.length ?? 0);
  if (total > 6000) issues.push({ level: "error", path, message: "Discord embed total visible text exceeds 6000 characters." });
}

function validateForbiddenLanguage(post: { title: string; body: string; practical?: string; question: string; disclaimer?: string }, path: string, issues: EducationValidationIssue[]) {
  const text = [post.title, post.body, post.practical, post.question, post.disclaimer].filter(Boolean).join("\n").toLowerCase();
  for (const phrase of forbiddenPhrases) {
    if (text.includes(phrase)) {
      issues.push({ level: "error", path, message: `Forbidden phrase detected: "${phrase}".` });
    }
  }
  if (adviceSignals.test(text)) {
    issues.push({ level: "error", path, message: "Post appears to give direct personalized financial advice or a trade instruction." });
  }
}
