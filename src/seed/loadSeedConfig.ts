import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import { z } from "zod";
import { romanianDisclaimers } from "./disclaimers.js";
import type { SeedConfig, SeedValidationIssue } from "./types.js";

const keySchema = z.string().regex(/^[a-z0-9_]+$/);
const disclaimerKeys = Object.keys(romanianDisclaimers) as [keyof typeof romanianDisclaimers, ...(keyof typeof romanianDisclaimers)[]];

const seedEmbedSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  footer: z.string().optional(),
  color: z.number().int().min(0).max(0xffffff).optional()
});

const seedMessageSchema = z
  .object({
    key: keySchema,
    channelKey: keySchema,
    pin: z.boolean().default(true),
    mode: z.enum(["plain", "embed"]).default("embed"),
    content: z.string().optional(),
    embed: seedEmbedSchema.optional(),
    disclaimers: z.array(z.enum(disclaimerKeys)).default([])
  })
  .superRefine((message, context) => {
    if (message.mode === "embed" && !message.embed) {
      context.addIssue({ code: "custom", path: ["embed"], message: "Embed mode requires an embed object." });
    }
    if (message.mode === "plain" && !message.content) {
      context.addIssue({ code: "custom", path: ["content"], message: "Plain mode requires content." });
    }
  });

const seedConfigSchema = z.object({
  messages: z.array(seedMessageSchema).default([])
});

export async function loadSeedConfig(path = "config/seed-messages.yml"): Promise<SeedConfig> {
  const result = await validateSeedConfigShape(path);
  if (result.issues.length > 0 || !result.config) {
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }
  return result.config;
}

export async function validateSeedConfigShape(path = "config/seed-messages.yml"): Promise<{ config?: SeedConfig; issues: SeedValidationIssue[] }> {
  const source = await readFile(path, "utf8");
  const doc = parseDocument(source, { prettyErrors: true, uniqueKeys: true });

  if (doc.errors.length > 0) {
    return {
      issues: doc.errors.map((error) => ({
        level: "error",
        path,
        message: error.message
      }))
    };
  }

  const parsed = seedConfigSchema.safeParse(doc.toJS());
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => ({
        level: "error",
        path: issue.path.join(".") || "seed",
        message: issue.message
      }))
    };
  }

  return { config: parsed.data, issues: [] };
}
