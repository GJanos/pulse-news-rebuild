# Pulse Rebuild Plan

Date: 2026-05-23
Owner: Janos Gorondi
Status: Approved — ready to execute

This document is the agreed plan for rebuilding the Pulse codebase in a fresh repository with proper tooling, structure, and per-slice discipline.

The rebuild is **structural, not behavioral**. The output of the rebuilt code on the same input must match the legacy code. Algorithm changes and feature additions are out of scope until parity is reached.

---

## 1. The legacy tree

Do not delete the existing repo. It is the reference implementation. Every rebuilt slice will be diffed against it.

Mechanics:

1. Finish and commit the current WIP on the legacy repo. Push.
2. Commit this `REBUILD_PLAN.md`, the consolidated `BEHAVIOR.md`, the parity snapshot in `todo.md`, and the `devlog.md` rebuild entry. Push.
3. Close Claude Code.
4. Rename the directory: `D:\JanosGorondi\AI\pulse-news` → `D:\JanosGorondi\AI\pulse-news-legacy`.
5. Create empty `D:\JanosGorondi\AI\pulse-news` next to it.
6. On GitHub, create a new empty repo (e.g. `pulse-news-rebuild`).
7. In PowerShell:
   ```
   cd D:\JanosGorondi\AI\pulse-news
   git init
   git remote add origin <new-repo-url>
   git checkout -b main
   git checkout -b develop
   ```
8. Launch Claude Code in `D:\JanosGorondi\AI\pulse-news`, and add `D:\JanosGorondi\AI\pulse-news-legacy` as an additional working directory (`/add-dir` or `--add-dir` flag).
9. First task in the new session: scaffold tooling (Phase 0 below).

---

## 2. Behavior spec (BEHAVIOR.md)

The three existing README files already act as behavior documentation. Consolidate and correct them into one `BEHAVIOR.md` at the new repo root, plus per-package READMEs that focus on setup/dev workflow.

`BEHAVIOR.md` is the acceptance test for "is the rebuild caught up yet?" It must list, in flat bullet form (not implementation detail):

- Every screen in the app and what it does.
- Every cron job step and what it produces.
- Every config key in `pulse.config.json`.
- Every Supabase table and its purpose.
- Every deep link the app responds to.
- Every notification type the app sends.
- Every preference the user can set.

It does not describe how anything is implemented. Implementation lives in code and CLAUDE.md files.

---

## 3. WIP snapshot (todo.md)

Before any rebuild work starts, snapshot the current state of in-flight work into `todo.md`:

- The fixes already in the modified files (must land in the rebuild, not regress).
- The new hooks and components added but not yet committed.
- Any known bugs not yet fixed.
- Any features in flight.

Every rebuild slice must check this list and incorporate the relevant items. The list is the parity contract.

---

## 4. Repository structure

```
pulse-news/
├── .github/workflows/ci.yml        ← lint + typecheck + test on every PR
├── .husky/                          ← pre-commit hook
├── .gitignore
├── .prettierrc
├── .eslintrc.cjs                    ← root config, extended by subpackages
├── tsconfig.base.json               ← shared compiler options
├── README.md                        ← humans: high-level overview
├── BEHAVIOR.md                      ← humans + Claude: the spec
├── REBUILD_PLAN.md                  ← this file
├── devlog.md
├── todo.md
├── CLAUDE.md                        ← Claude: repo-wide conventions, build/test, branching
├── CODEOWNERS
├── shared/                          ← not a standalone package; consumed via relative imports
│   ├── CLAUDE.md                    ← Claude: shared is source of truth, no app/cron imports allowed in here
│   ├── pulse.config.json
│   └── src/                         ← config loader, shared types, constants
├── app/
│   ├── README.md                    ← humans: Expo dev setup
│   ├── CLAUDE.md                    ← Claude: RN/Expo specifics, gotchas
│   ├── package.json
│   ├── tsconfig.json                ← extends ../tsconfig.base.json
│   ├── .eslintrc.cjs                ← extends ../.eslintrc.cjs
│   └── src/
└── cron/
    ├── README.md                    ← humans: Vercel/Supabase setup, env vars
    ├── CLAUDE.md                    ← Claude: cron specifics, scheduling, env vars
    ├── package.json
    ├── tsconfig.json
    ├── .eslintrc.cjs
    └── src/
```

No npm workspaces. Two consumers of `shared/` is not enough to justify the tooling tax. Imports use relative paths or a TS path alias. If a third consumer appears, revisit.

---

## 5. Tooling baseline (Phase 0 — before any feature code)

Land all of this before slice 1:

- ESLint + `@typescript-eslint` — root config, subpackages extend.
- Prettier — root config, one style for the whole repo.
- TypeScript — `tsc --noEmit` per package, shared `tsconfig.base.json`.
- Jest + `ts-jest` — already started in `cron/`, formalize and extend to `app/`.
- Husky + lint-staged — pre-commit: format + typecheck staged files.
- GitHub Actions — on every PR to `develop`: install, lint, typecheck, test.
- Branch protection on `main` and `develop`: require PR, require CI green.
- CODEOWNERS — Janos as owner of everything.

---

## 6. Branching

```
main      ← protected, only receives merges from develop, tagged releases
develop   ← protected, integration branch, all slices merge here first
feat/*    ← short-lived, one slice each
fix/*     ← short-lived, one bug each (used after parity is reached)
```

No `release/` branch until a beta channel exists.

---

## 7. Slices

### Backend slices (in order — each builds on the prior)

| #   | Slice                                                                                          | Status              | PR  |
| --- | ---------------------------------------------------------------------------------------------- | ------------------- | --- |
| 1   | **shared** — types, config schema, region/currency constants                                   | ✓ merged to develop | #1  |
| 2   | **cron/config** — loading + validating `pulse.config.json` from `shared/`                      | ✓ merged to develop | #2  |
| 3   | **cron/fetch** — news fetching, all sources, logging (`logging.ts`, `qualityLog.ts`)           | ✓ merged to develop | #3  |
| 4   | **cron/rank** — per-region Claude reorder + cross-region global selection                      | pending             | —   |
| 5   | **cron/notify** — `persistDigests`, FCM dispatch, `sendNotifications`                          | pending             | —   |
| 6   | **cron/api** — `daily-digest.ts` + `notify.ts` + `account.ts` Vercel handlers, pipeline wiring | pending             | —   |

> Note: `rankHeadlines` is stubbed as `slice(0, count)` in `fetchNews.ts` — replaced in cron/rank slice.

Currency rate fetching happens in the UI, not in cron — no `cron/currency` slice.

### Frontend slices (after backend lands on develop)

| #   | Slice                                                                                                           | Status  |
| --- | --------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | **app/foundation** — App.tsx shell, fonts, theme, safe areas, navigation skeleton, error boundaries             | pending |
| 2   | **app/auth-flow** — Supabase auth + login/signup/reset screens + session hook                                   | pending |
| 3   | **app/digest-flow** — preferences + digest fetching + currency rates hook + DigestPage + DigestPager + sections | pending |
| 4   | **app/settings-flow** — Settings screen + region picker + preference editing                                    | pending |
| 5   | **app/article** — ArticleScreen + WebBrowser handoff                                                            | pending |
| 6   | **app/notifications** — notification registration + deep link parsing + password recovery flow                  | pending |

Some files (App.tsx, hooks) get touched across multiple slices. That is expected. Each slice adds the parts of those files it needs; it does not rewrite from scratch.

Each slice kickoff prompt explicitly scopes the legacy regions to port. Example:

> "Slice: app/auth-flow. Legacy reference: `legacy/app/src/screens/LoginScreen.tsx`, `legacy/app/App.tsx` lines 45–80 (auth provider wiring), `legacy/app/src/hooks/useSupabaseAuth.ts`. Port these, ignore the rest of App.tsx for this slice."

---

## 8. Per-slice discipline

- **One slice = one PR.** No combined slices.
- **Port behavior first, improve structure second.** Match legacy behavior exactly. Structural improvements (extracting helpers, renaming, splitting files) are allowed in the same PR. Algorithm or behavior changes are not. If you spot a better way, write it in `todo.md` and do it in a `fix/*` branch after parity.
  - Rule of thumb: if legacy and rebuild would produce different outputs on the same input, it is a behavior change and must be deferred.
- **Skill-driven quality improvements are allowed in the same PR.** The installed skills (`typescript-pro`, `react-expert`, `react-native-expert`, `test-master`, `security-reviewer`) are authoritative on code quality within each slice. They may: strengthen types, apply idiomatic patterns, improve test architecture, and harden security posture. The hard constraint remains: same inputs → same outputs. Any improvement that changes observable behavior must go to `todo.md`.
- **Tests go in the same PR.** Not "tests later." Test what hurts when it breaks — ranking, dedup, auth state, deep link parsing, digest assembly. Skip snapshot tests on pure presentation. Aim 60–70% coverage on the right lines. Invoke `test-master` on each test file before committing.
- **`/code-review` before opening the PR**, not after. Fix findings on the branch. Invoke `code-reviewer` skill for a deeper pass on logic-heavy slices.
- **`/security-review`** on slices that touch auth, notifications, API endpoints, or deep links. Invoke `security-reviewer` skill alongside it. Skip both on pure-logic slices.
- **PR description links the legacy file(s) it replaces.** Enables completeness audit.

---

## 9. Definition of "caught up"

- Every bullet in `BEHAVIOR.md` is implemented.
- Every fix in the `todo.md` parity list is incorporated.
- CI is green on `develop`.
- A local Expo build can be installed and used end-to-end without hitting a regression versus legacy.

Then: merge `develop` → `main`, tag `v1.0.0`, rename the GitHub repo to `pulse-news`, archive the old repo and the local `pulse-news-legacy/` directory, switch to normal `feat/*` and `fix/*` flow, and start working through the deferred improvements in `todo.md`.
