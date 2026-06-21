import { renderEducationPayload } from "./render.js";
import { writeEducationAuditLog } from "./state.js";
import type { EducationChannel, EducationContentBank, EducationPlanItem, EducationPostRecord, EducationState } from "./types.js";
import { logger } from "../utils/logger.js";

export async function applyEducationPlan(args: {
  plan: EducationPlanItem[];
  bank: EducationContentBank;
  channels: Record<string, EducationChannel | undefined>;
  state: EducationState;
  now?: Date;
}): Promise<EducationPostRecord[]> {
  const now = args.now ?? new Date();
  const records: EducationPostRecord[] = [];

  for (const item of args.plan) {
    if (item.skipped || !item.postKey) {
      const record: EducationPostRecord = {
        date: item.date,
        timezone: item.timezone,
        channelKey: item.channelKey,
        postKey: item.postKey ?? "none",
        status: "skipped",
        error: item.reason
      };
      records.push(record);
      args.state.posts.push(record);
      logger.info(`education:${item.channelKey}: skipped. ${item.reason ?? ""}`.trim());
      continue;
    }

    const post = args.bank.posts.find((candidate) => candidate.key === item.postKey);
    const channel = args.channels[item.channelKey];
    if (!post || !channel) {
      const record: EducationPostRecord = {
        date: item.date,
        timezone: item.timezone,
        channelKey: item.channelKey,
        postKey: item.postKey,
        status: "failed",
        error: !post ? "Selected post is missing." : "Discord channel is missing."
      };
      records.push(record);
      args.state.posts.push(record);
      logger.warn(`education:${item.channelKey}: failed. ${record.error}`);
      continue;
    }

    try {
      const message = await channel.send(renderEducationPayload(post, now));
      const record: EducationPostRecord = {
        date: item.date,
        timezone: item.timezone,
        channelKey: item.channelKey,
        postKey: post.key,
        discordChannelId: channel.id,
        discordMessageId: message.id,
        postedAt: now.toISOString(),
        status: "posted"
      };
      records.push(record);
      args.state.posts.push(record);
      logger.info(`education:${item.channelKey}: posted ${post.key}.`);
    } catch (error) {
      const record: EducationPostRecord = {
        date: item.date,
        timezone: item.timezone,
        channelKey: item.channelKey,
        postKey: post.key,
        discordChannelId: channel.id,
        postedAt: now.toISOString(),
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      };
      records.push(record);
      args.state.posts.push(record);
      logger.warn(`education:${item.channelKey}: failed. ${record.error}`);
    }
  }

  if (records[0]) {
    await writeEducationAuditLog(records[0].date, records);
  }
  return records;
}
