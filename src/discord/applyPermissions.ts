import { PermissionFlagsBits, PermissionsBitField, type PermissionResolvable } from "discord.js";
import type { Blueprint, CategoryBlueprint, ChannelBlueprint, RoleBlueprint } from "../config/schema.js";
import type { CurrentPermissionOverwrite } from "../diff/types.js";

const aliases: Record<string, bigint> = {
  viewchannels: PermissionFlagsBits.ViewChannel,
  viewchannel: PermissionFlagsBits.ViewChannel,
  sendmessages: PermissionFlagsBits.SendMessages,
  managemessages: PermissionFlagsBits.ManageMessages,
  moderatemembers: PermissionFlagsBits.ModerateMembers,
  readmessagehistory: PermissionFlagsBits.ReadMessageHistory,
  addreactions: PermissionFlagsBits.AddReactions,
  connect: PermissionFlagsBits.Connect,
  speak: PermissionFlagsBits.Speak,
  managechannels: PermissionFlagsBits.ManageChannels,
  manageroles: PermissionFlagsBits.ManageRoles,
  mentioneveryone: PermissionFlagsBits.MentionEveryone,
  attachfiles: PermissionFlagsBits.AttachFiles,
  embedlinks: PermissionFlagsBits.EmbedLinks,
  useexternalemojis: PermissionFlagsBits.UseExternalEmojis,
  administrator: PermissionFlagsBits.Administrator
};

export type DesiredOverwrite = {
  role: string;
  allow: string[];
  deny: string[];
};

export function normalizePermissionName(permission: string): string | undefined {
  const key = permission.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!aliases[key]) return undefined;
  return permissionNameFromBit(aliases[key]);
}

export function permissionsToBits(permissions: string[]): PermissionResolvable[] {
  return permissions.map((permission) => {
    const normalized = normalizePermissionName(permission);
    if (!normalized) throw new Error(`Unknown permission "${permission}".`);
    return aliases[normalized.toLowerCase().replace(/[^a-z0-9]/g, "")];
  });
}

export function permissionNamesFromBits(bitfield: bigint | PermissionsBitField): string[] {
  const value = typeof bitfield === "bigint" ? bitfield : bitfield.bitfield;
  return Object.entries(aliases)
    .filter(([alias]) => alias === canonicalAlias(alias))
    .filter(([, bit]) => (value & bit) === bit)
    .map(([, bit]) => permissionNameFromBit(bit))
    .sort();
}

export function rolePermissionNames(role: RoleBlueprint): string[] {
  return role.permissions.map((permission) => normalizePermissionName(permission) ?? permission).sort();
}

export function mutedRoleDenySend(): string[] {
  return ["SendMessages", "AddReactions", "Speak"];
}

export function readonlyChannel(): DesiredOverwrite[] {
  return [
    { role: "@everyone", allow: ["ViewChannel", "ReadMessageHistory"], deny: ["SendMessages", "AddReactions"] },
    { role: "administrator", allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AddReactions"], deny: [] },
    { role: "moderator", allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AddReactions"], deny: [] },
    { role: "mentor", allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AddReactions"], deny: [] }
  ];
}

export function normalCommunityChannel(): DesiredOverwrite[] {
  return [
    { role: "@everyone", allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AddReactions"], deny: [] },
    { role: "muted", allow: ["ViewChannel", "ReadMessageHistory"], deny: mutedRoleDenySend() }
  ];
}

export function premiumOnlyChannel(): DesiredOverwrite[] {
  return [
    { role: "@everyone", allow: [], deny: ["ViewChannel"] },
    { role: "member", allow: [], deny: ["ViewChannel"] },
    { role: "beginner", allow: [], deny: ["ViewChannel"] },
    { role: "premium_member", allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AddReactions", "Connect", "Speak"], deny: [] },
    { role: "mentor", allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AddReactions", "Connect", "Speak"], deny: [] },
    { role: "moderator", allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AddReactions", "Connect", "Speak"], deny: [] },
    { role: "administrator", allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AddReactions", "Connect", "Speak"], deny: [] },
    { role: "muted", allow: [], deny: mutedRoleDenySend() }
  ];
}

export function moderatorOnlyChannel(): DesiredOverwrite[] {
  return [
    { role: "@everyone", allow: [], deny: ["ViewChannel"] },
    { role: "member", allow: [], deny: ["ViewChannel"] },
    { role: "beginner", allow: [], deny: ["ViewChannel"] },
    { role: "premium_member", allow: [], deny: ["ViewChannel"] },
    { role: "moderator", allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AddReactions", "Connect", "Speak"], deny: [] },
    { role: "administrator", allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AddReactions", "Connect", "Speak"], deny: [] }
  ];
}

export function desiredOverwritesForChannel(
  channel: ChannelBlueprint,
  category: CategoryBlueprint
): DesiredOverwrite[] {
  const overwrites: DesiredOverwrite[] = [];
  const premiumOnly = channel.premiumOnly || category.premiumOnly;
  const moderatorOnly = channel.moderatorOnly || category.moderatorOnly;

  if (moderatorOnly) overwrites.push(...moderatorOnlyChannel());
  else if (premiumOnly) overwrites.push(...premiumOnlyChannel());
  else if (channel.readonly) overwrites.push(...readonlyChannel());
  else overwrites.push(...normalCommunityChannel());

  overwrites.push(...category.overwrites, ...channel.overwrites);
  return mergeOverwrites(overwrites);
}

export function desiredOverwritesForCategory(category: CategoryBlueprint): DesiredOverwrite[] {
  if (category.moderatorOnly) return mergeOverwrites([...moderatorOnlyChannel(), ...category.overwrites]);
  if (category.premiumOnly) return mergeOverwrites([...premiumOnlyChannel(), ...category.overwrites]);
  return mergeOverwrites(category.overwrites);
}

export function overwriteSignature(overwrites: DesiredOverwrite[] | CurrentPermissionOverwrite[]): string {
  return overwrites
    .map((overwrite) => {
      const role = "role" in overwrite ? overwrite.role : overwrite.id;
      return `${role}:allow=${overwrite.allow.map((p) => normalizePermissionName(p) ?? p).sort().join(",")};deny=${overwrite.deny
        .map((p) => normalizePermissionName(p) ?? p)
        .sort()
        .join(",")}`;
    })
    .sort()
    .join("|");
}

export function desiredPermissionOverwritesForDiscord(
  overwrites: DesiredOverwrite[],
  roleIds: Record<string, string>,
  everyoneRoleId: string
) {
  return overwrites.map((overwrite) => {
    const id = overwrite.role === "@everyone" ? everyoneRoleId : roleIds[overwrite.role];
    if (!id) throw new Error(`Cannot resolve role "${overwrite.role}" for permission overwrite.`);
    return {
      id,
      allow: permissionsToBits(overwrite.allow),
      deny: permissionsToBits(overwrite.deny)
    };
  });
}

export function resolveCurrentOverwriteSignature(overwrites: CurrentPermissionOverwrite[] | undefined, idsToRoleKeys: Record<string, string>) {
  return overwriteSignature(
    (overwrites ?? [])
      .filter((overwrite) => overwrite.type === "role")
      .map((overwrite) => ({
        role: idsToRoleKeys[overwrite.id] ?? overwrite.id,
        allow: overwrite.allow,
        deny: overwrite.deny
      }))
  );
}

export function buildKnownRoleIds(blueprint: Blueprint, roleState: Record<string, string>, guildId: string): Record<string, string> {
  const ids: Record<string, string> = { "@everyone": guildId };
  for (const role of blueprint.roles) {
    if (roleState[role.key]) ids[role.key] = roleState[role.key];
  }
  return ids;
}

function mergeOverwrites(overwrites: DesiredOverwrite[]): DesiredOverwrite[] {
  const merged = new Map<string, DesiredOverwrite>();
  for (const overwrite of overwrites) {
    const current = merged.get(overwrite.role) ?? { role: overwrite.role, allow: [], deny: [] };
    current.allow = unique([...current.allow, ...overwrite.allow.map((p) => normalizePermissionName(p) ?? p)]);
    current.deny = unique([...current.deny, ...overwrite.deny.map((p) => normalizePermissionName(p) ?? p)]);
    merged.set(overwrite.role, current);
  }
  return [...merged.values()];
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}

function canonicalAlias(alias: string) {
  const bit = aliases[alias];
  return Object.entries(aliases).find(([, value]) => value === bit)?.[0] ?? alias;
}

function permissionNameFromBit(bit: bigint): string {
  const mapping = new Map<bigint, string>([
    [PermissionFlagsBits.ViewChannel, "ViewChannel"],
    [PermissionFlagsBits.SendMessages, "SendMessages"],
    [PermissionFlagsBits.ManageMessages, "ManageMessages"],
    [PermissionFlagsBits.ModerateMembers, "ModerateMembers"],
    [PermissionFlagsBits.ReadMessageHistory, "ReadMessageHistory"],
    [PermissionFlagsBits.AddReactions, "AddReactions"],
    [PermissionFlagsBits.Connect, "Connect"],
    [PermissionFlagsBits.Speak, "Speak"],
    [PermissionFlagsBits.ManageChannels, "ManageChannels"],
    [PermissionFlagsBits.ManageRoles, "ManageRoles"],
    [PermissionFlagsBits.MentionEveryone, "MentionEveryone"],
    [PermissionFlagsBits.AttachFiles, "AttachFiles"],
    [PermissionFlagsBits.EmbedLinks, "EmbedLinks"],
    [PermissionFlagsBits.UseExternalEmojis, "UseExternalEmojis"],
    [PermissionFlagsBits.Administrator, "Administrator"]
  ]);
  return mapping.get(bit) ?? bit.toString();
}
