# Cron E2E Runners — Design Spec

**Date:** 2026-05-25
**Branch target:** `develop`
**Scope:** `cron/e2e/` — five developer-invoked observation runners that call real APIs

---

## Problem

The legacy cron had four standalone scripts (`testFetch.ts`, `testNotify.ts`, `testGlobalRanking.ts`, `index.ts`) for manually exercising the pipeline against real APIs. None of these have been ported to the new `cron/` package. A fifth runner (`countryRanking`) is new — it re-ranks a user-selected subset of today's regions.

---

## Decision

Port all four legacy runners plus the new one into `cron/e2e/`. These are developer-invoked observation tools, not CI tests. A shared `e2e/print.ts` handles pretty-printed console output. Each runner is a standalone `async main()` script invoked via `ts-node`. npm scripts are prefixed `e2e:`.

---

## File Structure

```
cron/
  e2e/
    print.ts           ← shared pretty-printer (ported from legacy src/print.ts)
    fetch.ts           ← fetch + per-region rank, no DB writes
    full.ts            ← full pipeline: fetch → persist → global rank → FCM → quality log
    notify.ts          ← fire FCM push to all registered devices
    globalRanking.ts   ← read today's Supabase digests, re-run global rank, print
    countryRanking.ts  ← same as globalRanking but filtered to CLI-supplied region codes, per-region rank
```

---

## Runners

### `e2e/print.ts`

Ported from `legacy/cron/src/print.ts`. Exports:

- `printHeadlines(digest: RegionDigest): void`
- `printGlobalHeadlines(headlines: GlobalHeadline[]): void`
- `printTotals(stats, totalRegions, fetch, ranking, count): void`

No logic changes from legacy.

### `e2e/fetch.ts`

Ported from `legacy/cron/testFetch.ts`. Flow:

1. `loadPulseConfig()` + `createSource(config)`
2. `runFetchPipeline(config, source)` — calls Perplexity + Claude per region
3. Accumulate per-region usage totals
4. `printHeadlines` per digest
5. `printTotals` summary
6. If `config.api.ranking.global.enabled`: `rankGlobalHeadlines` + `printGlobalHeadlines`
7. If `config.log.qualityLog`: `buildRunLog` + `writeRunLog`, log path to console

**Real APIs:** Perplexity, Claude. No DB writes.

### `e2e/full.ts`

Ported from `legacy/cron/index.ts`. Flow:

1. `loadPulseConfig()` + `createSource(config)`
2. `runFetchPipeline` — fetch + per-region rank
3. Log errors; bail if all regions failed
4. Log `usageSummary` + `retrySummary`
5. `persistDigests` → Supabase
6. If global ranking enabled: `rankGlobalHeadlines` + `persistGlobalDigest`
7. `sendNotifications` → FCM
8. If quality log enabled: `buildRunLog` + `writeRunLog`

**Real APIs:** Perplexity, Claude, Supabase, FCM.

### `e2e/notify.ts`

Ported from `legacy/cron/testNotify.ts`. Flow:

1. `loadPulseConfig()` + `initializeLogger(config)`
2. `sendNotifications([{ region: 'Test', headlines: [], attempts: 0 }])` — dummy digest, FCM only
3. Log completion

**Real APIs:** FCM only.

### `e2e/globalRanking.ts`

Ported from `legacy/cron/testGlobalRanking.ts`. Flow:

1. `loadPulseConfig()`, build Supabase client from env
2. Query `digests` table for today's date
3. Map rows to `RegionDigest[]`
4. `rankGlobalHeadlines(digests, config)` — Claude
5. `printGlobalHeadlines` from `e2e/print.ts`

**Real APIs:** Supabase, Claude.

### `e2e/countryRanking.ts`

New runner. Flow:

1. Read region codes from `process.argv.slice(2)`; exit 1 with usage hint if none given
2. Build Supabase client; query `digests` for today filtered to the provided region codes
3. Exit 0 with message if no matching digests found
4. For each digest: `rankHeadlines(digest.headlines, digest.region, config)` — per-region Claude reorder
5. `printHeadlines` per ranked digest from `e2e/print.ts`

**Real APIs:** Supabase, Claude.

---

## npm Scripts

Added to `cron/package.json`:

```json
"e2e:fetch":          "ts-node -r ./src/bootstrap e2e/fetch.ts",
"e2e:full":           "ts-node -r ./src/bootstrap e2e/full.ts",
"e2e:notify":         "ts-node -r ./src/bootstrap e2e/notify.ts",
"e2e:globalRanking":  "ts-node -r ./src/bootstrap e2e/globalRanking.ts",
"e2e:countryRanking": "ts-node -r ./src/bootstrap e2e/countryRanking.ts"
```

`countryRanking` accepts region codes as positional args:

```bash
npm run e2e:countryRanking -- US GB DE
```

---

## tsconfig Changes

Add `"e2e/**/*"` to the `include` array in `cron/tsconfig.json` so TypeScript and ESLint cover the new directory.

---

## Doc Updates

- `cron/CLAUDE.md`: add `e2e/` section to the module map table
- `cron/README.md`: add five `e2e:*` scripts to the dev commands section

---

## Real API Summary

| Runner               | Perplexity | Claude | Supabase | FCM |
| -------------------- | ---------- | ------ | -------- | --- |
| `e2e:fetch`          | ✓          | ✓      | —        | —   |
| `e2e:full`           | ✓          | ✓      | ✓        | ✓   |
| `e2e:notify`         | —          | —      | —        | ✓   |
| `e2e:globalRanking`  | —          | ✓      | ✓        | —   |
| `e2e:countryRanking` | —          | ✓      | ✓        | —   |

---

## Out of Scope

- No Jest involvement — these are not assertion-based tests and will never run in CI
- No new ranking algorithms — `countryRanking` reuses `rankHeadlines` unchanged
- No new print helpers beyond porting the existing `print.ts`
