import { Command } from "commander";
import { runApplyCommand } from "./commands/apply.js";
import { runDailyReportsRunCommand } from "./commands/dailyReportsRun.js";
import { runDailyReportsValidateCommand } from "./commands/dailyReportsValidate.js";
import { runEducationGenerateCalendarCommand } from "./commands/educationGenerateCalendar.js";
import { runEducationPlanCommand } from "./commands/educationPlan.js";
import { runEducationPreviewCommand } from "./commands/educationPreview.js";
import { runEducationRunCommand } from "./commands/educationRun.js";
import { runEducationValidateCommand } from "./commands/educationValidate.js";
import { runExportCommand } from "./commands/export.js";
import { runGenerateAllCommand } from "./commands/generateAll.js";
import { runPlanCommand } from "./commands/plan.js";
import { runSeedApplyCommand } from "./commands/seedApply.js";
import { runSeedExportCommand } from "./commands/seedExport.js";
import { runSeedPlanCommand } from "./commands/seedPlan.js";
import { runSeedValidateCommand } from "./commands/seedValidate.js";
import { runSchedulerStartCommand } from "./commands/schedulerStart.js";
import { runValidateCommand } from "./commands/validate.js";
import { logger } from "./utils/logger.js";

const program = new Command();

program
  .name("devtrader-discord-provisioner")
  .description("Local infrastructure-as-code provisioner for the Learn to win Discord server.")
  .version("0.1.0");

program.command("validate").description("Validate config/server.blueprint.yml.").action(() => runSafely(() => runValidateCommand()));
program.command("plan").description("Dry-run Discord changes without modifying the server.").action(() => runSafely(() => runPlanCommand()));
program
  .command("apply")
  .description("Apply the blueprint to Discord.")
  .option("--yes", "Confirm planned destructive operations.")
  .option("--no-delete", "Guarantee that no deletion operation is executed.")
  .action((options: { yes?: boolean; noDelete?: boolean }) => runSafely(() => runApplyCommand(options)));
program.command("export").description("Export the current Discord server structure to YAML.").action(() => runSafely(() => runExportCommand()));
program
  .command("seed:validate")
  .description("Validate config/seed-messages.yml.")
  .option("--strict", "Fail when seed messages reference missing channels.")
  .action((options: { strict?: boolean }) => runSafely(() => runSeedValidateCommand(options)));
program
  .command("seed:plan")
  .description("Dry-run seed message changes without modifying Discord.")
  .option("--strict", "Fail when seed messages reference missing channels.")
  .option("--no-pin", "Plan message create/update operations without pinning.")
  .option("--only <channelKey>", "Plan seed messages for only one channel key.")
  .action((options: { strict?: boolean; noPin?: boolean; only?: string }) => runSafely(() => runSeedPlanCommand(options)));
program
  .command("seed:apply")
  .description("Create or update managed seed messages.")
  .option("--yes", "Approve unattended seed apply.")
  .option("--no-pin", "Create or update seed messages without pinning.")
  .option("--only <channelKey>", "Seed only one channel key.")
  .option("--dry-run", "Show the seed plan without modifying Discord.")
  .option("--strict", "Fail when seed messages reference missing channels.")
  .action((options: { yes?: boolean; noPin?: boolean; only?: string; dryRun?: boolean; strict?: boolean }) => runSafely(() => runSeedApplyCommand(options)));
program.command("seed:export").description("Export current managed seed messages as YAML.").action(() => runSafely(() => runSeedExportCommand()));
program.command("education:validate").description("Validate daily education schedule and content bank.").action(() => runSafely(() => runEducationValidateCommand()));
program
  .command("education:plan")
  .description("Show today's education posts without modifying Discord.")
  .option("--only <channelKey>", "Plan only one education channel.")
  .option("--skip <channelKeys>", "Comma-separated channel keys to skip.")
  .action((options: { only?: string; skip?: string }) => runSafely(() => runEducationPlanCommand(options)));
program
  .command("education:run")
  .description("Post today's education content to Discord.")
  .option("--only <channelKey>", "Post only one education channel.")
  .option("--skip <channelKeys>", "Comma-separated channel keys to skip.")
  .option("--dry-run", "Show the plan without modifying Discord.")
  .action((options: { only?: string; skip?: string; dryRun?: boolean }) => runSafely(() => runEducationRunCommand(options)));
program
  .command("education:preview")
  .description("Render today's education posts in the console without contacting Discord.")
  .option("--only <channelKey>", "Preview only one education channel.")
  .option("--skip <channelKeys>", "Comma-separated channel keys to skip.")
  .action((options: { only?: string; skip?: string }) => runSafely(() => runEducationPreviewCommand(options)));
program
  .command("education:generate-calendar")
  .description("Generate or refresh a 30-day education calendar.")
  .option("--days <days>", "Number of days to generate.")
  .option("--start <YYYY-MM-DD>", "Calendar start date.")
  .action((options: { days?: string; start?: string }) => runSafely(() => runEducationGenerateCalendarCommand(options)));
program.command("daily-reports:validate").description("Validate deterministic daily report configuration.").action(() => runSafely(() => runDailyReportsValidateCommand()));
program
  .command("daily-reports:run")
  .description("Post deterministic daily reports to Discord.")
  .option("--only <reportType>", "Run only stiri-importante or calendar-economic.")
  .option("--force", "Bypass duplicate protection for today's report.")
  .option("--dry-run", "Render reports without modifying Discord.")
  .action((options: { only?: string; force?: boolean; dryRun?: boolean }) => runSafely(() => runDailyReportsRunCommand(options)));
program
  .command("generate-stiri-importante")
  .description("Manual admin command: post stiri-importante.")
  .option("--force", "Bypass duplicate protection for today's report.")
  .option("--dry-run", "Render without modifying Discord.")
  .action((options: { force?: boolean; dryRun?: boolean }) => runSafely(() => runDailyReportsRunCommand({ ...options, only: "stiri-importante" })));
program
  .command("generate-calendar-economic")
  .description("Manual admin command: post calendar-economic.")
  .option("--force", "Bypass duplicate protection for today's report.")
  .option("--dry-run", "Render without modifying Discord.")
  .action((options: { force?: boolean; dryRun?: boolean }) => runSafely(() => runDailyReportsRunCommand({ ...options, only: "calendar-economic" })));
program
  .command("reuters-markets-report")
  .description("Manual admin command: post Reuters Markets report.")
  .option("--force", "Bypass duplicate protection for today's Reuters report.")
  .option("--dry-run", "Render without modifying Discord.")
  .action((options: { force?: boolean; dryRun?: boolean }) => runSafely(() => runDailyReportsRunCommand({ ...options, only: "reuters-markets" })));
program
  .command("daily-market-news")
  .description("Manual admin command: post Currents API market news report.")
  .option("--force", "Bypass duplicate protection for today's Currents report.")
  .option("--dry-run", "Render without modifying Discord.")
  .action((options: { force?: boolean; dryRun?: boolean }) => runSafely(() => runDailyReportsRunCommand({ ...options, only: "currents-market-news" })));
program
  .command("generate-daily-reports")
  .description("Manual admin command: post all enabled daily market reports.")
  .option("--force", "Bypass duplicate protection for today's reports.")
  .option("--dry-run", "Render without modifying Discord.")
  .action((options: { force?: boolean; dryRun?: boolean }) => runSafely(() => runDailyReportsRunCommand(options)));
program
  .command("generate-all")
  .description("Post all enabled market reports and all scheduled education posts.")
  .option("--force", "Bypass duplicate protection for today's market reports.")
  .option("--dry-run", "Render everything without modifying Discord.")
  .action((options: { force?: boolean; dryRun?: boolean }) => runSafely(() => runGenerateAllCommand(options)));
program.command("scheduler:start").description("Start the long-running daily education scheduler.").action(() => runSafely(() => runSchedulerStartCommand()));

await program.parseAsync(process.argv);

async function runSafely(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
