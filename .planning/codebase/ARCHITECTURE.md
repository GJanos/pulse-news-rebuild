<!-- refreshed: 2026-05-24 -->

# Architecture

**Analysis Date:** 2026-05-24

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel Cron (cron/)                       │
├──────────────────────┬──────────────────┬────────────────────────┤
│  api/daily-digest.ts │   api/notify.ts  │    api/account.ts      │
│  (05:00 UTC daily)   │  (every 30 min)  │  (device reg / delete) │
└──────────┬───────────┴────────┬─────────┴──────────┬────────────┘
           │                   │                     │
           ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        cron/src/ Pipeline                        │
│  pipeline.ts → fetchNews.ts → rankHeadlines.ts → notify.ts       │
└──────────────────────────────┬──────────────────────────────────┘
                               │  reads/writes
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                 │
│  digests | global_digests | devices | user_preferences           │
└──────────────────────────────┬──────────────────────────────────┘
                               │  reads on notification tap
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React Native App (app/)                        │
│  App.tsx → hooks/useAppServices → screens → src/storage          │
└─────────────────────────────────────────────────────────────────┘
                               │
         ┌─────────────────────┴─────────────────────┐
         ▼                                           ▼
┌────────────────────┐                   ┌───────────────────────┐
│   shared/src/      │                   │   FCM (Firebase)      │
│  types, regions,   │                   │  push notifications   │
│  config schema     │                   └───────────────────────┘
└────────────────────┘
```

## Component Responsibilities

| Component                   | Responsibility                                                                     | File                                   |
| --------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| `api/daily-digest.ts`       | Vercel entry: fetch + rank + persist + FCM (null notify_at devices)                | `cron/api/daily-digest.ts`             |
| `api/notify.ts`             | Vercel entry: FCM to devices in current 30-min window                              | `cron/api/notify.ts`                   |
| `api/account.ts`            | Vercel entry: device registration (POST) and account deletion (DELETE)             | `cron/api/account.ts`                  |
| `pipeline.ts`               | Orchestrates staggered parallel `fetchDigest()` calls across regions               | `cron/src/pipeline.ts`                 |
| `fetchNews.ts`              | `PerplexitySource` — implements `DigestSource`; retry loop with recency windows    | `cron/src/fetchNews.ts`                |
| `rankHeadlines.ts`          | Per-region Claude reranking + cross-region global headline selection               | `cron/src/rankHeadlines.ts`            |
| `notify.ts` (cron)          | `persistDigests`, `persistGlobalDigest`, `dispatchFcm`, `sendNotifications`        | `cron/src/notify.ts`                   |
| `config.ts` (cron)          | Loads and merges `pulse.config.json`; env overrides; `checkCronSecret`             | `cron/src/config.ts`                   |
| `types.ts` (cron)           | `RegionHeadline`, `RegionDigest`, `DigestSource`, `DigestUsage`                    | `cron/src/types.ts`                    |
| `prompt.ts`                 | All Perplexity + Claude prompt builders                                            | `cron/src/prompt.ts`                   |
| `regions.ts`                | `resolveRegions()` — wraps `ALL_REGIONS` from `@shared/regions`                    | `cron/src/regions.ts`                  |
| `logging.ts`                | Winston logger factory                                                             | `cron/src/logging.ts`                  |
| `bootstrap.ts`              | dotenv loader — must be first import in all cron runners                           | `cron/src/bootstrap.ts`                |
| `lib/perplexityClient.ts`   | HTTP client with iterative retry for Perplexity Sonar API                          | `cron/src/lib/perplexityClient.ts`     |
| `lib/parseHeadlines.ts`     | URL resolution + quality annotation                                                | `cron/src/lib/parseHeadlines.ts`       |
| `lib/urlUtils.ts`           | Article URL validation and slug extraction                                         | `cron/src/lib/urlUtils.ts`             |
| `lib/topicUtils.ts`         | Jaccard deduplication, topic spread                                                | `cron/src/lib/topicUtils.ts`           |
| `lib/textUtils.ts`          | `stripCitations`, `summaryHasUrl`                                                  | `cron/src/lib/textUtils.ts`            |
| App.tsx                     | Root: font loading, screen routing; composes `useAppServices` + `useAppNavigation` | `app/App.tsx`                          |
| `useAppServices`            | Aggregates auth + device + preferences + theme for App.tsx                         | `app/src/hooks/useAppServices.ts`      |
| `useAppNavigation`          | Nav state + Android back + FCM routing + auth-gate redirects                       | `app/src/hooks/useAppNavigation.ts`    |
| `useSupabaseAuth`           | Session management — sign in/up/out/reset/delete                                   | `app/src/hooks/useSupabaseAuth.ts`     |
| `useDeepLinkRecovery`       | `pulse://reset-password` PKCE + implicit token exchange                            | `app/src/hooks/useDeepLinkRecovery.ts` |
| `useDigest`                 | Module-level cache + stale window + `forceRefresh`                                 | `app/src/hooks/useDigest.ts`           |
| `useCurrencyRates`          | jsDelivr/Cloudflare fallback; % change; module-level cache                         | `app/src/hooks/useCurrencyRates.ts`    |
| `storage/preferences.ts`    | MMKV cache + Supabase pull/push; conflict resolution via `updatedAt`               | `app/src/storage/preferences.ts`       |
| `storage/digests.ts`        | Cache-first digest storage; stale window; immutable past dates                     | `app/src/storage/digests.ts`           |
| `storage/mmkv.ts`           | Shared MMKV instance                                                               | `app/src/storage/mmkv.ts`              |
| `supabase/client.ts`        | Lazy Supabase client; MMKV-backed session persistence                              | `app/src/supabase/client.ts`           |
| `notifications/register.ts` | FCM token + Supabase upsert; `linkDeviceToUser`; `registerNotificationHandlers`    | `app/src/notifications/register.ts`    |
| `shared/src/types.ts`       | Shared domain types: `Headline`, `Digest`, `Region`, `UserPreferences`             | `shared/src/types.ts`                  |
| `shared/src/regions.ts`     | Region code constants and metadata; `ALL_REGIONS`                                  | `shared/src/regions.ts`                |
| `shared/src/config.ts`      | `pulse.config.json` loader + schema                                                | `shared/src/config.ts`                 |

## Pattern Overview

**Overall:** Serverless cron pipeline + React Native consumer, decoupled through Supabase as the shared data store.

**Key Characteristics:**

- Cron produces data (digests) and triggers delivery (FCM); app only consumes
- No direct cron-to-app communication — FCM tap drives a Supabase read
- `shared/` is a zero-dependency source tree compiled by both consumers via TS path alias, not a published package
- No npm workspaces; each package (`cron/`, `app/`) installs and builds independently

## Layers

**Shared Types/Config Layer:**

- Purpose: Single source of truth for cross-package types and config schema
- Location: `shared/src/`
- Contains: TypeScript types, region constants, config loader
- Depends on: nothing (zero imports from `app/` or `cron/`)
- Used by: `cron/src/**` and `app/src/**` via `@shared/*` alias

**Cron API Layer (Vercel Handlers):**

- Purpose: HTTP entry points for Vercel cron schedule and device management
- Location: `cron/api/`
- Contains: Three serverless handlers (`daily-digest.ts`, `notify.ts`, `account.ts`)
- Depends on: `cron/src/` pipeline modules
- Used by: Vercel runtime (scheduled + on-demand)

**Cron Pipeline Layer:**

- Purpose: Orchestrates the full fetch → rank → persist → notify flow
- Location: `cron/src/pipeline.ts`, `cron/src/fetchNews.ts`, `cron/src/rankHeadlines.ts`, `cron/src/notify.ts`
- Contains: Business logic for news processing
- Depends on: `cron/src/lib/`, `cron/src/config.ts`, `@shared/*`
- Used by: `cron/api/` handlers

**Cron Utilities Layer:**

- Purpose: Stateless helpers for text, URL, and topic processing
- Location: `cron/src/lib/`
- Contains: `perplexityClient.ts`, `parseHeadlines.ts`, `urlUtils.ts`, `topicUtils.ts`, `textUtils.ts`
- Depends on: nothing from `cron/src/` business logic (leaf layer)
- Used by: pipeline layer (`fetchNews.ts`, `rankHeadlines.ts`)

**App Hooks Layer:**

- Purpose: Business logic for auth, data fetching, navigation, and preferences
- Location: `app/src/hooks/`
- Contains: `useAppServices`, `useAppNavigation`, `useSupabaseAuth`, `useDeepLinkRecovery`, `useDigest`, `useCurrencyRates`
- Depends on: `app/src/storage/`, `app/src/supabase/`, `app/src/notifications/`, `@shared/*`
- Used by: `App.tsx` and screen components

**App Storage Layer:**

- Purpose: Local persistence (MMKV) with Supabase cloud sync
- Location: `app/src/storage/`
- Contains: `mmkv.ts`, `preferences.ts`, `digests.ts`
- Depends on: `app/src/supabase/client.ts`
- Used by: hooks layer

**App Infrastructure Layer:**

- Purpose: Platform clients, logging, configuration
- Location: `app/src/supabase/`, `app/src/notifications/`, `app/src/logger.ts`, `app/src/config.ts`
- Contains: Supabase client, FCM registration, structured logger, typed config
- Depends on: `@shared/*`, external SDKs
- Used by: storage layer, hooks layer

## Data Flow

### Daily Digest Production (05:00 UTC)

1. Vercel fires cron → `api/daily-digest.ts` (`cron/api/daily-digest.ts`)
2. `bootstrap.ts` loads `.env`; `config.ts` merges `pulse.config.json` with defaults
3. `pipeline.ts` `runFetchPipeline()` — staggered `Promise.allSettled` per region
4. Each region: `fetchNews.ts` `PerplexitySource` → Perplexity Sonar API → URL resolve + dedup (`cron/src/lib/`)
5. `rankHeadlines.ts` — per-region Claude reorder, then global cross-region selection
6. `notify.ts` `persistDigests()` — evicts old rows, upserts `digests` table in Supabase
7. `notify.ts` `persistGlobalDigest()` — upserts `global_digests` table
8. `notify.ts` `sendNotifications()` — FCM multicast to devices where `notify_at IS NULL`

### Scheduled Per-Device Notification (every 30 min)

1. Vercel fires cron → `api/notify.ts`
2. Queries `devices` for rows where `notify_at` matches current 30-min window
3. `sendNotifications()` dispatches FCM; stale UNREGISTERED tokens deleted

### App Digest Consumption (on FCM tap)

1. FCM tap → `useAppNavigation` `registerNotificationHandlers()` (`app/src/hooks/useAppNavigation.ts`)
2. Forces full remote refetch via `useDigest` `forceRefresh()` (`app/src/hooks/useDigest.ts`)
3. `storage/digests.ts` checks MMKV cache staleness; fetches from Supabase `digests` table if stale
4. Navigates to `DigestScreen` for today's date

### Password Reset Deep Link

1. Email link opens `pulse://reset-password?code=…` or `pulse://reset-password#access_token=…`
2. `useDeepLinkRecovery` (`app/src/hooks/useDeepLinkRecovery.ts`) — PKCE exchange or direct `setSession`
3. Navigates to `ResetPasswordScreen`

**State Management:**

- App: React hooks + MMKV for local persistence; no global state library
- Cron: stateless per invocation (no in-memory state between runs); all state in Supabase

## Key Abstractions

**`DigestSource` Interface:**

- Purpose: Contract for news-fetching backends (allows swapping Perplexity for another source)
- Examples: `cron/src/fetchNews.ts` (`PerplexitySource` implements it)
- Pattern: Interface defined in `cron/src/types.ts`; `createSource()` factory in `cron/src/config.ts`

**`@shared/*` Path Alias:**

- Purpose: Allows both `cron/` and `app/` to import shared types without relative `../shared/` paths
- Configured in: `cron/tsconfig.json` paths, `app/tsconfig.json` paths, `cron/jest.config.cjs` moduleNameMapper
- Resolves to: `../shared/src/*`

**MMKV Storage Layer:**

- Purpose: Synchronous on-device persistence; replaces AsyncStorage
- Shared instance: `app/src/storage/mmkv.ts`
- Used by: `preferences.ts`, `digests.ts`, and `supabase/client.ts` (session persistence)

**`pulse.config.json`:**

- Purpose: Runtime configuration knob for both cron behavior and app display
- App copy: `shared/pulse.config.json` (loaded by `app/src/config.ts` and `shared/src/config.ts`)
- Cron copy: `cron/pulse.config.json` (separate file with cron-specific keys; loaded by `cron/src/config.ts`)

## Entry Points

**`cron/api/daily-digest.ts`:**

- Location: `cron/api/daily-digest.ts`
- Triggers: Vercel cron at `0 5 * * *` (05:00 UTC daily)
- Responsibilities: Full pipeline — fetch, rank, persist, FCM for null-notify_at devices

**`cron/api/notify.ts`:**

- Location: `cron/api/notify.ts`
- Triggers: Vercel cron at `*/30 * * * *` (every 30 minutes)
- Responsibilities: FCM dispatch for devices whose `notify_at` falls in current window

**`cron/api/account.ts`:**

- Location: `cron/api/account.ts`
- Triggers: HTTP POST (device register) or DELETE (account delete) from the app
- Responsibilities: Supabase device upsert and cascading account deletion

**`app/App.tsx`:**

- Location: `app/App.tsx`
- Triggers: React Native app start
- Responsibilities: Font loading, auth state, screen routing via `useAppServices` + `useAppNavigation`

## Architectural Constraints

- **Threading:** Cron runs in a single-threaded Node.js serverless environment; parallel region fetches use `Promise.allSettled` with stagger delay (not worker threads)
- **Global state:** No module-level singletons in cron (all state in Supabase); app uses module-level cache in `useDigest.ts` and `useCurrencyRates.ts` for in-process memoization
- **Circular imports:** `shared/` has zero imports from `cron/` or `app/` — enforced by convention; no automated check yet
- **No npm workspaces:** `cron/` and `app/` have independent `node_modules/`; `shared/` has no `package.json` and is never published
- **Android only:** `app/` has no iOS-specific code; `ios/` is not committed

## Anti-Patterns

### Importing `app/` or `cron/` from `shared/`

**What happens:** A `shared/src/` file imports from `../app/` or `../cron/`
**Why it's wrong:** `shared/` is the dependency root; circular imports break both TypeScript compilation and test isolation
**Do this instead:** If logic is needed in `shared/`, define it there and export it; never import from consumers

### Using `console.log` directly in cron/

**What happens:** `console.log` calls scattered in `cron/src/`
**Why it's wrong:** ESLint rule `no-console` warns on these; structured context is lost; inconsistent log levels
**Do this instead:** Import the Winston logger from `cron/src/logging.ts` and use `logger.info()`, `logger.error()`, etc.

### Importing `@shared/*` without the `type` keyword for type-only imports

**What happens:** `import { Headline } from '@shared/types'` instead of `import type { Headline } from '@shared/types'`
**Why it's wrong:** ESLint rule `@typescript-eslint/consistent-type-imports` enforces `import type` for type-only imports; CI will fail
**Do this instead:** `import type { Headline } from '@shared/types';`

## Error Handling

**Strategy:** Fail-fast on configuration errors; `Promise.allSettled` for region-level failures in cron (one region failing does not abort others); surface errors via Winston logger before rethrowing or swallowing at the API boundary.

**Patterns:**

- Cron API handlers catch top-level errors and return HTTP 500 to Vercel
- `fetchNews.ts` retry loop uses a configurable `maxAttempts` + `retryDelay` before giving up on a region
- FCM stale token cleanup: `UNREGISTERED` error code triggers deletion from `devices` table inline during `sendNotifications()`

## Cross-Cutting Concerns

**Logging:** Winston in `cron/` (`cron/src/logging.ts`); structured logger in `app/` (`app/src/logger.ts`) with level sourced from `pulse.config.json`
**Validation:** Config validated at startup in `cron/src/config.ts` (`checkCronSecret`); no runtime schema validation library detected
**Authentication:** Supabase Auth for the app (email + password); cron uses Supabase service-role key (bypasses RLS) for all write operations; app uses publishable key for reads and preference writes

---

_Architecture analysis: 2026-05-24_
