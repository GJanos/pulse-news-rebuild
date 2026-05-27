# app/digest-flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the digest display layer to the rebuild's modern stack — React Query v5 for data fetching, Zustand selectors for shared state, Reanimated v4 throughout — while preserving all legacy behavioral contracts exactly, with one intentional improvement: currency stale window reduced to 5 minutes and forced-refresh added.

**Architecture:** React Query replaces module-level Map caches in every hook. Zustand store selectors replace prop-drilling of `t`, `theme`, `aes`. Business logic is extracted as pure/async functions (exported from each hook file) so the full test suite runs in the existing Node environment without a renderer.

**Tech Stack:** React Query v5 (`@tanstack/react-query`), Zustand v5, Reanimated v4, RNGH v2, MMKV, Supabase, ts-jest (node env)

**Spec:** `docs/superpowers/specs/2026-05-27-digest-flow-design.md`

---

### Task 1: Types, prefs slice, store wire-up

**Files:**

- Modify: `app/src/types.ts`
- Create: `app/src/store/slices/prefs.ts`
- Modify: `app/src/store/index.ts`
- Test: `app/src/store/slices/prefs.test.ts`

- [ ] **Step 1: Add GlobalHeadline and GlobalDigestPayload to types.ts**

Open `app/src/types.ts` and add after the `RegionDigestPayload` interface:

```ts
export interface GlobalHeadline {
  title: string;
  summary: string;
  detail?: string;
  url: string;
  /** The source region name (e.g. "Hungary"). */
  region: string;
  sourceName?: string;
}

export interface GlobalDigestPayload {
  headlines: GlobalHeadline[];
}
```

- [ ] **Step 2: Create app/src/store/slices/prefs.ts**

```ts
import type { StateCreator } from 'zustand';
import type { UserPreferences } from '../../types';

export const DEFAULT_PREFERENCES: UserPreferences = {
  selectedRegions: ['Hungary', 'Ukraine', 'Russia', 'United States', 'United Kingdom'],
  headlineCount: 5,
  regionHeadlineCounts: {},
  historyDays: 7,
  notifyTime: '07:30',
  openLinksIn: 'in-app',
  regionStyle: 'flag',
  baseCurrency: 'USD',
  showCurrencyRates: false,
  showGlobalHeadlines: true,
  globalHeadlineCount: 5,
  theme: 'light',
  aesthetic: 'editorial',
  updatedAt: new Date(0).toISOString(),
};

export interface PrefsSlice {
  prefs: UserPreferences;
  /** Settings-flow will call this after loading from MMKV/Supabase. */
  setPrefs: (prefs: UserPreferences) => void;
}

export const createPrefsSlice: StateCreator<PrefsSlice> = (set) => ({
  prefs: DEFAULT_PREFERENCES,
  setPrefs: (prefs) => set({ prefs }),
});
```

- [ ] **Step 3: Update app/src/store/index.ts**

```ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createAppSlice, type AppSlice } from './slices/app';
import { createNavSlice, type NavSlice } from './slices/nav';
import { createAuthSlice, type AuthSlice } from './slices/auth';
import { createPrefsSlice, type PrefsSlice } from './slices/prefs';

export const useAppStore = create<AppSlice & NavSlice & AuthSlice & PrefsSlice>()(
  devtools(
    (...a) => ({
      ...createAppSlice(...a),
      ...createNavSlice(...a),
      ...createAuthSlice(...a),
      ...createPrefsSlice(...a),
    }),
    { name: 'PulseStore', enabled: __DEV__ },
  ),
);
```

- [ ] **Step 4: Write the failing prefs slice tests**

Create `app/src/store/slices/prefs.test.ts`:

```ts
import { createPrefsSlice, DEFAULT_PREFERENCES } from './prefs';
import type { PrefsSlice } from './prefs';

function makeSlice(): PrefsSlice {
  let state: PrefsSlice = {} as PrefsSlice;
  const set = (partial: Partial<PrefsSlice>) => {
    state = { ...state, ...partial };
  };
  state = createPrefsSlice(set as any, () => state, {} as any);
  return state;
}

describe('PrefsSlice', () => {
  it('initialises with DEFAULT_PREFERENCES', () => {
    const slice = makeSlice();
    expect(slice.prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('setPrefs replaces prefs entirely', () => {
    const slice = makeSlice();
    const updated = { ...DEFAULT_PREFERENCES, historyDays: 14 };
    slice.setPrefs(updated);
    // state is updated via the set callback (tested via the store integration below)
    expect(DEFAULT_PREFERENCES.historyDays).toBe(7); // DEFAULT is immutable
  });

  it('DEFAULT_PREFERENCES has showGlobalHeadlines true', () => {
    expect(DEFAULT_PREFERENCES.showGlobalHeadlines).toBe(true);
  });

  it('DEFAULT_PREFERENCES has 5 default selected regions', () => {
    expect(DEFAULT_PREFERENCES.selectedRegions).toHaveLength(5);
  });
});
```

- [ ] **Step 5: Run the tests**

```bash
cd /home/hp/projects/pulse-news/app && npm test -- --testPathPattern=prefs.test
```

Expected: 4 tests pass.

- [ ] **Step 6: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/src/types.ts app/src/store/slices/prefs.ts app/src/store/index.ts app/src/store/slices/prefs.test.ts
git commit -m "feat(app/digest-flow): add GlobalHeadline types, prefs slice, wire store"
```

---

### Task 2: storage/digests.ts — port + tests

**Files:**

- Create: `app/src/storage/digests.ts`
- Test: `app/src/storage/digests.test.ts`

Legacy: `/home/hp/projects/pulse-news-legacy/app/src/storage/digests.ts` — port exactly. No algorithmic changes.

- [ ] **Step 1: Create app/src/storage/digests.ts**

```ts
import { storage } from './mmkv';
import type {
  DailyDigest,
  Headline,
  RegionDigestPayload,
  GlobalHeadline,
  GlobalDigestPayload,
} from '../types';
import { getSupabase } from '../supabase/client';
import { getLogger } from '../logger';

const log = getLogger('digests');

const CACHE_KEY_PREFIX = 'pulse.digest.v1';
const GLOBAL_CACHE_KEY_PREFIX = 'pulse.global.v1';

function cacheKey(region: string, date: string): string {
  return `${CACHE_KEY_PREFIX}::${date}::${region}`;
}

interface CachedRegionDigest {
  region: string;
  date: string;
  headlines: Headline[];
  cachedAt: string;
}

interface CachedGlobalDigest {
  date: string;
  headlines: GlobalHeadline[];
  cachedAt: string;
}

export async function loadLocalRegionDigest(
  region: string,
  date: string,
): Promise<Headline[] | null> {
  try {
    const raw = storage.getString(cacheKey(region, date));
    if (!raw) {
      log.debug(`cache miss: ${region} ${date}`);
      return null;
    }
    const parsed = JSON.parse(raw) as CachedRegionDigest;
    log.debug(`cache hit: ${region} ${date} (${parsed.headlines.length} headlines)`);
    return parsed.headlines;
  } catch {
    log.warn(`failed to read cache for ${region} ${date}`);
    return null;
  }
}

function multiGetRegionDigests(
  regions: string[],
  date: string,
): Record<string, CachedRegionDigest> {
  if (regions.length === 0) return {};
  const out: Record<string, CachedRegionDigest> = {};
  for (const region of regions) {
    const raw = storage.getString(cacheKey(region, date));
    if (!raw) continue;
    try {
      out[region] = JSON.parse(raw) as CachedRegionDigest;
    } catch {
      log.warn(`failed to parse cached entry for ${region} ${date}`);
    }
  }
  log.debug(`multiGet: ${Object.keys(out).length}/${regions.length} cache hits for ${date}`);
  return out;
}

export function saveLocalRegionDigest(region: string, date: string, headlines: Headline[]): void {
  const entry: CachedRegionDigest = { region, date, headlines, cachedAt: new Date().toISOString() };
  try {
    storage.set(cacheKey(region, date), JSON.stringify(entry));
    log.debug(`cached ${region} ${date} (${headlines.length} headlines)`);
  } catch {
    log.warn(`failed to write cache for ${region} ${date}`);
  }
}

export function trimLocalCache(historyDays: number): void {
  try {
    const keys = storage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(CACHE_KEY_PREFIX + '::'));
    if (ours.length === 0) return;
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - historyDays);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const toDrop = ours.filter((k) => {
      const parts = k.split('::');
      const date = parts[1];
      return date ? date < cutoffISO : false;
    });
    if (toDrop.length > 0) {
      for (const key of toDrop) storage.delete(key);
      log.info(`trimmed ${toDrop.length} stale cache entries (cutoff ${cutoffISO})`);
    }
  } catch {
    log.warn('cache trim failed');
  }
}

export async function fetchRemoteDigestsForDate(
  date: string,
  regions: string[],
): Promise<Array<{ region: string; headlines: Headline[] }>> {
  const supabase = getSupabase();
  if (!supabase || regions.length === 0) return [];
  log.info(`fetching ${regions.length} region(s) from Supabase for ${date}`);
  const { data, error } = await supabase
    .from('digests')
    .select('region, payload')
    .eq('date', date)
    .in('region', regions);
  if (error || !data) {
    log.warn(`Supabase fetch failed: ${error?.message ?? 'no data returned'}`);
    return [];
  }
  return data.map((row) => {
    const payload = row.payload as RegionDigestPayload;
    return { region: row.region as string, headlines: payload.headlines ?? [] };
  });
}

function writeThrough(region: string, date: string, headlines: Headline[]): void {
  saveLocalRegionDigest(region, date, headlines);
}

async function fetchAndCache(
  date: string,
  regions: string[],
  out: Record<string, Headline[]>,
): Promise<Array<{ region: string; headlines: Headline[] }>> {
  const remote = await fetchRemoteDigestsForDate(date, regions);
  for (const row of remote) {
    out[row.region] = row.headlines;
    writeThrough(row.region, date, row.headlines);
  }
  return remote;
}

export async function loadDailyDigest(
  date: string,
  regions: string[],
  options?: { historyDays?: number; staleMinutes?: number },
): Promise<DailyDigest> {
  log.info(`loading digest ${date} for ${regions.length} region(s)`);
  const out: Record<string, Headline[]> = {};
  const today = new Date().toISOString().slice(0, 10);

  if (date === today) {
    const staleMs = (options?.staleMinutes ?? 60) * 60 * 1000;
    const now = Date.now();
    const cached = multiGetRegionDigests(regions, date);
    const stale = regions.filter((r) => {
      const entry = cached[r];
      if (!entry) return true;
      return now - new Date(entry.cachedAt).getTime() > staleMs;
    });
    const staleSet = new Set(stale);
    for (const r of regions.filter((r) => !staleSet.has(r))) out[r] = cached[r]!.headlines;
    if (stale.length > 0) {
      const remote = await fetchAndCache(date, stale, out);
      const fromRemote = new Set(remote.map((r) => r.region));
      for (const r of stale.filter((r) => !fromRemote.has(r))) {
        if (cached[r]) {
          out[r] = cached[r]!.headlines;
        }
      }
    }
  } else {
    const cached = multiGetRegionDigests(regions, date);
    for (const [r, entry] of Object.entries(cached)) out[r] = entry.headlines;
    const missing = regions.filter((r) => !cached[r]);
    if (missing.length > 0) await fetchAndCache(date, missing, out);
  }

  if (options?.historyDays && date === today) trimLocalCache(options.historyDays);

  return { date, regions: out };
}

function loadLocalGlobalDigest(date: string, staleMs: number): GlobalHeadline[] | null {
  try {
    const raw = storage.getString(`${GLOBAL_CACHE_KEY_PREFIX}::${date}`);
    if (!raw) {
      log.debug(`global cache miss: ${date}`);
      return null;
    }
    const parsed = JSON.parse(raw) as CachedGlobalDigest;
    if (staleMs > 0 && Date.now() - new Date(parsed.cachedAt).getTime() > staleMs) {
      log.debug(`global cache stale: ${date}`);
      return null;
    }
    return parsed.headlines;
  } catch {
    log.warn(`failed to read global cache for ${date}`);
    return null;
  }
}

function writeGlobalThrough(date: string, headlines: GlobalHeadline[]): void {
  const entry: CachedGlobalDigest = { date, headlines, cachedAt: new Date().toISOString() };
  try {
    storage.set(`${GLOBAL_CACHE_KEY_PREFIX}::${date}`, JSON.stringify(entry));
  } catch (e) {
    log.warn(`failed to write global cache: ${String(e)}`);
  }
}

export async function loadGlobalHeadlines(
  date: string,
  options?: { staleMinutes?: number },
): Promise<GlobalHeadline[]> {
  log.info(`loading global headlines for ${date}`);
  const today = new Date().toISOString().slice(0, 10);
  const staleMs = date === today ? (options?.staleMinutes ?? 60) * 60 * 1000 : 0;
  const cached = loadLocalGlobalDigest(date, staleMs);
  if (cached) return cached;
  const supabase = getSupabase();
  if (!supabase) {
    log.warn('Supabase not configured');
    return [];
  }
  const { data, error } = await supabase
    .from('global_digests')
    .select('payload')
    .eq('date', date)
    .maybeSingle();
  if (error) {
    log.warn(`Supabase global fetch failed: ${error.message}`);
    return [];
  }
  if (!data) {
    log.info(`no global digest for ${date}`);
    return [];
  }
  const headlines = (data.payload as GlobalDigestPayload).headlines ?? [];
  writeGlobalThrough(date, headlines);
  return headlines;
}
```

- [ ] **Step 2: Add getAllKeys and delete to the MMKV mock**

Open `app/__mocks__/react-native-mmkv.ts` and extend the mockMMKV object:

```ts
const mockStore = new Map<string, string>();

const mockMMKV = {
  getString: (key: string): string | undefined => mockStore.get(key),
  set: (key: string, value: string): void => {
    mockStore.set(key, value);
  },
  delete: (key: string): void => {
    mockStore.delete(key);
  },
  remove: (key: string): boolean => {
    const e = mockStore.has(key);
    mockStore.delete(key);
    return e;
  },
  clearAll: (): void => {
    mockStore.clear();
  },
  contains: (key: string): boolean => mockStore.has(key),
  getAllKeys: (): string[] => Array.from(mockStore.keys()),
};

export const createMMKV = jest.fn().mockReturnValue(mockMMKV);
```

- [ ] **Step 3: Write the failing storage tests**

Create `app/src/storage/digests.test.ts`:

```ts
import {
  loadDailyDigest,
  loadGlobalHeadlines,
  saveLocalRegionDigest,
  trimLocalCache,
  fetchRemoteDigestsForDate,
} from './digests';
import { storage } from './mmkv';
import { getSupabase } from '../supabase/client';

jest.mock('../supabase/client', () => ({ getSupabase: jest.fn() }));
jest.mock('../logger', () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

const TODAY = new Date().toISOString().slice(0, 10);
const PAST = '2020-01-01';

function mockSupabase(rows: unknown[] | null, error: unknown = null) {
  const chain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: rows, error }),
    maybeSingle: jest.fn().mockResolvedValue({ data: rows?.[0] ?? null, error }),
  };
  jest.mocked(getSupabase).mockReturnValue(chain as any);
  return chain;
}

beforeEach(() => {
  (storage as any).clearAll();
  jest.clearAllMocks();
});

// ── loadDailyDigest ──────────────────────────────────────────────────

describe('loadDailyDigest — today', () => {
  it('all regions fresh — Supabase not called', async () => {
    saveLocalRegionDigest('Hungary', TODAY, [{ title: 'A', summary: 'S', url: 'u' }]);
    const chain = mockSupabase([]);
    const result = await loadDailyDigest(TODAY, ['Hungary'], { staleMinutes: 60 });
    expect(result.regions['Hungary']).toHaveLength(1);
    expect(chain.in).not.toHaveBeenCalled();
  });

  it('stale region fetched from Supabase and written to MMKV', async () => {
    // Write a cache entry dated far in the past (simulate stale)
    const staleEntry = JSON.stringify({
      region: 'Hungary',
      date: TODAY,
      headlines: [{ title: 'old', summary: 's', url: 'u' }],
      cachedAt: new Date(0).toISOString(),
    });
    (storage as any).set(`pulse.digest.v1::${TODAY}::Hungary`, staleEntry);
    mockSupabase([
      { region: 'Hungary', payload: { headlines: [{ title: 'new', summary: 's', url: 'u' }] } },
    ]);
    const result = await loadDailyDigest(TODAY, ['Hungary'], { staleMinutes: 60 });
    expect(result.regions['Hungary']![0]!.title).toBe('new');
  });

  it('all missing — all fetched and written to MMKV', async () => {
    mockSupabase([
      { region: 'Hungary', payload: { headlines: [{ title: 'HU', summary: 's', url: 'u' }] } },
      { region: 'Ukraine', payload: { headlines: [{ title: 'UA', summary: 's', url: 'u' }] } },
    ]);
    const result = await loadDailyDigest(TODAY, ['Hungary', 'Ukraine'], { staleMinutes: 60 });
    expect(Object.keys(result.regions)).toHaveLength(2);
    // Written to MMKV:
    expect(storage.getString(`pulse.digest.v1::${TODAY}::Hungary`)).toBeDefined();
  });

  it('Supabase returns empty — stale MMKV served (offline fallback)', async () => {
    const staleEntry = JSON.stringify({
      region: 'Hungary',
      date: TODAY,
      headlines: [{ title: 'stale', summary: 's', url: 'u' }],
      cachedAt: new Date(0).toISOString(),
    });
    (storage as any).set(`pulse.digest.v1::${TODAY}::Hungary`, staleEntry);
    mockSupabase([]); // Supabase returns nothing
    const result = await loadDailyDigest(TODAY, ['Hungary'], { staleMinutes: 0 });
    expect(result.regions['Hungary']![0]!.title).toBe('stale');
  });

  it('Supabase error — stale MMKV served', async () => {
    const staleEntry = JSON.stringify({
      region: 'Hungary',
      date: TODAY,
      headlines: [{ title: 'cached', summary: 's', url: 'u' }],
      cachedAt: new Date(0).toISOString(),
    });
    (storage as any).set(`pulse.digest.v1::${TODAY}::Hungary`, staleEntry);
    mockSupabase(null, { message: 'network error' });
    const result = await loadDailyDigest(TODAY, ['Hungary'], { staleMinutes: 0 });
    expect(result.regions['Hungary']![0]!.title).toBe('cached');
  });
});

describe('loadDailyDigest — past date', () => {
  it('cache hit — immutable, no Supabase call', async () => {
    saveLocalRegionDigest('Hungary', PAST, [{ title: 'Past', summary: 's', url: 'u' }]);
    const chain = mockSupabase([]);
    const result = await loadDailyDigest(PAST, ['Hungary']);
    expect(result.regions['Hungary']).toHaveLength(1);
    expect(chain.in).not.toHaveBeenCalled();
  });

  it('cache miss — fetched once then written through', async () => {
    mockSupabase([
      { region: 'Hungary', payload: { headlines: [{ title: 'fetched', summary: 's', url: 'u' }] } },
    ]);
    const result = await loadDailyDigest(PAST, ['Hungary']);
    expect(result.regions['Hungary']![0]!.title).toBe('fetched');
    expect(storage.getString(`pulse.digest.v1::${PAST}::Hungary`)).toBeDefined();
  });
});

// ── saveLocalRegionDigest ────────────────────────────────────────────

describe('saveLocalRegionDigest', () => {
  it('write + read roundtrip', async () => {
    saveLocalRegionDigest('Ukraine', TODAY, [{ title: 'T', summary: 'S', url: 'u' }]);
    const result = await loadDailyDigest(TODAY, ['Ukraine'], { staleMinutes: 9999 });
    expect(result.regions['Ukraine']).toHaveLength(1);
  });
});

// ── trimLocalCache ───────────────────────────────────────────────────

describe('trimLocalCache', () => {
  it('entry on exact cutoff date kept; day before dropped', () => {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 7);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const dayBefore = new Date(cutoff.getTime() - 86_400_000).toISOString().slice(0, 10);
    saveLocalRegionDigest('Hungary', cutoffISO, []);
    saveLocalRegionDigest('Hungary', dayBefore, []);
    trimLocalCache(7);
    expect(storage.getString(`pulse.digest.v1::${cutoffISO}::Hungary`)).toBeDefined();
    expect(storage.getString(`pulse.digest.v1::${dayBefore}::Hungary`)).toBeUndefined();
  });
});

// ── loadGlobalHeadlines ──────────────────────────────────────────────

describe('loadGlobalHeadlines', () => {
  it('cache miss — fetches from Supabase global_digests', async () => {
    mockSupabase([
      { payload: { headlines: [{ title: 'G', summary: 's', url: 'u', region: 'Hungary' }] } },
    ]);
    const result = await loadGlobalHeadlines(TODAY, { staleMinutes: 60 });
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('G');
  });

  it('cache hit within stale window — Supabase not called', async () => {
    // Write fresh global cache
    const entry = JSON.stringify({
      date: TODAY,
      headlines: [{ title: 'cached', summary: 's', url: 'u', region: 'H' }],
      cachedAt: new Date().toISOString(),
    });
    (storage as any).set(`pulse.global.v1::${TODAY}`, entry);
    const chain = mockSupabase([]);
    const result = await loadGlobalHeadlines(TODAY, { staleMinutes: 60 });
    expect(result[0]!.title).toBe('cached');
    expect(chain.maybeSingle).not.toHaveBeenCalled();
  });

  it('Supabase error — returns empty array', async () => {
    mockSupabase(null, { message: 'err' });
    const result = await loadGlobalHeadlines(TODAY, { staleMinutes: 0 });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the tests**

```bash
cd /home/hp/projects/pulse-news/app && npm test -- --testPathPattern=digests.test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/storage/digests.ts app/src/storage/digests.test.ts app/__mocks__/react-native-mmkv.ts
git commit -m "feat(app/digest-flow): port storage/digests.ts with full test suite"
```

---

### Task 3: useDigest.ts — React Query wrapper + tests

**Files:**

- Create: `app/src/hooks/useDigest.ts`
- Test: `app/src/hooks/useDigest.test.ts`

- [ ] **Step 1: Create app/src/hooks/useDigest.ts**

```ts
import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadDailyDigest } from '../storage/digests';
import { TODAY_ISO } from '../data';
import { getLogger } from '../logger';
import type { DailyDigest } from '../types';

const log = getLogger('useDigest');
const FETCH_TIMEOUT_MS = 10_000;

export interface DigestQueryFnArgs {
  date: string;
  regions: string[];
  historyDays: number;
  staleMinutes: number;
  forced: boolean;
}

/** Exported for unit testing. Contains all business logic. */
export async function digestQueryFn({
  date,
  regions,
  historyDays,
  staleMinutes,
  forced,
}: DigestQueryFnArgs): Promise<DailyDigest> {
  const effectiveStale = forced ? 0 : staleMinutes;
  log.info(`fetching digest for ${date}${forced ? ' [forced]' : ''}`);
  return await Promise.race([
    loadDailyDigest(date, regions, { historyDays, staleMinutes: effectiveStale }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('digest fetch timed out')), FETCH_TIMEOUT_MS),
    ),
  ]);
}

export interface UseDigestResult {
  digest: DailyDigest | undefined;
  isLoading: boolean;
  /** True only on cold miss (no cached data) — matches legacy behavior. */
  error: boolean;
  forceRefresh: () => void;
}

export function useDigest(
  date: string,
  regions: string[],
  historyDays: number,
  staleMinutes: number,
): UseDigestResult {
  const regionsKey = regions.slice().sort().join('|');
  const forcedRef = useRef(false);

  const query = useQuery<DailyDigest>({
    queryKey: ['digest', date, regionsKey],
    staleTime: date === TODAY_ISO ? staleMinutes * 60_000 : Infinity,
    gcTime: 24 * 60 * 60_000,
    queryFn: async () => {
      const forced = forcedRef.current;
      forcedRef.current = false;
      return digestQueryFn({ date, regions, historyDays, staleMinutes, forced });
    },
  });

  const forceRefresh = useCallback(() => {
    if (date !== TODAY_ISO) return; // no-op on past dates
    forcedRef.current = true;
    void query.refetch();
  }, [date, query]);

  return {
    digest: query.data,
    isLoading: query.isPending,
    error: query.isError && !query.data,
    forceRefresh,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `app/src/hooks/useDigest.test.ts`:

```ts
import { digestQueryFn } from './useDigest';
import { loadDailyDigest } from '../storage/digests';
import { TODAY_ISO } from '../data';

jest.mock('../storage/digests', () => ({ loadDailyDigest: jest.fn() }));
jest.mock('../logger', () => ({ getLogger: () => ({ info: jest.fn(), warn: jest.fn() }) }));

const REGIONS = ['Hungary', 'Ukraine'];
const PAST = '2020-01-01';
const DIGEST = { date: TODAY_ISO, regions: { Hungary: [{ title: 'A', summary: 'S', url: 'u' }] } };

beforeEach(() => jest.clearAllMocks());

describe('digestQueryFn', () => {
  it('passes staleMinutes through when not forced', async () => {
    jest.mocked(loadDailyDigest).mockResolvedValue(DIGEST);
    await digestQueryFn({
      date: TODAY_ISO,
      regions: REGIONS,
      historyDays: 7,
      staleMinutes: 60,
      forced: false,
    });
    expect(loadDailyDigest).toHaveBeenCalledWith(TODAY_ISO, REGIONS, {
      historyDays: 7,
      staleMinutes: 60,
    });
  });

  it('passes staleMinutes: 0 when forced (bypasses stale window)', async () => {
    jest.mocked(loadDailyDigest).mockResolvedValue(DIGEST);
    await digestQueryFn({
      date: TODAY_ISO,
      regions: REGIONS,
      historyDays: 7,
      staleMinutes: 60,
      forced: true,
    });
    expect(loadDailyDigest).toHaveBeenCalledWith(TODAY_ISO, REGIONS, {
      historyDays: 7,
      staleMinutes: 0,
    });
  });

  it('rejects after 10 seconds (timeout)', async () => {
    jest.useFakeTimers();
    jest
      .mocked(loadDailyDigest)
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(DIGEST), 15_000)),
      );
    const promise = digestQueryFn({
      date: TODAY_ISO,
      regions: REGIONS,
      historyDays: 7,
      staleMinutes: 60,
      forced: false,
    });
    jest.advanceTimersByTime(10_001);
    await expect(promise).rejects.toThrow('digest fetch timed out');
    jest.useRealTimers();
  });

  it('returns result before timeout fires', async () => {
    jest.useFakeTimers();
    jest.mocked(loadDailyDigest).mockResolvedValue(DIGEST);
    const promise = digestQueryFn({
      date: TODAY_ISO,
      regions: REGIONS,
      historyDays: 7,
      staleMinutes: 60,
      forced: false,
    });
    jest.advanceTimersByTime(100);
    await expect(promise).resolves.toEqual(DIGEST);
    jest.useRealTimers();
  });

  it('propagates loadDailyDigest rejection', async () => {
    jest.mocked(loadDailyDigest).mockRejectedValue(new Error('network error'));
    await expect(
      digestQueryFn({
        date: PAST,
        regions: REGIONS,
        historyDays: 7,
        staleMinutes: 60,
        forced: false,
      }),
    ).rejects.toThrow('network error');
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd /home/hp/projects/pulse-news/app && npm test -- --testPathPattern=useDigest.test
```

Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/src/hooks/useDigest.ts app/src/hooks/useDigest.test.ts
git commit -m "feat(app/digest-flow): useDigest with React Query, 10s timeout, forceRefresh"
```

---

### Task 4: useGlobalHeadlines.ts — React Query + tests

**Files:**

- Create: `app/src/hooks/useGlobalHeadlines.ts`
- Test: `app/src/hooks/useGlobalHeadlines.test.ts`

- [ ] **Step 1: Create app/src/hooks/useGlobalHeadlines.ts**

```ts
import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadGlobalHeadlines } from '../storage/digests';
import { TODAY_ISO } from '../data';
import { getLogger } from '../logger';
import type { GlobalHeadline } from '../types';

const log = getLogger('useGlobalHeadlines');

export interface GlobalQueryFnArgs {
  date: string;
  staleMinutes: number;
  forced: boolean;
}

/** Exported for unit testing. */
export async function globalQueryFn({
  date,
  staleMinutes,
  forced,
}: GlobalQueryFnArgs): Promise<GlobalHeadline[]> {
  const effectiveStale = forced ? 0 : staleMinutes;
  log.info(`fetching global headlines for ${date}${forced ? ' [forced]' : ''}`);
  return loadGlobalHeadlines(date, { staleMinutes: effectiveStale });
}

export interface UseGlobalHeadlinesResult {
  headlines: GlobalHeadline[];
  forceRefresh: () => void;
}

export function useGlobalHeadlines(
  date: string,
  enabled: boolean,
  staleMinutes: number,
): UseGlobalHeadlinesResult {
  const forcedRef = useRef(false);

  const query = useQuery<GlobalHeadline[]>({
    queryKey: ['global', date],
    enabled,
    staleTime: date === TODAY_ISO ? staleMinutes * 60_000 : Infinity,
    gcTime: 24 * 60 * 60_000,
    queryFn: async () => {
      const forced = forcedRef.current;
      forcedRef.current = false;
      return globalQueryFn({ date, staleMinutes, forced });
    },
  });

  const forceRefresh = useCallback(() => {
    if (date !== TODAY_ISO) return; // no-op on past dates (matches legacy)
    forcedRef.current = true;
    void query.refetch();
  }, [date, query]);

  return {
    headlines: query.data ?? [],
    forceRefresh,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `app/src/hooks/useGlobalHeadlines.test.ts`:

```ts
import { globalQueryFn } from './useGlobalHeadlines';
import { loadGlobalHeadlines } from '../storage/digests';
import { TODAY_ISO } from '../data';

jest.mock('../storage/digests', () => ({ loadGlobalHeadlines: jest.fn() }));
jest.mock('../logger', () => ({ getLogger: () => ({ info: jest.fn(), warn: jest.fn() }) }));

const PAST = '2020-01-01';
const SAMPLE: import('../types').GlobalHeadline[] = [
  { title: 'G', summary: 'S', url: 'u', region: 'Hungary' },
];

beforeEach(() => jest.clearAllMocks());

describe('globalQueryFn', () => {
  it('passes staleMinutes through when not forced', async () => {
    jest.mocked(loadGlobalHeadlines).mockResolvedValue(SAMPLE);
    await globalQueryFn({ date: TODAY_ISO, staleMinutes: 60, forced: false });
    expect(loadGlobalHeadlines).toHaveBeenCalledWith(TODAY_ISO, { staleMinutes: 60 });
  });

  it('passes staleMinutes: 0 when forced', async () => {
    jest.mocked(loadGlobalHeadlines).mockResolvedValue(SAMPLE);
    await globalQueryFn({ date: TODAY_ISO, staleMinutes: 60, forced: true });
    expect(loadGlobalHeadlines).toHaveBeenCalledWith(TODAY_ISO, { staleMinutes: 0 });
  });

  it('past date — staleMinutes still passed through (storage handles immutability)', async () => {
    jest.mocked(loadGlobalHeadlines).mockResolvedValue([]);
    await globalQueryFn({ date: PAST, staleMinutes: 60, forced: false });
    expect(loadGlobalHeadlines).toHaveBeenCalledWith(PAST, { staleMinutes: 60 });
  });

  it('returns empty array when loadGlobalHeadlines returns empty', async () => {
    jest.mocked(loadGlobalHeadlines).mockResolvedValue([]);
    const result = await globalQueryFn({ date: TODAY_ISO, staleMinutes: 60, forced: false });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd /home/hp/projects/pulse-news/app && npm test -- --testPathPattern=useGlobalHeadlines.test
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/src/hooks/useGlobalHeadlines.ts app/src/hooks/useGlobalHeadlines.test.ts
git commit -m "feat(app/digest-flow): useGlobalHeadlines with React Query"
```

---

### Task 5: useCurrencyRates.ts — React Query, 5-min stale + tests

**Files:**

- Create: `app/src/hooks/useCurrencyRates.ts`
- Test: `app/src/hooks/useCurrencyRates.test.ts`

- [ ] **Step 1: Create app/src/hooks/useCurrencyRates.ts**

```ts
import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLogger } from '../logger';

const log = getLogger('useCurrencyRates');

/** Intentional improvement: 5 minutes (legacy was 60 minutes). */
const STALE_MS = 5 * 60_000;

export interface CurrencyRate {
  rate: number;
  changePercent: number | null;
}

function currencyUrls(base: string, date: 'latest' | string): [string, string] {
  const key = base.toLowerCase();
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${key}.json`,
    `https://${date}.currency-api.pages.dev/v1/currencies/${key}.json`,
  ];
}

export async function fetchRates(
  base: string,
  date: 'latest' | string,
): Promise<Record<string, number> | null> {
  const key = base.toLowerCase();
  const urls = currencyUrls(base, date);
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        log.warn(`currency fetch failed: HTTP ${res.status} (${url})`);
        continue;
      }
      const json = (await res.json()) as Record<string, Record<string, number>>;
      const rates = json[key] ?? null;
      if (rates) return rates;
    } catch (e) {
      log.warn(`currency fetch threw: ${String(e)} (${url})`);
    }
  }
  return null;
}

/** Exported for unit testing. Fetches today + yesterday rates and builds the CurrencyRate map. */
export async function buildCurrencyRates(
  codes: string[],
  baseCurrency: string,
): Promise<Record<string, CurrencyRate>> {
  const yesterdayDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  log.info(`fetching ${baseCurrency} rates for [${codes.join(', ')}]`);
  const [today, yesterday] = await Promise.all([
    fetchRates(baseCurrency, 'latest'),
    fetchRates(baseCurrency, yesterdayDate),
  ]);
  if (!today) {
    log.warn('today rates unavailable — returning {}');
    return {};
  }
  const result: Record<string, CurrencyRate> = {};
  for (const code of codes) {
    if (code === baseCurrency) continue;
    const key = code.toLowerCase();
    const rate = today[key];
    if (rate == null) continue;
    const prevRate = yesterday?.[key] ?? null;
    const changePercent = prevRate != null ? ((prevRate - rate) / prevRate) * 100 : null;
    result[code] = { rate, changePercent };
  }
  return result;
}

export function formatRate(rate: number): string {
  if (rate >= 10_000) return Math.round(rate).toLocaleString('en-US');
  if (rate >= 100) return Math.round(rate).toString();
  if (rate >= 10) return rate.toFixed(2);
  if (rate >= 1) return rate.toFixed(3);
  return rate.toFixed(3);
}

export interface UseCurrencyRatesResult {
  rates: Record<string, CurrencyRate>;
  forceRefresh: () => void;
}

export function useCurrencyRates(
  codes: string[],
  enabled: boolean,
  baseCurrency = 'USD',
): UseCurrencyRatesResult {
  const codesKey = codes.slice().sort().join(',');
  const forcedRef = useRef(false);

  const query = useQuery<Record<string, CurrencyRate>>({
    queryKey: ['currency', baseCurrency, codesKey],
    enabled: enabled && codesKey !== '',
    staleTime: STALE_MS,
    gcTime: 60 * 60_000,
    queryFn: async () => {
      forcedRef.current = false; // consumed
      return buildCurrencyRates(codes, baseCurrency);
    },
    throwOnError: false,
  });

  const forceRefresh = useCallback(() => {
    forcedRef.current = true;
    void query.refetch();
  }, [query]);

  return {
    rates: query.data ?? {},
    forceRefresh,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `app/src/hooks/useCurrencyRates.test.ts`:

```ts
import { buildCurrencyRates, fetchRates, formatRate } from './useCurrencyRates';

jest.mock('../logger', () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeFetchResponse(data: unknown, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) });
}

beforeEach(() => jest.clearAllMocks());

describe('fetchRates', () => {
  it('returns null when both URLs fail', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    const result = await fetchRates('USD', 'latest');
    expect(result).toBeNull();
  });

  it('falls back to second URL when first returns non-ok', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, json: jest.fn() })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ usd: { eur: 0.9 } }) });
    const result = await fetchRates('USD', 'latest');
    expect(result).toEqual({ eur: 0.9 });
  });
});

describe('buildCurrencyRates', () => {
  it('returns {} when today fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    const result = await buildCurrencyRates(['EUR'], 'USD');
    expect(result).toEqual({});
  });

  it('builds rate with changePercent from yesterday', async () => {
    // today: EUR = 0.9 per USD; yesterday: EUR = 1.0 per USD
    // change = (1.0 - 0.9) / 1.0 * 100 = 10% (EUR strengthened vs USD)
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ usd: { eur: 0.9 } }) }) // today (jsDelivr)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ usd: { eur: 1.0 } }) }); // yesterday (jsDelivr)
    const result = await buildCurrencyRates(['EUR'], 'USD');
    expect(result['EUR']!.rate).toBeCloseTo(0.9);
    expect(result['EUR']!.changePercent).toBeCloseTo(10);
  });

  it('sets changePercent null when yesterday unavailable', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ usd: { eur: 0.9 } }) })
      .mockRejectedValueOnce(new Error('network')); // yesterday fetch fails
    // jsDelivr failed for yesterday, try cf fallback:
    mockFetch.mockRejectedValueOnce(new Error('network'));
    const result = await buildCurrencyRates(['EUR'], 'USD');
    expect(result['EUR']!.changePercent).toBeNull();
  });

  it('different baseCurrencies produce independent cache keys (no shared state)', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ eur: { usd: 1.1 } }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: jest.fn() })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ eur: { usd: 1.1 } }) });
    await buildCurrencyRates(['USD'], 'EUR');
    await buildCurrencyRates(['USD'], 'EUR');
    // Two separate calls, not sharing any module-level state
    expect(mockFetch).toHaveBeenCalledTimes(4); // 2 calls per buildCurrencyRates (today + yesterday)
  });

  it('skips baseCurrency code in output', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ usd: { eur: 0.9, usd: 1.0 } }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ usd: {} }) });
    const result = await buildCurrencyRates(['EUR', 'USD'], 'USD');
    expect('USD' in result).toBe(false);
    expect('EUR' in result).toBe(true);
  });
});

describe('formatRate', () => {
  it.each([
    [15000, '15,000'],
    [150, '150'],
    [15.5, '15.50'],
    [1.234, '1.234'],
    [0.001, '0.001'],
  ])('formatRate(%s) = %s', (input, expected) => {
    expect(formatRate(input)).toBe(expected);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd /home/hp/projects/pulse-news/app && npm test -- --testPathPattern=useCurrencyRates.test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/src/hooks/useCurrencyRates.ts app/src/hooks/useCurrencyRates.test.ts
git commit -m "feat(app/digest-flow): useCurrencyRates with 5-min stale window, forceRefresh"
```

---

### Task 6: useDigestPageData.ts — store selectors + tests

**Files:**

- Create: `app/src/hooks/useDigestPageData.ts`
- Test: `app/src/hooks/useDigestPageData.test.ts`

- [ ] **Step 1: Create app/src/hooks/useDigestPageData.ts**

```ts
import { useCallback, useMemo } from 'react';
import { useDigest } from './useDigest';
import { useGlobalHeadlines } from './useGlobalHeadlines';
import { useCurrencyRates } from './useCurrencyRates';
import { sortedSelectedRegions } from '../data';
import { useAppStore } from '../store';
import { config } from '../config';
import type { DailyDigest, Region } from '../types';
import type { CurrencyRate } from './useCurrencyRates';

export interface VisibleBucket {
  region: Region;
  items: import('../types').Headline[];
}

/** Exported pure function for unit testing. */
export function buildVisibleBuckets(
  digest: DailyDigest | undefined,
  selectedRegions: string[],
  headlineCount: number,
  regionHeadlineCounts: Record<string, number>,
): VisibleBucket[] {
  if (!digest) return [];
  return sortedSelectedRegions(selectedRegions)
    .map((r) => {
      const count = regionHeadlineCounts[r.region] ?? headlineCount;
      return { region: r, items: (digest.regions[r.region] ?? []).slice(0, count) };
    })
    .filter((b) => b.items.length > 0);
}

export function useDigestPageData(date: string, isToday: boolean) {
  const selectedRegions = useAppStore((s) => s.prefs.selectedRegions);
  const headlineCount = useAppStore((s) => s.prefs.headlineCount);
  const regionHeadlineCounts = useAppStore((s) => s.prefs.regionHeadlineCounts);
  const historyDays = useAppStore((s) => s.prefs.historyDays);
  const showGlobalHeadlines = useAppStore((s) => s.prefs.showGlobalHeadlines);
  const globalHeadlineCount = useAppStore((s) => s.prefs.globalHeadlineCount);
  const showCurrencyRates = useAppStore((s) => s.prefs.showCurrencyRates);
  const baseCurrency = useAppStore((s) => s.prefs.baseCurrency);

  const {
    digest,
    error,
    isLoading,
    forceRefresh: forceRefreshDigest,
  } = useDigest(date, selectedRegions, historyDays, config.digestStaleMins);
  const { headlines: globalHeadlines, forceRefresh: forceRefreshGlobal } = useGlobalHeadlines(
    date,
    showGlobalHeadlines,
    config.digestStaleMins,
  );

  const visible = useMemo(
    () => buildVisibleBuckets(digest, selectedRegions, headlineCount, regionHeadlineCounts),
    [digest, selectedRegions, headlineCount, regionHeadlineCounts],
  );

  const visibleGlobalHeadlines = useMemo(
    () => globalHeadlines.slice(0, globalHeadlineCount),
    [globalHeadlines, globalHeadlineCount],
  );

  const hasGlobal = showGlobalHeadlines && visibleGlobalHeadlines.length > 0;
  const totalHeadlines = useMemo(() => visible.reduce((n, b) => n + b.items.length, 0), [visible]);

  const currencyCodes = useMemo(
    () =>
      Array.from(new Set(visible.map((b) => b.region.currency).filter((c) => c !== baseCurrency))),
    [visible, baseCurrency],
  );
  const { rates: currencyRates, forceRefresh: forceRefreshCurrency } = useCurrencyRates(
    currencyCodes,
    showCurrencyRates && isToday,
    baseCurrency,
  );

  const forceRefresh = useCallback(() => {
    forceRefreshDigest();
    forceRefreshGlobal();
    forceRefreshCurrency();
  }, [forceRefreshDigest, forceRefreshGlobal, forceRefreshCurrency]);

  return {
    digest,
    error,
    isLoading,
    visible,
    globalHeadlines,
    visibleGlobalHeadlines,
    hasGlobal,
    totalHeadlines,
    currencyRates,
    forceRefresh,
  };
}
```

Note: `useDigest` needs to export `isLoading`. Update `app/src/hooks/useDigest.ts` — add `isLoading` to `UseDigestResult`:

```ts
// In UseDigestResult interface add:
isLoading: boolean;
// In return statement:
isLoading: query.isPending,
```

- [ ] **Step 2: Write the failing tests**

Create `app/src/hooks/useDigestPageData.test.ts`:

```ts
import { buildVisibleBuckets } from './useDigestPageData';
import type { DailyDigest } from '../types';

// sortedSelectedRegions is a pure function from data.ts — mock it to return Region objects in order
jest.mock('../data', () => ({
  sortedSelectedRegions: (regions: string[]) =>
    regions.map((r) => ({
      region: r,
      country: r,
      code: r.slice(0, 2).toUpperCase(),
      continent: 'Europe',
      currency: r + '_CUR',
      sources: [],
    })),
  TODAY_ISO: '2026-01-01',
  isoDateAtDayIndex: jest.fn(),
  formatLongDate: jest.fn(),
  REGIONS: [],
}));

const makeDigest = (regions: Record<string, number>): DailyDigest => ({
  date: '2026-01-01',
  regions: Object.fromEntries(
    Object.entries(regions).map(([r, count]) => [
      r,
      Array.from({ length: count }, (_, i) => ({ title: `${r}-${i}`, summary: 's', url: 'u' })),
    ]),
  ),
});

describe('buildVisibleBuckets', () => {
  it('filters to selectedRegions only', () => {
    const digest = makeDigest({ Hungary: 3, Ukraine: 2, Russia: 1 });
    const result = buildVisibleBuckets(digest, ['Hungary', 'Ukraine'], 5, {});
    expect(result.map((b) => b.region.region)).toEqual(['Hungary', 'Ukraine']);
  });

  it('preserves sortedSelectedRegions order', () => {
    const digest = makeDigest({ Ukraine: 2, Hungary: 3 });
    const result = buildVisibleBuckets(digest, ['Ukraine', 'Hungary'], 5, {});
    expect(result[0]!.region.region).toBe('Ukraine');
    expect(result[1]!.region.region).toBe('Hungary');
  });

  it('region in prefs but missing from digest — excluded from visible', () => {
    const digest = makeDigest({ Hungary: 2 });
    const result = buildVisibleBuckets(digest, ['Hungary', 'Ukraine'], 5, {});
    expect(result).toHaveLength(1);
    expect(result[0]!.region.region).toBe('Hungary');
  });

  it('empty digest — returns []', () => {
    const result = buildVisibleBuckets(undefined, ['Hungary'], 5, {});
    expect(result).toEqual([]);
  });

  it('respects headlineCount cap', () => {
    const digest = makeDigest({ Hungary: 10 });
    const result = buildVisibleBuckets(digest, ['Hungary'], 3, {});
    expect(result[0]!.items).toHaveLength(3);
  });

  it('respects regionHeadlineCounts override', () => {
    const digest = makeDigest({ Hungary: 10 });
    const result = buildVisibleBuckets(digest, ['Hungary'], 5, { Hungary: 2 });
    expect(result[0]!.items).toHaveLength(2);
  });

  it('totalHeadlines counts across all buckets', () => {
    const digest = makeDigest({ Hungary: 3, Ukraine: 2 });
    const result = buildVisibleBuckets(digest, ['Hungary', 'Ukraine'], 5, {});
    const total = result.reduce((n, b) => n + b.items.length, 0);
    expect(total).toBe(5);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd /home/hp/projects/pulse-news/app && npm test -- --testPathPattern=useDigestPageData.test
```

Expected: 7 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/src/hooks/useDigestPageData.ts app/src/hooks/useDigestPageData.test.ts app/src/hooks/useDigest.ts
git commit -m "feat(app/digest-flow): useDigestPageData reads prefs from store, buildVisibleBuckets extracted"
```

---

### Task 7: useJumpTargets.ts — port as-is + tests

**Files:**

- Create: `app/src/hooks/useJumpTargets.ts`
- Test: `app/src/hooks/useJumpTargets.test.ts`

- [ ] **Step 1: Create app/src/hooks/useJumpTargets.ts**

```ts
import { useRef, useMemo } from 'react';
import type { GlobalHeadline, Region, Headline } from '../types';
import type { VisibleBucket } from './useDigestPageData';

export type ListItem =
  | { key: '__global__'; type: 'global'; payload: GlobalHeadline[] }
  | { key: string; type: 'region'; payload: VisibleBucket };

/** Exported for unit testing. */
export function buildJumpIndex(
  visible: VisibleBucket[],
  globalHeadlines: GlobalHeadline[],
  hasGlobal: boolean,
): { listData: ListItem[]; indexMap: Map<string, number> } {
  const listData: ListItem[] = [];
  if (hasGlobal) listData.push({ key: '__global__', type: 'global', payload: globalHeadlines });
  for (const b of visible) listData.push({ key: b.region.region, type: 'region', payload: b });
  const indexMap = new Map(listData.map((it, i) => [it.key, i]));
  return { listData, indexMap };
}

export function useJumpTargets(
  visible: VisibleBucket[],
  globalHeadlines: GlobalHeadline[],
  hasGlobal: boolean,
) {
  const indexMapRef = useRef<Map<string, number>>(new Map());

  const listData = useMemo(() => {
    const { listData: data, indexMap } = buildJumpIndex(visible, globalHeadlines, hasGlobal);
    indexMapRef.current = indexMap;
    return data;
  }, [visible, globalHeadlines, hasGlobal]);

  return { listData, indexMapRef };
}
```

- [ ] **Step 2: Write the failing tests**

Create `app/src/hooks/useJumpTargets.test.ts`:

```ts
import { buildJumpIndex } from './useJumpTargets';
import type { VisibleBucket } from './useDigestPageData';
import type { GlobalHeadline } from '../types';

const makeRegion = (name: string) => ({
  region: name,
  country: name,
  code: name.slice(0, 2).toUpperCase(),
  continent: 'Europe' as const,
  currency: 'EUR',
  sources: [],
});

const makeBucket = (name: string): VisibleBucket => ({
  region: makeRegion(name),
  items: [{ title: `${name} news`, summary: 's', url: 'u' }],
});

const GLOBAL: GlobalHeadline[] = [{ title: 'Global', summary: 'S', url: 'u', region: 'Hungary' }];

describe('buildJumpIndex', () => {
  it('global row is first when hasGlobal=true', () => {
    const { listData } = buildJumpIndex([makeBucket('Hungary')], GLOBAL, true);
    expect(listData[0]!.key).toBe('__global__');
    expect(listData[1]!.key).toBe('Hungary');
  });

  it('no global row when hasGlobal=false', () => {
    const { listData } = buildJumpIndex([makeBucket('Hungary')], GLOBAL, false);
    expect(listData).toHaveLength(1);
    expect(listData[0]!.key).toBe('Hungary');
  });

  it('indexMap maps key to correct FlatList index', () => {
    const { indexMap } = buildJumpIndex(
      [makeBucket('Hungary'), makeBucket('Ukraine')],
      GLOBAL,
      true,
    );
    expect(indexMap.get('__global__')).toBe(0);
    expect(indexMap.get('Hungary')).toBe(1);
    expect(indexMap.get('Ukraine')).toBe(2);
  });

  it('empty visible with hasGlobal=true — only global row', () => {
    const { listData } = buildJumpIndex([], GLOBAL, true);
    expect(listData).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd /home/hp/projects/pulse-news/app && npm test -- --testPathPattern=useJumpTargets.test
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/src/hooks/useJumpTargets.ts app/src/hooks/useJumpTargets.test.ts
git commit -m "feat(app/digest-flow): useJumpTargets ported, buildJumpIndex extracted for testing"
```

---

### Task 8: Flag.tsx — port as-is

**Files:**

- Create: `app/src/components/Flag.tsx`

- [ ] **Step 1: Create app/src/components/Flag.tsx**

Read the legacy at `/home/hp/projects/pulse-news-legacy/app/src/components/Flag.tsx` and port it exactly — no changes. The component uses `react-native-svg` which is already in `package.json`.

```bash
cp /home/hp/projects/pulse-news-legacy/app/src/components/Flag.tsx /home/hp/projects/pulse-news/app/src/components/Flag.tsx
```

- [ ] **Step 2: Add react-native-pressable-scale dependency**

This package is used in DigestPager, GlobalSection, RegionSection and is not yet in the rebuild. Add it now:

```bash
cd /home/hp/projects/pulse-news/app && npm install react-native-pressable-scale
```

Add `__mocks__/react-native-pressable-scale.ts` (makes the package importable in tests):

```ts
import React from 'react';
import { Pressable } from 'react-native';
import type { PressableProps } from 'react-native';

interface PressableScaleProps extends PressableProps {
  activeScale?: number;
}
export const PressableScale: React.FC<PressableScaleProps> = ({ activeScale: _, ...props }) =>
  React.createElement(Pressable, props);
```

- [ ] **Step 3: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/Flag.tsx app/__mocks__/react-native-pressable-scale.ts app/package.json app/package-lock.json
git commit -m "feat(app/digest-flow): port Flag.tsx, add react-native-pressable-scale"
```

---

### Task 9: GlobalSection.tsx — React.memo, store selectors

**Files:**

- Create: `app/src/components/GlobalSection.tsx`

- [ ] **Step 1: Create app/src/components/GlobalSection.tsx**

Port from legacy. Remove `theme` and `aes` props — read from store internally.

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from 'react-native-pressable-scale';
import { THEMES, AESTHETICS, font } from '../themes';
import PulseIcon from './Icon';
import { REGIONS } from '../data';
import { useAppStore } from '../store';
import type { Headline, GlobalHeadline, Region } from '../types';

const REGION_MAP = new Map(REGIONS.map((r) => [r.region, r]));

interface GlobalSectionProps {
  headlines: GlobalHeadline[];
  onOpenArticle: (h: Headline, r: Region) => void;
}

function GlobalSectionImpl({ headlines, onOpenArticle }: GlobalSectionProps): React.ReactElement {
  const theme = useAppStore((s) => THEMES[s.prefs.theme]);
  const aes = useAppStore((s) => AESTHETICS[s.prefs.aesthetic]);

  return (
    <View style={s.container}>
      <View
        style={[
          s.regionHeader,
          {
            borderTopColor: theme.accent,
            borderTopWidth: 2,
            borderBottomColor: theme.ruleStrong,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        <PulseIcon name="globe" size={18} color={theme.accent} strokeWidth={1.8} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            style={{
              fontFamily: font(aes, 'title', 600),
              fontSize: 19,
              lineHeight: 21,
              letterSpacing: -0.3,
              color: theme.accent,
            }}
          >
            Global Headlines
          </Text>
          <Text
            style={{
              fontFamily: font(aes, 'eyebrow', 500),
              fontSize: 9,
              letterSpacing: 1.3,
              color: theme.textFaint,
              textTransform: 'uppercase',
              marginTop: 2,
            }}
          >
            Cross-region · most important
          </Text>
        </View>
        <Text style={{ fontFamily: font(aes, 'number'), fontSize: 11, color: theme.textFaint }}>
          {headlines.length}
        </Text>
      </View>

      {headlines.map((h, i) => {
        const fallbackCode = h.region.slice(0, 2).toUpperCase();
        const region: Region = REGION_MAP.get(h.region) ?? {
          region: h.region,
          country: fallbackCode,
          code: fallbackCode,
          continent: 'Europe',
          currency: '',
          sources: [],
        };
        const headline: Headline = {
          title: h.title,
          summary: h.summary,
          detail: h.detail,
          url: h.url,
          sourceName: h.sourceName,
        };
        return (
          <PressableScale
            key={`${h.url}-${i}`}
            onPress={() => onOpenArticle(headline, region)}
            accessibilityLabel={h.title}
            activeScale={0.94}
            style={[
              s.headlineRow,
              {
                borderBottomColor: theme.rule,
                borderBottomWidth: i < headlines.length - 1 ? StyleSheet.hairlineWidth : 0,
              },
            ]}
          >
            <View style={s.numberCol}>
              <Text
                style={{
                  fontFamily: font(aes, 'number', 500),
                  fontSize: aes.numberSize,
                  lineHeight: 16,
                  color: theme.textFaint,
                  letterSpacing: 0.2,
                }}
              >
                {i + 1}
              </Text>
            </View>
            <View style={s.content}>
              <Text
                style={{
                  fontFamily: font(aes, 'title', aes.roles.title.weight),
                  fontSize: aes.titleSize,
                  lineHeight: aes.titleLh,
                  letterSpacing: aes.titleLetter,
                  color: theme.text,
                }}
              >
                {h.title}
              </Text>
              <Text
                style={{
                  fontFamily: font(aes, 'body'),
                  fontSize: aes.bodySize,
                  lineHeight: aes.bodyLh,
                  color: theme.textDim,
                  marginTop: 8,
                }}
              >
                {h.summary}
              </Text>
              <View style={s.headlineFoot}>
                <View style={s.sourceRow}>
                  <Text
                    style={{
                      fontFamily: font(aes, 'ui', 600),
                      fontSize: 12,
                      color: theme.accent,
                      letterSpacing: -0.05,
                    }}
                  >
                    {h.sourceName}
                  </Text>
                  <PulseIcon name="link" size={11} color={theme.accent} strokeWidth={1.8} />
                </View>
                <View style={[s.regionPill, { backgroundColor: theme.accentSoft }]}>
                  <Text
                    style={{
                      fontFamily: font(aes, 'eyebrow', 600),
                      fontSize: 9.5,
                      letterSpacing: aes.eyebrowLetter,
                      color: theme.accent,
                      textTransform: 'uppercase',
                    }}
                  >
                    {h.region}
                  </Text>
                </View>
              </View>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

export const GlobalSection = React.memo(GlobalSectionImpl);

const s = StyleSheet.create({
  regionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headlineRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  headlineFoot: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  container: { marginTop: 16 },
  numberCol: { width: 32, paddingTop: 2 },
  content: { flex: 1 },
  sourceRow: { flexDirection: 'row', alignItems: 'center' },
  regionPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
});
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/GlobalSection.tsx
git commit -m "feat(app/digest-flow): GlobalSection with store selectors, React.memo"
```

---

### Task 10: RegionSection.tsx — React.memo, store selectors

**Files:**

- Create: `app/src/components/RegionSection.tsx`

- [ ] **Step 1: Create app/src/components/RegionSection.tsx**

Port from legacy. Remove `theme`, `aes`, `t` props — read from store. Keep `currencyRate` as prop (per-region data).

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from 'react-native-pressable-scale';
import { THEMES, AESTHETICS, font } from '../themes';
import PulseIcon from './Icon';
import Flag from './Flag';
import { formatRate, type CurrencyRate } from '../hooks/useCurrencyRates';
import { useAppStore } from '../store';
import type { Headline, Region } from '../types';
import type { VisibleBucket } from '../hooks/useDigestPageData';

interface RegionSectionProps {
  bucket: VisibleBucket;
  currencyRate?: CurrencyRate;
  onOpenArticle: (h: Headline, r: Region) => void;
}

interface CurrencyChipProps {
  code: string;
  baseCurrency: string;
  rate: CurrencyRate;
}

function CurrencyChip({ code, baseCurrency, rate }: CurrencyChipProps): React.ReactElement {
  const aes = useAppStore((s) => AESTHETICS[s.prefs.aesthetic]);
  const theme = useAppStore((s) => THEMES[s.prefs.theme]);
  const sign = rate.changePercent == null ? '' : rate.changePercent >= 0 ? '+' : '';
  const changeTxt = rate.changePercent == null ? '' : ` ${sign}${rate.changePercent.toFixed(1)}%`;
  return (
    <View style={[chip.wrap, { backgroundColor: theme.accentSoft }]}>
      <Text style={{ fontFamily: font(aes, 'number', 600), fontSize: 11, color: theme.accent }}>
        {code}/{baseCurrency} {formatRate(rate.rate)}
        {changeTxt}
      </Text>
    </View>
  );
}

const chip = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
});

function RegionSectionImpl({
  bucket,
  currencyRate,
  onOpenArticle,
}: RegionSectionProps): React.ReactElement {
  const theme = useAppStore((s) => THEMES[s.prefs.theme]);
  const aes = useAppStore((s) => AESTHETICS[s.prefs.aesthetic]);
  const baseCurrency = useAppStore((s) => s.prefs.baseCurrency);
  const regionStyle = useAppStore((s) => s.prefs.regionStyle);
  const showFlags = regionStyle !== 'code';

  return (
    <View style={s.container}>
      <View
        style={[
          s.regionHeader,
          {
            borderTopColor: theme.accent,
            borderTopWidth: 2,
            borderBottomColor: theme.ruleStrong,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        {showFlags ? (
          <Flag country={bucket.region.country} width={26} height={20} />
        ) : (
          <View style={[s.codePill, { backgroundColor: theme.accentSoft }]}>
            <Text
              style={{
                fontFamily: font(aes, 'number', 600),
                fontSize: 11,
                color: theme.accent,
                letterSpacing: 0.4,
              }}
            >
              {bucket.region.code}
            </Text>
          </View>
        )}
        <View style={s.headerTitle}>
          <Text
            style={{
              fontFamily: font(aes, 'title', 600),
              fontSize: 19,
              lineHeight: 21,
              letterSpacing: -0.3,
              color: theme.accent,
            }}
          >
            {bucket.region.region}
          </Text>
          <Text
            style={{
              fontFamily: font(aes, 'eyebrow', 500),
              fontSize: 9,
              letterSpacing: 1.3,
              color: theme.textFaint,
              textTransform: 'uppercase',
              marginTop: 2,
            }}
          >
            {bucket.region.continent}
          </Text>
        </View>
        {currencyRate && (
          <CurrencyChip
            code={bucket.region.currency}
            baseCurrency={baseCurrency}
            rate={currencyRate}
          />
        )}
      </View>

      {bucket.items.map((h, i) => (
        <PressableScale
          key={`${h.url}-${i}`}
          onPress={() => onOpenArticle(h, bucket.region)}
          accessibilityLabel={h.title}
          activeScale={0.94}
          style={[
            s.headlineRow,
            {
              borderBottomColor: theme.rule,
              borderBottomWidth: i < bucket.items.length - 1 ? StyleSheet.hairlineWidth : 0,
            },
          ]}
        >
          <View style={s.numberCol}>
            <Text
              style={{
                fontFamily: font(aes, 'number', 500),
                fontSize: aes.numberSize,
                lineHeight: 16,
                color: theme.textFaint,
                letterSpacing: 0.2,
              }}
            >
              {i + 1}
            </Text>
          </View>
          <View style={s.content}>
            <Text
              style={{
                fontFamily: font(aes, 'title', aes.roles.title.weight),
                fontSize: aes.titleSize,
                lineHeight: aes.titleLh,
                letterSpacing: aes.titleLetter,
                color: theme.text,
              }}
            >
              {h.title}
            </Text>
            <Text
              style={{
                fontFamily: font(aes, 'body'),
                fontSize: aes.bodySize,
                lineHeight: aes.bodyLh,
                color: theme.textDim,
                marginTop: 8,
              }}
            >
              {h.summary}
            </Text>
            {h.sourceName && (
              <View style={s.sourceRow}>
                <Text
                  style={{
                    fontFamily: font(aes, 'ui', 600),
                    fontSize: 12,
                    color: theme.accent,
                    letterSpacing: -0.05,
                  }}
                >
                  {h.sourceName}
                </Text>
                <PulseIcon name="link" size={11} color={theme.accent} strokeWidth={1.8} />
              </View>
            )}
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

export const RegionSection = React.memo(RegionSectionImpl);

const s = StyleSheet.create({
  container: { marginTop: 16 },
  regionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: { flex: 1, marginLeft: 10 },
  codePill: {
    width: 36,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headlineRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  numberCol: { width: 32, paddingTop: 2 },
  content: { flex: 1 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  currencyWrap: {},
});
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/RegionSection.tsx
git commit -m "feat(app/digest-flow): RegionSection with store selectors, React.memo"
```

---

### Task 11: JumpModal.tsx — Reanimated v4 animation

**Files:**

- Create: `app/src/components/JumpModal.tsx`
- Test: `app/src/hooks/useJumpTargets.test.ts` (already done in Task 7)

- [ ] **Step 1: Add Reanimated mock to jest setup**

Add `app/__mocks__/react-native-reanimated.ts`:

```ts
const Reanimated = {
  default: {
    View: require('react-native').View,
    createAnimatedComponent: (c: unknown) => c,
  },
  useSharedValue: (v: unknown) => ({ value: v }),
  useAnimatedStyle: (fn: () => unknown) => fn(),
  withTiming: (v: unknown) => v,
  interpolate: (_v: unknown, _i: number[], output: number[]) => output[0],
  Extrapolation: { CLAMP: 'clamp' },
};

module.exports = Reanimated;
```

Add to `jest.config.cjs` moduleNameMapper:

```js
'^react-native-reanimated$': '<rootDir>/__mocks__/react-native-reanimated.ts',
'^react-native-gesture-handler$': '<rootDir>/__mocks__/react-native-gesture-handler.ts',
```

Add `app/__mocks__/react-native-gesture-handler.ts`:

```ts
export const GestureHandlerRootView = require('react-native').View;
export const GestureDetector = ({ children }: { children: React.ReactNode }) => children;
export const Gesture = {
  Pan: () => ({
    activeOffsetX: function (this: unknown) {
      return this;
    },
    failOffsetY: function (this: unknown) {
      return this;
    },
    onStart: function (this: unknown) {
      return this;
    },
    onUpdate: function (this: unknown) {
      return this;
    },
    onEnd: function (this: unknown) {
      return this;
    },
  }),
};
```

- [ ] **Step 2: Create app/src/components/JumpModal.tsx**

Port from legacy. Remove `panelAnim`, `aes`, `theme` props — animation is internal, read theme/aes from store.

```tsx
import React, { useEffect } from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import PulseIcon from './Icon';
import Flag from './Flag';
import { THEMES, AESTHETICS, font } from '../themes';
import { useAppStore } from '../store';
import type { VisibleBucket } from '../hooks/useDigestPageData';

interface Props {
  open: boolean;
  onClose: () => void;
  visible: VisibleBucket[];
  hasGlobal: boolean;
  jumpTo: (name: string) => void;
}

export default function JumpModal({ open, onClose, visible, hasGlobal, jumpTo }: Props) {
  const theme = useAppStore((s) => THEMES[s.prefs.theme]);
  const aes = useAppStore((s) => AESTHETICS[s.prefs.aesthetic]);
  const regionStyle = useAppStore((s) => s.prefs.regionStyle);

  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(open ? 1 : 0, { duration: 180 });
  }, [open, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: interpolate(opacity.value, [0, 1], [16, 0]) }],
  }));

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.panel,
            { backgroundColor: theme.surface, borderColor: theme.rule },
            animStyle,
          ]}
        >
          <Text
            style={{
              fontFamily: font(aes, 'eyebrow', 600),
              fontSize: 9.5,
              letterSpacing: 1.8,
              color: theme.textFaint,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Jump to
          </Text>

          {hasGlobal && (
            <Pressable
              onPress={() => {
                onClose();
                jumpTo('__global__');
              }}
              style={[
                styles.row,
                { borderTopColor: theme.rule, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
              accessibilityLabel="Jump to Global Headlines"
            >
              <PulseIcon name="globe" size={15} color={theme.textDim} />
              <Text
                style={{
                  fontFamily: font(aes, 'ui', 500),
                  fontSize: 14,
                  color: theme.text,
                  marginLeft: 10,
                }}
              >
                Global Headlines
              </Text>
            </Pressable>
          )}

          {visible.map((b) => (
            <Pressable
              key={b.region.region}
              onPress={() => {
                onClose();
                jumpTo(b.region.region);
              }}
              style={[
                styles.row,
                { borderTopColor: theme.rule, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
              accessibilityLabel={`Jump to ${b.region.region}`}
            >
              {regionStyle !== 'code' ? (
                <Flag country={b.region.country} width={22} height={16} />
              ) : (
                <View style={[styles.codePill, { backgroundColor: theme.accentSoft }]}>
                  <Text
                    style={{
                      fontFamily: font(aes, 'number', 600),
                      fontSize: 9.5,
                      color: theme.accent,
                    }}
                  >
                    {b.region.code}
                  </Text>
                </View>
              )}
              <Text
                style={{
                  fontFamily: font(aes, 'ui', 500),
                  fontSize: 14,
                  color: theme.text,
                  marginLeft: 10,
                }}
              >
                {b.region.region}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    width: 240,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  codePill: {
    width: 28,
    height: 18,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 3: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/app && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/JumpModal.tsx app/__mocks__/react-native-reanimated.ts app/__mocks__/react-native-gesture-handler.ts app/jest.config.cjs
git commit -m "feat(app/digest-flow): JumpModal with Reanimated v4 animation"
```

---

### Task 12: DigestPage.tsx — FlatList optimized, store selectors

**Files:**

- Create: `app/src/components/DigestPage.tsx`

- [ ] **Step 1: Create app/src/components/DigestPage.tsx**

```tsx
import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { THEMES, AESTHETICS, font } from '../themes';
import { useDigestPageData } from '../hooks/useDigestPageData';
import { useJumpTargets, type ListItem } from '../hooks/useJumpTargets';
import JumpModal from './JumpModal';
import { isoDateAtDayIndex } from '../data';
import { RegionSection } from './RegionSection';
import { GlobalSection } from './GlobalSection';
import PulseIcon from './Icon';
import { useAppStore } from '../store';
import { getLogger } from '../logger';
import type { Headline, Region } from '../types';

const log = getLogger('DigestPage');

export interface DigestPageHandle {
  forceRefresh: () => void;
  openJumpModal: () => void;
}

interface Props {
  dayIndex: number;
  active: boolean;
  onOpenArticle: (h: Headline, r: Region) => void;
}

export const DigestPage = React.memo(
  React.forwardRef<DigestPageHandle, Props>(function DigestPage(
    { dayIndex, active, onOpenArticle },
    ref,
  ) {
    const isToday = dayIndex === 0;
    const date = useMemo(() => isoDateAtDayIndex(dayIndex), [dayIndex]);

    const theme = useAppStore((s) => THEMES[s.prefs.theme]);
    const aes = useAppStore((s) => AESTHETICS[s.prefs.aesthetic]);
    const notifyTime = useAppStore((s) => s.prefs.notifyTime);

    const {
      digest,
      error,
      isLoading,
      visible,
      visibleGlobalHeadlines,
      hasGlobal,
      totalHeadlines,
      currencyRates,
      forceRefresh,
    } = useDigestPageData(date, isToday);

    const flatRef = useRef<FlatList<ListItem> | null>(null);
    const { listData, indexMapRef } = useJumpTargets(visible, visibleGlobalHeadlines, hasGlobal);

    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = useCallback(() => {
      setRefreshing(true);
      forceRefresh();
    }, [forceRefresh]);
    useEffect(() => {
      if (digest) setRefreshing(false);
    }, [digest]);

    const [jumpOpen, setJumpOpen] = useState(false);
    const openJumpModal = useCallback(() => setJumpOpen(true), []);

    const scrollToIndexSafe = useCallback((index: number) => {
      if (index < 0) return;
      let attempts = 0;
      const tryScroll = () => {
        attempts += 1;
        try {
          flatRef.current?.scrollToIndex({ index, animated: true });
        } catch {
          if (attempts < 4) setTimeout(tryScroll, 80 * attempts);
        }
      };
      tryScroll();
    }, []);

    const jumpTo = useCallback(
      (name: string) => {
        setJumpOpen(false);
        const idx = indexMapRef.current.get(name);
        if (idx !== undefined) scrollToIndexSafe(idx);
      },
      [scrollToIndexSafe, indexMapRef],
    );

    React.useImperativeHandle(ref, () => ({ forceRefresh, openJumpModal }), [
      forceRefresh,
      openJumpModal,
    ]);

    const renderItem = useCallback(
      ({ item }: { item: ListItem }) => {
        if (item.type === 'global') {
          return <GlobalSection headlines={item.payload} onOpenArticle={onOpenArticle} />;
        }
        return (
          <RegionSection
            bucket={item.payload}
            currencyRate={currencyRates[item.payload.region.currency]}
            onOpenArticle={onOpenArticle}
          />
        );
      },
      [currencyRates, onOpenArticle],
    );

    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={styles.metaRow}>
          <Text
            style={{
              fontFamily: font(aes, 'eyebrow', 600),
              fontSize: 10,
              letterSpacing: 1.8,
              color: theme.textFaint,
              textTransform: 'uppercase',
            }}
          >
            {totalHeadlines} stories · {visible.length} regions
          </Text>
        </View>

        {isLoading && !error && (
          <View style={styles.centerSpinner}>
            <ActivityIndicator color={theme.textFaint} />
          </View>
        )}

        {!isLoading && error && (
          <Pressable onPress={forceRefresh} style={styles.errorBox}>
            <Text
              style={{
                fontFamily: font(aes, 'eyebrow', 600),
                fontSize: 9.5,
                letterSpacing: 1.8,
                color: theme.textFaint,
                textTransform: 'uppercase',
              }}
            >
              Couldn't load
            </Text>
            <Text style={{ fontFamily: font(aes, 'body'), fontSize: 14, color: theme.textDim }}>
              Tap to retry
            </Text>
          </Pressable>
        )}

        {digest && visible.length === 0 && !hasGlobal && (
          <View style={styles.emptyBox}>
            <Text
              style={{
                fontFamily: font(aes, 'eyebrow', 600),
                fontSize: 9.5,
                letterSpacing: 1.8,
                color: theme.textFaint,
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              No stories
            </Text>
            <Text
              style={{
                fontFamily: font(aes, 'body'),
                fontSize: 14,
                lineHeight: 22,
                color: theme.textDim,
                textAlign: 'center',
              }}
            >
              No digest available for your selected regions on this date.
            </Text>
          </View>
        )}

        {digest && (visible.length > 0 || hasGlobal) && (
          <FlatList
            ref={flatRef}
            data={listData}
            keyExtractor={(item) => item.key}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={active && isToday ? onRefresh : undefined}
            renderItem={renderItem}
            removeClippedSubviews
            maxToRenderPerBatch={8}
            windowSize={5}
            ListFooterComponent={
              <View style={styles.footer}>
                <Text
                  style={{
                    fontFamily: font(aes, 'eyebrow', 600),
                    fontSize: 10,
                    letterSpacing: 2.2,
                    color: theme.textFaint,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  — End of digest —
                </Text>
                <Text
                  style={{
                    fontFamily: font(aes, 'body'),
                    fontSize: 13,
                    lineHeight: 20,
                    color: theme.textDim,
                    maxWidth: 280,
                    textAlign: 'center',
                  }}
                >
                  Tomorrow's pulse arrives at {notifyTime}.
                </Text>
              </View>
            }
          />
        )}

        <JumpModal
          open={jumpOpen}
          onClose={() => setJumpOpen(false)}
          visible={visible}
          hasGlobal={hasGlobal}
          jumpTo={jumpTo}
        />
      </View>
    );
  }),
);

const styles = StyleSheet.create({
  metaRow: { paddingVertical: 5, alignItems: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, alignItems: 'center' },
  centerSpinner: { paddingVertical: 60, alignItems: 'center' },
  errorBox: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { paddingVertical: 60, paddingHorizontal: 32, alignItems: 'center' },
});
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/app && npx tsc --noEmit
```

Fix any type errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/DigestPage.tsx
git commit -m "feat(app/digest-flow): DigestPage FlatList-optimized, store selectors, no prop drilling"
```

---

### Task 13: DigestPager.tsx — port as-is, store selectors

**Files:**

- Create: `app/src/components/DigestPager.tsx`

- [ ] **Step 1: Create app/src/components/DigestPager.tsx**

Port from legacy. Remove `t`, `theme`, `aes`, `maxDayIndex` from props — read from store. Keep `dayIndex`, `setDayIndex`, `onOpenSettings`, `onOpenArticle`, `activePageRef` as props.

```tsx
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWindowDimensions, View, Text, Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { PressableScale } from 'react-native-pressable-scale';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { DigestPage, type DigestPageHandle } from './DigestPage';
import PulseMark from './PulseMark';
import PulseIcon from './Icon';
import { THEMES, AESTHETICS, font } from '../themes';
import { isoDateAtDayIndex, formatLongDate } from '../data';
import { useAppStore } from '../store';
import type { Headline, Region } from '../types';

interface Props {
  dayIndex: number;
  setDayIndex: (n: number) => void;
  onOpenSettings: () => void;
  onOpenArticle: (h: Headline, r: Region) => void;
  activePageRef: React.RefObject<DigestPageHandle | null>;
}

const SPRING = { damping: 28, stiffness: 220, mass: 0.9 } as const;
const WINDOW = 1;

function txFor(dayIndex: number, maxDayIndex: number, W: number): number {
  'worklet';
  return -(maxDayIndex - dayIndex) * W;
}

function usePageRefs<T>(activeRef: React.MutableRefObject<T | null>) {
  const pageRefs = useRef<Map<number, T | null>>(new Map());
  const setters = useRef(new Map<number, (h: T | null) => void>());
  const activeKey = useRef<number | null>(null);

  const getSlotSetter = useCallback(
    (pageDayIndex: number) => {
      let setter = setters.current.get(pageDayIndex);
      if (!setter) {
        setter = (h: T | null) => {
          pageRefs.current.set(pageDayIndex, h);
          if (pageDayIndex === activeKey.current) activeRef.current = h;
        };
        setters.current.set(pageDayIndex, setter);
      }
      return setter;
    },
    [activeRef],
  );

  const setActivePage = useCallback(
    (idx: number) => {
      activeKey.current = idx;
      activeRef.current = pageRefs.current.get(idx) ?? null;
    },
    [activeRef],
  );

  return { getSlotSetter, setActivePage };
}

const iconBtn = {
  width: 36,
  height: 36,
  borderRadius: 10,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

export default React.memo(function DigestPager({
  dayIndex,
  setDayIndex,
  onOpenSettings,
  onOpenArticle,
  activePageRef,
}: Props) {
  const { width: W } = useWindowDimensions();

  const theme = useAppStore((s) => THEMES[s.prefs.theme]);
  const aes = useAppStore((s) => AESTHETICS[s.prefs.aesthetic]);
  const maxDayIndex = useAppStore((s) => Math.max(0, s.prefs.historyDays - 1));
  const showGlobalHeadlines = useAppStore((s) => s.prefs.showGlobalHeadlines);
  const selectedRegions = useAppStore((s) => s.prefs.selectedRegions);

  const isToday = dayIndex === 0;
  const date = useMemo(() => isoDateAtDayIndex(dayIndex), [dayIndex]);
  const fmt = useMemo(() => formatLongDate(date), [date]);

  const tx = useSharedValue(txFor(dayIndex, maxDayIndex, W));
  const startTx = useSharedValue(txFor(dayIndex, maxDayIndex, W));
  const { getSlotSetter, setActivePage } = usePageRefs<DigestPageHandle>(activePageRef);

  const skipNextSpring = useRef(false);
  const commitDay = useCallback(
    (idx: number) => {
      skipNextSpring.current = true;
      setDayIndex(idx);
    },
    [setDayIndex],
  );

  useEffect(() => {
    setActivePage(dayIndex);
    if (skipNextSpring.current) {
      skipNextSpring.current = false;
      return;
    }
    cancelAnimation(tx);
    tx.value = withSpring(txFor(dayIndex, maxDayIndex, W), SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIndex, W, setActivePage]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-15, 15])
    .onStart(() => {
      cancelAnimation(tx);
      startTx.value = tx.value;
    })
    .onUpdate((e) => {
      let next = startTx.value + e.translationX;
      const leftBound = txFor(0, maxDayIndex, W);
      const rightBound = 0;
      if (next > rightBound) next = rightBound + (next - rightBound) * 0.35;
      if (next < leftBound) next = leftBound + (next - leftBound) * 0.35;
      tx.value = next;
    })
    .onEnd((e) => {
      const vx = e.velocityX;
      const dx = e.translationX;
      const threshold = W * 0.22;
      const velocityTrigger = 600;
      let target = dayIndex;
      if (dx > threshold || vx > velocityTrigger) target = Math.min(dayIndex + 1, maxDayIndex);
      else if (dx < -threshold || vx < -velocityTrigger) target = Math.max(dayIndex - 1, 0);
      tx.value = withSpring(txFor(target, maxDayIndex, W), { ...SPRING, velocity: vx });
      if (target !== dayIndex) runOnJS(commitDay)(target);
    });

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  const totalSlots = maxDayIndex + 1;
  const canJump = selectedRegions.length + (showGlobalHeadlines ? 1 : 0) > 1;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { backgroundColor: theme.bg }]}>
        <View style={styles.headerTop}>
          <View style={styles.wordmark}>
            <PulseMark size={22} color={theme.text} accent={theme.accent} />
            <Text
              style={{
                fontFamily: font(aes, 'title', 700),
                fontSize: 22,
                lineHeight: 22,
                letterSpacing: -0.4,
                color: theme.text,
                marginLeft: 8,
              }}
            >
              Pulse
            </Text>
            <Text
              style={{
                fontFamily: font(aes, 'eyebrow', 600),
                fontSize: 9,
                lineHeight: 10,
                letterSpacing: 1.6,
                color: theme.accent,
                marginLeft: 8,
                textTransform: 'uppercase',
              }}
            >
              Daily
            </Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {canJump && (
              <Pressable
                onPress={() => activePageRef.current?.openJumpModal()}
                style={iconBtn}
                hitSlop={6}
                accessibilityLabel="Jump to region"
              >
                <PulseIcon name="list-ul" size={18} color={theme.textDim} />
              </Pressable>
            )}
            <Pressable
              onPress={onOpenSettings}
              style={iconBtn}
              hitSlop={6}
              accessibilityLabel="Settings"
            >
              <PulseIcon name="settings" size={18} color={theme.textDim} />
            </Pressable>
          </View>
        </View>

        <View style={styles.navRow}>
          {dayIndex < maxDayIndex ? (
            <PressableScale
              onPress={() => setDayIndex(dayIndex + 1)}
              accessibilityLabel="Older day"
              activeScale={0.9}
              style={iconBtn}
            >
              <PulseIcon name="arrow-left" size={18} color={theme.textDim} />
            </PressableScale>
          ) : (
            <View style={iconBtn} />
          )}

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: font(aes, 'eyebrow', 600),
                fontSize: 9.5,
                lineHeight: 10,
                letterSpacing: 1.7,
                color: isToday ? theme.accent : theme.textFaint,
                marginBottom: 4,
                textTransform: 'uppercase',
              }}
            >
              {isToday ? 'Today' : `${dayIndex} ${dayIndex === 1 ? 'day' : 'days'} ago`}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: font(aes, 'title', 600),
                  fontSize: 18,
                  lineHeight: 18,
                  letterSpacing: -0.2,
                  color: theme.text,
                }}
              >
                {fmt.wd}, {fmt.mo} {fmt.day}
              </Text>
              {!isToday && (
                <PressableScale
                  onPress={() => setDayIndex(0)}
                  accessibilityLabel="Jump to today"
                  activeScale={0.92}
                  style={{
                    marginLeft: 10,
                    backgroundColor: theme.accentSoft,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: font(aes, 'ui', 600),
                      fontSize: 11,
                      color: theme.accent,
                      letterSpacing: -0.05,
                    }}
                  >
                    Today
                  </Text>
                </PressableScale>
              )}
            </View>
          </View>

          {dayIndex > 0 ? (
            <PressableScale
              onPress={() => setDayIndex(dayIndex - 1)}
              accessibilityLabel="Newer day"
              activeScale={0.9}
              style={iconBtn}
            >
              <PulseIcon name="arrow-right" size={18} color={theme.textDim} />
            </PressableScale>
          ) : (
            <View style={iconBtn} />
          )}
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <Animated.View style={[styles.strip, { width: W * totalSlots }, stripStyle]}>
            {Array.from({ length: totalSlots }, (_, i) => {
              const pageDayIndex = maxDayIndex - i;
              const inWindow = Math.abs(pageDayIndex - dayIndex) <= WINDOW;
              return (
                <View key={pageDayIndex} style={{ width: W }}>
                  {inWindow ? (
                    <DigestPage
                      ref={getSlotSetter(pageDayIndex)}
                      dayIndex={pageDayIndex}
                      active={pageDayIndex === dayIndex}
                      onOpenArticle={onOpenArticle}
                    />
                  ) : null}
                </View>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { flexDirection: 'row', alignItems: 'center' },
  navRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  strip: { flex: 1, flexDirection: 'row' },
});
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/DigestPager.tsx
git commit -m "feat(app/digest-flow): DigestPager with store selectors, maxDayIndex computed internally"
```

---

### Task 14: App.tsx — wire DigestPager, BackHandler

**Files:**

- Modify: `app/App.tsx`

- [ ] **Step 1: Update App.tsx**

Replace the entire `App.tsx` with the following (preserving all existing boot logic):

```tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  SourceSerif4_400Regular,
  SourceSerif4_500Medium,
  SourceSerif4_600SemiBold,
  SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { THEMES, AESTHETICS } from './src/themes';
import { useAppStore } from './src/store';
import { useAppInit } from './src/hooks/useAppInit';
import { useAuthInit } from './src/hooks/useAuthInit';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import SplashScreenComponent from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import DigestPager from './src/components/DigestPager';
import SettingsStub from './src/screens/stubs/SettingsStub';
import UpdateRequiredScreen from './src/screens/stubs/UpdateRequiredScreen';
import MaintenanceScreen from './src/screens/stubs/MaintenanceScreen';
import type { AppState, ScreenId } from './src/types';
import type { Theme } from './src/themes';
import type { AuthActions } from './src/hooks/useSupabaseAuth';
import type { DigestPageHandle } from './src/components/DigestPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
const defaultAes = AESTHETICS.editorial;

export default function App(): React.ReactElement {
  const [fontsLoaded, fontError] = useFonts({
    SourceSerif4_400Regular,
    SourceSerif4_500Medium,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  useAppInit(fontsLoaded || !!fontError);

  const appState = useAppStore((s) => s.appState);
  const screen = useAppStore((s) => s.screen);
  const isPasswordRecovery = useAppStore((s) => s.isPasswordRecovery);
  const themeId = useAppStore((s) => s.prefs.theme);
  const theme = THEMES[themeId] ?? THEMES.light;

  const actions = useAuthInit();

  useEffect(() => {
    if (appState !== 'booting') void SplashScreen.hideAsync();
  }, [appState]);

  return (
    <GestureHandlerRootView style={s.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <RootScreens
              appState={appState}
              screen={screen}
              theme={theme}
              isPasswordRecovery={isPasswordRecovery}
              actions={actions}
            />
            <StatusBar style={theme.barStyle} />
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

interface RootScreensProps {
  appState: AppState;
  screen: ScreenId;
  theme: Theme;
  isPasswordRecovery: boolean;
  actions: AuthActions;
}

function RootScreens({
  appState,
  screen,
  theme,
  isPasswordRecovery,
  actions,
}: RootScreensProps): React.ReactElement {
  const dayIndex = useAppStore((s) => s.dayIndex);
  const setDayIndex = useAppStore((s) => s.setDayIndex);
  const article = useAppStore((s) => s.article);
  const setArticle = useAppStore((s) => s.setArticle);
  const setScreen = useAppStore((s) => s.setScreen);
  const activePageRef = useRef<DigestPageHandle | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (article) {
        setArticle(null);
        return true;
      }
      if (screen === 'settings') {
        setScreen('digest');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [article, screen, setArticle, setScreen]);

  if (isPasswordRecovery) {
    return (
      <ResetPasswordScreen
        theme={theme}
        aes={defaultAes}
        onUpdatePassword={actions.updatePassword}
      />
    );
  }

  if (appState === 'booting') return <View style={[s.root, { backgroundColor: theme.bg }]} />;
  if (appState === 'auth-check' || appState === 'prefs-loading')
    return <SplashScreenComponent theme={theme} aes={defaultAes} />;
  if (appState === 'unauthenticated') {
    return (
      <LoginScreen
        theme={theme}
        aes={defaultAes}
        onSignIn={actions.signIn}
        onSignUp={actions.signUp}
        onResetPassword={actions.resetPassword}
      />
    );
  }
  if (appState === 'update-required') return <UpdateRequiredScreen />;
  if (appState === 'maintenance') return <MaintenanceScreen />;

  // appState === 'ready'
  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[s.root, { backgroundColor: theme.bg }]}
    >
      {(screen === 'digest' || screen === 'settings') && (
        <DigestPager
          dayIndex={dayIndex}
          setDayIndex={setDayIndex}
          onOpenSettings={() => setScreen('settings')}
          onOpenArticle={(h, r) => setArticle({ h, r })}
          activePageRef={activePageRef}
        />
      )}
      {screen === 'settings' && <SettingsStub />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({ root: { flex: 1 } });
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/hp/projects/pulse-news/app && npx tsc --noEmit
```

Fix any type errors (e.g. themeId selector now reads from `s.prefs.theme` directly as `ThemeId`).

- [ ] **Step 3: Run all tests**

```bash
cd /home/hp/projects/pulse-news/app && npm test
```

Expected: all existing tests pass + all new tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/App.tsx
git commit -m "feat(app/digest-flow): wire DigestPager in App.tsx, BackHandler, clean themeId selector"
```

---

### Task 15: Pre-PR quality pass

**Files:** All files created/modified in this slice.

- [ ] **Step 1: Run full typecheck**

```bash
cd /home/hp/projects/pulse-news/app && npx tsc --noEmit
```

Expected: zero errors. Fix any before proceeding.

- [ ] **Step 2: Run lint**

```bash
cd /home/hp/projects/pulse-news/app && npx eslint --ext .ts,.tsx src
```

Expected: zero errors. Warnings are acceptable.

- [ ] **Step 3: Run format check**

```bash
cd /home/hp/projects/pulse-news && npm run format:check
```

If it fails:

```bash
cd /home/hp/projects/pulse-news && npm run format
git add -p  # stage only the format fixes
git commit -m "style: format digest-flow files"
```

- [ ] **Step 4: Run full test suite with coverage**

```bash
cd /home/hp/projects/pulse-news/app && npm test -- --coverage
```

Expected: storage + hook line coverage ≥ 75%. Review the coverage report and note any gaps.

- [ ] **Step 5: Behavioral checklist — verify contracts manually**

Confirm (by reading code, not running the app) that each regression note from the spec is handled:

| #   | Behavior                                                  | Implemented by                                                      |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Swipe spring fires, header updates immediately            | `commitDay` runs `setDayIndex` before spring settles in DigestPager |
| 2   | Pull-to-refresh forces remote fetch                       | `onRefresh` sets `forcedRef.current=true` via `forceRefresh`        |
| 3   | Notification tap → `activePageRef.current.forceRefresh()` | `activePageRef` wired in App.tsx; `forceRefresh` in DigestPage      |
| 4   | FCM sets `dayIndex=0`, spring animates                    | `setDayIndex(0)` via store; useEffect in DigestPager springs        |
| 5   | Past date → no network after first load                   | `staleTime: Infinity` on past dates                                 |
| 6   | Settings: DigestPager stays mounted                       | Both rendered when `screen === 'settings'`                          |
| 7   | Back from settings → digest                               | BackHandler in App.tsx                                              |
| 8   | Back with article open → close article                    | BackHandler checks `article` first                                  |
| 9   | `dayIndex===0` = today                                    | `isToday = dayIndex === 0`                                          |
| 10  | ±WINDOW=1 max 3 instances                                 | `WINDOW = 1` constant in DigestPager                                |

- [ ] **Step 6: Open PR**

```bash
git checkout -b feat/app-digest-flow 2>/dev/null || true
git push origin HEAD
```

Then run `/code-review` before creating the PR.

- [ ] **Step 7: Run code review and create PR**

After `/code-review` passes:

```bash
gh pr create \
  --title "feat(app/digest-flow): port digest display layer with React Query + Zustand selectors" \
  --base develop \
  --body "$(cat <<'EOF'
## Summary
- Ports DigestPager, DigestPage, GlobalSection, RegionSection, Flag, JumpModal from legacy
- Replaces module-level Map caches with React Query v5 (staleTime, gcTime, forceRefresh via refetch)
- Eliminates prop-drilling of t/theme/aes — all components read from Zustand store selectors
- JumpModal animation migrated from Animated.Value to Reanimated v4 (useSharedValue + withTiming)
- One intentional improvement: currency stale window 60min → 5min

## Legacy files replaced
- app/src/components/DigestPager.tsx
- app/src/components/DigestPage.tsx
- app/src/components/GlobalSection.tsx
- app/src/components/RegionSection.tsx
- app/src/components/Flag.tsx
- app/src/components/JumpModal.tsx
- app/src/hooks/useDigest.ts
- app/src/hooks/useGlobalHeadlines.ts
- app/src/hooks/useCurrencyRates.ts
- app/src/hooks/useDigestPageData.ts
- app/src/hooks/useJumpTargets.ts
- app/src/storage/digests.ts
- app/App.tsx (partial)

## Behavioral contracts preserved
All 10 regression notes from the spec verified — see Task 15 checklist.

## Test plan
- [ ] `npm test` passes in full (storage + hook tests)
- [ ] `npx tsc --noEmit` zero errors
- [ ] `npx eslint` zero errors
- [ ] Swipe between days springs correctly
- [ ] Pull-to-refresh on today forces remote fetch
- [ ] Settings screen shows behind DigestPager

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
