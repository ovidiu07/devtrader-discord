import type { ProvisionPlan } from "./types.js";

const labels = {
  create: "+ create",
  update: "~ update",
  reorder: "~ reorder",
  delete: "- delete",
  unchanged: "= unchanged",
  warning: "! warning"
};

export function printPlan(plan: ProvisionPlan) {
  const groups = ["create", "update", "reorder", "unchanged", "warning"] as const;

  console.log("\nDiscord provisioning plan\n");
  for (const group of groups) {
    const operations = plan.operations.filter((operation) => operation.kind === group);
    if (operations.length === 0) continue;

    console.log(`${labels[group].toUpperCase()}`);
    for (const operation of operations) {
      console.log(`  ${operation.resource}:${operation.key} (${operation.name}) - ${operation.reason}`);
      for (const change of operation.changes ?? []) {
        console.log(`    ${change}`);
      }
    }
    console.log("");
  }

  if (plan.destructive.length > 0) {
    console.log("WARNING: DESTRUCTIVE OPERATIONS");
    for (const operation of plan.destructive) {
      console.log(`  ${labels[operation.kind]} ${operation.resource}:${operation.key} (${operation.name}) - ${operation.reason}`);
    }
    console.log("");
  } else {
    console.log("WARNING: No destructive operations are planned.\n");
  }
}
