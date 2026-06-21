import { describe, expect, it } from "vitest";
import type { Blueprint } from "../src/config/schema.js";
import { validateBlueprint } from "../src/config/loadBlueprint.js";

const validBlueprint: Blueprint = {
  server: { name: "Learn to win" },
  roles: [
    { key: "administrator", name: "Administrator", permissions: [], deny: [], managed: true },
    { key: "moderator", name: "Moderator", permissions: ["View Channels"], deny: [], managed: true },
    { key: "mentor", name: "Mentor", permissions: ["View Channels"], deny: [], managed: true },
    { key: "premium_member", name: "Premium Member", permissions: ["View Channels"], deny: [], managed: true },
    { key: "member", name: "Membru", permissions: ["View Channels"], deny: [], managed: true },
    { key: "beginner", name: "Începător", permissions: ["View Channels"], deny: [], managed: true },
    { key: "muted", name: "Muted", permissions: ["View Channels"], deny: ["Send Messages"], managed: true }
  ],
  categories: [
    {
      key: "start_here",
      name: "START AICI",
      premiumOnly: false,
      moderatorOnly: false,
      overwrites: [],
      channels: [
        {
          key: "bun_venit",
          name: "bun-venit",
          type: "text",
          readonly: true,
          premiumOnly: false,
          moderatorOnly: false,
          overwrites: []
        }
      ]
    }
  ],
  messages: [{ key: "welcome", channelKey: "bun_venit", mode: "create-or-update", body: "Bun venit" }]
};

describe("blueprint validation", () => {
  it("accepts a valid blueprint", () => {
    expect(validateBlueprint(validBlueprint)).toEqual([]);
  });

  it("rejects duplicate logical keys", () => {
    const blueprint = structuredClone(validBlueprint);
    blueprint.roles.push({ key: "member", name: "Duplicate", permissions: [], deny: [], managed: true });

    expect(validateBlueprint(blueprint)).toContainEqual({
      path: "roles",
      message: 'Duplicate logical key "member".'
    });
  });

  it("rejects invalid role references in permission overwrites", () => {
    const blueprint = structuredClone(validBlueprint);
    blueprint.categories[0].channels[0].overwrites.push({ role: "missing_role", allow: ["View Channels"], deny: [] });

    expect(validateBlueprint(blueprint)).toContainEqual({
      path: "channels.bun_venit.overwrites.0.role",
      message: 'Unknown role reference "missing_role".'
    });
  });

  it("rejects messages that reference missing channels", () => {
    const blueprint = structuredClone(validBlueprint);
    blueprint.messages[0].channelKey = "missing_channel";

    expect(validateBlueprint(blueprint)).toContainEqual({
      path: "messages.welcome.channelKey",
      message: 'Unknown channel reference "missing_channel".'
    });
  });
});
