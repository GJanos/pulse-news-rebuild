# Design: Phase 1 — `shared` slice

**Date:** 2026-05-24
**Slice:** 1 of 14
**Branch:** `feat/shared`
**Legacy reference:** `/home/hp/projects/pulse-news-legacy/shared/regions.ts`, `app/src/types.ts`, `app/src/config.ts`, `cron/src/types.ts`, `cron/src/config.ts`

---

## Goal

Establish the `shared/` package as the single source of truth for all types, config schema, region/currency constants, and the merged runtime config. Every downstream slice imports from `@shared/*` — this slice sets those contracts.

---

## Files

### `shared/src/types.ts` (create)

Exports all cross-package domain types. Types are **type-only** — no runtime logic.

**From `legacy/app/src/types.ts`:**

- `Headline` — single headline (title, summary, detail?, url, category?, sourceName?). Unifies legacy `app.Headline` and `cron.RegionHeadline` — identical shapes, one canonical name.
- `RegionDigestPayload` — `{ headlines: Headline[] }` stored in `digests.payload` JSONB
- `GlobalHeadline` — headline with `region` field, stored in `global_digests.payload`
- `GlobalDigestPayload` — `{ headlines: GlobalHeadline[] }`
- `RegionDigest` — `{ region: string; date: string; headlines: Headline[] }` (app consumption shape)
- `DailyDigest` — `{ date: string; regions: Record<string, Headline[]> }`
- `ThemeId` — `'light' | 'sepia' | 'dark'`
- `AestheticId` — `'editorial' | 'clinical' | 'brutalist'`
- `ScreenId` — `'login' | 'splash' | 'digest' | 'settings'`
- `UserPreferences` — full user preferences shape (selectedRegions, headlineCount, regionHeadlineCounts, historyDays, notifyTime, openLinksIn, regionStyle, baseCurrency, showCurrencyRates, showGlobalHeadlines, globalHeadlineCount, theme, aesthetic, updatedAt)
- `DeviceRow` — mirrors Supabase `devices` row (id, fcmToken, notifyAt, updatedAt)

**Not in shared (cron-internal, stays in `cron/src/types.ts`):**

- `RegionDigest` with `usage`/`rankingUsage`/`attempts`/`quality` — pipeline type, not consumed by app
- `DigestUsage`, `DigestRequest`, `DigestSource` — cron pipeline internals
- `HeadlineQuality`, `DigestQuality` — quality logging types from `qualityLog.ts`

### `shared/src/regions.ts` (create)

Direct port of `legacy/shared/regions.ts`. No changes except path.

Exports:

- `ContinentName` type — `'Europe' | 'Middle East' | 'Asia' | 'Americas'`
- `Region` interface — region, country, code, continent, currency, sources
- `REGIONS` constant — all 9 supported regions in display order

### `shared/src/config.ts` (create)

**Types only — no runtime logic.** Exports the full config type tree.

**App config types (from `legacy/app/src/config.ts`):**

```typescript
export interface AppConfig {
  screenStateTtlMs: number;
  splashAdvanceMs: number;
  deviceRegistrationTimeoutMs: number;
  prefsDebounceMs: number;
  logLevel: LogLevel;
  digestStaleMins: number;
  currencyStaleMins: number;
  fetchCount: number;
}
```

**Cron config types (from `legacy/cron/src/config.ts`):**

- `LogLevel` — `'debug' | 'info' | 'warn' | 'error'`
- `ModelConfig`, `FetchConfig`, `RankingLocalConfig`, `RankingGlobalConfig`, `RankingConfig`
- `ApiConfig`, `DbConfig`, `LogConfig`, `PulseConfig`

**Top-level wrapper:**

```typescript
export interface SharedConfig {
  app: AppConfig;
  cron: PulseConfig;
}
```

### `shared/pulse.config.json` (create)

Merged from both legacy config files. Single source of truth.

```json
{
  "app": {
    "screenStateTtlMs": 1800000,
    "splashAdvanceMs": 900,
    "deviceRegistrationTimeoutMs": 10000,
    "prefsDebounceMs": 100,
    "logLevel": "debug",
    "digestStaleMins": 60,
    "currencyStaleMins": 5,
    "fetchCount": 5
  },
  "cron": {
    "model": {
      "name": "sonar-pro",
      "reasoningEffort": "low",
      "temperature": 0.35,
      "searchType": "pro",
      "searchContextSize": "medium"
    },
    "api": {
      "regions": [
        "Hungary",
        "Ukraine",
        "Russia",
        "India",
        "United States",
        "United Kingdom",
        "China",
        "Iran",
        "Israel"
      ],
      "fetch": {
        "count": 5,
        "summarySentences": 1,
        "detailSentences": 3,
        "maxAttempts": 4,
        "attemptDelay": 2000,
        "retryDelay": 3000,
        "minResults": 5,
        "recencySequence": ["day", "day", "week", "week", "month", "month"],
        "buffer": 1
      },
      "ranking": {
        "local": { "enabled": true, "model": "claude-sonnet-4-6", "maxTokens": 256 },
        "global": {
          "enabled": true,
          "count": 5,
          "model": "claude-sonnet-4-6",
          "maxTokens": 512,
          "chunkSize": 25
        }
      }
    },
    "db": { "evict": false, "evictDays": 14 },
    "log": { "level": "debug", "qualityLog": true }
  }
}
```

### `app/jest.config.cjs` (create)

```js
'use strict';
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  passWithNoTests: true,
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
};
```

### `shared/src/.gitkeep` (delete)

Replaced by real source files.

---

## What stays in `cron/` (not moved)

| What                                           | Stays in                 | Reason                           |
| ---------------------------------------------- | ------------------------ | -------------------------------- |
| `loadPulseConfig()`, `mergeConfig()`           | `cron/src/config.ts`     | Runtime logic — Phase 2          |
| `createSource()`, `checkCronSecret()`          | `cron/src/config.ts`     | Runtime logic — Phase 2/8        |
| `RegionDigest` (with usage/attempts)           | `cron/src/types.ts`      | Pipeline type, app never imports |
| `DigestUsage`, `DigestRequest`, `DigestSource` | `cron/src/types.ts`      | Cron-internal                    |
| `HeadlineQuality`, `DigestQuality`             | `cron/src/qualityLog.ts` | Quality logging, cron-internal   |

---

## Alias wiring (already done)

Both `cron/tsconfig.json` and `app/tsconfig.json` already have:

```json
"paths": { "@shared/*": ["../shared/src/*"] }
```

`cron/jest.config.cjs` already has:

```js
moduleNameMapper: { '^@shared/(.*)$': '<rootDir>/../shared/src/$1' }
```

No changes needed — just verified in context of this slice.

---

## Success Criteria

1. `cd cron && npx tsc --noEmit` passes
2. `cd app && npx tsc --noEmit` passes
3. `cd cron && npm test` passes — existing tests still resolve `@shared/*`
4. `shared/pulse.config.json` contains merged values from both legacy config files
5. `app/jest.config.cjs` exists with correct `moduleNameMapper`

---

## Out of Scope for this slice

- Config loading runtime (`loadPulseConfig`) — Phase 2
- Consuming `@shared/config` types in cron — Phase 2
- Consuming `@shared/config` types in app — Phase 9+
- Any app or cron logic files
