import { validateBlueprintFile } from "../config/loadBlueprint.js";
import { logger } from "../utils/logger.js";

export async function runValidateCommand(path = "config/server.blueprint.yml") {
  const result = await validateBlueprintFile(path);
  if (result.issues.length > 0) {
    logger.error("Blueprint validation failed:");
    for (const issue of result.issues) {
      logger.error(`- ${issue.path}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  logger.info("Blueprint validation passed.");
}
