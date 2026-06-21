# devtrader-discord-provisioner

Local TypeScript infrastructure-as-code tooling for provisioning the existing **Learn to win** Discord server.

This project reads `config/server.blueprint.yml`, validates it, compares it with the current Discord guild, prints a dry-run plan, and can apply the managed roles, categories, channels, topics, permission overwrites, and starter messages.

It does not create a new Discord server. It uses your existing server ID: `1513588231797473380`.

## Setup

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=1513588231797473380
```

Paste the bot token only into `.env`. Never commit or share it.

## Commands

Validate the blueprint:

```bash
npm run validate
```

Preview the changes without modifying Discord:

```bash
npm run plan
```

Apply the blueprint:

```bash
npm run apply
```

Skip destructive operations entirely:

```bash
npm run apply -- --no-delete
```

Auto-confirm destructive operations if future blueprint support adds them:

```bash
npm run apply -- --yes
```

Export the current server structure:

```bash
npm run export
```

Run tests:

```bash
npm test
```

Validate deterministic daily market reports:

```bash
npm run daily-reports:validate
```

Preview daily market reports without posting to Discord:

```bash
npm run daily-reports:run -- --dry-run
```

Post daily market reports manually:

```bash
npm run daily-reports:run
npm run generate-stiri-importante
npm run generate-calendar-economic
npm run reuters-markets-report
```

## Safe Re-Runs

The tool writes `state/discord-state.json` after apply. This maps blueprint logical keys to Discord IDs so future runs update existing resources instead of creating duplicates.

If the state file is missing, the tool tries to match existing resources by visible Discord names, then saves discovered IDs during apply.

By default, unmanaged resources are preserved. The current implementation does not delete roles, channels, categories, webhooks, events, or rules.

## Reducing Bot Permissions

For initial bootstrap, you can temporarily grant the bot Administrator. After the first successful apply, reduce the bot permissions to the minimum needed for your workflow:

- Manage Roles
- Manage Channels
- View Channels
- Send Messages
- Read Message History
- Manage Messages if moderators need bot-managed moderation workflows

Keep the bot role above any roles it needs to create or edit. Discord does not allow a bot to manage roles at or above its own highest role.

## Blueprint

Edit `config/server.blueprint.yml` to change roles, categories, channels, topics, read-only channels, premium-only channels, moderator-only channels, and managed messages.

See `docs/blueprint-reference.md` for the supported format.

## Daily Market Reports

The project includes no-AI automation for `stiri-importante` and `calendar-economic`. It posts Romanian reports from RSS/API data, fixed templates, keyword rules, and predefined market-impact mappings. It does not use OpenAI, ChatGPT, LLMs, or any text-generation model.

It can also generate an optional Reuters Markets report for `stiri-importante` or a configured channel ID. Enable it with:

```bash
REUTERS_MARKETS_NEWS_ENABLED=true
REUTERS_MARKETS_NEWS_CRON=0 0 9 * * 1-5
REUTERS_MARKETS_NEWS_TIMEZONE=Europe/Bucharest
REUTERS_MARKETS_NEWS_CHANNEL_ID=
```

Default schedule: Monday-Friday at `09:00` in `Europe/Bucharest`.

See `docs/daily-reports.md` for environment variables, RSS setup, Reuters Markets setup, economic-calendar API setup, fallback behavior, duplicate protection, and manual commands.
