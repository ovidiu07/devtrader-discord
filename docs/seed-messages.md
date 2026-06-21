# Seed Messages

Seed messages prepare managed text channels with pinned Romanian onboarding content for the DevTrader community.

The content lives in `config/seed-messages.yml`. The implementation stores created message IDs in `state/discord-state.json` under `seedMessages`, so repeated runs edit the same bot-owned messages instead of creating duplicates.

## Required Permissions

The bot needs these permissions in channels that receive seed messages:

- `VIEW_CHANNEL`
- `SEND_MESSAGES`
- `READ_MESSAGE_HISTORY` if the bot checks existing messages, pins, or stored message IDs
- `PIN_MESSAGES` only when pinning is enabled
- `EMBED_LINKS` when rich embeds are used and Discord requires it for the server/channel behavior

`PIN_MESSAGES` is not required when running with `--no-pin`.

## Commands

Validate the seed configuration:

```bash
npm run seed:validate
```

Preview what would change without modifying Discord:

```bash
npm run seed:plan
```

Apply all managed seed messages:

```bash
npm run seed:apply -- --yes
```

Seed only one channel:

```bash
npm run seed:apply -- --only bun_venit --yes
```

Create or update messages without pinning:

```bash
npm run seed:apply -- --no-pin --yes
```

Export current managed seed messages for backup/review:

```bash
npm run seed:export
```

Use `--strict` with `seed:validate`, `seed:plan`, or `seed:apply` if missing channel references should fail the command instead of being reported as warnings.

## Idempotency

Each seed message has a stable YAML `key` and `channelKey`. The state file stores the Discord message ID using `channelKey:key`.

On apply, the bot:

- fetches the stored message ID;
- edits it if the rendered content changed;
- leaves it unchanged if it already matches;
- recreates it and updates state if the stored message ID no longer exists;
- pins it when `pin: true`, unless `--no-pin` is used.

The bot never deletes user messages and never bulk-deletes anything. Seed identity is stored in state instead of adding visible hidden markers to Discord messages, because Discord displays HTML comments as visible text.

## Updating Messages Safely

To change onboarding content later:

1. Edit `config/seed-messages.yml`.
2. Run `npm run seed:validate`.
3. Run `npm run seed:plan`.
4. Review the planned creates, updates, pins, skips, and recreates.
5. Run `npm run seed:apply -- --yes`.

Avoid changing a seed message `key` unless you intentionally want the bot to create a new managed message. Prefer changing only the text, embed title, footer, `pin`, or disclaimer references.

All visible Discord content in seed messages must stay in Romanian and must remain educational. Trading analysis, setup, chart, news, macroeconomic, and premium messages need a clear disclaimer and must not be presented as financial advice.
