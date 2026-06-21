import type { SeedPlan } from "./types.js";

const labels = {
  create: "+ create",
  update: "~ update",
  pin: "^ pin",
  recreate: "+ recreate",
  skip: "= skip",
  unchanged: "= unchanged",
  warning: "! warning"
};

export function printSeedPlan(plan: SeedPlan) {
  console.log("\nDiscord seed message plan\n");
  const groups = ["create", "recreate", "update", "pin", "skip", "unchanged", "warning"] as const;
  for (const group of groups) {
    const operations = plan.operations.filter((operation) => operation.kind === group);
    if (operations.length === 0) continue;

    console.log(`${labels[group].toUpperCase()}`);
    for (const operation of operations) {
      console.log(`  seed:${operation.key} (${operation.channelKey}) - ${operation.reason}`);
      for (const change of operation.changes ?? []) {
        console.log(`    ${change}`);
      }
    }
    console.log("");
  }
}
