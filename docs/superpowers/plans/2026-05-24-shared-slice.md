# shared slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `shared/` package — canonical types, config schema, region constants, and merged runtime config — so every downstream slice has a single source of truth to import from via `@shared/*`.

**Architecture:** Three type-only source files (`types.ts`, `regions.ts`, `config.ts`) and one merged runtime JSON (`pulse.config.json`) under `shared/`. No logic lives here — this slice is purely contracts. Existing TS path aliases (`@shared/*` → `../shared/src/*`) are already wired in both package tsconfigs and the cron Jest config; this slice populates the files they point to.

**Tech Stack:** TypeScript (type declarations only), Node.js/ts-jest for smoke tests

**Spec:** `docs/superpowers/specs/2026-05-24-shared-slice-design.md`
**Legacy reference:** `/home/hp/projects/pulse-news-legacy/`

---

## File Map

| Action | Path                            | Purpose                                                                    |
| ------ | ------------------------------- | -------------------------------------------------------------------------- |
| Create | `shared/src/regions.ts`         | `ContinentName`, `Region`, `REGIONS` — direct port from legacy             |
| Create | `shared/src/types.ts`           | All cross-package domain types                                             |
| Create | `shared/src/config.ts`          | `AppConfig`, `PulseConfig` + sub-types, `SharedConfig` wrapper — type-only |
| Create | `shared/pulse.config.json`      | Merged runtime config (`app` + `cron` subtrees)                            |
| Create | `app/jest.config.cjs`           | Jest config for app package with `@shared/*` moduleNameMapper              |
| Create | `cron/src/tests/shared.test.ts` | Smoke test — verifies `@shared/*` imports and spot-checks values           |
| Delete | `shared/src/.gitkeep`           | Replaced by real source files                                              |

---

## Task 1: Create feature branch

- [ ] **Step 1: Create and switch to the feature branch**

```bash
git checkout -b feat/shared
```

Expected: `Switched to a new branch 'feat/shared'`

---

## Task 2: Write the smoke test (TDD — will fail until shared files exist)

**Files:**

- Create: `cron/src/tests/shared.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// cron/src/tests/shared.test.ts
import { REGIONS } from '@shared/regions';
import type { Headline, UserPreferences, SharedConfig } from '@shared/types';
import type { PulseConfig, AppConfig } from '@shared/config';

describe('@shared/regions', () => {
  it('exports 9 regions', () => {
    expect(REGIONS).toHaveLength(9);
  });

  it('every region has required fields', () => {
    for (const r of REGIONS) {
      expect(r.region).toBeTruthy();
      expect(r.country).toMatch(/^[A-Z]{2}$/);
      expect(r.currency).toMatch(/^[A-Z]{3}$/);
      expect(r.sources.length).toBeGreaterThan(0);
    }
  });

  it('Hungary is first in display order', () => {
    expect(REGIONS[0]?.region).toBe('Hungary');
  });
});

describe('@shared/types type smoke', () => {
  it('Headline shape compiles', () => {
    const h: Headline = {
      title: 'Test',
      summary: 'Summary',
      url: 'https://example.com',
    };
    expect(h.title).toBe('Test');
  });

  it('UserPreferences shape compiles', () => {
    const prefs: UserPreferences = {
      selectedRegions: ['Hungary'],
      headlineCount: 5,
      regionHeadlineCounts: {},
      historyDays: 7,
      notifyTime: '07:00',
      openLinksIn: 'in-app',
      regionStyle: 'flag',
      baseCurrency: 'USD',
      showCurrencyRates: true,
      showGlobalHeadlines: false,
      globalHeadlineCount: 5,
      theme: 'light',
      aesthetic: 'editorial',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(prefs.selectedRegions).toContain('Hungary');
  });
});

describe('@shared/config type smoke', () => {
  it('SharedConfig subtree shape compiles', () => {
    const cfg: Pick<SharedConfig, 'app'> = {
      app: {
        screenStateTtlMs: 1800000,
        splashAdvanceMs: 900,
        deviceRegistrationTimeoutMs: 10000,
        prefsDebounceMs: 100,
        logLevel: 'info',
        digestStaleMins: 60,
        currencyStaleMins: 5,
        fetchCount: 5,
      },
    };
    expect(cfg.app.screenStateTtlMs).toBe(1800000);
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails with module-not-found**

```bash
cd cron && npm test -- --testPathPattern=shared.test
```

Expected: FAIL — `Cannot find module '@shared/regions'` (or similar). This proves the test is wired correctly and the imports are missing.

---

## Task 3: Create `shared/src/regions.ts`

**Files:**

- Create: `shared/src/regions.ts`

- [ ] **Step 1: Create the file (direct port from legacy)**

```typescript
// shared/src/regions.ts
export type ContinentName = 'Europe' | 'Middle East' | 'Asia' | 'Americas';

export interface Region {
  /** Display name and primary key everywhere — must match the DB `region` column. */
  region: string;
  /** ISO 3166-1 alpha-2. Used for flag image lookup. */
  country: string;
  /** Short display label shown when the user prefers codes over flags. */
  code: string;
  continent: ContinentName;
  /** ISO 4217 currency code for the primary currency of this region. */
  currency: string;
  /** Preferred news outlets passed to the cron prompt. Ignored by the app. */
  sources: string[];
}

/** All regions the app and cron currently support, in display order. */
export const REGIONS: Region[] = [
  {
    region: 'Hungary',
    country: 'HU',
    code: 'HU',
    continent: 'Europe',
    currency: 'HUF',
    sources: [
      'Telex (telex.hu)',
      'HVG (hvg.hu)',
      '444 (444.hu)',
      'Hungary Today (hungarytoday.hu)',
    ],
  },
  {
    region: 'Ukraine',
    country: 'UA',
    code: 'UA',
    continent: 'Europe',
    currency: 'UAH',
    sources: [
      'Kyiv Independent (kyivindependent.com)',
      'Ukrinform (ukrinform.ua)',
      'RFE/RL Ukraine (rferl.org)',
    ],
  },
  {
    region: 'Russia',
    country: 'RU',
    code: 'RU',
    continent: 'Europe',
    currency: 'RUB',
    sources: [
      'Moscow Times (themoscowtimes.com)',
      'Meduza (meduza.io)',
      'RFE/RL Russia (rferl.org)',
    ],
  },
  {
    region: 'United Kingdom',
    country: 'GB',
    code: 'GB',
    continent: 'Europe',
    currency: 'GBP',
    sources: [
      'BBC News (bbc.co.uk/news)',
      'The Guardian (theguardian.com)',
      'Sky News (news.sky.com)',
      'The Independent (independent.co.uk)',
    ],
  },
  {
    region: 'Israel',
    country: 'IL',
    code: 'IL',
    continent: 'Middle East',
    currency: 'ILS',
    sources: [
      'Jerusalem Post (jpost.com)',
      'Haaretz (haaretz.com)',
      'Reuters Israel (reuters.com)',
      'Ynet News (ynetnews.com)',
    ],
  },
  {
    region: 'Iran',
    country: 'IR',
    code: 'IR',
    continent: 'Middle East',
    currency: 'IRR',
    sources: [
      'Iran International (iranintl.com)',
      'RFE/RL Iran (rferl.org)',
      'Al Jazeera Iran (aljazeera.com)',
    ],
  },
  {
    region: 'China',
    country: 'CN',
    code: 'CN',
    continent: 'Asia',
    currency: 'CNY',
    sources: [
      'South China Morning Post (scmp.com)',
      'Caixin Global (caixinglobal.com)',
      'Reuters China (reuters.com)',
    ],
  },
  {
    region: 'India',
    country: 'IN',
    code: 'IN',
    continent: 'Asia',
    currency: 'INR',
    sources: [
      'The Hindu (thehindu.com)',
      'NDTV (ndtv.com)',
      'Hindustan Times (hindustantimes.com)',
      'The Wire (thewire.in)',
    ],
  },
  {
    region: 'United States',
    country: 'US',
    code: 'US',
    continent: 'Americas',
    currency: 'USD',
    sources: [
      'AP News (apnews.com)',
      'Reuters (reuters.com)',
      'Politico (politico.com)',
      'The Hill (thehill.com)',
      'Axios (axios.com)',
    ],
  },
];
```

- [ ] **Step 2: Run the regions tests only — confirm they pass, type tests still fail**

```bash
cd cron && npm test -- --testPathPattern=shared.test
```

Expected: `@shared/regions` describe block: 3 PASS. `@shared/types` and `@shared/config` describe blocks: still FAIL with module-not-found.

- [ ] **Step 3: Commit**

```bash
git add shared/src/regions.ts cron/src/tests/shared.test.ts
git commit -m "feat(shared): add regions constants and smoke test"
```

---

## Task 4: Create `shared/src/types.ts`

**Files:**

- Create: `shared/src/types.ts`

- [ ] **Step 1: Create the file**

```typescript
// shared/src/types.ts
export type { ContinentName, Region } from './regions';

// ── Headlines ───────────────────────────────────────────────────────

/** A single headline. Canonical cross-package type (unifies legacy app.Headline and cron.RegionHeadline). */
export interface Headline {
  title: string;
  summary: string;
  /** 3-4 sentence deep-dive. Absent on old cached digests. */
  detail?: string;
  url: string;
  category?: string;
  sourceName?: string;
}

/** Payload stored in `digests.payload` JSONB. One row per (region, date). */
export interface RegionDigestPayload {
  headlines: Headline[];
}

/** A globally-important headline selected across all regions. */
export interface GlobalHeadline {
  title: string;
  summary: string;
  detail?: string;
  url: string;
  region: string;
  sourceName?: string;
}

/** Payload stored in `global_digests.payload` JSONB. One row per date. */
export interface GlobalDigestPayload {
  headlines: GlobalHeadline[];
}

/** A region's digest for a specific date, as the app consumes it. */
export interface RegionDigest {
  region: string;
  /** ISO date YYYY-MM-DD. */
  date: string;
  headlines: Headline[];
}

/** A whole day's digest across all regions the user reads. */
export interface DailyDigest {
  /** ISO date YYYY-MM-DD. */
  date: string;
  regions: Record<string, Headline[]>;
}

// ── Settings ────────────────────────────────────────────────────────

export type ThemeId = 'light' | 'sepia' | 'dark';
export type AestheticId = 'editorial' | 'clinical' | 'brutalist';
export type ScreenId = 'login' | 'splash' | 'digest' | 'settings';

export interface UserPreferences {
  selectedRegions: string[];
  headlineCount: number;
  /** Per-region headline count overrides. Missing key → fall back to `headlineCount`. */
  regionHeadlineCounts: Record<string, number>;
  historyDays: number;
  /** "HH:MM" 24h. */
  notifyTime: string;
  openLinksIn: 'in-app' | 'browser';
  regionStyle: 'flag' | 'code';
  baseCurrency: string;
  showCurrencyRates: boolean;
  showGlobalHeadlines: boolean;
  globalHeadlineCount: number;
  theme: ThemeId;
  aesthetic: AestheticId;
  /** ISO timestamp. Used for Supabase ↔ local conflict resolution: newer wins. */
  updatedAt: string;
}

// ── Devices (Supabase) ──────────────────────────────────────────────

/** Mirrors the `devices` row exactly (Supabase column names → camelCase). */
export interface DeviceRow {
  id: string;
  fcmToken: string;
  notifyAt: string | null;
  updatedAt: string;
}
```

- [ ] **Step 2: Run the test — regions + types describe blocks should pass**

```bash
cd cron && npm test -- --testPathPattern=shared.test
```

Expected: `@shared/regions` 3 PASS, `@shared/types type smoke` 2 PASS. `@shared/config` still FAIL.

- [ ] **Step 3: Commit**

```bash
git add shared/src/types.ts
git commit -m "feat(shared): add cross-package domain types"
```

---

## Task 5: Create `shared/src/config.ts`

**Files:**

- Create: `shared/src/config.ts`

- [ ] **Step 1: Create the file**

```typescript
// shared/src/config.ts

// ── Shared ──────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ── App config ──────────────────────────────────────────────────────

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

// ── Cron config ─────────────────────────────────────────────────────

export interface ModelConfig {
  name: string;
  reasoningEffort: string;
  temperature: number;
  searchType: string;
  searchContextSize: string;
}

export interface FetchConfig {
  count: number;
  summarySentences: number;
  detailSentences: number;
  maxAttempts: number;
  attemptDelay: number;
  retryDelay: number;
  minResults: number;
  recencySequence: Array<'hour' | 'day' | 'week' | 'month' | 'year'>;
  buffer: number;
}

export interface RankingLocalConfig {
  enabled: boolean;
  model: string;
  maxTokens: number;
}

export interface RankingGlobalConfig {
  enabled: boolean;
  count: number;
  model: string;
  maxTokens: number;
  chunkSize: number;
}

export interface RankingConfig {
  local: RankingLocalConfig;
  global: RankingGlobalConfig;
}

export interface ApiConfig {
  regions: string[];
  fetch: FetchConfig;
  ranking: RankingConfig;
}

export interface DbConfig {
  evict: boolean;
  evictDays: number;
}

export interface LogConfig {
  level: LogLevel;
  qualityLog: boolean;
}

export interface PulseConfig {
  model: ModelConfig;
  api: ApiConfig;
  db: DbConfig;
  log: LogConfig;
}

// ── Top-level wrapper ────────────────────────────────────────────────

export interface SharedConfig {
  app: AppConfig;
  cron: PulseConfig;
}
```

- [ ] **Step 2: Run all smoke tests — all three describe blocks should pass**

```bash
cd cron && npm test -- --testPathPattern=shared.test
```

Expected: ALL PASS — 7 tests total across 3 describe blocks.

- [ ] **Step 3: Commit**

```bash
git add shared/src/config.ts
git commit -m "feat(shared): add config type schema (AppConfig, PulseConfig, SharedConfig)"
```

---

## Task 6: Create `shared/pulse.config.json`

**Files:**

- Create: `shared/pulse.config.json`

- [ ] **Step 1: Create the merged runtime config**

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
        "local": {
          "enabled": true,
          "model": "claude-sonnet-4-6",
          "maxTokens": 256
        },
        "global": {
          "enabled": true,
          "count": 5,
          "model": "claude-sonnet-4-6",
          "maxTokens": 512,
          "chunkSize": 25
        }
      }
    },
    "db": {
      "evict": false,
      "evictDays": 14
    },
    "log": {
      "level": "debug",
      "qualityLog": true
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/pulse.config.json
git commit -m "feat(shared): add merged pulse.config.json (app + cron subtrees)"
```

---

## Task 7: Create `app/jest.config.cjs` and clean up `.gitkeep`

**Files:**

- Create: `app/jest.config.cjs`
- Delete: `shared/src/.gitkeep`

- [ ] **Step 1: Create the app Jest config**

```javascript
// app/jest.config.cjs
'use strict';

/** @type {import('jest').Config} */
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

- [ ] **Step 2: Delete the placeholder**

```bash
rm shared/src/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add app/jest.config.cjs
git rm shared/src/.gitkeep
git commit -m "feat(shared): add app jest config, remove .gitkeep"
```

---

## Task 8: Full verification

- [ ] **Step 1: Typecheck `cron/`**

```bash
cd cron && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Typecheck `app/`**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all cron tests**

```bash
cd cron && npm test
```

Expected: all PASS (7 tests in `shared.test.ts`).

- [ ] **Step 4: Run cron lint**

```bash
cd cron && npx eslint --ext .ts src
```

Expected: no errors.

- [ ] **Step 5: Run prettier check from root**

```bash
npm run format:check
```

Expected: no formatting issues. If issues found, run `npm run format` and commit:

```bash
npm run format
git add -A
git commit -m "style: format shared slice files"
```

---

## Task 9: Open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/shared
```

- [ ] **Step 2: Run `/code-review` before opening the PR**

(No security review needed — this slice has no auth, API endpoints, notifications, or deep links.)

- [ ] **Step 3: Open the PR**

PR title: `feat: shared package — types, config schema, region constants`

PR description must include:

- Link to legacy files replaced: `legacy/shared/regions.ts`, `legacy/app/src/types.ts`, `legacy/app/src/config.ts`, `legacy/cron/src/config.ts` (types only)
- Target branch: `develop`
