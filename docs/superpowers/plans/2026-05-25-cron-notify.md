# cron/notify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `notify.ts` from the legacy codebase — Supabase persistence for region and global digests, FCM multicast dispatch with stale-token eviction, and the `sendNotifications` orchestrator.

**Architecture:** A single new file `cron/src/notify.ts` contains all five exported functions: `buildClient` (lazy Supabase singleton), `initMessaging` (lazy Firebase Admin singleton), `persistDigests`, `persistGlobalDigest`, `dispatchFcm`, and `sendNotifications`. Supabase and Firebase Admin are injected via module-level singletons (same pattern as the legacy). Tests mock both SDKs entirely — no real network calls.

**Tech Stack:** TypeScript, `@supabase/supabase-js`, `firebase-admin`, `ws` (Supabase WebSocket transport), Jest + ts-jest, `@shared/config` (`PulseConfig`), `cron/src/types.ts` (`RegionDigest`), `cron/src/rankHeadlines.ts` (`GlobalHeadline`)

---

## File Map

| Action | File                            | Responsibility                                                                                                             |
| ------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Create | `cron/src/notify.ts`            | All 6 exports: `buildClient`, `initMessaging`, `persistDigests`, `persistGlobalDigest`, `dispatchFcm`, `sendNotifications` |
| Create | `cron/src/tests/notify.test.ts` | Unit tests — Supabase mocked, Firebase Admin mocked, no real network                                                       |
| Modify | `cron/CLAUDE.md` (module map)   | Mark `src/notify.ts` as ✓                                                                                                  |

---

## Task 1: Create `notify.ts` — client singletons and helpers

**Files:**

- Create: `cron/src/notify.ts`

- [ ] **Step 1: Create the file with imports, singletons, and private helpers**

```typescript
// cron/src/notify.ts
import admin from 'firebase-admin';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import type { PulseConfig } from '@shared/config';
import type { RegionDigest } from './types';
import type { GlobalHeadline } from './rankHeadlines';
import { getLogger } from './logging';

let _db: SupabaseClient | null = null;

const FCM_BATCH_SIZE = 500;

function chunkTokens(tokens: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
    chunks.push(tokens.slice(i, i + FCM_BATCH_SIZE));
  }
  return chunks;
}

function cutoffDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/cron && npx tsc --noEmit
```

Expected: no errors (unused imports are fine at this stage — exported functions come in later tasks).

---

## Task 2: Add `initMessaging` and `buildClient`

**Files:**

- Modify: `cron/src/notify.ts`

- [ ] **Step 1: Append both exported factory functions**

```typescript
/** Initialize (or reuse) Firebase Admin SDK and return the Messaging instance. */
export function initMessaging() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Private key is stored with literal \n in .env; restore real newlines at runtime.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are required',
      );
    }
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
  return admin.messaging();
}

/** Create (or return the cached) Supabase service-role client. */
export function buildClient() {
  if (!_db) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
    _db = createClient(url, key, { realtime: { transport: ws as unknown as typeof WebSocket } });
  }
  return _db;
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/cron && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add cron/src/notify.ts
git commit -m "feat(cron/notify): add notify.ts — singletons, initMessaging, buildClient"
```

---

## Task 3: Add `persistDigests` and `persistGlobalDigest`

**Files:**

- Modify: `cron/src/notify.ts`

- [ ] **Step 1: Append both persistence functions**

```typescript
export async function persistDigests(digests: RegionDigest[], config: PulseConfig): Promise<void> {
  const log = getLogger('notify');
  const db = buildClient();
  const today = new Date().toISOString().slice(0, 10);

  if (config.db.evict) {
    const { error } = await db.from('digests').delete().lt('date', cutoffDate(config.db.evictDays));
    if (error) log.warn(`Eviction failed: ${error.message}`);
    else log.info(`Evicted digests older than ${config.db.evictDays} days`);
  }

  const rows = digests.map((d) => ({
    region: d.region,
    date: today,
    payload: { headlines: d.headlines },
  }));

  const { error } = await db.from('digests').upsert(rows, { onConflict: 'region,date' });
  if (error) throw new Error(`Digest upsert failed: ${error.message}`);

  log.info(`Persisted ${rows.length} digests for ${today}`);
}

/** Upsert today's global digest into the `global_digests` table (one row per date). */
export async function persistGlobalDigest(headlines: GlobalHeadline[]): Promise<void> {
  const log = getLogger('notify');
  const db = buildClient();
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await db
    .from('global_digests')
    .upsert({ date: today, payload: { headlines } }, { onConflict: 'date' });
  if (error) throw new Error(`Global digest upsert failed: ${error.message}`);

  log.info(`Persisted ${headlines.length} global headlines for ${today}`);
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/cron && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add cron/src/notify.ts
git commit -m "feat(cron/notify): add persistDigests and persistGlobalDigest"
```

---

## Task 4: Add `dispatchFcm` and `sendNotifications`

**Files:**

- Modify: `cron/src/notify.ts`

- [ ] **Step 1: Append both FCM functions**

```typescript
/**
 * Send FCM multicast to the given tokens and evict stale ones from the DB.
 * Accepts an optional comma-separated region list passed as notification data.
 */
export async function dispatchFcm(
  tokens: string[],
  regions = '',
): Promise<{ sent: number; total: number }> {
  const log = getLogger('notify');
  if (tokens.length === 0) return { sent: 0, total: 0 };

  const messaging = initMessaging();
  const db = buildClient();
  const data: Record<string, string> = { type: 'daily_digest' };
  if (regions) data['regions'] = regions;

  let totalSent = 0;
  const staleTokens: string[] = [];
  const batches = chunkTokens(tokens);

  for (let index = 0; index < batches.length; index += 1) {
    const batchTokens = batches[index]!;
    const result = await messaging.sendEachForMulticast({
      tokens: batchTokens,
      notification: { title: 'Pulse', body: 'Your daily digest is ready' },
      data,
      android: {
        priority: 'high',
        notification: { channelId: 'default' },
      },
    });

    totalSent += result.successCount;
    log.info(
      `FCM batch ${index + 1}/${batches.length} sent ${result.successCount}/${batchTokens.length}`,
    );

    batchTokens.forEach((token, tokenIndex) => {
      const code = result.responses[tokenIndex]!.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        staleTokens.push(token);
      }
    });
  }

  if (staleTokens.length > 0) {
    const { error } = await db.from('devices').delete().in('fcm_token', staleTokens);
    if (error) log.warn(`Failed to remove stale tokens: ${error.message}`);
    else log.info(`Removed ${staleTokens.length} stale tokens`);
  }

  return { sent: totalSent, total: tokens.length };
}

/** Send notifications to all registered devices. Used by the local cron runner for testing. */
export async function sendNotifications(digests: RegionDigest[]): Promise<void> {
  const log = getLogger('notify');
  const db = buildClient();

  const { data: devices, error } = await db.from('devices').select('id, fcm_token');
  if (error) throw new Error(`Failed to read device tokens: ${error.message}`);
  if (!devices || devices.length === 0) {
    log.info('No registered devices — skipping FCM dispatch');
    return;
  }

  const tokens = devices.map((d) => d.fcm_token as string);
  const regions = digests.map((d) => d.region).join(',');
  await dispatchFcm(tokens, regions);
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/cron && npx tsc --noEmit
```

Expected: zero errors, zero unused-import warnings (all imports now consumed).

- [ ] **Step 3: Run lint**

```bash
cd /home/hp/projects/pulse-news/cron && npx eslint --ext .ts src
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add cron/src/notify.ts
git commit -m "feat(cron/notify): add dispatchFcm and sendNotifications"
```

---

## Task 5: Write tests for `persistDigests` and `persistGlobalDigest`

**Files:**

- Create: `cron/src/tests/notify.test.ts`

Both Supabase and Firebase Admin are mocked at module level. The Supabase mock uses a fluent builder pattern (each method returns `this`) with a terminal `mockResolvedValueOnce` for the final `await`.

- [ ] **Step 1: Create the test file**

```typescript
// cron/src/tests/notify.test.ts
import { persistDigests, persistGlobalDigest } from '../notify';
import type { RegionDigest } from '../types';
import type { PulseConfig } from '@shared/config';

jest.mock('../logging', () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

// ── Supabase mock ──────────────────────────────────────────────────────────────
// Models the fluent query builder: from().delete().lt() or from().upsert() etc.
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  lt: jest.fn().mockResolvedValue({ error: null }),
  upsert: jest.fn().mockResolvedValue({ error: null }),
  select: jest.fn().mockResolvedValue({ data: [], error: null }),
  in: jest.fn().mockResolvedValue({ error: null }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// ── Firebase Admin mock ────────────────────────────────────────────────────────
const mockSendEachForMulticast = jest.fn();
jest.mock('firebase-admin', () => ({
  __esModule: true,
  default: {
    apps: [],
    initializeApp: jest.fn(),
    credential: { cert: jest.fn() },
    messaging: jest.fn(() => ({ sendEachForMulticast: mockSendEachForMulticast })),
  },
}));

// ws has no runtime behaviour in tests — just needs to import without error.
jest.mock('ws', () => ({}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const makeConfig = (evict = false): PulseConfig => ({
  model: {
    name: 'sonar-pro',
    reasoningEffort: 'low',
    temperature: 0.35,
    searchType: 'pro',
    searchContextSize: 'medium',
  },
  api: {
    regions: ['Hungary'],
    fetch: {
      count: 5,
      summarySentences: 1,
      detailSentences: 3,
      maxAttempts: 4,
      attemptDelay: 2000,
      retryDelay: 3000,
      minResults: 5,
      recencySequence: ['day'],
      buffer: 1,
    },
    ranking: {
      local: { enabled: true, model: 'claude-sonnet-4-6', maxTokens: 256 },
      global: {
        enabled: true,
        count: 5,
        model: 'claude-sonnet-4-6',
        maxTokens: 512,
        chunkSize: 25,
      },
    },
  },
  db: { evict, evictDays: 14 },
  log: { level: 'debug', qualityLog: true },
});

const makeDigests = (regions: string[]): RegionDigest[] =>
  regions.map((region) => ({
    region,
    headlines: [{ title: `${region} headline`, summary: 'summary', url: 'https://example.com/1' }],
    attempts: 1,
  }));

// ── persistDigests ─────────────────────────────────────────────────────────────

describe('persistDigests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fluent chain returns
    mockSupabase.from.mockReturnThis();
    mockSupabase.delete.mockReturnThis();
    mockSupabase.lt.mockResolvedValue({ error: null });
    mockSupabase.upsert.mockResolvedValue({ error: null });
    // Provide env vars so buildClient() succeeds
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-key';
  });

  it('upserts one row per digest into the digests table', async () => {
    const digests = makeDigests(['Hungary', 'United States']);
    await persistDigests(digests, makeConfig());

    expect(mockSupabase.from).toHaveBeenCalledWith('digests');
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ region: 'Hungary' }),
        expect.objectContaining({ region: 'United States' }),
      ]),
      { onConflict: 'region,date' },
    );
  });

  it("includes today's date and headlines payload in each row", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const digests = makeDigests(['Hungary']);
    await persistDigests(digests, makeConfig());

    const [rows] = mockSupabase.upsert.mock.calls[0] as [
      Array<{ region: string; date: string; payload: { headlines: unknown[] } }>,
      unknown,
    ];
    expect(rows[0]!.date).toBe(today);
    expect(rows[0]!.payload.headlines).toHaveLength(1);
  });

  it('throws when upsert returns an error', async () => {
    mockSupabase.upsert.mockResolvedValueOnce({ error: { message: 'db error' } });
    await expect(persistDigests(makeDigests(['Hungary']), makeConfig())).rejects.toThrow(
      'Digest upsert failed: db error',
    );
  });

  it('runs eviction delete when evict is enabled', async () => {
    await persistDigests(makeDigests(['Hungary']), makeConfig(true));
    expect(mockSupabase.delete).toHaveBeenCalled();
    expect(mockSupabase.lt).toHaveBeenCalledWith('date', expect.any(String));
  });

  it('skips eviction when evict is false', async () => {
    await persistDigests(makeDigests(['Hungary']), makeConfig(false));
    expect(mockSupabase.delete).not.toHaveBeenCalled();
  });
});

// ── persistGlobalDigest ────────────────────────────────────────────────────────

describe('persistGlobalDigest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnThis();
    mockSupabase.upsert.mockResolvedValue({ error: null });
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-key';
  });

  it("upserts into global_digests with today's date and all headlines", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const headlines = [
      {
        title: 'Global story',
        summary: 'summary',
        url: 'https://example.com/1',
        region: 'Hungary',
      },
    ];

    await persistGlobalDigest(headlines);

    expect(mockSupabase.from).toHaveBeenCalledWith('global_digests');
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      { date: today, payload: { headlines } },
      { onConflict: 'date' },
    );
  });

  it('throws when upsert returns an error', async () => {
    mockSupabase.upsert.mockResolvedValueOnce({ error: { message: 'global db error' } });
    await expect(persistGlobalDigest([])).rejects.toThrow(
      'Global digest upsert failed: global db error',
    );
  });
});
```

- [ ] **Step 2: Run these tests**

```bash
cd /home/hp/projects/pulse-news/cron && npm test -- --testPathPattern=notify
```

Expected: all 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add cron/src/tests/notify.test.ts
git commit -m "test(cron/notify): persistDigests and persistGlobalDigest — 7 tests"
```

---

## Task 6: Write tests for `dispatchFcm`

**Files:**

- Modify: `cron/src/tests/notify.test.ts`

- [ ] **Step 1: Add `dispatchFcm` import at top of file**

Change:

```typescript
import { persistDigests, persistGlobalDigest } from '../notify';
```

To:

```typescript
import { persistDigests, persistGlobalDigest, dispatchFcm } from '../notify';
```

- [ ] **Step 2: Append `dispatchFcm` describe block to the bottom of the file**

```typescript
// ── dispatchFcm ────────────────────────────────────────────────────────────────

describe('dispatchFcm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnThis();
    mockSupabase.in.mockResolvedValue({ error: null });
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-key';
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY =
      '-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----';
  });

  it('returns { sent: 0, total: 0 } immediately when tokens list is empty', async () => {
    const result = await dispatchFcm([]);
    expect(result).toEqual({ sent: 0, total: 0 });
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it('calls sendEachForMulticast with tokens, notification body, and data', async () => {
    mockSendEachForMulticast.mockResolvedValueOnce({
      successCount: 2,
      responses: [{ error: null }, { error: null }],
    });

    const result = await dispatchFcm(['token-a', 'token-b'], 'Hungary,United States');

    expect(mockSendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['token-a', 'token-b'],
        notification: { title: 'Pulse', body: 'Your daily digest is ready' },
        data: { type: 'daily_digest', regions: 'Hungary,United States' },
        android: { priority: 'high', notification: { channelId: 'default' } },
      }),
    );
    expect(result).toEqual({ sent: 2, total: 2 });
  });

  it('does not include regions key in data when regions param is empty', async () => {
    mockSendEachForMulticast.mockResolvedValueOnce({
      successCount: 1,
      responses: [{ error: null }],
    });

    await dispatchFcm(['token-a']);

    const call = mockSendEachForMulticast.mock.calls[0]![0] as { data: Record<string, string> };
    expect(call.data).not.toHaveProperty('regions');
    expect(call.data['type']).toBe('daily_digest');
  });

  it('evicts stale tokens from DB after send', async () => {
    mockSendEachForMulticast.mockResolvedValueOnce({
      successCount: 1,
      responses: [
        { error: null },
        { error: { code: 'messaging/registration-token-not-registered' } },
      ],
    });

    await dispatchFcm(['token-good', 'token-stale']);

    expect(mockSupabase.from).toHaveBeenCalledWith('devices');
    expect(mockSupabase.in).toHaveBeenCalledWith('fcm_token', ['token-stale']);
  });

  it('evicts tokens with messaging/invalid-registration-token too', async () => {
    mockSendEachForMulticast.mockResolvedValueOnce({
      successCount: 1,
      responses: [{ error: { code: 'messaging/invalid-registration-token' } }, { error: null }],
    });

    await dispatchFcm(['token-invalid', 'token-good']);

    expect(mockSupabase.in).toHaveBeenCalledWith('fcm_token', ['token-invalid']);
  });

  it('skips DB eviction when no stale tokens', async () => {
    mockSendEachForMulticast.mockResolvedValueOnce({
      successCount: 2,
      responses: [{ error: null }, { error: null }],
    });

    await dispatchFcm(['token-a', 'token-b']);

    expect(mockSupabase.in).not.toHaveBeenCalled();
  });

  it('splits into multiple batches when tokens exceed FCM_BATCH_SIZE (500)', async () => {
    const tokens = Array.from({ length: 501 }, (_, i) => `token-${i}`);
    mockSendEachForMulticast
      .mockResolvedValueOnce({ successCount: 500, responses: Array(500).fill({ error: null }) })
      .mockResolvedValueOnce({ successCount: 1, responses: [{ error: null }] });

    const result = await dispatchFcm(tokens);

    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ sent: 501, total: 501 });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /home/hp/projects/pulse-news/cron && npm test -- --testPathPattern=notify
```

Expected: all 14 tests pass (7 existing + 7 new).

- [ ] **Step 3: Commit**

```bash
git add cron/src/tests/notify.test.ts
git commit -m "test(cron/notify): dispatchFcm — 7 tests covering batching, stale eviction, empty tokens"
```

---

## Task 7: Write tests for `sendNotifications`

**Files:**

- Modify: `cron/src/tests/notify.test.ts`

- [ ] **Step 1: Add `sendNotifications` to the import**

Change:

```typescript
import { persistDigests, persistGlobalDigest, dispatchFcm } from '../notify';
```

To:

```typescript
import { persistDigests, persistGlobalDigest, dispatchFcm, sendNotifications } from '../notify';
```

- [ ] **Step 2: Append `sendNotifications` describe block**

```typescript
// ── sendNotifications ──────────────────────────────────────────────────────────

describe('sendNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnThis();
    mockSupabase.in.mockResolvedValue({ error: null });
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-key';
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY =
      '-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----';
  });

  it('skips FCM dispatch when no devices are registered', async () => {
    mockSupabase.select.mockResolvedValueOnce({ data: [], error: null });

    await sendNotifications([{ region: 'Hungary', headlines: [], attempts: 1 }]);

    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it('dispatches FCM with tokens from all registered devices', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: [
        { id: '1', fcm_token: 'tok-a' },
        { id: '2', fcm_token: 'tok-b' },
      ],
      error: null,
    });
    mockSendEachForMulticast.mockResolvedValueOnce({
      successCount: 2,
      responses: [{ error: null }, { error: null }],
    });

    await sendNotifications([
      { region: 'Hungary', headlines: [], attempts: 1 },
      { region: 'United States', headlines: [], attempts: 1 },
    ]);

    expect(mockSendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['tok-a', 'tok-b'],
        data: expect.objectContaining({ regions: 'Hungary,United States' }),
      }),
    );
  });

  it('throws when the device query returns an error', async () => {
    mockSupabase.select.mockResolvedValueOnce({ data: null, error: { message: 'query failed' } });

    await expect(
      sendNotifications([{ region: 'Hungary', headlines: [], attempts: 1 }]),
    ).rejects.toThrow('Failed to read device tokens: query failed');
  });
});
```

- [ ] **Step 3: Run the full test suite**

```bash
cd /home/hp/projects/pulse-news/cron && npm test
```

Expected: all tests pass (93 existing + 17 new notify tests = 110 total).

- [ ] **Step 4: Run coverage**

```bash
cd /home/hp/projects/pulse-news/cron && npm run test:coverage
```

Expected: global line coverage ≥ 60% (Jest enforces the threshold). `notify.ts` should be ≥ 80%.

- [ ] **Step 5: Commit**

```bash
git add cron/src/tests/notify.test.ts
git commit -m "test(cron/notify): sendNotifications — 3 tests; full notify suite 17 tests"
```

---

## Task 8: Update `cron/CLAUDE.md` module map

**Files:**

- Modify: `cron/CLAUDE.md`

- [ ] **Step 1: Mark `src/notify.ts` as landed**

Find:

```
| `src/notify.ts`               |     | `persistDigests`, `persistGlobalDigest`, `dispatchFcm`, `sendNotifications` (cron/notify slice)      |
```

Change to:

```
| `src/notify.ts`               | ✓   | `persistDigests`, `persistGlobalDigest`, `dispatchFcm`, `sendNotifications` (cron/notify slice)      |
```

- [ ] **Step 2: Commit**

```bash
git add cron/CLAUDE.md
git commit -m "docs: mark notify.ts as landed in cron module map"
```

---

## Task 9: Pre-PR quality pass

- [ ] **Step 1: Run full lint + typecheck + test**

```bash
cd /home/hp/projects/pulse-news/cron && npx tsc --noEmit && npx eslint --ext .ts src && npm test
```

Expected: zero errors, all tests pass.

- [ ] **Step 2: Run `/code-review` on the branch**

Per CLAUDE.md: run `/code-review` before opening the PR. Fix any findings on the branch.

- [ ] **Step 3: Open a PR to `develop`** (confirm the target is `develop`, not `main`)

PR title: `feat(cron/notify): Supabase digest persistence and FCM dispatch`

PR body must include:

- Legacy reference: `pulse-news-legacy/cron/src/notify.ts`
- Functions ported: `buildClient`, `initMessaging`, `persistDigests`, `persistGlobalDigest`, `dispatchFcm`, `sendNotifications`
- Note: no algorithm changes — same inputs → same outputs

---

## Self-Review

**Spec coverage (REBUILD_PLAN.md §7, slice 5):**

- ✓ `persistDigests` — Task 3, tested Task 5
- ✓ `persistGlobalDigest` — Task 3, tested Task 5
- ✓ FCM dispatch (`dispatchFcm`) — Task 4, tested Task 6
- ✓ `sendNotifications` — Task 4, tested Task 7
- ✓ `buildClient` (Supabase singleton) — Task 2
- ✓ `initMessaging` (Firebase singleton) — Task 2

**Placeholder scan:** None. Every step has actual code.

**Type consistency:**

- `RegionDigest` from `./types` — same shape used in all tasks
- `GlobalHeadline` from `./rankHeadlines` — same shape in Tasks 3 and 5
- `PulseConfig` from `@shared/config` — only used in `persistDigests`
- `mockSupabase` fluent chain: `from().upsert()`, `from().delete().lt()`, `from().select()`, `from().delete().in()` — all consistent with how Supabase query builder works
- `mockSendEachForMulticast` response shape: `{ successCount: number, responses: Array<{ error: { code: string } | null }> }` — consistent across Tasks 6 and 7
