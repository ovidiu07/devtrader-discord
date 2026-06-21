# Daily Scheduler Deployment

Required environment variables:

```bash
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
```

Secrets must never be committed.

## Local Manual Run

```bash
npm ci
npm run education:validate
npm run generate-all -- --dry-run
npm run generate-all
```

## VPS Cron

Run every morning at the configured time, or run multiple times safely because state prevents duplicate daily posts.

Example crontab:

```cron
CRON_TZ=Europe/Bucharest
0 9 * * * cd /opt/devtrader-discord && /usr/bin/npm run generate-all >> logs/scheduler-cron.log 2>&1
```

The application and cron trigger both use `Europe/Bucharest`; `CRON_TZ` avoids shifting the 09:00 trigger when the server uses another timezone.

`generate-all` is a one-shot command. It posts every enabled market report and all education channels, then exits. This is the recommended command for cron and launchd.

## Long-Running Scheduler

```bash
npm run scheduler:start
```

The scheduler reads `config/education-daily-schedule.yml`, logs next education run times, and posts each education channel at its configured time. It also runs the deterministic no-AI daily market reports for `stiri-importante` and `calendar-economic` Monday-Friday at `DAILY_REPORT_TIME`, default `09:00` in `Europe/Bucharest`.

The terminal, container, or process supervisor running this command must remain active. Printing a next-run time only creates an in-memory timer; it does not install an operating-system scheduled job.

If `REUTERS_MARKETS_NEWS_ENABLED=true`, the scheduler also runs the Reuters Markets report Monday-Friday at the time derived from `REUTERS_MARKETS_NEWS_CRON`, default `0 0 9 * * 1-5` in `Europe/Bucharest`.

If `CURRENTS_MARKET_NEWS_ENABLED=true`, the scheduler also runs the Currents API market-news report Monday-Friday at the time derived from `CURRENTS_MARKET_NEWS_CRON`, default `0 0 9 * * 1-5` in `Europe/Bucharest`. `CURRENTS_API_KEY` and `CURRENTS_MARKET_NEWS_CHANNEL_ID` must be configured; the key must stay only in the environment.

If the process restarts, local state prevents duplicate education posts and duplicate daily market reports for the same day.

## Docker

```bash
docker compose up -d --build
docker compose logs -f
```

State and logs are mounted from `./state` and `./logs`.

## GitHub Actions

`.github/workflows/education-daily.yml` is included with manual dispatch enabled. The scheduled trigger is commented out until `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` are configured as repository secrets.

Audit logs are written under `logs/education-posts/`. On ephemeral runners, persist logs as artifacts if you need long-term retention.
