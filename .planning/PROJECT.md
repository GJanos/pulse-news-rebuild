# Pulse News Rebuild

## What This Is

Pulse News is a React Native (Expo/Android-first) news aggregator app backed by Vercel cron jobs that fetch, rank, and push-notify region-specific headlines via Perplexity AI. This project is a **structural rebuild** of the legacy `pulse-news-legacy` repo into a clean, properly-tooled codebase with the same behavior.

## Core Value

The rebuilt codebase must match the legacy output on identical input — same headlines, same ranking, same notifications — with zero behavioral regressions before `v1.0.0` is tagged.

## Requirements

### Validated

- ✓ Monorepo layout: `shared/`, `app/`, `cron/` packages with no npm workspaces — existing
- ✓ CI: GitHub Actions on every PR (lint, typecheck, test) — existing
- ✓ Husky pre-commit hooks — existing
- ✓ Prettier + ESLint root config — existing

### Active

**Backend slices (in order):**

- [ ] **Phase 1** — `shared`: types, config schema, region/currency constants
- [ ] **Phase 2** — `cron/config`: loading + validating pulse.config.json
- [ ] **Phase 3** — `cron/fetch`: news fetching from Perplexity, all regions
- [ ] **Phase 4** — `cron/dedup`: headline deduplication
- [ ] **Phase 5** — `cron/rank`: ranking algorithm (highest test priority)
- [ ] **Phase 6** — `cron/digest`: digest assembly + Supabase persistence
- [ ] **Phase 7** — `cron/notify`: push notification dispatch
- [ ] **Phase 8** — `cron/api`: daily-digest.ts endpoint + entry wiring

**Frontend slices (after backend lands):**

- [ ] **Phase 9** — `app/foundation`: App.tsx shell, fonts, theme, safe areas, nav skeleton, error boundaries
- [ ] **Phase 10** — `app/auth-flow`: Supabase auth + login/signup/reset + session hook
- [ ] **Phase 11** — `app/digest-flow`: preferences + digest fetching + currency rates + DigestPage + DigestPager
- [ ] **Phase 12** — `app/settings-flow`: Settings screen + region picker + preference editing
- [ ] **Phase 13** — `app/article`: ArticleScreen + WebBrowser handoff
- [ ] **Phase 14** — `app/notifications`: notification registration + deep link parsing + password recovery

### Out of Scope

- Algorithm or behavior changes — defer to `todo.md` for post-parity `fix/*` branches
- Currency rate fetching in cron — happens in the UI, not the backend
- npm workspaces — two consumers don't justify the tooling tax
- `release/` branch — until a beta channel exists

## Context

- **Legacy reference:** `/home/hp/projects/pulse-news-legacy/` — do not delete; diff every slice against it
- **Parity contract:** `todo.md` contains in-flight fixes and features that must be incorporated per slice
- **Behavior spec:** `BEHAVIOR.md` is the acceptance test for "is the rebuild caught up yet?"
- **Branching:** `main` ← `develop` ← `feat/*` / `fix/*`; never commit directly to protected branches

## Constraints

- **Behavioral parity**: Same inputs → same outputs as legacy. No algorithm changes until `v1.0.0`.
- **Test coverage**: 60–70% line coverage on logic that breaks silently (ranking, dedup, auth, deep links, digest assembly)
- **Slice discipline**: One slice = one PR to `develop`. Tests in same PR.
- **Security review**: Required on auth, notifications, API endpoints, deep link slices.

## Key Decisions

| Decision                         | Rationale                                                         | Outcome   |
| -------------------------------- | ----------------------------------------------------------------- | --------- |
| No npm workspaces                | Two consumers don't justify tooling tax; revisit if third appears | — Pending |
| `@shared/*` TS path alias        | Avoids relative `../../` import noise; configured per-package     | — Pending |
| Behavioral parity first          | Enables safe migration before any improvements                    | — Pending |
| `pulse.config.json` in `shared/` | Single source of truth consumed by both app and cron              | — Pending |

---

_Last updated: 2026-05-24 after initialization from REBUILD_PLAN.md_

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
