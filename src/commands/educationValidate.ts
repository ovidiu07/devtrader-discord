import { loadBlueprint } from "../config/loadBlueprint.js";
import { loadEducationContentBank, loadEducationSchedule, validateEducationYamlShape } from "../education/loadConfig.js";
import { validateEducationConfig } from "../education/validation.js";
import { logger } from "../utils/logger.js";

export async function runEducationValidateCommand() {
  const shapeIssues = await validateEducationYamlShape();
  if (shapeIssues.length > 0) {
    printIssues(shapeIssues);
    process.exitCode = 1;
    return;
  }

  const [blueprint, schedule, bank] = await Promise.all([loadBlueprint(), loadEducationSchedule(), loadEducationContentBank()]);
  const issues = validateEducationConfig(schedule, bank, blueprint);
  printIssues(issues);
  if (issues.some((issue) => issue.level === "error")) {
    process.exitCode = 1;
    return;
  }

  logger.info("Education automation validation passed.");
}

function printIssues(issues: Array<{ level: "error" | "warning"; path: string; message: string }>) {
  for (const issue of issues) {
    const line = `${issue.level.toUpperCase()}: ${issue.path}: ${issue.message}`;
    if (issue.level === "error") logger.error(line);
    else logger.warn(line);
  }
}
