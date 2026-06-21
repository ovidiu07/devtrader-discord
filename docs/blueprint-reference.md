# Blueprint Reference

The blueprint lives at `config/server.blueprint.yml`.

## Server

```yaml
server:
  name: Learn to win
  description: Comunitate românească pentru educație în trading...
```

The apply command attempts to update the server name and description if the bot has permission.

## Roles

```yaml
roles:
  - key: member
    name: Membru
    permissions:
      - View Channels
      - Send Messages
```

`key` is the stable logical ID. Do not change it unless you intentionally want to remap state.

Avoid granting `Administrator` to roles created by the script unless you explicitly intend to do so.

## Categories and Channels

```yaml
categories:
  - key: start_here
    name: START AICI
    channels:
      - key: bun_venit
        name: bun-venit
        type: text
        readonly: true
        topic: Primul loc în care ajungi în comunitate.
```

Supported channel types:

- `text`
- `announcement`
- `voice`

Common flags:

- `readonly: true`
- `premiumOnly: true`
- `moderatorOnly: true`

These flags are translated into Discord permission overwrites by helper functions in `src/discord/applyPermissions.ts`.

## Manual Overwrites

```yaml
overwrites:
  - role: moderator
    allow:
      - Send Messages
    deny: []
```

Use role logical keys, not Discord IDs. Use `@everyone` for the guild default role.

## Managed Messages

```yaml
messages:
  - key: welcome
    channelKey: bun_venit
    mode: create-or-update
    body: |
      Bun venit...
```

Managed message IDs are stored in `state/discord-state.json`. If the state file is missing, the tool searches recent bot messages for the management marker before posting a new message.
