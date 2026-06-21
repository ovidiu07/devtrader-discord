import { z } from "zod";

export const permissionNames = [
  "View Channels",
  "Send Messages",
  "Manage Messages",
  "Moderate Members",
  "Read Message History",
  "Add Reactions",
  "Connect",
  "Speak",
  "Manage Channels",
  "Manage Roles",
  "Mention Everyone",
  "Attach Files",
  "Embed Links",
  "Use External Emojis"
] as const;

export const channelTypes = ["text", "announcement", "voice"] as const;

const overwriteSchema = z.object({
  role: z.string().min(1),
  allow: z.array(z.string().min(1)).default([]),
  deny: z.array(z.string().min(1)).default([])
});

export const roleSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  purpose: z.string().optional(),
  permissions: z.array(z.string().min(1)).default([]),
  deny: z.array(z.string().min(1)).default([]),
  managed: z.boolean().default(true)
});

export const channelSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  type: z.enum(channelTypes),
  topic: z.string().optional(),
  readonly: z.boolean().default(false),
  premiumOnly: z.boolean().default(false),
  moderatorOnly: z.boolean().default(false),
  parent: z.string().optional(),
  overwrites: z.array(overwriteSchema).default([])
});

export const categorySchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  premiumOnly: z.boolean().default(false),
  moderatorOnly: z.boolean().default(false),
  overwrites: z.array(overwriteSchema).default([]),
  channels: z.array(channelSchema).default([])
});

export const messageSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  channelKey: z.string().regex(/^[a-z0-9_]+$/),
  mode: z.enum(["create-or-update", "print-only"]).default("create-or-update"),
  body: z.string().min(1)
});

export const blueprintSchema = z.object({
  server: z.object({
    name: z.string().min(1),
    description: z.string().optional()
  }),
  roles: z.array(roleSchema).default([]),
  categories: z.array(categorySchema).default([]),
  messages: z.array(messageSchema).default([])
});

export type Blueprint = z.infer<typeof blueprintSchema>;
export type RoleBlueprint = z.infer<typeof roleSchema>;
export type CategoryBlueprint = z.infer<typeof categorySchema>;
export type ChannelBlueprint = z.infer<typeof channelSchema>;
export type MessageBlueprint = z.infer<typeof messageSchema>;

export type ValidationIssue = {
  path: string;
  message: string;
};

export type BlueprintValidationResult = {
  blueprint?: Blueprint;
  issues: ValidationIssue[];
};
