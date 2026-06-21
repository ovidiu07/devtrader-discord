import { describe, expect, it } from "vitest";
import type { Blueprint } from "../src/config/schema.js";
import type { SeedConfig } from "../src/seed/types.js";
import { validateSeedConfig } from "../src/seed/validation.js";

const blueprint: Blueprint = {
  server: { name: "DevTrader" },
  roles: [],
  categories: [
    {
      key: "start",
      name: "START",
      premiumOnly: false,
      moderatorOnly: false,
      overwrites: [],
      channels: [
        {
          key: "analiza_zilei",
          name: "analiza-zilei",
          type: "text",
          readonly: false,
          premiumOnly: false,
          moderatorOnly: false,
          overwrites: []
        }
      ]
    }
  ],
  messages: []
};

describe("seed config validation", () => {
  it("accepts Romanian trading content with a clear disclaimer", () => {
    const config: SeedConfig = {
      messages: [
        {
          key: "intro",
          channelKey: "analiza_zilei",
          pin: true,
          mode: "embed",
          embed: {
            title: "Analiza zilei",
            description: "Acest canal este pentru analiză educațională, scenarii posibile și risc.",
            footer: "Conținut educațional. Nu reprezintă consultanță financiară."
          }
        }
      ]
    };

    expect(validateSeedConfig(config, blueprint)).toEqual([]);
  });

  it("reports duplicate seed message keys", () => {
    const config: SeedConfig = {
      messages: [
        { key: "intro", channelKey: "analiza_zilei", pin: true, mode: "plain", content: "Acest canal este pentru comunitate și educație." },
        { key: "intro", channelKey: "analiza_zilei", pin: true, mode: "plain", content: "Acest canal este pentru comunitate și educație." }
      ]
    };

    expect(validateSeedConfig(config, blueprint)).toContainEqual({
      level: "error",
      path: "messages.1.key",
      message: 'Duplicate seed message key "intro".'
    });
  });

  it("warns for missing channels by default and fails in strict mode", () => {
    const config: SeedConfig = {
      messages: [{ key: "intro", channelKey: "lipsa", pin: true, mode: "plain", content: "Acest canal este pentru comunitate și educație." }]
    };

    expect(validateSeedConfig(config, blueprint)[0]?.level).toBe("warning");
    expect(validateSeedConfig(config, blueprint, { strict: true })[0]?.level).toBe("error");
  });

  it("requires a disclaimer for trading analysis topics", () => {
    const config: SeedConfig = {
      messages: [
        {
          key: "intro",
          channelKey: "analiza_zilei",
          pin: true,
          mode: "embed",
          embed: {
            title: "Analiza zilei",
            description: "Acest canal este pentru analiză, grafice și scenarii de piață."
          }
        }
      ]
    };

    expect(validateSeedConfig(config, blueprint)).toEqual(expect.arrayContaining([expect.objectContaining({ message: "Trading-related seed messages need a clear educational disclaimer." })]));
  });
});
