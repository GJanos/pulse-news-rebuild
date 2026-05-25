# Cron E2E Runners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `cron/e2e/` — five developer-invoked runners that exercise the pipeline against real APIs, invocable via `npm run e2e:*`.

**Architecture:** Six files in `cron/e2e/`: a shared pretty-printer (`print.ts`) and five standalone runners (`fetch`, `full`, `notify`, `globalRanking`, `countryRanking`), each an `async main()` exiting with code 1 on error. No Jest involved — these are observation tools, not CI tests. Verification is `npx tsc --noEmit`.

**Tech Stack:** TypeScript, ts-node, @supabase/supabase-js, @anthropic-ai/sdk (via existing src/ modules), Winston logger, Firebase Admin SDK.

---

## File Map

| Action | Path                         | Role                                                             |
| ------ | ---------------------------- | ---------------------------------------------------------------- |
| Modify | `cron/tsconfig.json`         | Add `e2e/**/*` to `include`                                      |
| Create | `cron/e2e/print.ts`          | Shared pretty-printer (port of legacy `src/print.ts`)            |
| Create | `cron/e2e/fetch.ts`          | Fetch + rank, no DB writes                                       |
| Create | `cron/e2e/full.ts`           | Full pipeline: fetch → persist → global rank → FCM → quality log |
| Create | `cron/e2e/notify.ts`         | FCM push to all registered devices                               |
| Create | `cron/e2e/globalRanking.ts`  | Re-run global ranking on today's Supabase digests                |
| Create | `cron/e2e/countryRanking.ts` | Per-region rank on CLI-supplied subset of today's digests        |
| Modify | `cron/package.json`          | Add five `e2e:*` npm scripts                                     |
| Modify | `cron/CLAUDE.md`             | Add `e2e/` section to module map                                 |
| Modify | `cron/README.md`             | Add `e2e:*` scripts to dev commands                              |

---

## Task 1: tsconfig + shared print.ts

**Files:**

- Modify: `cron/tsconfig.json`
- Create: `cron/e2e/print.ts`

- [ ] **Step 1: Add `e2e/**/\*` to tsconfig include\*\*

Edit `cron/tsconfig.json` — change the `include` line:

```json
"include": ["src/**/*", "api/**/*", "e2e/**/*"],
```

- [ ] **Step 2: Create `cron/e2e/print.ts`**

```typescript
import type { GlobalHeadline } from '../src/rankHeadlines';
import type { RegionDigest } from '../src/types';

export function printHeadlines(digest: RegionDigest): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${digest.region}`);
  console.log(`${'─'.repeat(60)}`);
  digest.headlines.forEach((item, i) => {
    console.log(`${i + 1}. [${item.category ?? 'news'}] ${item.title}`);
    console.log(`   ${item.summary}`);
    if (item.detail) console.log(`   ${item.detail}`);
    console.log(`   ${item.sourceName ? `Source: ${item.sourceName}` : 'Source:'} ${item.url}\n`);
  });
}

export function printGlobalHeadlines(headlines: GlobalHeadline[]): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  GLOBAL HEADLINES (${headlines.length})`);
  console.log(`${'═'.repeat(60)}`);
  headlines.forEach((h, i) => {
    console.log(`${i + 1}. [${h.region}] ${h.title}`);
    console.log(`   ${h.summary}`);
    if (h.detail) console.log(`   ${h.detail}`);
    console.log(`   ${h.sourceName ? `Source: ${h.sourceName}` : 'Source:'} ${h.url}\n`);
  });
}

export function printTotals(
  stats: Array<{ region: string; attempts: number; got: number }>,
  totalRegions: number,
  fetch: { prompt: number; completion: number; tokens: number; cost: number },
  ranking: { prompt: number; completion: number; tokens: number; cost: number },
  count: number,
): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  TOTAL — ${stats.length}/${totalRegions} regions`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Fetch   — ${fetch.tokens} tokens  $${fetch.cost.toFixed(6)} USD`);
  console.log(`  Ranking — ${ranking.tokens} tokens  $${ranking.cost.toFixed(6)} USD`);
  console.log(`  Combined                $${(fetch.cost + ranking.cost).toFixed(6)} USD`);
  console.log(`\n  Retries:`);
  const pad = Math.max(...stats.map((s) => s.region.length));
  stats.forEach((s) => {
    console.log(
      `    ${s.region.padEnd(pad)}  ${s.attempts} attempt(s) → ${s.got}/${count} headlines`,
    );
  });
}
```

- [ ] **Step 3: Typecheck**

```bash
cd cron && npx tsc --noEmit
```

Expected: no errors.

---

## Task 2: `e2e/fetch.ts`

**Files:**

- Create: `cron/e2e/fetch.ts`

- [ ] **Step 1: Create `cron/e2e/fetch.ts`**

```typescript
import { createSource, loadPulseConfig } from '../src/config';
import { rankGlobalHeadlines } from '../src/rankHeadlines';
import { buildRunLog, runFetchPipeline, writeRunLog } from '../src/pipeline';
import { printGlobalHeadlines, printHeadlines, printTotals } from './print';

type UsageTotals = { prompt: number; completion: number; tokens: number; cost: number };
type RetryStats = { region: string; attempts: number; got: number };

async function main() {
  const startTime = Date.now();
  const config = loadPulseConfig();
  const source = createSource(config);

  const { resolvedRegions, digests, errors } = await runFetchPipeline(config, source);

  const fetchUsage: UsageTotals = { prompt: 0, completion: 0, tokens: 0, cost: 0 };
  const rankingUsage: UsageTotals = { prompt: 0, completion: 0, tokens: 0, cost: 0 };
  const retryStats: RetryStats[] = [];

  errors.forEach((error) =>
    console.error(`\nRegion fetch failed: ${error.region}: ${String(error.reason)}`),
  );

  for (const digest of digests) {
    retryStats.push({
      region: digest.region,
      attempts: digest.attempts,
      got: digest.headlines.length,
    });
    printHeadlines(digest);
    if (digest.usage) {
      fetchUsage.prompt += digest.usage.promptTokens;
      fetchUsage.completion += digest.usage.completionTokens;
      fetchUsage.tokens += digest.usage.totalTokens;
      fetchUsage.cost += digest.usage.costUsd;
    }
    if (digest.rankingUsage) {
      rankingUsage.prompt += digest.rankingUsage.promptTokens;
      rankingUsage.completion += digest.rankingUsage.completionTokens;
      rankingUsage.tokens += digest.rankingUsage.totalTokens;
      rankingUsage.cost += digest.rankingUsage.costUsd;
    }
  }

  printTotals(retryStats, resolvedRegions.length, fetchUsage, rankingUsage, config.api.fetch.count);

  if (config.api.ranking.global.enabled) {
    const globalHeadlines = await rankGlobalHeadlines(digests, config);
    printGlobalHeadlines(globalHeadlines);
  }

  if (config.log.qualityLog) {
    const log = buildRunLog(config, resolvedRegions, digests, startTime);
    const logPath = writeRunLog(log, resolvedRegions);
    console.log(`\nQuality log → ${logPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

```bash
cd cron && npx tsc --noEmit
```

Expected: no errors.

---

## Task 3: `e2e/full.ts`

**Files:**

- Create: `cron/e2e/full.ts`

- [ ] **Step 1: Create `cron/e2e/full.ts`**

```typescript
import { createSource, loadPulseConfig } from '../src/config';
import { getLogger } from '../src/logging';
import { persistDigests, persistGlobalDigest, sendNotifications } from '../src/notify';
import {
  buildRunLog,
  runFetchPipeline,
  retrySummary,
  usageSummary,
  writeRunLog,
} from '../src/pipeline';
import { rankGlobalHeadlines } from '../src/rankHeadlines';

async function main() {
  const startTime = Date.now();
  const config = loadPulseConfig();
  const logger = getLogger('e2e:full');
  const source = createSource(config);

  const { resolvedRegions, digests, errors } = await runFetchPipeline(config, source);
  errors.forEach((error) =>
    logger.error(`Region fetch failed: ${error.region}: ${String(error.reason)}`),
  );

  if (digests.length === 0) {
    logger.error('All region fetches failed — skipping persist and notify');
    return;
  }

  logger.info(usageSummary(digests, resolvedRegions.length));
  logger.info(`Attempts per region — ${retrySummary(digests)}`);

  await persistDigests(digests, config);

  if (config.api.ranking.global.enabled) {
    const globalHeadlines = await rankGlobalHeadlines(digests, config);
    if (globalHeadlines.length > 0) {
      await persistGlobalDigest(globalHeadlines);
    }
  }

  await sendNotifications(digests);

  if (config.log.qualityLog) {
    const log = buildRunLog(config, resolvedRegions, digests, startTime);
    const logPath = writeRunLog(log, resolvedRegions);
    logger.info(`Quality log → ${logPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

```bash
cd cron && npx tsc --noEmit
```

Expected: no errors.

---

## Task 4: `e2e/notify.ts`

**Files:**

- Create: `cron/e2e/notify.ts`

- [ ] **Step 1: Create `cron/e2e/notify.ts`**

```typescript
import { loadPulseConfig } from '../src/config';
import { getLogger, initializeLogger } from '../src/logging';
import { sendNotifications } from '../src/notify';

async function main() {
  const config = loadPulseConfig();
  initializeLogger(config);
  const logger = getLogger('e2e:notify');
  await sendNotifications([{ region: 'Test', headlines: [], attempts: 0 }]);
  logger.info('Test notification pipeline completed');
}

main().catch((err) => {
  const logger = getLogger('e2e:notify');
  logger.error(String(err));
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

```bash
cd cron && npx tsc --noEmit
```

Expected: no errors.

---

## Task 5: `e2e/globalRanking.ts`

**Files:**

- Create: `cron/e2e/globalRanking.ts`

- [ ] **Step 1: Create `cron/e2e/globalRanking.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import { loadPulseConfig } from '../src/config';
import { getLogger } from '../src/logging';
import { rankGlobalHeadlines } from '../src/rankHeadlines';
import type { RegionDigest, RegionHeadline } from '../src/types';
import { printGlobalHeadlines } from './print';

const log = getLogger('e2e:globalRanking');

function buildClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  return createClient(url, key);
}

async function main() {
  const config = loadPulseConfig();
  const db = buildClient();
  const today = new Date().toISOString().slice(0, 10);

  log.info(`Fetching persisted digests for ${today}…`);
  const { data, error } = await db.from('digests').select('region, payload').eq('date', today);

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  if (!data || data.length === 0) {
    log.info('No digests found for today. Run the cron first.');
    return;
  }

  const digests: RegionDigest[] = data.map((row) => ({
    region: row.region as string,
    headlines: (row.payload as { headlines: RegionHeadline[] }).headlines,
    attempts: 1,
  }));

  const totalCandidates = digests.reduce((n, d) => n + d.headlines.length, 0);
  log.info(`Loaded ${digests.length} regions — ${totalCandidates} total candidates\n`);
  digests.forEach((d) => log.info(`  ${d.region.padEnd(20)} ${d.headlines.length} headlines`));

  log.info('\nRunning global ranking…');
  const globalHeadlines = await rankGlobalHeadlines(digests, config);
  printGlobalHeadlines(globalHeadlines);
}

main().catch((err) => {
  log.error(String(err));
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

```bash
cd cron && npx tsc --noEmit
```

Expected: no errors.

---

## Task 6: `e2e/countryRanking.ts`

**Files:**

- Create: `cron/e2e/countryRanking.ts`

- [ ] **Step 1: Create `cron/e2e/countryRanking.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import { loadPulseConfig } from '../src/config';
import { getLogger } from '../src/logging';
import { rankHeadlines } from '../src/rankHeadlines';
import type { RegionDigest, RegionHeadline } from '../src/types';
import { printHeadlines } from './print';

const log = getLogger('e2e:countryRanking');

function buildClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  return createClient(url, key);
}

async function main() {
  const codes = process.argv.slice(2);
  if (codes.length === 0) {
    console.error('Usage: npm run e2e:countryRanking -- <REGION> [REGION ...]');
    console.error('Example: npm run e2e:countryRanking -- US GB DE');
    process.exit(1);
  }

  const config = loadPulseConfig();
  const db = buildClient();
  const today = new Date().toISOString().slice(0, 10);
  const normalised = codes.map((c) => c.toUpperCase());

  log.info(`Fetching digests for ${today} — regions: ${normalised.join(', ')}`);
  const { data, error } = await db
    .from('digests')
    .select('region, payload')
    .eq('date', today)
    .in('region', normalised);

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  if (!data || data.length === 0) {
    log.info('No matching digests found for today. Run the cron first.');
    return;
  }

  const digests: RegionDigest[] = data.map((row) => ({
    region: row.region as string,
    headlines: (row.payload as { headlines: RegionHeadline[] }).headlines,
    attempts: 1,
  }));

  for (const digest of digests) {
    log.info(`\nRanking ${digest.region} (${digest.headlines.length} headlines)…`);
    const { headlines } = await rankHeadlines(digest.headlines, digest.region, config);
    printHeadlines({ ...digest, headlines });
  }
}

main().catch((err) => {
  log.error(String(err));
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

```bash
cd cron && npx tsc --noEmit
```

Expected: no errors.

---

## Task 7: npm scripts + doc updates

**Files:**

- Modify: `cron/package.json`
- Modify: `cron/CLAUDE.md`
- Modify: `cron/README.md`

- [ ] **Step 1: Add e2e scripts to `cron/package.json`**

Add inside the `"scripts"` object:

```json
"e2e:fetch":          "ts-node -r ./src/bootstrap e2e/fetch.ts",
"e2e:full":           "ts-node -r ./src/bootstrap e2e/full.ts",
"e2e:notify":         "ts-node -r ./src/bootstrap e2e/notify.ts",
"e2e:globalRanking":  "ts-node -r ./src/bootstrap e2e/globalRanking.ts",
"e2e:countryRanking": "ts-node -r ./src/bootstrap e2e/countryRanking.ts"
```

Full `scripts` block after edit:

```json
"scripts": {
  "build": "tsc --noEmit",
  "lint": "eslint --ext .ts src",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "e2e:fetch":          "ts-node -r ./src/bootstrap e2e/fetch.ts",
  "e2e:full":           "ts-node -r ./src/bootstrap e2e/full.ts",
  "e2e:notify":         "ts-node -r ./src/bootstrap e2e/notify.ts",
  "e2e:globalRanking":  "ts-node -r ./src/bootstrap e2e/globalRanking.ts",
  "e2e:countryRanking": "ts-node -r ./src/bootstrap e2e/countryRanking.ts"
}
```

- [ ] **Step 2: Add e2e section to `cron/CLAUDE.md` module map**

Append a new `e2e/` block to the module map table after the existing `api/account.ts` row:

```markdown
| `e2e/print.ts` | ✓ | Shared pretty-printer — `printHeadlines`, `printGlobalHeadlines`, `printTotals` |
| `e2e/fetch.ts` | ✓ | E2E runner — fetch + per-region rank, no DB writes (`npm run e2e:fetch`) |
| `e2e/full.ts` | ✓ | E2E runner — full pipeline: fetch → persist → global rank → FCM → quality log (`npm run e2e:full`) |
| `e2e/notify.ts` | ✓ | E2E runner — FCM push to all registered devices (`npm run e2e:notify`) |
| `e2e/globalRanking.ts` | ✓ | E2E runner — re-rank today's Supabase digests globally (`npm run e2e:globalRanking`) |
| `e2e/countryRanking.ts` | ✓ | E2E runner — per-region rank on CLI-supplied regions (`npm run e2e:countryRanking -- US GB`) |
```

- [ ] **Step 3: Add e2e scripts to `cron/README.md` dev commands**

In the `Dev runners` section, replace the existing placeholder block with:

````markdown
E2E runners (call real APIs — require `.env` to be populated):

```bash
npm run e2e:fetch                           # fetch + rank, no DB writes
npm run e2e:full                            # full pipeline: fetch → persist → FCM → quality log
npm run e2e:notify                          # FCM push to all registered devices
npm run e2e:globalRanking                   # re-rank today's Supabase digests globally
npm run e2e:countryRanking -- US GB DE      # per-region rank on selected regions
```
````

````

- [ ] **Step 4: Typecheck + lint**

```bash
cd cron && npx tsc --noEmit && npx eslint --ext .ts src e2e
````

Expected: no errors.

- [ ] **Step 5: Single commit — all changes**

```bash
git add cron/tsconfig.json cron/package.json cron/CLAUDE.md cron/README.md cron/e2e/
git commit -m "feat(cron/e2e): add e2e runners (fetch, full, notify, globalRanking, countryRanking)"
```
