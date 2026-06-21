import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { stringify } from "yaml";
import { createDiscordClient, getGuildId } from "../discord/client.js";
import { fetchCurrentState } from "../discord/fetchCurrentState.js";
import { logger } from "../utils/logger.js";

export async function runExportCommand(path = "exports/current-server.export.yml") {
  const client = await createDiscordClient();

  try {
    const guild = await client.guilds.fetch(getGuildId());
    const current = await fetchCurrentState(guild);
    const categories = current.categories
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((category) => ({
        key: slugKey(category.name),
        name: category.name,
        channels: current.channels
          .filter((channel) => channel.parentId === category.id)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((channel) => ({
            key: slugKey(channel.name),
            name: channel.name,
            type: channel.type,
            topic: channel.topic ?? undefined
          }))
      }));

    const topLevelChannels = current.channels.filter((channel) => !channel.parentId);
    if (topLevelChannels.length > 0) {
      categories.push({
        key: "uncategorized",
        name: "UNCATEGORIZED",
        channels: topLevelChannels.map((channel) => ({
          key: slugKey(channel.name),
          name: channel.name,
          type: channel.type,
          topic: channel.topic ?? undefined
        }))
      });
    }

    const exported = {
      server: {
        name: current.name,
        description: current.description ?? undefined
      },
      roles: current.roles.map((role) => ({
        key: slugKey(role.name),
        name: role.name,
        permissions: role.permissions
      })),
      categories,
      messages: []
    };

    await mkdir("exports", { recursive: true });
    await writeFile(path, stringify(exported), "utf8");
    logger.info(`Export saved to ${path}.`);
  } finally {
    client.destroy();
  }
}

function slugKey(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "item"
  );
}
