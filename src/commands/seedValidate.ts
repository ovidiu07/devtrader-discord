import { loadBlueprint } from "../config/loadBlueprint.js";
import { loadSeedConfig, validateSeedConfigShape } from "../seed/loadSeedConfig.js";
import { validateSeedConfig } from "../seed/validation.js";
import { logger } from "../utils/logger.js";

export async function runSeedValidateCommand(options: { strict?: boolean } = {}) {
  const shape = await validateSeedConfigShape();
  if (shape.issues.length > 0) {
    printIssues(shape.issues);
    process.exitCode = 1;
    return;
  }

  const blueprint = await loadBlueprint();
  const config = await loadSeedConfig();
  const issues = validateSeedConfig(config, blueprint, options);
  printIssues(issues);

  if (issues.some((issue) => issue.level === "error")) {
    process.exitCode = 1;
    return;
  }

  logger.info("Seed message validation passed.");
}

function printIssues(issues: Array<{ level: "error" | "warning"; path: string; message: string }>) {
  for (const issue of issues) {
    const line = `${issue.level.toUpperCase()}: ${issue.path}: ${issue.message}`;
    if (issue.level === "error") logger.error(line);
    else logger.warn(line);
  }
}
