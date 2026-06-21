# Daily Education Posts

The daily education system posts one Romanian educational message per configured channel in the `EDUCAȚIE TRADING` category.

Default schedule, timezone `Europe/Bucharest`:

- `09:00` - `bazele_tradingului`
- `09:00` - `managementul_riscului`
- `09:00` - `macroeconomie`
- `09:00` - `psihologie_si_disciplina`
- `09:00` - `resurse_educationale`

## Configuration

- Schedule: `config/education-daily-schedule.yml`
- Static content bank: `config/education-content-bank.yml`
- Optional generated calendar: `config/education-calendar.yml`
- State: `state/education-posts-state.json`
- Audit logs: `logs/education-posts/YYYY-MM-DD.json`

If a calendar entry exists for today, it is used. Otherwise the selector chooses a post by channel category, weekday rhythm, and no-repeat rules.

Weekday rhythm:

- Monday: concept
- Tuesday: mistake
- Wednesday: exercise
- Thursday: reflection
- Friday: case study
- Saturday: recap
- Sunday: preparation

## Commands

```bash
npm run education:validate
npm run education:plan
npm run education:preview
npm run education:generate-calendar
npm run education:run
npm run education:run -- --only bazele_tradingului
npm run education:run -- --dry-run
npm run scheduler:start
```

Use `--skip bazele_tradingului,macroeconomie` to skip selected channels in plan, preview, or run mode.

## No-Repeat Logic

The schedule has `defaultNoRepeatDays`, currently `45`. The selector avoids using the same post key in the same channel within that window. If every matching post was recently used, it picks a deterministic fallback and reports the reason in the plan.

Idempotency is date-based. If a channel already has a successful post for today, `education:run` skips that channel and does not create a duplicate.

## Permissions

Required bot permissions for daily posting:

- `VIEW_CHANNEL`
- `SEND_MESSAGES`
- `EMBED_LINKS`
- `READ_MESSAGE_HISTORY` if you later add checks against message history

Administrator permission is not required for daily posting after the server is bootstrapped.
