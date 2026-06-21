import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import { blueprintSchema, type Blueprint, type BlueprintValidationResult, type ValidationIssue } from "./schema.js";
import { normalizePermissionName } from "../discord/applyPermissions.js";

const requiredRoleKeysForFlags = ["administrator", "moderator", "mentor", "premium_member", "member", "beginner"];

export class BlueprintValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }
}

export async function loadBlueprint(path = "config/server.blueprint.yml"): Promise<Blueprint> {
  const result = await validateBlueprintFile(path);
  if (result.issues.length > 0 || !result.blueprint) {
    throw new BlueprintValidationError(result.issues);
  }
  return result.blueprint;
}

export async function validateBlueprintFile(path = "config/server.blueprint.yml"): Promise<BlueprintValidationResult> {
  const source = await readFile(path, "utf8");
  const doc = parseDocument(source, { prettyErrors: true, uniqueKeys: true });
  const issues: ValidationIssue[] = [];

  if (doc.errors.length > 0) {
    return {
      issues: doc.errors.map((error) => ({
        path,
        message: error.message
      }))
    };
  }

  const parsed = blueprintSchema.safeParse(doc.toJS());
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "blueprint",
        message: issue.message
      }))
    };
  }

  issues.push(...validateBlueprint(parsed.data));
  return { blueprint: parsed.data, issues };
}

export function validateBlueprint(blueprint: Blueprint): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const roleKeys = new Set<string>();
  const categoryKeys = new Set<string>();
  const channelKeys = new Set<string>();
  const messageKeys = new Set<string>();

  for (const role of blueprint.roles) {
    addUnique(roleKeys, role.key, "roles", issues);
    validatePermissions(`roles.${role.key}.permissions`, role.permissions, issues);
    validatePermissions(`roles.${role.key}.deny`, role.deny, issues);
  }

  for (const category of blueprint.categories) {
    addUnique(categoryKeys, category.key, "categories", issues);
  }

  for (const category of blueprint.categories) {
    validateOverwrites(`categories.${category.key}.overwrites`, category.overwrites, roleKeys, issues);
    validateFlagRoles(`categories.${category.key}`, category.premiumOnly, category.moderatorOnly, roleKeys, issues);

    for (const channel of category.channels) {
      addUnique(channelKeys, channel.key, "channels", issues);
      if (channel.parent && !categoryKeys.has(channel.parent)) {
        issues.push({
          path: `channels.${channel.key}.parent`,
          message: `Unknown category reference "${channel.parent}".`
        });
      }
      validateOverwrites(`channels.${channel.key}.overwrites`, channel.overwrites, roleKeys, issues);
      validateFlagRoles(`channels.${channel.key}`, channel.premiumOnly, channel.moderatorOnly, roleKeys, issues);
    }
  }

  for (const message of blueprint.messages) {
    addUnique(messageKeys, message.key, "messages", issues);
    if (!channelKeys.has(message.channelKey)) {
      issues.push({
        path: `messages.${message.key}.channelKey`,
        message: `Unknown channel reference "${message.channelKey}".`
      });
    }
  }

  return issues;
}

function addUnique(seen: Set<string>, key: string, path: string, issues: ValidationIssue[]) {
  if (seen.has(key)) {
    issues.push({ path, message: `Duplicate logical key "${key}".` });
    return;
  }
  seen.add(key);
}

function validateFlagRoles(path: string, premiumOnly: boolean, moderatorOnly: boolean, roleKeys: Set<string>, issues: ValidationIssue[]) {
  if (!premiumOnly && !moderatorOnly) return;

  const needed = moderatorOnly ? ["administrator", "moderator", "member", "beginner", "premium_member"] : requiredRoleKeysForFlags;
  for (const key of needed) {
    if (!roleKeys.has(key)) {
      issues.push({ path, message: `Flag requires role "${key}" to exist.` });
    }
  }
}

function validateOverwrites(
  path: string,
  overwrites: Array<{ role: string; allow: string[]; deny: string[] }>,
  roleKeys: Set<string>,
  issues: ValidationIssue[]
) {
  for (const [index, overwrite] of overwrites.entries()) {
    if (overwrite.role !== "@everyone" && !roleKeys.has(overwrite.role)) {
      issues.push({ path: `${path}.${index}.role`, message: `Unknown role reference "${overwrite.role}".` });
    }
    validatePermissions(`${path}.${index}.allow`, overwrite.allow, issues);
    validatePermissions(`${path}.${index}.deny`, overwrite.deny, issues);
  }
}

function validatePermissions(path: string, permissions: string[], issues: ValidationIssue[]) {
  for (const permission of permissions) {
    if (!normalizePermissionName(permission)) {
      issues.push({ path, message: `Unknown permission "${permission}".` });
    }
  }
}
