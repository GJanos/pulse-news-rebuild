# cron/config Implementation Plan

**Goal:** Port `cron/src/config.ts` from legacy — config loading, deep merge, and cron secret validation. Env variable overrides (`LOG_LEVEL`, `COUNT`, `MIN_RESULTS`) are intentionally dropped — all config comes from `pulse.config.json` only.

**Branch:** `feat/cron-config`
**Legacy reference:** `/home/hp/projects/pulse-news-legacy/cron/src/config.ts`
**Spec:** this document

---

## What this slice delivers

| Export              | Purpose                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `defaultConfig`     | Fallback `PulseConfig` when `pulse.config.json` is absent or incomplete       |
| `loadPulseConfig()` | Reads `shared/pulse.config.json` (`.cron` subtree), deep-merges over defaults |
| `mergeConfig<T>()`  | Generic deep-merge helper (object-recursive, array/scalar replace)            |
| `checkCronSecret()` | Validates `Authorization: Bearer <CRON_SECRET>` on inbound Vercel requests    |

**Deferred to later phases:**

- `createSource()` — depends on `PerplexitySource` (Phase 3 / `cron/fetch`)
- `initializeLogger(config)` — depends on `logging.ts` (Phase 4)

---

## Key differences from legacy

| Legacy                                                                                                 | New                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Types declared inline (`PulseConfig`, `ModelConfig`, etc.)                                             | Import from `@shared/config`                                                                             |
| `pulse.config.json` at `cron/pulse.config.json` — `path.resolve(__dirname, '..', 'pulse.config.json')` | Now at `shared/pulse.config.json` — `path.resolve(__dirname, '..', '..', 'shared', 'pulse.config.json')` |
| `parsed` cast as `Partial<PulseConfig>` (flat JSON)                                                    | JSON has `{ app, cron }` shape — extract `.cron` subtree before merging                                  |
| Calls `initializeLogger(config)` at end of `loadPulseConfig`                                           | Omitted — logger not yet ported; add `// TODO: Phase 4 — initializeLogger(config)`                       |

---

## File map

| Action | Path                            | Purpose                                                                   |
| ------ | ------------------------------- | ------------------------------------------------------------------------- |
| Create | `cron/src/config.ts`            | Port `loadPulseConfig`, `mergeConfig`, `checkCronSecret`, `defaultConfig` |
| Create | `cron/src/tests/config.test.ts` | Unit tests — merge logic, fallback-to-defaults, secret validation         |

---

## Task 1: Write the smoke/unit tests (TDD — will fail until config.ts exists)

**File:** `cron/src/tests/config.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import type { IncomingMessage, ServerResponse } from 'http';
import type { PulseConfig } from '@shared/config';

describe('loadPulseConfig', () => {
  it('loads shared/pulse.config.json and returns a valid PulseConfig', () => {
    const { loadPulseConfig } = require('../config');
    const cfg: PulseConfig = loadPulseConfig();
    expect(cfg.model.name).toBeTruthy();
    expect(Array.isArray(cfg.api.regions)).toBe(true);
    expect(cfg.api.regions.length).toBeGreaterThan(0);
    expect(typeof cfg.api.fetch.count).toBe('number');
    expect(typeof cfg.db.evict).toBe('boolean');
    expect(['debug', 'info', 'warn', 'error']).toContain(cfg.log.level);
  });

  it('falls back to defaultConfig when config file is absent', () => {
    jest.mock('fs', () => ({
      ...jest.requireActual('fs'),
      existsSync: () => false,
    }));
    jest.resetModules();
    const { loadPulseConfig } = require('../config');
    const cfg: PulseConfig = loadPulseConfig();
    expect(cfg.model.name).toBe('sonar');
    jest.unmock('fs');
    jest.resetModules();
  });
});

describe('checkCronSecret', () => {
  function makeReq(auth?: string): IncomingMessage {
    return { headers: { authorization: auth } } as unknown as IncomingMessage;
  }

  function makeRes(): ServerResponse & { statusCode: number; ended: boolean } {
    const res = {
      statusCode: 0,
      ended: false,
      writeHead(code: number) {
        this.statusCode = code;
        return this;
      },
      end() {
        this.ended = true;
        return this;
      },
    };
    return res as unknown as ServerResponse & { statusCode: number; ended: boolean };
  }

  it('returns true and does not write when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    const { checkCronSecret } = require('../config');
    const res = makeRes();
    expect(checkCronSecret(makeReq(), res)).toBe(true);
    expect(res.ended).toBe(false);
  });

  it('returns true when Authorization matches the secret', () => {
    process.env.CRON_SECRET = 'abc123';
    jest.resetModules();
    const { checkCronSecret } = require('../config');
    const res = makeRes();
    expect(checkCronSecret(makeReq('Bearer abc123'), res)).toBe(true);
    expect(res.ended).toBe(false);
    delete process.env.CRON_SECRET;
    jest.resetModules();
  });

  it('returns false and writes 401 when secret is wrong', () => {
    process.env.CRON_SECRET = 'abc123';
    jest.resetModules();
    const { checkCronSecret } = require('../config');
    const res = makeRes();
    expect(checkCronSecret(makeReq('Bearer wrong'), res)).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.ended).toBe(true);
    delete process.env.CRON_SECRET;
    jest.resetModules();
  });

  it('returns false and writes 401 when Authorization header is missing', () => {
    process.env.CRON_SECRET = 'abc123';
    jest.resetModules();
    const { checkCronSecret } = require('../config');
    const res = makeRes();
    expect(checkCronSecret(makeReq(), res)).toBe(false);
    expect(res.statusCode).toBe(401);
    delete process.env.CRON_SECRET;
    jest.resetModules();
  });
});
```

- [ ] **Step 2: Run — confirm it fails with module-not-found**

```bash
cd cron && npm test -- --testPathPattern=config.test
```

Expected: FAIL — `Cannot find module '../config'`

---

## Task 2: Create `cron/src/config.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import type { PulseConfig } from '@shared/config';
import { REGIONS } from '@shared/regions';

// ── Defaults ────────────────────────────────────────────────────────────────

export const defaultConfig: PulseConfig = {
  model: {
    name: 'sonar',
    reasoningEffort: 'low',
    temperature: 0.2,
    searchType: 'pro',
    searchContextSize: 'medium',
  },
  api: {
    regions: REGIONS.map((r) => r.region),
    fetch: {
      count: 5,
      summarySentences: 1,
      detailSentences: 3,
      maxAttempts: 4,
      attemptDelay: 2000,
      retryDelay: 1000,
      minResults: 5,
      recencySequence: ['day', 'day', 'week', 'week', 'month', 'month'],
      buffer: 0,
    },
    ranking: {
      local: {
        enabled: true,
        model: 'claude-sonnet-4-6',
        maxTokens: 256,
      },
      global: {
        enabled: false,
        count: 5,
        model: 'claude-sonnet-4-6',
        maxTokens: 512,
        chunkSize: 40,
      },
    },
  },
  db: {
    evict: true,
    evictDays: 7,
  },
  log: {
    level: 'info',
    qualityLog: true,
  },
};

// ── Config loading ───────────────────────────────────────────────────────────

export function loadPulseConfig(): PulseConfig {
  // pulse.config.json moved to shared/ in Phase 1
  const configPath = path.resolve(__dirname, '..', '..', 'shared', 'pulse.config.json');

  const config: PulseConfig = {
    model: { ...defaultConfig.model },
    api: { ...defaultConfig.api },
    db: { ...defaultConfig.db },
    log: { ...defaultConfig.log },
  };

  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = (JSON.parse(raw) as { cron?: Partial<PulseConfig> }).cron ?? {};
    const merged = mergeConfig(defaultConfig, parsed);
    config.model = merged.model;
    config.api = merged.api;
    config.db = merged.db;
    config.log = merged.log;
  }

  // TODO: Phase 4 — initializeLogger(config)

  return config;
}

// ── Merge helper ─────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mergeConfig<T>(defaults: T, overrides: Partial<T>): T {
  if (!isObject(defaults) || !isObject(overrides)) {
    return (overrides as T) ?? defaults;
  }

  const merged = { ...defaults } as Record<string, unknown>;

  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const keyStr = key as string;
    const defVal = (defaults as Record<string, unknown>)[keyStr];
    const ovVal = (overrides as Record<string, unknown>)[keyStr];

    if (isObject(defVal) && isObject(ovVal)) {
      merged[keyStr] = mergeConfig(defVal, ovVal as Partial<typeof defVal>);
    } else if (ovVal !== undefined) {
      merged[keyStr] = ovVal;
    }
  }

  return merged as T;
}

// ── Vercel auth ──────────────────────────────────────────────────────────────

export function checkCronSecret(req: IncomingMessage, res: ServerResponse): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.writeHead(401).end('Unauthorized');
    return false;
  }
  return true;
}
```

- [ ] **Step 2: Run config tests — all should pass**

```bash
cd cron && npm test -- --testPathPattern=config.test
```

Expected: all PASS (6 tests).

- [ ] **Step 3: Commit**

```bash
git add cron/src/config.ts cron/src/tests/config.test.ts
git commit -m "feat(cron/config): port loadPulseConfig, mergeConfig, checkCronSecret"
```

---

## Task 3: Full verification

- [ ] **Step 1: Typecheck cron**

```bash
cd cron && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Typecheck app** (regression check)

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all cron tests**

```bash
cd cron && npm test
```

Expected: all PASS (shared smoke tests + config tests).

- [ ] **Step 4: Lint**

```bash
cd cron && npx eslint --ext .ts src
```

Expected: no errors.

- [ ] **Step 5: Format check**

```bash
npm run format:check
```

Expected: clean. If not: `npm run format && git add -A && git commit -m "style: format cron/config files"`

---

## Task 4: Open PR

- [ ] **Step 1: Push**

```bash
git push -u origin feat/cron-config
```

- [ ] **Step 2: Run `/code-review`**

(No `/security-review` needed — `checkCronSecret` is a read-only header check, no mutation.)

- [ ] **Step 3: Open PR**

Title: `feat(cron): config loading, merge, and cron secret validation`

Description must link:

- Legacy file replaced: `pulse-news-legacy/cron/src/config.ts`
- Target branch: `develop`
