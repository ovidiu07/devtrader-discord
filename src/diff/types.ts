import type { ChannelBlueprint } from "../config/schema.js";

export type ResourceKind = "server" | "role" | "category" | "channel" | "message";
export type OperationKind = "create" | "update" | "reorder" | "delete" | "unchanged" | "warning";

export type PlanOperation = {
  kind: OperationKind;
  resource: ResourceKind;
  key: string;
  name: string;
  reason: string;
  destructive?: boolean;
  changes?: string[];
};

export type ProvisionPlan = {
  operations: PlanOperation[];
  destructive: PlanOperation[];
};

export type CurrentRoleState = {
  id: string;
  name: string;
  permissions: string[];
  position?: number;
  managed?: boolean;
};

export type CurrentChannelState = {
  id: string;
  name: string;
  type: ChannelBlueprint["type"] | "category";
  parentId?: string | null;
  parentKey?: string;
  topic?: string | null;
  position?: number;
  overwrites?: CurrentPermissionOverwrite[];
};

export type CurrentPermissionOverwrite = {
  id: string;
  type: "role" | "member";
  allow: string[];
  deny: string[];
};

export type CurrentGuildState = {
  id: string;
  name: string;
  description?: string | null;
  roles: CurrentRoleState[];
  categories: CurrentChannelState[];
  channels: CurrentChannelState[];
};
