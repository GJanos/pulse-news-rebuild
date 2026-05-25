# cron/fetch Implementation Plan

**Goal:** Port the entire headline-fetch pipeline from legacy — types, URL utilities, text utilities, topic deduplication, Perplexity HTTP client, response parsing, fetch prompts, and `PerplexitySource`. `rankHeadlines` is stubbed as a pass-through and deferred to Phase 4.

**Branch:** `feat/cron-fetch`
**Legacy references:**

- `pulse-news-legacy/cron/src/types.ts`
- `pulse-news-legacy/cron/src/qualityLog.ts` (types only — logging behavior deferred)
- `pulse-news-legacy/cron/src/lib/textUtils.ts`
- `pulse-news-legacy/cron/src/lib/urlUtils.ts`
- `pulse-news-legacy/cron/src/lib/topicUtils.ts`
- `pulse-news-legacy/cron/src/lib/perplexityClient.ts`
- `pulse-news-legacy/cron/src/lib/parseHeadlines.ts`
- `pulse-news-legacy/cron/src/prompt.ts`
- `pulse-news-legacy/cron/src/fetchNews.ts`

**Spec:** this document

---

## What this slice delivers

| Export / File                 | Purpose                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `src/types.ts`                | All runtime types + quality signal types (consolidated from legacy types + qualityLog) |
| `src/logging.ts`              | `initializeLogger`, `getLogger` — Winston logger factory                               |
| `src/qualityLog.ts`           | `RunConfig`, `RunLog`, `buildLogPath`, `appendRunLog`                                  |
| `src/lib/textUtils.ts`        | `stripCitations`, `summaryHasUrl`                                                      |
| `src/lib/urlUtils.ts`         | URL filtering, slug extraction, match scoring                                          |
| `src/lib/topicUtils.ts`       | Jaccard deduplication, topic spread                                                    |
| `src/lib/perplexityClient.ts` | `callPerplexity` — HTTP client with iterative retry                                    |
| `src/lib/parseHeadlines.ts`   | `parseHeadlines` — URL resolution + quality annotation                                 |
| `src/prompt.ts`               | All prompt builders (fetch, ranking, global)                                           |
| `src/fetchNews.ts`            | `PerplexitySource implements DigestSource`                                             |

**Deferred to later phases:**

- `rankHeadlines` — depends on Anthropic SDK (Phase 4 / `cron/rank`)

---

## Key differences from legacy

| Legacy                                                               | New                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `HeadlineQuality`, `DigestQuality` in `qualityLog.ts`                | Moved to `types.ts` — only the type defs; file I/O stays in `qualityLog.ts`                |
| Dynamic `await import('./logging')` in `fetchDigest`                 | Static `import { getLogger } from './logging'`; call inside `fetchDigest`                  |
| Dynamic `await import('./lib/perplexityClient')` etc.                | Static imports throughout                                                                  |
| `rankHeadlines(collected, region, config)` called inline             | Stubbed: `{ headlines: collected.slice(0, count), usage: undefined }` + `// TODO: Phase 4` |
| `PulseConfig` declared locally in `config.ts`                        | Imported from `@shared/config`                                                             |
| `import type { HeadlineQuality, DigestQuality } from './qualityLog'` | `import type { HeadlineQuality, DigestQuality } from './types'`                            |
| `import { PulseConfig } from './config'` in `logging.ts`             | `import type { PulseConfig } from '@shared/config'`                                        |

---

## File map

| Action | Path                               | Purpose                                        |
| ------ | ---------------------------------- | ---------------------------------------------- |
| Create | `cron/src/types.ts`                | Runtime + quality types                        |
| Create | `cron/src/logging.ts`              | Winston logger factory                         |
| Create | `cron/src/qualityLog.ts`           | Run log types + file I/O                       |
| Create | `cron/src/lib/textUtils.ts`        | Citation stripping, URL detection in summaries |
| Create | `cron/src/lib/urlUtils.ts`         | URL validation, slug, match scoring            |
| Create | `cron/src/lib/topicUtils.ts`       | Topic deduplication, spread calculation        |
| Create | `cron/src/lib/perplexityClient.ts` | HTTP client with retry                         |
| Create | `cron/src/lib/parseHeadlines.ts`   | Response parser + URL resolution               |
| Create | `cron/src/prompt.ts`               | All prompt builders                            |
| Create | `cron/src/fetchNews.ts`            | `PerplexitySource` class                       |
| Create | `cron/src/tests/fetchNews.test.ts` | Unit tests — all testable pure functions       |

---

## Task 1: Create the branch

```bash
git checkout main && git pull && git checkout -b feat/cron-fetch
```

---

## Task 2: Port types

**File:** `cron/src/types.ts`

Consolidates `types.ts` + quality-type subset of `qualityLog.ts`. Excludes `RunConfig`, `RunLog`, `appendRunLog`, `buildLogPath`.

```typescript
export interface RegionHeadline {
  title: string;
  summary: string;
  detail?: string;
  url: string;
  category?: string;
  sourceName?: string;
}

export interface DigestUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface RegionDigest {
  region: string;
  headlines: RegionHeadline[];
  usage?: DigestUsage;
  rankingUsage?: DigestUsage;
  attempts: number;
  quality?: DigestQuality;
}

export interface DigestRequest {
  region: string;
  country: string;
  sources: string[];
  count?: number;
}

export interface DigestSource {
  fetchDigest(request: DigestRequest): Promise<RegionDigest>;
}

export interface HeadlineQuality {
  title: string;
  url: string;
  urlSource: 'search_results' | 'model';
  urlMatchScore: number;
  recencyRound: number;
  summaryHasUrl: boolean;
}

export interface DigestQuality {
  region: string;
  country: string;
  status: 'ok' | 'partial' | 'empty';
  attemptsUsed: number;
  recenciesUsed: string[];
  candidatesGenerated: number;
  urlFilterDropCount: number;
  modelFallbackCount: number;
  topicDropCount: number;
  filterRejectRate: number;
  avgUrlMatchScore: number;
  avgTopicSpread: number;
  headlines: HeadlineQuality[];
  usage: DigestUsage;
}
```

---

## Task 3: Port lib utilities + logging (copy-exact)

All files ported verbatim from legacy unless an import path changes.

### `cron/src/logging.ts`

Port exactly from `pulse-news-legacy/cron/src/logging.ts`.

One import change: `import { PulseConfig } from './config'` → `import type { PulseConfig } from '@shared/config'`.

### `cron/src/qualityLog.ts`

Port exactly from `pulse-news-legacy/cron/src/qualityLog.ts`.

Includes: `RunConfig`, `RunLog`, `buildLogPath`, `appendRunLog`. No import changes — uses only `fs`, `path`, and local interfaces.

Note: `HeadlineQuality` and `DigestQuality` are **not** exported from here — they live in `src/types.ts`. The `DigestQuality.usage` field is typed using `DigestUsage` from `./types` (not an inline object literal as in legacy).

### `cron/src/lib/textUtils.ts`

Port exactly from `pulse-news-legacy/cron/src/lib/textUtils.ts`.

### `cron/src/lib/urlUtils.ts`

Port exactly from `pulse-news-legacy/cron/src/lib/urlUtils.ts`.

### `cron/src/lib/topicUtils.ts`

Port exactly from `pulse-news-legacy/cron/src/lib/topicUtils.ts`.

### `cron/src/lib/perplexityClient.ts`

Port exactly from `pulse-news-legacy/cron/src/lib/perplexityClient.ts`.
The `PerplexityCompletion` interface is exported (already is in legacy).

### `cron/src/lib/parseHeadlines.ts`

Port exactly from `pulse-news-legacy/cron/src/lib/parseHeadlines.ts`.

One import change: `HeadlineQuality` comes from `../types` instead of `../qualityLog`.

---

## Task 4: Port `prompt.ts`

Port all four builders exactly from legacy:

- `buildFetchSystemPrompt(summarySentences, detailSentences)`
- `buildFetchUserPrompt(region, count, sources)`
- `buildRankingSystemPrompt()`
- `buildRankingUserPrompt(region, headlines)`
- `buildGlobalSystemPrompt()`
- `buildGlobalUserPrompt(candidates, count)`

No changes — pure string functions.

---

## Task 5: Port `fetchNews.ts`

**File:** `cron/src/fetchNews.ts`

Changes from legacy:

1. **Static imports** — replace all `await import(...)` with top-level static imports.

2. **Logger** — replace dynamic `await import('./logging')` with a static top-level import:

   ```typescript
   import { getLogger } from './logging';
   ```

   Inside `fetchDigest`, call `const logger = getLogger('fetchNews');` exactly as in legacy — just no `await import` wrapper. The `Log` type alias is kept as a local structural type used in `callPerplexity` and `parseHeadlines` parameter signatures.

3. **rankHeadlines stub** — replace the `rankHeadlines` call in `fetchDigest` with a pass-through:

   ```typescript
   // TODO: Phase 4 — replace with real rankHeadlines
   const headlines = collected.slice(0, count);
   const rankingUsage = undefined;
   ```

   The `quality` object construction and `RegionDigest` return remain identical to legacy.

4. **Type imports** — `HeadlineQuality`, `DigestQuality`, `RegionHeadline`, `RegionDigest`, `DigestRequest`, `DigestSource` all come from `./types`. `PulseConfig` from `@shared/config`.

5. **`PerplexityCompletion`** — imported from `./lib/perplexityClient` (it's already exported there) rather than re-declared locally.

6. **`ParseResult`** interface — keep as a local interface in `fetchNews.ts` (not in types.ts — it's an implementation detail of the parse loop).

---

## Task 6: Write tests

**File:** `cron/src/tests/fetchNews.test.ts`

Test only pure functions — skip HTTP calls and the full `fetchDigest` integration.

### `textUtils`

```typescript
describe('stripCitations', () => {
  it('removes [1], [12], [1][2] markers and collapses whitespace', () => { ... });
  it('returns unchanged string when no citations present', () => { ... });
});

describe('summaryHasUrl', () => {
  it('returns true when summary contains http(s) link', () => { ... });
  it('returns false when no URL present', () => { ... });
});
```

### `urlUtils`

```typescript
describe('isArticleUrl', () => {
  it('returns false for youtube.com', () => { ... });
  it('returns true for a news article URL', () => { ... });
});

describe('urlSlug', () => {
  it('returns last path segment', () => { ... });
  it('returns empty string for invalid URL', () => { ... });
});

describe('isValidHeadlineUrl', () => {
  it('rejects homepage (path = /)', () => { ... });
  it('rejects topic/tag/category pages', () => { ... });
  it('accepts a well-formed article URL', () => { ... });
  it('rejects social domain URLs', () => { ... });
});

describe('isFakePlaceholder', () => {
  it('returns true for "No news available"', () => { ... });
  it('returns false for a real headline title', () => { ... });
});

describe('isModelUrlPlausible', () => {
  it('returns true when path has fewer than 3 long words', () => { ... });
  it('returns true when at least one path word matches title', () => { ... });
  it('returns false when path words have no overlap with title', () => { ... });
});

describe('matchUrl', () => {
  it('returns the best-scoring search result URL', () => { ... });
  it('returns null when no result meets the threshold', () => { ... });
  it('skips already-used URLs', () => { ... });
});
```

### `topicUtils`

```typescript
describe('isDuplicateTopic', () => {
  it('returns false for an empty seen list', () => { ... });
  it('returns true for a title with 40%+ Jaccard overlap', () => { ... });
  it('returns false for clearly distinct topics', () => { ... });
});

describe('calcAvgTopicSpread', () => {
  it('returns 1 for a single headline', () => { ... });
  it('returns lower spread for near-duplicate titles', () => { ... });
  it('returns near-1 for completely distinct titles', () => { ... });
});
```

### `logging`

```typescript
describe('getLogger', () => {
  it('throws when called before initializeLogger', () => {
    jest.resetModules();
    const { getLogger } = require('../logging');
    expect(() => getLogger('test')).toThrow('Logger not initialized');
  });
});
```

### `qualityLog`

```typescript
describe('buildLogPath', () => {
  it('builds a deterministic filename from runConfig and country codes', () => { ... });
  it('includes all country codes joined by comma', () => { ... });
});
```

### `PerplexitySource` constructor

```typescript
describe('PerplexitySource', () => {
  it('throws when PERPLEXITY_API_KEY is not provided', () => {
    const { PerplexitySource } = require('../fetchNews');
    expect(() => new PerplexitySource(defaultConfig, undefined)).toThrow('PERPLEXITY_API_KEY');
  });

  it('constructs without error when key is provided', () => {
    const { PerplexitySource } = require('../fetchNews');
    expect(() => new PerplexitySource(defaultConfig, 'test-key')).not.toThrow();
  });
});
```

### `prompt` builders

```typescript
describe('buildFetchSystemPrompt', () => {
  it('includes the summarySentences count', () => { ... });
  it('includes the detailSentences count', () => { ... });
});

describe('buildFetchUserPrompt', () => {
  it('includes region and count', () => { ... });
  it('includes preferred outlets when sources are provided', () => { ... });
  it('omits outlet hint when sources list is empty', () => { ... });
});
```

---

## Task 7: Full verification

- [ ] **Step 1: Typecheck cron**

```bash
cd cron && npx tsc --noEmit
```

- [ ] **Step 2: Typecheck app** (regression check)

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Run all cron tests**

```bash
cd cron && npm test
```

- [ ] **Step 4: Lint**

```bash
cd cron && npx eslint --ext .ts src
```

- [ ] **Step 5: Format check**

```bash
npm run format:check
```

---

## Task 8: Open PR

- [ ] **Step 1: Push**

```bash
git push -u origin feat/cron-fetch
```

- [ ] **Step 2: Run `/code-review`**

- [ ] **Step 3: Open PR**

Title: `feat(cron): fetch pipeline — PerplexitySource, URL/topic utilities, prompt builders`

Target branch: `develop`

Description must link legacy files replaced:

- `pulse-news-legacy/cron/src/types.ts`
- `pulse-news-legacy/cron/src/logging.ts`
- `pulse-news-legacy/cron/src/qualityLog.ts`
- `pulse-news-legacy/cron/src/lib/textUtils.ts`
- `pulse-news-legacy/cron/src/lib/urlUtils.ts`
- `pulse-news-legacy/cron/src/lib/topicUtils.ts`
- `pulse-news-legacy/cron/src/lib/perplexityClient.ts`
- `pulse-news-legacy/cron/src/lib/parseHeadlines.ts`
- `pulse-news-legacy/cron/src/prompt.ts`
- `pulse-news-legacy/cron/src/fetchNews.ts`
