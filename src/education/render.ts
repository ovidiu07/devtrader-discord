import type { EducationPost, EducationRenderedPayload } from "./types.js";

export function renderEducationPayload(post: EducationPost, now = new Date(), useEmbed = true): EducationRenderedPayload {
  if (useEmbed) {
    return {
      embeds: [
        {
          title: post.title,
          description: post.body.trim(),
          fields: [
            ...(post.practical ? [{ name: "Aplică practic", value: post.practical }] : []),
            { name: "Întrebare pentru comunitate", value: post.question }
          ],
          footer: post.disclaimer ? { text: post.disclaimer } : undefined,
          timestamp: now.toISOString()
        }
      ],
      allowedMentions: { parse: [] }
    };
  }

  return {
    content: [
      post.title,
      post.body.trim(),
      post.practical ? `Aplică practic:\n${post.practical}` : undefined,
      `Întrebare pentru comunitate:\n${post.question}`,
      post.disclaimer
    ]
      .filter(Boolean)
      .join("\n\n"),
    allowedMentions: { parse: [] }
  };
}
