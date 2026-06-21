# Manual Discord Setup

This tool assumes the Discord server already exists.

## Create the Server

Create the Discord server manually in the Discord app. For this project, the target server ID is:

```text
1513588231797473380
```

## Create the Discord Application and Bot

1. Open the Discord Developer Portal.
2. Create a new application.
3. Open the Bot section.
4. Create the bot.
5. Reset or copy the bot token.
6. Store the token only in your local `.env` file.

## Invite the Bot

Use OAuth2 URL Generator:

1. Select `bot`.
2. Select `applications.commands`.
3. Set integration type to server install.
4. For bootstrap, choose Administrator temporarily, or select the exact permissions you need.
5. Copy the generated URL.
6. Open the URL and authorize the bot into your server.

## Get the Server ID

Enable Discord Developer Mode:

1. User Settings.
2. Advanced.
3. Enable Developer Mode.
4. Right-click the server and copy Server ID.

You can also copy it from some Discord URLs.

## Local Secrets

Create `.env` from `.env.example` and paste the token there:

```bash
cp .env.example .env
```

```text
DISCORD_BOT_TOKEN=your-token-here
DISCORD_GUILD_ID=1513588231797473380
```
