# Pulse News — CLAUDE.md

## Repo layout

```
pulse-news/
├── shared/     ← types, config, region constants (no package.json; compiled by consumers)
├── app/        ← React Native / Expo, Android-first
├── cron/       ← Vercel cron jobs, Node.js
└── supabase/   ← schema reference only (no code)
```

## Build & test commands

| Package | Typecheck                     | Lint                                      | Test                       |
| ------- | ----------------------------- | ----------------------------------------- | -------------------------- |
| cron    | `cd cron && npx tsc --noEmit` | `cd cron && npx eslint --ext .ts src`     | `cd cron && npm test`      |
| app     | `cd app && npx tsc --noEmit`  | `cd app && npx eslint --ext .ts,.tsx src` | deferred to app/foundation |

Prettier (run from root): `npm run format:check` / `npm run format`

## Branching

```
main      ← protected; merges from develop only; tagged releases
develop   ← protected; all feature slices merge here; CI must be green
feat/*    ← one slice per branch
fix/*     ← one bug per branch (post-parity only)
```

Never commit directly to `main` or `develop`. Always open a PR.

**All PRs target `develop`.** Never target `main` directly — `main` only receives merges from `develop`. The GitHub repo default branch is set to `develop` so the PR form pre-selects it, but always confirm before creating.

## Slice discipline

- **One slice = one PR to `develop`.**
- Match legacy behavior exactly — same inputs, same outputs. Structural improvements (renaming, extracting helpers) are allowed. Algorithm changes are not — defer them to `todo.md`.
- Before opening a PR: `/code-review`.
- On slices touching auth, notifications, API endpoints, or deep links: `/security-review`.
- PR description must link the legacy file(s) it replaces.
- Tests in the same PR. Target 60–70% line coverage on logic that breaks silently.

## Legacy reference

Legacy codebase: `/home/hp/projects/pulse-news-legacy/`

When starting a slice: read the corresponding legacy file first, then port behavior exactly.
Do not delete the legacy repo until parity is declared and `v1.0.0` is tagged.

## Post-merge branch cleanup

After any PR is merged, immediately run:

```bash
git checkout develop
git pull origin develop
git branch -d feat/<branch-name>
git push origin --delete feat/<branch-name>
```

Also clean up any other stale merged `feat/*` branches at the same time. Do this without being asked.

---

## Context-mode

Use `ctx_execute` / `ctx_execute_file` / `ctx_batch_execute` instead of Bash for any command that reads, queries, lists, diffs, tests, builds, or inspects output. Bash only for: file mutations, git writes, `cd`/`pwd`, process control, package install.

No subagents for read-only tasks — Use `ctx_batch_execute` + `ctx_search` for exploration instead.

---

## CI

GitHub Actions runs on every PR to `develop` or `main`:

- format:check (root)
- lint (root, covering all packages)
- typecheck per package
- jest (cron)
