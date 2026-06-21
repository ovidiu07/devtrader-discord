# Operations

## Preview Changes

```bash
npm run plan
```

This connects to Discord, fetches the guild structure, compares it with `config/server.blueprint.yml`, and prints the diff. It does not modify Discord.

## Apply Changes

```bash
npm run apply
```

Apply creates or updates managed roles, categories, channels, topics, permission overwrites, and configured starter messages.

## No Delete Mode

```bash
npm run apply -- --no-delete
```

This guarantees that no deletion operation is executed. The current implementation preserves unmanaged resources by default and does not generate delete operations.

## Confirming Destructive Work

```bash
npm run apply -- --yes
```

Use this only after reading the plan. Destructive operations are printed under a clear warning section.

## Export Current Server

```bash
npm run export
```

The export is written to:

```text
exports/current-server.export.yml
```

Use this to inspect manual Discord changes and decide whether to copy them into the main blueprint.

## Recover From Local Config Mistakes

If you accidentally edit the blueprint, restore it from git or compare it with `exports/current-server.export.yml`.

If `state/discord-state.json` is deleted, run `npm run plan` first. On the next apply, the tool will try to match existing resources by name and save discovered IDs again.
