# shared/

Source of truth for types, config schema, region constants shared between `app/` and `cron/`. No `package.json` — compiled by consumers via `@shared/*` TS path alias.

## Rules

- No imports from `app/` or `cron/`. Zero runtime dependencies.
- Types/constants used by both packages belong here; single-consumer things belong in that package.
