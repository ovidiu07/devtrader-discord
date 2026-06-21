import type { Guild } from "discord.js";
import type { Blueprint } from "../config/schema.js";
import { permissionsToBits, rolePermissionNames } from "./applyPermissions.js";
import { withDiscordRateLimitHandling } from "./rateLimit.js";
import type { DiscordState } from "../state/loadState.js";

const auditReason = "devtrader-discord-provisioner role sync";

export async function applyRoles(guild: Guild, blueprint: Blueprint, state: DiscordState) {
  const roles = await guild.roles.fetch();

  for (const roleBlueprint of blueprint.roles) {
    const existing =
      (state.roles[roleBlueprint.key] ? roles.get(state.roles[roleBlueprint.key]) : undefined) ??
      roles.find((role) => role.name === roleBlueprint.name);

    if (!existing) {
      const created = await withDiscordRateLimitHandling(() =>
        guild.roles.create({
          name: roleBlueprint.name,
          permissions: permissionsToBits(roleBlueprint.permissions),
          reason: auditReason
        })
      );
      state.roles[roleBlueprint.key] = created.id;
      continue;
    }

    state.roles[roleBlueprint.key] = existing.id;
    if (existing.managed) continue;

    const expectedPermissions = rolePermissionNames(roleBlueprint).join(",");
    const currentPermissions = existing.permissions.toArray().sort().join(",");
    const shouldEdit = existing.name !== roleBlueprint.name || currentPermissions !== expectedPermissions;

    if (shouldEdit) {
      await withDiscordRateLimitHandling(() =>
        existing.edit(
          {
            name: roleBlueprint.name,
            permissions: permissionsToBits(roleBlueprint.permissions),
            reason: auditReason
          }
        )
      );
    }
  }
}
