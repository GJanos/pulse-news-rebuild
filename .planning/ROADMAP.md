# Roadmap: Pulse News Rebuild

**Generated:** 2026-05-24
**Phases:** 14
**Requirements:** 39 mapped, 0 unmapped ✓
**Goal:** Behavioral parity with `pulse-news-legacy` — same output on same input

---

## Phase Overview

| #   | Phase             | Goal                                   | Requirements | Branch                 |
| --- | ----------------- | -------------------------------------- | ------------ | ---------------------- |
| 1   | shared            | Types, config schema, region constants | SHR-01–06    | feat/shared            |
| 2   | cron/config       | Config loading + validation            | CFG-01–03    | feat/cron-config       |
| 3   | cron/fetch        | News fetching from Perplexity          | FET-01–03    | feat/cron-fetch        |
| 4   | cron/dedup        | Headline deduplication                 | DED-01       | feat/cron-dedup        |
| 5   | cron/rank         | Ranking algorithm                      | RNK-01–03    | feat/cron-rank         |
| 6   | cron/digest       | Digest assembly + persistence          | DIG-01–03    | feat/cron-digest       |
| 7   | cron/notify       | Push notification dispatch             | NOT-01–02    | feat/cron-notify       |
| 8   | cron/api          | API endpoints + entry wiring           | API-01–04    | feat/cron-api          |
| 9   | app/foundation    | App shell, theme, nav skeleton         | APP-01–02    | feat/app-foundation    |
| 10  | app/auth-flow     | Auth screens + session hook            | AUTH-01–04   | feat/app-auth-flow     |
| 11  | app/digest-flow   | Digest + currency + pager              | DGST-01–05   | feat/app-digest-flow   |
| 12  | app/settings-flow | Settings + preferences                 | SET-01–03    | feat/app-settings-flow |
| 13  | app/article       | Article screen + browser handoff       | ART-01       | feat/app-article       |
| 14  | app/notifications | Notifications + deep links             | NTF-01–03    | feat/app-notifications |

---

### Phase 1: shared

**Goal:** Establish the shared package — types, config schema, region/currency constants — so all downstream slices have a single source of truth.
**Success Criteria:**

1. `@shared/types`, `@shared/regions`, `@shared/config` resolve in both `app/` and `cron/` TypeScript builds
2. `npx tsc --noEmit` passes in both packages after alias wired up
3. All cross-package types extracted from legacy into `shared/src/`
4. `shared/pulse.config.json` replaces both legacy config files
5. Jest `moduleNameMapper` resolves `@shared/*` in both packages

### Phase 2: cron/config

**Goal:** Port config loading — merge defaults, apply env overrides, expose typed `PulseConfig` — using types from `@shared/config`.
**Success Criteria:**

1. `loadPulseConfig()` returns correct merged config with defaults only
2. Deep-merges partial `pulse.config.json` without clobbering unspecified defaults
3. Env var overrides (LOG_LEVEL, COUNT, MIN_RESULTS) applied correctly
4. Unit tests cover merge behavior and env overrides

### Phase 3: cron/fetch

**Goal:** Port Perplexity news fetching with retry logic across all configured regions.
**Success Criteria:**

1. `PerplexitySource.fetchDigest()` returns `RegionDigest` for a given region
2. Retry logic follows `recencySequence`, `maxAttempts`, `attemptDelay`/`retryDelay`
3. Response parsed and filtered to `RegionHeadline[]`
4. Unit tests cover parsing and filter logic

### Phase 4: cron/dedup

**Goal:** Port headline deduplication — URL exact match + fuzzy title match.
**Success Criteria:**

1. Exact URL duplicates filtered
2. Fuzzy title duplicates filtered at same threshold as legacy
3. Unit tests cover dedup logic

### Phase 5: cron/rank

**Goal:** Port local + global ranking via Claude API. Highest test priority.
**Success Criteria:**

1. Local ranking reorders headlines per region via Claude API
2. Global ranking selects top headlines across all regions when enabled
3. Unit tests at 60–70%+ line coverage with mocked Claude API

### Phase 6: cron/digest

**Goal:** Port digest assembly and Supabase persistence including eviction.
**Success Criteria:**

1. Digest assembled from ranked headlines per region
2. `digests` and `global_digests` rows upserted in Supabase
3. Old rows evicted per `db.evict`/`db.evictDays` config
4. Unit tests cover assembly logic

### Phase 7: cron/notify

**Goal:** Port FCM push notification dispatch.
**Success Criteria:**

1. Devices in current 30-min window receive FCM notification
2. Devices with `notify_at = null` notified at digest generation time
3. FCM errors handled and logged without crashing pipeline

### Phase 8: cron/api

**Goal:** Wire all cron stages into Vercel API entry points.
**Success Criteria:**

1. `api/daily-digest.ts`: full pipeline executes end-to-end
2. `api/notify.ts`: FCM dispatch to current-window devices works
3. `api/account.ts`: POST registers device, DELETE removes device + preferences
4. Cron secret check guards all three endpoints
5. TypeScript compiles with no errors

### Phase 9: app/foundation

**Goal:** App.tsx shell with fonts, safe areas, theme system, navigation skeleton, error boundaries.
**Success Criteria:**

1. App boots to splash/login screen without errors
2. Theme (light/sepia/dark) and aesthetic (editorial/clinical/brutalist) applied globally
3. Navigation skeleton renders correct screen per `ScreenId`
4. Error boundary catches and displays fallback

### Phase 10: app/auth-flow

**Goal:** Supabase auth — login, signup, reset password + persistent session hook.
**Success Criteria:**

1. User can log in and session persists across restarts
2. User can sign up and receive verification email
3. User can request password reset email
4. `useSupabaseAuth` hook returns correct session state

### Phase 11: app/digest-flow

**Goal:** Full digest experience — preferences, data fetching, currency rates, DigestPage, DigestPager, sections.
**Success Criteria:**

1. Digest loads and displays for each selected region
2. Swipe navigation works between regions
3. Currency rates fetched and displayed when enabled
4. Global headlines section rendered when enabled
5. Per-region headline count overrides applied

### Phase 12: app/settings-flow

**Goal:** Settings screen + region picker + all preference editing + Supabase sync.
**Success Criteria:**

1. All `UserPreferences` fields editable from settings screen
2. Preferences persisted locally via MMKV
3. Preferences synced to Supabase with `updatedAt` conflict resolution (newer wins)

### Phase 13: app/article

**Goal:** Article screen with in-app browser or system browser handoff per preference.
**Success Criteria:**

1. In-app browser opens when `openLinksIn = 'in-app'`
2. System browser opens when `openLinksIn = 'browser'`

### Phase 14: app/notifications

**Goal:** Device registration, deep link parsing, password recovery flow.
**Success Criteria:**

1. FCM token registered in Supabase `devices` on first launch
2. Notification tap deep link navigates to correct digest
3. Password recovery deep link routes to reset screen
4. Security review passed

---

## Completion Criteria

- Every requirement in REQUIREMENTS.md marked complete ✓
- `BEHAVIOR.md` bullets all implemented
- `todo.md` parity items all incorporated
- CI green on `develop`
- Local Expo build installable and functional end-to-end vs legacy
- Merge `develop` → `main`, tag `v1.0.0`
