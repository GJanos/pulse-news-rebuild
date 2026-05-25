# Codebase Structure

**Analysis Date:** 2026-05-24

## Directory Layout

```
pulse-news/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions: format, lint, typecheck, test on PRs
├── .husky/
│   └── pre-commit              # lint-staged: prettier + tsc --noEmit on staged files
├── .planning/
│   └── codebase/               # GSD architecture/stack/testing docs (not committed code)
├── docs/
│   └── superpowers/
│       └── plans/              # Phase implementation plans
├── app/                        # React Native / Expo app (Android-first)
│   ├── assets/                 # Static assets: icon, splash, notification icon
│   ├── src/
│   │   ├── index.ts            # Package barrel (placeholder; currently empty export)
│   │   ├── App.tsx             # Root component (added by app/foundation slice)
│   │   ├── types.ts            # App-local domain types
│   │   ├── config.ts           # Typed re-export of pulse.config.json + API_URL
│   │   ├── data.ts             # Re-exports REGIONS from @shared; date helpers
│   │   ├── themes.ts           # THEMES, AESTHETICS, font() helper
│   │   ├── logger.ts           # Structured logger (level from pulse.config.json)
│   │   ├── supabase/
│   │   │   └── client.ts       # Lazy Supabase client; MMKV-backed session
│   │   ├── storage/
│   │   │   ├── mmkv.ts         # Shared MMKV instance
│   │   │   ├── preferences.ts  # MMKV + Supabase sync; updatedAt conflict resolution
│   │   │   └── digests.ts      # Cache-first; stale window; immutable past dates
│   │   ├── notifications/
│   │   │   └── register.ts     # FCM token upsert; linkDeviceToUser; handlers
│   │   └── hooks/
│   │       ├── useAppServices.ts       # Aggregates auth + device + prefs + theme
│   │       ├── useAppNavigation.ts     # Nav state, Android back, FCM routing
│   │       ├── useSupabaseAuth.ts      # sign in/up/out/reset/delete
│   │       ├── useDeepLinkRecovery.ts  # pulse://reset-password PKCE + implicit
│   │       ├── useDigest.ts            # Module-level cache + stale window + forceRefresh
│   │       └── useCurrencyRates.ts     # jsDelivr/Cloudflare fallback; % change
│   ├── .env.example            # Required env vars (never commit .env)
│   ├── .eslintrc.cjs           # Extends root .eslintrc.cjs
│   ├── package.json            # pulse-app; no workspaces
│   ├── tsconfig.json           # Extends ../tsconfig.base.json; @shared/* alias
│   ├── CLAUDE.md               # App-specific instructions for Claude
│   └── README.md               # Humans: Expo dev setup
├── cron/                       # Vercel serverless cron jobs (Node.js)
│   ├── api/
│   │   ├── daily-digest.ts     # Vercel handler: full pipeline, 05:00 UTC daily
│   │   ├── notify.ts           # Vercel handler: FCM per 30-min window
│   │   └── account.ts          # Vercel handler: device register / account delete
│   ├── src/
│   │   ├── index.ts            # Package barrel (placeholder; currently empty export)
│   │   ├── types.ts            # RegionHeadline, RegionDigest, DigestSource, DigestUsage
│   │   ├── config.ts           # pulse.config.json loader; env overrides; createSource()
│   │   ├── pipeline.ts         # runFetchPipeline: staggered Promise.allSettled per region
│   │   ├── fetchNews.ts        # PerplexitySource: retry loop, URL resolve, dedup
│   │   ├── rankHeadlines.ts    # Per-region + global Claude ranking
│   │   ├── notify.ts           # persistDigests, persistGlobalDigest, dispatchFcm
│   │   ├── prompt.ts           # All Perplexity + Claude prompt builders
│   │   ├── regions.ts          # resolveRegions(); re-exports ALL_REGIONS from @shared
│   │   ├── logging.ts          # Winston logger factory
│   │   ├── bootstrap.ts        # dotenv loader — first import in all runners
│   │   └── lib/
│   │       ├── perplexityClient.ts  # HTTP client with iterative retry
│   │       ├── parseHeadlines.ts    # URL resolution + quality annotation
│   │       ├── urlUtils.ts          # Article URL validation, slug extraction
│   │       ├── topicUtils.ts        # Jaccard deduplication, topic spread
│   │       └── textUtils.ts         # stripCitations, summaryHasUrl
│   ├── logs/                   # Per-run quality logs (gitignored except .gitkeep)
│   ├── .env.example            # Required env vars (never commit .env)
│   ├── .eslintrc.cjs           # Extends root .eslintrc.cjs
│   ├── jest.config.cjs         # ts-jest; @shared/* alias; 60% coverage threshold
│   ├── package.json            # pulse-cron; no workspaces
│   ├── tsconfig.json           # Extends ../tsconfig.base.json; @shared/* alias
│   ├── CLAUDE.md               # Cron-specific instructions for Claude
│   └── README.md               # Humans: Vercel/Supabase setup, env vars
├── shared/                     # Shared types/constants (no package.json)
│   ├── src/
│   │   ├── .gitkeep            # Placeholder; populated by shared slice
│   │   ├── types.ts            # Headline, Digest, Region, UserPreferences, …
│   │   ├── regions.ts          # ALL_REGIONS constants and metadata
│   │   └── config.ts           # pulse.config.json loader + schema
│   ├── pulse.config.json       # Runtime config for both app and cron
│   └── CLAUDE.md               # shared/ rules for Claude
├── supabase/
│   ├── schema.sql              # Reference DDL: devices, user_preferences, digests
│   └── README.md               # Schema notes (no executable code)
├── .eslintrc.cjs               # Root ESLint config; extended by app/ and cron/
├── .prettierrc                 # Prettier: semi, singleQuote, trailingComma all, width 100
├── tsconfig.base.json          # Shared TS compiler options (ES2020, strict, CommonJS)
├── vercel.json                 # Cron schedule: daily-digest 05:00, notify */30
├── package.json                # Root devtools: prettier, eslint, husky, lint-staged
├── BEHAVIOR.md                 # Acceptance spec: screens, cron steps, config keys, tables
├── REBUILD_PLAN.md             # Rebuild approach, slice order, discipline rules
├── CLAUDE.md                   # Repo-wide conventions for Claude
├── CODEOWNERS                  # All paths owned by GJanos
├── devlog.md                   # Running development log
└── todo.md                     # Parity snapshot + deferred improvements
```

## Directory Purposes

**`shared/src/`:**

- Purpose: Single source of truth for types and constants used by both `app/` and `cron/`
- Contains: TypeScript types (`types.ts`), region metadata (`regions.ts`), config schema (`config.ts`)
- Key files: `shared/src/types.ts`, `shared/src/regions.ts`, `shared/src/config.ts`
- Constraint: Zero imports from `app/` or `cron/`

**`cron/api/`:**

- Purpose: Vercel serverless function handlers — the HTTP entry points
- Contains: Three handlers corresponding to the three Vercel routes
- Key files: `cron/api/daily-digest.ts`, `cron/api/notify.ts`, `cron/api/account.ts`

**`cron/src/`:**

- Purpose: Pipeline business logic and utilities
- Contains: Pipeline orchestrator, news fetching, ranking, persistence, notification dispatch, config, logging
- Key files: `cron/src/pipeline.ts`, `cron/src/fetchNews.ts`, `cron/src/rankHeadlines.ts`, `cron/src/notify.ts`

**`cron/src/lib/`:**

- Purpose: Stateless leaf-layer helpers (no imports from `cron/src/` business logic)
- Contains: HTTP client, text processing, URL validation, deduplication utilities
- Key files: `cron/src/lib/perplexityClient.ts`, `cron/src/lib/topicUtils.ts`, `cron/src/lib/urlUtils.ts`

**`app/src/hooks/`:**

- Purpose: All app business logic expressed as React hooks
- Contains: Auth, navigation, data fetching, deep links, preferences
- Key files: `app/src/hooks/useAppServices.ts`, `app/src/hooks/useDigest.ts`, `app/src/hooks/useSupabaseAuth.ts`

**`app/src/storage/`:**

- Purpose: MMKV-backed local cache with Supabase cloud sync
- Contains: MMKV instance, preferences sync, digest cache
- Key files: `app/src/storage/preferences.ts`, `app/src/storage/digests.ts`, `app/src/storage/mmkv.ts`

**`app/src/supabase/`:**

- Purpose: Supabase client configured with MMKV session storage
- Key files: `app/src/supabase/client.ts`

**`app/src/notifications/`:**

- Purpose: FCM token registration and notification handler wiring
- Key files: `app/src/notifications/register.ts`

**`supabase/`:**

- Purpose: Schema reference only — DDL for creating tables and RLS policies
- Generated: No
- Committed: Yes (reference doc; not run automatically)

**`.planning/codebase/`:**

- Purpose: GSD architecture and convention documents written by `/gsd-map-codebase`
- Generated: Yes (by GSD tooling)
- Committed: Yes

## Key File Locations

**Entry Points:**

- `cron/api/daily-digest.ts`: Vercel cron handler — full pipeline
- `cron/api/notify.ts`: Vercel cron handler — scheduled FCM
- `cron/api/account.ts`: Vercel HTTP handler — device/account management
- `app/App.tsx`: React Native root component

**Configuration:**

- `shared/pulse.config.json`: Runtime config (regions, fetch params, display settings)
- `cron/tsconfig.json`: Cron TypeScript config; `@shared/*` alias
- `app/tsconfig.json`: App TypeScript config; `@shared/*` alias; `jsx: react-native`
- `tsconfig.base.json`: Shared compiler options extended by both packages
- `vercel.json`: Cron schedule definitions
- `.eslintrc.cjs`: Root ESLint config
- `.prettierrc`: Prettier config

**Core Logic:**

- `cron/src/pipeline.ts`: Parallel region fetch orchestration
- `cron/src/fetchNews.ts`: Perplexity API integration and retry logic
- `cron/src/rankHeadlines.ts`: Claude-based headline ranking
- `cron/src/notify.ts`: Supabase persistence + FCM dispatch
- `app/src/hooks/useDigest.ts`: Digest fetch, cache, and refresh logic
- `app/src/storage/preferences.ts`: User preferences with cloud sync

**Testing:**

- `cron/jest.config.cjs`: Jest config for cron (ts-jest, `@shared/*` alias, 60% coverage)
- `cron/src/**/*.test.ts`: Unit tests co-located in `src/` (pattern: `*.test.ts`)

## Naming Conventions

**Files:**

- TypeScript source: `camelCase.ts` (e.g., `fetchNews.ts`, `rankHeadlines.ts`, `topicUtils.ts`)
- React hooks: `useHookName.ts` in `app/src/hooks/` (e.g., `useDigest.ts`, `useSupabaseAuth.ts`)
- Vercel handlers: `kebab-case.ts` in `cron/api/` (e.g., `daily-digest.ts`)
- Test files: `*.test.ts` co-located with the module under test in `src/`
- Config files: `camelCase.json` or tool-specific names (`.eslintrc.cjs`, `jest.config.cjs`)

**Directories:**

- Lowercase, single-word where possible: `src/`, `lib/`, `hooks/`, `storage/`, `api/`
- Multi-word: `node_modules/` (managed)

**Classes and types:**

- PascalCase: `PerplexitySource`, `RegionDigest`, `DigestSource`
- Type aliases and interfaces: PascalCase (e.g., `Headline`, `UserPreferences`)

**Functions:**

- camelCase: `runFetchPipeline`, `persistDigests`, `sendNotifications`, `resolveRegions`
- React hooks: `use` prefix: `useDigest`, `useAppServices`

## Where to Add New Code

**New cron pipeline step (business logic):**

- Implementation: `cron/src/<stepName>.ts`
- Tests: `cron/src/<stepName>.test.ts` (co-located)
- Wire into pipeline: `cron/src/pipeline.ts` or the relevant `cron/api/` handler

**New cron utility (stateless helper):**

- Implementation: `cron/src/lib/<utilName>.ts`
- Tests: `cron/src/lib/<utilName>.test.ts` (co-located)
- Rule: No imports from `cron/src/` business logic — keep as leaf module

**New Vercel API endpoint:**

- Implementation: `cron/api/<endpoint-name>.ts`
- Add to `vercel.json` if it needs a cron schedule
- Import `bootstrap.ts` first; use `cron/src/config.ts` for config

**New app screen:**

- Implementation: `app/src/screens/<ScreenName>.tsx`
- Wire into navigator: `app/App.tsx` or relevant navigator file

**New app hook:**

- Implementation: `app/src/hooks/use<HookName>.ts`
- Tests: `app/src/hooks/use<HookName>.test.ts` (co-located; use Jest + ts-jest, no renderer for pure logic hooks)

**New shared type or constant (used by both packages):**

- Type: add to `shared/src/types.ts`
- Region/constant data: add to `shared/src/regions.ts`
- Config schema: add to `shared/src/config.ts` and `shared/pulse.config.json`
- Do NOT add `app/` or `cron/` imports here

**New app utility (used only by app):**

- Implementation: `app/src/<utilName>.ts` (e.g., `data.ts`, `themes.ts`)

**New Supabase table:**

- Add DDL to `supabase/schema.sql`
- Add RLS policies in the same file
- Document purpose in the table comment block

## Special Directories

**`cron/logs/`:**

- Purpose: Per-run quality log JSON files written when `log.qualityLog: true` in config
- Generated: Yes (at runtime by cron)
- Committed: No (gitignored); `.gitkeep` keeps directory tracked

**`shared/src/`:**

- Purpose: Compiled by both `cron/` and `app/` via `@shared/*` path alias — never published as a package
- Generated: No
- Committed: Yes

**`app/assets/`:**

- Purpose: Static app assets (icon, splash, notification icon)
- Generated: No
- Committed: Yes

**`.planning/`:**

- Purpose: GSD planning documents and codebase maps
- Generated: Yes (by GSD tooling)
- Committed: Yes (aids future Claude instances)

**`docs/superpowers/plans/`:**

- Purpose: Phase-by-phase implementation plans for each rebuild slice
- Generated: Yes (by GSD tooling)
- Committed: Yes

---

_Structure analysis: 2026-05-24_
