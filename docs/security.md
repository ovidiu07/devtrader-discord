# Security

Never commit `.env`. The bot token is a secret and must stay local.

If the token is exposed, rotate it immediately in the Discord Developer Portal and update your local `.env`.

Use temporary Administrator only for bootstrap. After setup, reduce the bot permissions to the minimum needed for provisioning.

The bot can only manage roles below its highest role. Keep the bot role above the roles it needs to create or edit.

Review npm dependencies before updates. This project uses maintained packages: `discord.js`, `dotenv`, `yaml`, `zod`, `commander`, `typescript`, `tsx`, and `vitest`.

The tool masks known secrets in logs and never intentionally prints `DISCORD_BOT_TOKEN`.
