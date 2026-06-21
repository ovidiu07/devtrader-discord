import type { Blueprint } from "../config/schema.js";
import { desiredOverwritesForCategory, desiredOverwritesForChannel, overwriteSignature, resolveCurrentOverwriteSignature, rolePermissionNames } from "../discord/applyPermissions.js";
import type { DiscordState } from "../state/loadState.js";
import type { CurrentGuildState, CurrentRoleState, CurrentChannelState, PlanOperation, ProvisionPlan } from "./types.js";

export function buildPlan(blueprint: Blueprint, current: CurrentGuildState, state: DiscordState): ProvisionPlan {
  const operations: PlanOperation[] = [];
  const roleLookup = buildResourceLookup(current.roles, state.roles);
  const categoryLookup = buildResourceLookup(current.categories, state.categories);
  const channelLookup = buildResourceLookup(current.channels, state.channels);
  const roleIdsToKeys = invert({ ...state.roles, "@everyone": current.id });
  const categoryIdsToKeys = invert(state.categories);

  const serverChanges = diffValues([
    ["name", current.name, blueprint.server.name],
    ["description", current.description ?? "", blueprint.server.description ?? ""]
  ]);
  operations.push({
    kind: serverChanges.length ? "update" : "unchanged",
    resource: "server",
    key: "server",
    name: blueprint.server.name,
    reason: serverChanges.length ? "Server metadata differs." : "Server metadata already matches.",
    changes: serverChanges
  });

  for (const role of blueprint.roles) {
    const currentRole = roleLookup.byKey[role.key] ?? roleLookup.byName[role.name];
    if (!currentRole) {
      operations.push({ kind: "create", resource: "role", key: role.key, name: role.name, reason: "Role is missing." });
      continue;
    }

    const changes = diffValues([
      ["name", currentRole.name, role.name],
      ["permissions", currentRole.permissions.sort().join(","), rolePermissionNames(role).join(",")]
    ]);
    operations.push({
      kind: changes.length ? "update" : "unchanged",
      resource: "role",
      key: role.key,
      name: role.name,
      reason: changes.length ? "Role differs from blueprint." : "Role already matches.",
      changes
    });
  }

  for (const [categoryIndex, category] of blueprint.categories.entries()) {
    const currentCategory = categoryLookup.byKey[category.key] ?? categoryLookup.byName[category.name];
    const desiredCategoryOverwriteSignature = overwriteSignature(desiredOverwritesForCategory(category));

    if (!currentCategory) {
      operations.push({ kind: "create", resource: "category", key: category.key, name: category.name, reason: "Category is missing." });
    } else {
      const changes = diffValues([
        ["name", currentCategory.name, category.name],
        ["position", String(currentCategory.position ?? ""), String(categoryIndex)],
        ["permission overwrites", resolveCurrentOverwriteSignature(currentCategory.overwrites, roleIdsToKeys), desiredCategoryOverwriteSignature]
      ]);
      operations.push({
        kind: changes.some((change) => change.startsWith("position:")) ? "reorder" : changes.length ? "update" : "unchanged",
        resource: "category",
        key: category.key,
        name: category.name,
        reason: changes.length ? "Category differs from blueprint." : "Category already matches.",
        changes
      });
    }

    for (const [channelIndex, channel] of category.channels.entries()) {
      const currentChannel = channelLookup.byKey[channel.key] ?? channelLookup.byName[channel.name];
      if (!currentChannel) {
        operations.push({ kind: "create", resource: "channel", key: channel.key, name: channel.name, reason: "Channel is missing." });
        continue;
      }

      const desiredOverwriteSignature = overwriteSignature(desiredOverwritesForChannel(channel, category));
      const currentParentKey = currentChannel.parentId ? (categoryIdsToKeys[currentChannel.parentId] ?? currentChannel.parentKey ?? "") : "";
      const changes = diffValues([
        ["name", currentChannel.name, channel.name],
        ["type", currentChannel.type, channel.type],
        ["topic", currentChannel.topic ?? "", channel.topic ?? ""],
        ["parent", currentParentKey, category.key],
        ["position", String(currentChannel.position ?? ""), String(channelIndex)],
        ["permission overwrites", resolveCurrentOverwriteSignature(currentChannel.overwrites, roleIdsToKeys), desiredOverwriteSignature]
      ]);
      operations.push({
        kind: changes.some((change) => change.startsWith("position:")) ? "reorder" : changes.length ? "update" : "unchanged",
        resource: "channel",
        key: channel.key,
        name: channel.name,
        reason: changes.length ? "Channel differs from blueprint." : "Channel already matches.",
        changes
      });
    }
  }

  for (const message of blueprint.messages) {
    operations.push({
      kind: state.messages[message.key] ? "update" : "create",
      resource: "message",
      key: message.key,
      name: message.channelKey,
      reason: state.messages[message.key] ? "Managed message will be updated if content changed." : "Managed message is not tracked yet."
    });
  }

  return {
    operations,
    destructive: operations.filter((operation) => operation.destructive || operation.kind === "delete")
  };
}

function buildResourceLookup<T extends CurrentRoleState | CurrentChannelState>(resources: T[], idsByKey: Record<string, string>) {
  const byKey: Record<string, T | undefined> = {};
  const byName: Record<string, T | undefined> = {};

  for (const resource of resources) {
    byName[resource.name] = resource;
  }
  for (const [key, id] of Object.entries(idsByKey)) {
    byKey[key] = resources.find((resource) => resource.id === id);
  }

  return { byKey, byName };
}

function diffValues(values: Array<[label: string, current: string, desired: string]>): string[] {
  return values
    .filter(([, current, desired]) => current !== desired)
    .map(([label, current, desired]) => `${label}: "${current}" -> "${desired}"`);
}

function invert(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [value, key]));
}
