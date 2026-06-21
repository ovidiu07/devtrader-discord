import type { RomanianDisclaimerKey } from "./disclaimers.js";

export type SeedMessageMode = "plain" | "embed";

export type SeedEmbedConfig = {
  title: string;
  description: string;
  footer?: string;
  color?: number;
};

export type SeedMessageConfig = {
  key: string;
  channelKey: string;
  pin: boolean;
  mode: SeedMessageMode;
  content?: string;
  embed?: SeedEmbedConfig;
  disclaimers?: RomanianDisclaimerKey[];
};

export type SeedConfig = {
  messages: SeedMessageConfig[];
};

export type RenderedSeedEmbed = {
  title?: string;
  description?: string;
  color?: number;
  footer?: { text: string };
};

export type RenderedSeedPayload = {
  content?: string;
  embeds?: RenderedSeedEmbed[];
  allowedMentions: { parse: [] };
};

export type SeedMessageSnapshot = {
  id: string;
  content: string;
  embeds: RenderedSeedEmbed[];
  pinned: boolean;
};

export type SeedWritableMessage = SeedMessageSnapshot & {
  edit(payload: RenderedSeedPayload): Promise<SeedWritableMessage>;
  pin(reason?: string): Promise<void>;
};

export type SeedWritableChannel = {
  id: string;
  key: string;
  name: string;
  type: "text" | "announcement" | "voice" | "category" | "unknown";
  fetchMessage(id: string): Promise<SeedWritableMessage | null>;
  send(payload: RenderedSeedPayload): Promise<SeedWritableMessage>;
};

export type SeedPlanOperationKind = "create" | "update" | "pin" | "recreate" | "skip" | "unchanged" | "warning";

export type SeedPlanOperation = {
  kind: SeedPlanOperationKind;
  key: string;
  channelKey: string;
  messageKey: string;
  reason: string;
  changes?: string[];
};

export type SeedPlan = {
  operations: SeedPlanOperation[];
};

export type SeedValidationIssue = {
  level: "error" | "warning";
  path: string;
  message: string;
};
