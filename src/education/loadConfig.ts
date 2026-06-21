import { access, readFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import { z } from "zod";
import type { EducationCalendar, EducationContentBank, EducationScheduleConfig, EducationValidationIssue } from "./types.js";

const keySchema = z.string().regex(/^[a-z0-9_]+$/);
const timeSchema = z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/);

const scheduleSchema = z.object({
  timezone: z.string().default("Europe/Bucharest"),
  enabled: z.boolean().default(true),
  defaultNoRepeatDays: z.number().int().min(0).default(45),
  channels: z.array(
    z.object({
      channelKey: keySchema,
      enabled: z.boolean().default(true),
      dailyTime: timeSchema,
      contentCategory: keySchema,
      skip: z.boolean().optional(),
      noRepeatDays: z.number().int().min(0).optional()
    })
  )
});

const postSchema = z.object({
  key: keySchema,
  category: keySchema,
  weekdayType: z.enum(["concept", "mistake", "exercise", "reflection", "case_study", "recap", "preparation"]),
  difficulty: z.enum(["beginner", "intermediate"]).default("beginner"),
  title: z.string().min(1),
  body: z.string().min(1),
  practical: z.string().optional(),
  question: z.string().min(1),
  disclaimer: z.string().optional()
});

const contentBankSchema = z.object({
  posts: z.array(postSchema)
});

const calendarSchema = z.object({
  days: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        posts: z.array(z.object({ channelKey: keySchema, postKey: keySchema }))
      })
    )
    .default([])
});

export async function loadEducationSchedule(path = "config/education-daily-schedule.yml"): Promise<EducationScheduleConfig> {
  return parseYamlWithSchema(path, scheduleSchema);
}

export async function loadEducationContentBank(path = "config/education-content-bank.yml"): Promise<EducationContentBank> {
  return parseYamlWithSchema(path, contentBankSchema);
}

export async function loadEducationCalendar(path = "config/education-calendar.yml"): Promise<EducationCalendar> {
  try {
    await access(path);
  } catch {
    return { days: [] };
  }
  return parseYamlWithSchema(path, calendarSchema);
}

export async function validateEducationYamlShape(): Promise<EducationValidationIssue[]> {
  const issues: EducationValidationIssue[] = [];
  await collectShapeIssues("config/education-daily-schedule.yml", scheduleSchema, issues);
  await collectShapeIssues("config/education-content-bank.yml", contentBankSchema, issues);
  try {
    await access("config/education-calendar.yml");
    await collectShapeIssues("config/education-calendar.yml", calendarSchema, issues);
  } catch {
    // Calendar is optional.
  }
  return issues;
}

async function collectShapeIssues(path: string, schema: z.ZodType, issues: EducationValidationIssue[]) {
  try {
    await parseYamlWithSchema(path, schema);
  } catch (error) {
    issues.push({ level: "error", path, message: error instanceof Error ? error.message : String(error) });
  }
}

async function parseYamlWithSchema<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const source = await readFile(path, "utf8");
  const doc = parseDocument(source, { prettyErrors: true, uniqueKeys: true });
  if (doc.errors.length > 0) {
    throw new Error(doc.errors.map((error) => error.message).join("\n"));
  }

  const parsed = schema.safeParse(doc.toJS());
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("\n"));
  }
  return parsed.data;
}
