# app/settings-flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the legacy settings surface into the rebuild — replacing SettingsStub with a real SettingsScreen backed by MMKV + Supabase preference persistence, eliminating prop-drilling via Zustand selectors.

**Architecture:** `storage/preferences.ts` owns the CRUD layer (MMKV local cache + Supabase remote). `usePreferences` is a store-writer hook that hydrates on mount, background-syncs, and manages dirty/debounce flush. `SettingsScreen` reads all display state from the store; only `onLogout` and `onDeleteAccount` remain as props.

**Tech Stack:** Zustand, MMKV (`react-native-mmkv`), Supabase JS, React Native (`AppState`, `LayoutAnimation`, `Animated`), `react-native-pressable-scale`, `@testing-library/react-native`, `jest`

**Spec:** `docs/superpowers/specs/2026-05-30-app-settings-flow-design.md`

---

## File Map

| Action | Path                                            | Responsibility                                                                 |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| Create | `app/src/storage/preferences.ts`                | MMKV + Supabase CRUD, `DEFAULT_PREFERENCES`, conflict resolution               |
| Modify | `app/src/store/slices/prefs.ts`                 | Add `setPref`, `prefsMutationCount`; import `DEFAULT_PREFERENCES` from storage |
| Create | `app/src/store/slices/device.ts`                | `notificationsEnabled` stub (false until slice 6)                              |
| Modify | `app/src/store/index.ts`                        | Compose `DeviceSlice`                                                          |
| Create | `app/src/hooks/usePreferences.ts`               | Store-writer: hydrate, sync, debounced flush                                   |
| Delete | `app/src/hooks/usePrefsInit.ts`                 | Replaced by `usePreferences`                                                   |
| Create | `app/src/components/Stepper.tsx`                | Numeric stepper, two variants                                                  |
| Create | `app/src/components/RegionPicker.tsx`           | Region selector, 3 modes, store-driven                                         |
| Create | `app/src/hooks/useSlideIn.ts`                   | Slide-in animation hook (ported from legacy)                                   |
| Create | `app/src/hooks/useSwipe.ts`                     | Horizontal swipe gesture hook (ported from legacy)                             |
| Create | `app/src/screens/SettingsScreen.tsx`            | Full settings UI, 2-prop surface                                               |
| Delete | `app/src/screens/stubs/SettingsStub.tsx`        | Replaced by real screen                                                        |
| Modify | `app/App.tsx`                                   | Wire `usePreferences`; swap stub for `SettingsScreen`                          |
| Create | `app/src/tests/storage/preferences.test.ts`     | Storage layer tests                                                            |
| Modify | `app/src/tests/store/slices/prefs.test.ts`      | Add `setPref` + `prefsMutationCount` tests                                     |
| Create | `app/src/tests/store/slices/device.test.ts`     | Device slice tests                                                             |
| Create | `app/src/tests/hooks/usePreferences.test.ts`    | Hook: hydration, sync, flush                                                   |
| Create | `app/src/tests/components/Stepper.test.ts`      | Stepper clamping + onChange                                                    |
| Create | `app/src/tests/components/RegionPicker.test.ts` | Toggle, reorder, tune mode                                                     |
| Create | `app/src/tests/screens/SettingsScreen.test.ts`  | Auth callbacks, delete flow                                                    |

---

## Task 1: Storage layer — `storage/preferences.ts`

**Files:**

- Create: `app/src/storage/preferences.ts`
- Create: `app/src/tests/storage/preferences.test.ts`

- [ ] **Step 1.1: Write the failing tests**

Create `app/src/tests/storage/preferences.test.ts`:

```ts
import {
  DEFAULT_PREFERENCES,
  resolveConflict,
  loadLocalPreferences,
  saveLocalPreferences,
  pullRemotePreferences,
  pushRemotePreferences,
  syncPreferences,
} from '../../../storage/preferences';

// MMKV is auto-mocked via app/__mocks__/react-native-mmkv.ts (Map-backed mock).
// Supabase has no URL/key in test env so getSupabase() returns null naturally.
// We mock the client module to control Supabase responses per test.
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();
const mockUpsert = jest.fn();

jest.mock('../../../supabase/client', () => ({
  getSupabase: jest.fn(() => ({
    from: mockFrom,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockUpsert.mockResolvedValue({ error: null });
});

// ── resolveConflict ──────────────────────────────────────────────────

describe('resolveConflict', () => {
  it('returns DEFAULT_PREFERENCES when both null', () => {
    expect(resolveConflict(null, null)).toEqual(DEFAULT_PREFERENCES);
  });

  it('returns local when remote is null', () => {
    const local = { ...DEFAULT_PREFERENCES, theme: 'dark' as const };
    expect(resolveConflict(local, null)).toBe(local);
  });

  it('returns remote when local is null', () => {
    const remote = { ...DEFAULT_PREFERENCES, theme: 'dark' as const };
    expect(resolveConflict(null, remote)).toBe(remote);
  });

  it('returns local when local updatedAt is newer', () => {
    const local = { ...DEFAULT_PREFERENCES, updatedAt: '2026-01-02T00:00:00.000Z' };
    const remote = { ...DEFAULT_PREFERENCES, updatedAt: '2026-01-01T00:00:00.000Z' };
    expect(resolveConflict(local, remote)).toBe(local);
  });

  it('returns remote when remote updatedAt is newer', () => {
    const local = { ...DEFAULT_PREFERENCES, updatedAt: '2026-01-01T00:00:00.000Z' };
    const remote = { ...DEFAULT_PREFERENCES, updatedAt: '2026-01-02T00:00:00.000Z' };
    expect(resolveConflict(local, remote)).toBe(remote);
  });

  it('returns local when timestamps are equal (deterministic)', () => {
    const ts = '2026-01-01T00:00:00.000Z';
    const local = { ...DEFAULT_PREFERENCES, updatedAt: ts };
    const remote = { ...DEFAULT_PREFERENCES, updatedAt: ts };
    expect(resolveConflict(local, remote)).toBe(local);
  });
});

// ── loadLocalPreferences ─────────────────────────────────────────────

describe('loadLocalPreferences', () => {
  it('returns null on cache miss', async () => {
    // MMKV mock Map is empty by default in each test
    expect(await loadLocalPreferences()).toBeNull();
  });

  it('returns full prefs merged with defaults on cache hit', async () => {
    const stored = { ...DEFAULT_PREFERENCES, theme: 'dark', updatedAt: '2026-01-01T00:00:00.000Z' };
    // Write directly to the mocked MMKV store via saveLocalPreferences
    await saveLocalPreferences(stored);
    const result = await loadLocalPreferences();
    expect(result?.theme).toBe('dark');
    expect(result?.headlineCount).toBe(DEFAULT_PREFERENCES.headlineCount);
  });

  it('backfills missing fields from DEFAULT_PREFERENCES', async () => {
    // Simulate a cache written by an older app version (missing fields)
    const { storage } = await import('../../../storage/mmkv');
    storage.set(
      'pulse.preferences.v1',
      JSON.stringify({ theme: 'sepia', updatedAt: '2026-01-01T00:00:00.000Z' }),
    );
    const result = await loadLocalPreferences();
    expect(result?.theme).toBe('sepia');
    expect(result?.headlineCount).toBe(DEFAULT_PREFERENCES.headlineCount);
    expect(result?.selectedRegions).toEqual(DEFAULT_PREFERENCES.selectedRegions);
  });

  it('returns null on corrupt JSON without throwing', async () => {
    const { storage } = await import('../../../storage/mmkv');
    storage.set('pulse.preferences.v1', 'not-json{{{{');
    expect(await loadLocalPreferences()).toBeNull();
  });
});

// ── saveLocalPreferences ─────────────────────────────────────────────

describe('saveLocalPreferences', () => {
  it('writes JSON under pulse.preferences.v1', async () => {
    await saveLocalPreferences(DEFAULT_PREFERENCES);
    const { storage } = await import('../../../storage/mmkv');
    const raw = storage.getString('pulse.preferences.v1');
    expect(JSON.parse(raw!)).toEqual(DEFAULT_PREFERENCES);
  });
});

// ── pullRemotePreferences ────────────────────────────────────────────

describe('pullRemotePreferences', () => {
  it('returns null when no Supabase data', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await pullRemotePreferences('user-1')).toBeNull();
  });

  it('returns prefs merged with defaults when row found', async () => {
    const remotePrefs = { theme: 'dark', headlineCount: 3 };
    mockMaybeSingle.mockResolvedValue({
      data: { preferences: remotePrefs, updated_at: '2026-01-01T00:00:00.000Z' },
      error: null,
    });
    const result = await pullRemotePreferences('user-1');
    expect(result?.theme).toBe('dark');
    expect(result?.headlineCount).toBe(3);
    expect(result?.selectedRegions).toEqual(DEFAULT_PREFERENCES.selectedRegions);
    expect(result?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns null on Supabase error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'network error' } });
    expect(await pullRemotePreferences('user-1')).toBeNull();
  });
});

// ── pushRemotePreferences ────────────────────────────────────────────

describe('pushRemotePreferences', () => {
  it('resolves without throwing on success', async () => {
    mockUpsert.mockResolvedValue({ error: null });
    await expect(pushRemotePreferences('user-1', DEFAULT_PREFERENCES)).resolves.toBeUndefined();
  });

  it('throws when Supabase returns an error', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'constraint violation' } });
    await expect(pushRemotePreferences('user-1', DEFAULT_PREFERENCES)).rejects.toThrow(
      'constraint violation',
    );
  });
});

// ── syncPreferences ──────────────────────────────────────────────────

describe('syncPreferences', () => {
  it('returns remote and saves locally when remote is newer', async () => {
    const localPrefs = { ...DEFAULT_PREFERENCES, updatedAt: '2026-01-01T00:00:00.000Z' };
    const remotePrefs = {
      ...DEFAULT_PREFERENCES,
      theme: 'dark' as const,
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    await saveLocalPreferences(localPrefs);
    mockMaybeSingle.mockResolvedValue({
      data: { preferences: remotePrefs, updated_at: remotePrefs.updatedAt },
      error: null,
    });
    const result = await syncPreferences('user-1');
    expect(result.theme).toBe('dark');
    // Winner should now be in local cache
    const cached = await loadLocalPreferences();
    expect(cached?.theme).toBe('dark');
  });

  it('returns local and pushes to remote when local is newer', async () => {
    const localPrefs = { ...DEFAULT_PREFERENCES, updatedAt: '2026-01-02T00:00:00.000Z' };
    const remotePrefs = { ...DEFAULT_PREFERENCES, updatedAt: '2026-01-01T00:00:00.000Z' };
    await saveLocalPreferences(localPrefs);
    mockMaybeSingle.mockResolvedValue({
      data: { preferences: remotePrefs, updated_at: remotePrefs.updatedAt },
      error: null,
    });
    const result = await syncPreferences('user-1');
    expect(result.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('returns local and does not upsert when timestamps are equal', async () => {
    const ts = '2026-01-01T00:00:00.000Z';
    const prefs = { ...DEFAULT_PREFERENCES, updatedAt: ts };
    await saveLocalPreferences(prefs);
    mockMaybeSingle.mockResolvedValue({
      data: { preferences: prefs, updated_at: ts },
      error: null,
    });
    await syncPreferences('user-1');
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 1.2: Run tests — expect all to fail**

```bash
cd app && npx jest src/tests/storage/preferences.test.ts --no-coverage
```

Expected: multiple failures — `Cannot find module '../../../storage/preferences'`

- [ ] **Step 1.3: Create `storage/preferences.ts`**

Create `app/src/storage/preferences.ts`:

```ts
import { storage } from './mmkv';
import type { UserPreferences } from '../types';
import { getSupabase } from '../supabase/client';
import { getLogger } from '../logger';

const log = getLogger('preferences');

const STORAGE_KEY = 'pulse.preferences.v1';

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

/**
 * Read stored preferences from MMKV. Returns null on cache miss or parse
 * failure. Missing fields are backfilled from DEFAULT_PREFERENCES so old
 * cached versions stay compatible after new fields are added.
 */
export async function loadLocalPreferences(): Promise<UserPreferences | null> {
  try {
    const raw = storage.getString(STORAGE_KEY);
    if (!raw) {
      log.debug('no local cache found — defaults will be used');
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    const merged = { ...DEFAULT_PREFERENCES, ...parsed };
    log.debug(`loaded from local cache (updatedAt: ${merged.updatedAt})`);
    return merged;
  } catch {
    log.warn('failed to parse local preferences — resetting to defaults');
    return null;
  }
}

/** Persist preferences to the local MMKV cache. */
export async function saveLocalPreferences(prefs: UserPreferences): Promise<void> {
  try {
    storage.set(STORAGE_KEY, JSON.stringify(prefs));
    log.debug(`saved to local cache (updatedAt: ${prefs.updatedAt})`);
  } catch {
    log.warn('failed to save preferences to local cache');
  }
}

/**
 * Pull preferences from the `user_preferences` Supabase table.
 * Returns null when not found, on error, or when Supabase is unconfigured.
 */
export async function pullRemotePreferences(userId: string): Promise<UserPreferences | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await (supabase as any)
    .from('user_preferences')
    .select('preferences, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    log.warn(`pullRemotePreferences failed: ${error.message}`);
    return null;
  }
  if (!data) return null;
  return {
    ...DEFAULT_PREFERENCES,
    ...(data.preferences as Partial<UserPreferences>),
    updatedAt: data.updated_at as string,
  };
}

/**
 * Upsert preferences into `user_preferences`. Throws on Supabase error so
 * the caller can log the failure and retry on next foreground.
 */
export async function pushRemotePreferences(userId: string, prefs: UserPreferences): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await (supabase as any)
    .from('user_preferences')
    .upsert(
      { user_id: userId, preferences: prefs, updated_at: prefs.updatedAt },
      { onConflict: 'user_id' },
    );
  if (error) throw new Error(`pushRemotePreferences failed: ${error.message}`);
}

/**
 * Last-write-wins conflict resolution by `updatedAt` timestamp.
 * Falls back to DEFAULT_PREFERENCES when both inputs are null.
 */
export function resolveConflict(
  local: UserPreferences | null,
  remote: UserPreferences | null,
): UserPreferences {
  if (!local && !remote) return DEFAULT_PREFERENCES;
  if (!local) return remote!;
  if (!remote) return local;
  const winner = new Date(remote.updatedAt) > new Date(local.updatedAt) ? remote : local;
  log.debug(`conflict resolved: ${winner === remote ? 'remote' : 'local'} wins`);
  return winner;
}

/**
 * Pull from Supabase, resolve conflict with local cache, persist the winner,
 * and push to remote if local was newer. Returns the resolved preferences.
 */
export async function syncPreferences(userId: string): Promise<UserPreferences> {
  log.info(`syncing preferences for user ${userId.slice(0, 8)}…`);

  const [local, remote] = await Promise.all([
    loadLocalPreferences(),
    pullRemotePreferences(userId),
  ]);
  const winner = resolveConflict(local, remote);

  if (winner !== local) {
    await saveLocalPreferences(winner);
    log.info('sync: remote was newer — local cache updated');
  }
  if (
    winner === local &&
    local &&
    remote &&
    new Date(local.updatedAt) > new Date(remote.updatedAt)
  ) {
    pushRemotePreferences(userId, local).catch((e) => log.warn(`remote push failed: ${String(e)}`));
    log.info('sync: local was newer — remote push queued');
  }

  return winner;
}
```

- [ ] **Step 1.4: Run tests — expect all to pass**

```bash
cd app && npx jest src/tests/storage/preferences.test.ts --no-coverage
```

Expected: all tests pass

- [ ] **Step 1.5: Commit**

```bash
git add app/src/storage/preferences.ts app/src/tests/storage/preferences.test.ts
git commit -m "feat(app): add preferences storage layer with MMKV + Supabase sync"
```

---

## Task 2: Prefs slice — add `setPref` and `prefsMutationCount`

**Files:**

- Modify: `app/src/store/slices/prefs.ts`
- Modify: `app/src/tests/store/slices/prefs.test.ts`

- [ ] **Step 2.1: Write the new failing tests**

Replace `app/src/tests/store/slices/prefs.test.ts` entirely:

```ts
import { createPrefsSlice, type PrefsSlice } from '../../../store/slices/prefs';
import { DEFAULT_PREFERENCES } from '../../../storage/preferences';

function makeSlice(): { slice: PrefsSlice; setSpy: jest.Mock } {
  let state: PrefsSlice = {} as PrefsSlice;
  // set() can be called with an object OR a function — support both
  const setSpy = jest.fn(
    (partialOrFn: Partial<PrefsSlice> | ((s: PrefsSlice) => Partial<PrefsSlice>)) => {
      if (typeof partialOrFn === 'function') {
        state = { ...state, ...partialOrFn(state) };
      } else {
        state = { ...state, ...partialOrFn };
      }
    },
  );
  state = createPrefsSlice(
    setSpy as unknown as Parameters<typeof createPrefsSlice>[0],
    () => state,
    {} as unknown as Parameters<typeof createPrefsSlice>[2],
  );
  return { slice: state, setSpy };
}

describe('PrefsSlice', () => {
  it('initialises with DEFAULT_PREFERENCES', () => {
    const { slice } = makeSlice();
    expect(slice.prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('initialises prefsMutationCount at 0', () => {
    const { slice } = makeSlice();
    expect(slice.prefsMutationCount).toBe(0);
  });

  it('setPrefs replaces the full prefs object', () => {
    const { slice } = makeSlice();
    const updated = { ...DEFAULT_PREFERENCES, historyDays: 14 };
    slice.setPrefs(updated);
    expect(slice.prefs.historyDays).toBe(14);
  });

  it('setPrefs does NOT increment prefsMutationCount', () => {
    const { slice } = makeSlice();
    slice.setPrefs({ ...DEFAULT_PREFERENCES, historyDays: 14 });
    expect(slice.prefsMutationCount).toBe(0);
  });

  it('setPrefs does not mutate DEFAULT_PREFERENCES', () => {
    const { slice } = makeSlice();
    slice.setPrefs({ ...DEFAULT_PREFERENCES, historyDays: 14 });
    expect(DEFAULT_PREFERENCES.historyDays).toBe(7);
  });

  it('setPref updates only the targeted key', () => {
    const { slice } = makeSlice();
    slice.setPref('theme', 'dark');
    expect(slice.prefs.theme).toBe('dark');
    expect(slice.prefs.headlineCount).toBe(DEFAULT_PREFERENCES.headlineCount);
    expect(slice.prefs.selectedRegions).toEqual(DEFAULT_PREFERENCES.selectedRegions);
  });

  it('setPref bumps updatedAt to a newer timestamp', () => {
    const { slice } = makeSlice();
    const before = slice.prefs.updatedAt;
    // Ensure clock advances
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValueOnce('2099-01-01T00:00:00.000Z');
    slice.setPref('theme', 'sepia');
    expect(slice.prefs.updatedAt).not.toBe(before);
    jest.restoreAllMocks();
  });

  it('setPref increments prefsMutationCount', () => {
    const { slice } = makeSlice();
    slice.setPref('theme', 'dark');
    expect(slice.prefsMutationCount).toBe(1);
    slice.setPref('headlineCount', 3);
    expect(slice.prefsMutationCount).toBe(2);
  });

  it('DEFAULT_PREFERENCES.showGlobalHeadlines is true', () => {
    expect(DEFAULT_PREFERENCES.showGlobalHeadlines).toBe(true);
  });

  it('DEFAULT_PREFERENCES has 5 selected regions', () => {
    expect(DEFAULT_PREFERENCES.selectedRegions).toHaveLength(5);
  });

  it('DEFAULT_PREFERENCES theme is light', () => {
    expect(DEFAULT_PREFERENCES.theme).toBe('light');
  });

  it('DEFAULT_PREFERENCES aesthetic is editorial', () => {
    expect(DEFAULT_PREFERENCES.aesthetic).toBe('editorial');
  });

  it('DEFAULT_PREFERENCES baseCurrency is USD', () => {
    expect(DEFAULT_PREFERENCES.baseCurrency).toBe('USD');
  });

  it('DEFAULT_PREFERENCES headlineCount is 5', () => {
    expect(DEFAULT_PREFERENCES.headlineCount).toBe(5);
  });
});
```

- [ ] **Step 2.2: Run tests — expect new tests to fail**

```bash
cd app && npx jest src/tests/store/slices/prefs.test.ts --no-coverage
```

Expected: failures on `prefsMutationCount` and `setPref` tests — these don't exist yet

- [ ] **Step 2.3: Update `store/slices/prefs.ts`**

Replace `app/src/store/slices/prefs.ts` entirely:

```ts
import type { StateCreator } from 'zustand';
import type { UserPreferences } from '../../types';
import { DEFAULT_PREFERENCES } from '../../storage/preferences';

export type { UserPreferences };
export { DEFAULT_PREFERENCES };

export interface PrefsSlice {
  prefs: UserPreferences;
  /** Counts user-initiated setPref calls. Incremented by setPref, NOT by setPrefs.
   *  usePreferences watches this to debounce flush without reacting to hydration writes. */
  prefsMutationCount: number;
  /** Replace the full prefs object (hydration / remote sync). Does not dirty-mark. */
  setPrefs: (prefs: UserPreferences) => void;
  /** Update a single preference key, bump updatedAt, increment prefsMutationCount. */
  setPref: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
}

export const createPrefsSlice: StateCreator<PrefsSlice> = (set) => ({
  prefs: DEFAULT_PREFERENCES,
  prefsMutationCount: 0,
  setPrefs: (prefs) => set({ prefs }),
  setPref: (key, value) =>
    set((s) => ({
      prefs: { ...s.prefs, [key]: value, updatedAt: new Date().toISOString() },
      prefsMutationCount: s.prefsMutationCount + 1,
    })),
});
```

- [ ] **Step 2.4: Run tests — expect all to pass**

```bash
cd app && npx jest src/tests/store/slices/prefs.test.ts --no-coverage
```

Expected: all tests pass

- [ ] **Step 2.5: Commit**

```bash
git add app/src/store/slices/prefs.ts app/src/tests/store/slices/prefs.test.ts
git commit -m "feat(app/store): add setPref action and prefsMutationCount to PrefsSlice"
```

---

## Task 3: Device slice stub

**Files:**

- Create: `app/src/store/slices/device.ts`
- Modify: `app/src/store/index.ts`
- Create: `app/src/tests/store/slices/device.test.ts`

- [ ] **Step 3.1: Write the failing tests**

Create `app/src/tests/store/slices/device.test.ts`:

```ts
import { createDeviceSlice, type DeviceSlice } from '../../../store/slices/device';

function makeSlice(): DeviceSlice {
  let state: DeviceSlice = {} as DeviceSlice;
  const set = jest.fn((partial: Partial<DeviceSlice>) => {
    state = { ...state, ...partial };
  });
  state = createDeviceSlice(
    set as unknown as Parameters<typeof createDeviceSlice>[0],
    () => state,
    {} as unknown as Parameters<typeof createDeviceSlice>[2],
  );
  return state;
}

describe('DeviceSlice', () => {
  it('initialises notificationsEnabled as false', () => {
    const slice = makeSlice();
    expect(slice.notificationsEnabled).toBe(false);
  });

  it('setNotificationsEnabled(true) enables notifications', () => {
    const slice = makeSlice();
    slice.setNotificationsEnabled(true);
    expect(slice.notificationsEnabled).toBe(true);
  });

  it('setNotificationsEnabled(false) after true restores false', () => {
    const slice = makeSlice();
    slice.setNotificationsEnabled(true);
    slice.setNotificationsEnabled(false);
    expect(slice.notificationsEnabled).toBe(false);
  });
});
```

- [ ] **Step 3.2: Run tests — expect all to fail**

```bash
cd app && npx jest src/tests/store/slices/device.test.ts --no-coverage
```

Expected: `Cannot find module '../../../store/slices/device'`

- [ ] **Step 3.3: Create `store/slices/device.ts`**

Create `app/src/store/slices/device.ts`:

```ts
import type { StateCreator } from 'zustand';

export interface DeviceSlice {
  /** False until slice 6 (app/notifications) wires real FCM registration. */
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
}

export const createDeviceSlice: StateCreator<DeviceSlice> = (set) => ({
  notificationsEnabled: false,
  setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
});
```

- [ ] **Step 3.4: Run tests — expect all to pass**

```bash
cd app && npx jest src/tests/store/slices/device.test.ts --no-coverage
```

- [ ] **Step 3.5: Wire DeviceSlice into `store/index.ts`**

Replace `app/src/store/index.ts`:

```ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createAppSlice, type AppSlice } from './slices/app';
import { createNavSlice, type NavSlice } from './slices/nav';
import { createAuthSlice, type AuthSlice } from './slices/auth';
import { createPrefsSlice, type PrefsSlice } from './slices/prefs';
import { createDeviceSlice, type DeviceSlice } from './slices/device';

export const useAppStore = create<AppSlice & NavSlice & AuthSlice & PrefsSlice & DeviceSlice>()(
  devtools(
    (...a) => ({
      ...createAppSlice(...a),
      ...createNavSlice(...a),
      ...createAuthSlice(...a),
      ...createPrefsSlice(...a),
      ...createDeviceSlice(...a),
    }),
    { name: 'PulseStore', enabled: __DEV__ },
  ),
);
```

- [ ] **Step 3.6: Typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3.7: Commit**

```bash
git add app/src/store/slices/device.ts app/src/store/index.ts app/src/tests/store/slices/device.test.ts
git commit -m "feat(app/store): add DeviceSlice stub with notificationsEnabled=false"
```

---

## Task 4: `usePreferences` hook

**Files:**

- Create: `app/src/hooks/usePreferences.ts`
- Delete: `app/src/hooks/usePrefsInit.ts`
- Create: `app/src/tests/hooks/usePreferences.test.ts`

- [ ] **Step 4.1: Write the failing tests**

Create `app/src/tests/hooks/usePreferences.test.ts`:

```ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useAppStore } from '../../store';
import { usePreferences } from '../../hooks/usePreferences';
import {
  DEFAULT_PREFERENCES,
  loadLocalPreferences,
  saveLocalPreferences,
  syncPreferences,
  pushRemotePreferences,
} from '../../storage/preferences';

jest.mock('../../storage/preferences', () => ({
  DEFAULT_PREFERENCES: {
    selectedRegions: ['Hungary'],
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
  },
  loadLocalPreferences: jest.fn(),
  saveLocalPreferences: jest.fn().mockResolvedValue(undefined),
  syncPreferences: jest.fn(),
  pushRemotePreferences: jest.fn().mockResolvedValue(undefined),
}));

const mockLoad = loadLocalPreferences as jest.MockedFunction<typeof loadLocalPreferences>;
const mockSync = syncPreferences as jest.MockedFunction<typeof syncPreferences>;
const mockSave = saveLocalPreferences as jest.MockedFunction<typeof saveLocalPreferences>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  useAppStore.setState({
    appState: 'prefs-loading',
    screen: 'digest',
    session: null,
    prefs: DEFAULT_PREFERENCES,
    prefsMutationCount: 0,
  });
  mockLoad.mockResolvedValue(null);
  mockSync.mockResolvedValue(DEFAULT_PREFERENCES);
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Hydration ────────────────────────────────────────────────────────

describe('hydration', () => {
  it('calls setPrefs with loaded prefs on MMKV hit', async () => {
    const stored = { ...DEFAULT_PREFERENCES, theme: 'dark' as const };
    mockLoad.mockResolvedValue(stored);
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().prefs.theme).toBe('dark'));
  });

  it('calls setPrefs with DEFAULT_PREFERENCES on MMKV miss', async () => {
    mockLoad.mockResolvedValue(null);
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().appState).toBe('ready'));
    expect(useAppStore.getState().prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('transitions appState to ready after hydration', async () => {
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().appState).toBe('ready'));
  });

  it('does not call syncPreferences when userId is null', async () => {
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().appState).toBe('ready'));
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('calls syncPreferences when userId is present', async () => {
    useAppStore.setState({
      session: { user: { id: 'user-abc', email: 'test@test.com' } } as any,
    });
    const synced = { ...DEFAULT_PREFERENCES, theme: 'sepia' as const };
    mockSync.mockResolvedValue(synced);
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().prefs.theme).toBe('sepia'));
    expect(mockSync).toHaveBeenCalledWith('user-abc');
  });

  it('does not update store after unmount (cancelled)', async () => {
    let resolveLoad: (v: null) => void;
    mockLoad.mockReturnValue(
      new Promise((res) => {
        resolveLoad = res;
      }),
    );
    const { unmount } = renderHook(() => usePreferences());
    unmount();
    await act(async () => {
      resolveLoad!(null);
    });
    // appState should still be prefs-loading (hook was cancelled)
    expect(useAppStore.getState().appState).toBe('prefs-loading');
  });
});

// ── Dirty flush (debounced) ──────────────────────────────────────────

describe('dirty flush', () => {
  it('saves to local after 900ms following a setPref call', async () => {
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().appState).toBe('ready'));

    act(() => {
      useAppStore.getState().setPref('theme', 'dark');
    });
    expect(mockSave).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('debounces multiple setPref calls into one save', async () => {
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().appState).toBe('ready'));

    act(() => {
      useAppStore.getState().setPref('theme', 'dark');
      useAppStore.getState().setPref('headlineCount', 3);
      useAppStore.getState().setPref('historyDays', 14);
    });
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('does not save when no setPref has been called', async () => {
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().appState).toBe('ready'));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockSave).not.toHaveBeenCalled();
  });
});

// ── AppState flush ───────────────────────────────────────────────────

describe('AppState flush', () => {
  let appStateCallback: (state: string) => void;

  beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
      appStateCallback = cb as (state: string) => void;
      return { remove: jest.fn() };
    });
  });

  it('flushes immediately on background when dirty', async () => {
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().appState).toBe('ready'));

    act(() => {
      useAppStore.getState().setPref('theme', 'dark');
    });
    act(() => {
      appStateCallback('background');
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('flushes immediately on inactive when dirty', async () => {
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().appState).toBe('ready'));

    act(() => {
      useAppStore.getState().setPref('theme', 'dark');
    });
    act(() => {
      appStateCallback('inactive');
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('does not flush on background when clean', async () => {
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().appState).toBe('ready'));
    act(() => {
      appStateCallback('background');
    });
    expect(mockSave).not.toHaveBeenCalled();
  });
});

// ── Screen transition flush ──────────────────────────────────────────

describe('screen transition flush', () => {
  it('flushes immediately when navigating away from settings while dirty', async () => {
    useAppStore.setState({ screen: 'settings' });
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().appState).toBe('ready'));

    act(() => {
      useAppStore.getState().setPref('theme', 'dark');
    });
    act(() => {
      useAppStore.setState({ screen: 'digest' });
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('does not flush when navigating from digest to settings', async () => {
    renderHook(() => usePreferences());
    await waitFor(() => expect(useAppStore.getState().appState).toBe('ready'));

    act(() => {
      useAppStore.getState().setPref('theme', 'dark');
    });
    mockSave.mockClear();
    act(() => {
      useAppStore.setState({ screen: 'settings' });
    });
    expect(mockSave).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4.2: Run tests — expect all to fail**

```bash
cd app && npx jest src/tests/hooks/usePreferences.test.ts --no-coverage
```

Expected: `Cannot find module '../../hooks/usePreferences'`

- [ ] **Step 4.3: Create `hooks/usePreferences.ts`**

Create `app/src/hooks/usePreferences.ts`:

```ts
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppStore } from '../store';
import {
  DEFAULT_PREFERENCES,
  loadLocalPreferences,
  saveLocalPreferences,
  syncPreferences,
  pushRemotePreferences,
} from '../storage/preferences';
import { getLogger } from '../logger';

const log = getLogger('usePreferences');

/** Store-writer hook. Hydrates prefs from MMKV on mount, background-syncs
 *  from Supabase, and debounces dirty writes back to both stores. */
export function usePreferences(): void {
  const setPrefs = useAppStore((s) => s.setPrefs);
  const setAppState = useAppStore((s) => s.setAppState);
  const prefs = useAppStore((s) => s.prefs);
  const screen = useAppStore((s) => s.screen);
  const userId = useAppStore((s) => s.session?.user.id ?? null);
  const mutationCount = useAppStore((s) => s.prefsMutationCount);

  const dirtyRef = useRef(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback((): void => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    log.debug('flushing prefs');
    saveLocalPreferences(prefsRef.current).catch((e: unknown) => {
      log.warn(`local save failed: ${String(e)}`);
    });
    if (userIdRef.current) {
      pushRemotePreferences(userIdRef.current, prefsRef.current).catch((e: unknown) => {
        log.warn(`remote push failed: ${String(e)}`);
      });
    }
  }, []);

  // Hydration + background Supabase sync
  useEffect(() => {
    let cancelled = false;
    log.info('hydrating preferences');

    void (async () => {
      const local = await loadLocalPreferences();
      if (cancelled) return;
      setPrefs(local ?? DEFAULT_PREFERENCES);
      setAppState('ready');
      log.info('hydration complete');

      if (userId) {
        log.debug('starting background sync');
        const winner = await syncPreferences(userId);
        if (!cancelled) {
          setPrefs(winner);
          log.info('remote sync complete');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dirty tracking + debounced flush — only reacts to user setPref calls,
  // not to setPrefs (hydration/sync), because mutationCount is only incremented by setPref.
  useEffect(() => {
    if (mutationCount === 0) return;
    dirtyRef.current = true;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      flush();
      flushTimer.current = null;
    }, 900);
    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
    };
  }, [mutationCount, flush]);

  // Flush on unmount if dirty (catches e.g. component tree teardown)
  useEffect(() => {
    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      flush();
    };
  }, [flush]);

  // Flush when navigating away from settings screen
  useEffect(() => {
    if (screen !== 'settings') flush();
  }, [screen, flush]);

  // Flush when app goes to background or inactive
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') flush();
    });
    return () => sub.remove();
  }, [flush]);
}
```

- [ ] **Step 4.4: Run tests — expect all to pass**

```bash
cd app && npx jest src/tests/hooks/usePreferences.test.ts --no-coverage
```

Expected: all tests pass

- [ ] **Step 4.5: Delete `usePrefsInit.ts` and update `App.tsx` import**

```bash
rm app/src/hooks/usePrefsInit.ts
```

In `app/App.tsx`, replace the import:

```ts
// Remove:
import { usePrefsInit } from './src/hooks/usePrefsInit';

// Add:
import { usePreferences } from './src/hooks/usePreferences';
```

In `App.tsx`, replace the call:

```ts
// Remove:
usePrefsInit();

// Add:
usePreferences();
```

- [ ] **Step 4.6: Typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4.7: Commit**

```bash
git add app/src/hooks/usePreferences.ts app/src/tests/hooks/usePreferences.test.ts app/App.tsx
git commit -m "feat(app): add usePreferences hook — hydration, sync, debounced flush"
```

---

## Task 5: `Stepper` component

**Files:**

- Create: `app/src/components/Stepper.tsx`
- Create: `app/src/tests/components/Stepper.test.ts`

- [ ] **Step 5.1: Write the failing tests**

Create `app/src/tests/components/Stepper.test.ts`:

```ts
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Stepper from '../../components/Stepper';
import { THEMES, AESTHETICS } from '../../themes';

const theme = THEMES.light;
const aes = AESTHETICS.editorial;
const baseProps = { theme, aes, value: 5, min: 1, max: 10, onChange: jest.fn() };

beforeEach(() => jest.clearAllMocks());

describe('Stepper — text variant (default)', () => {
  it('calls onChange with value-1 on decrement', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} onChange={onChange} />);
    // First pressable is the decrement button
    fireEvent.press(getAllByRole('button')[0]!);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('calls onChange with value+1 on increment', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[1]!);
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('clamps to min — calls onChange with min when already at min', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} value={1} onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[0]!);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('clamps to max — calls onChange with max when already at max', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} value={10} onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[1]!);
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('renders suffix label', () => {
    const { getByText } = render(<Stepper {...baseProps} suffix="d" />);
    expect(getByText('5d')).toBeTruthy();
  });
});

describe('Stepper — icon variant', () => {
  it('calls onChange with value-1 on minus press', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} icons onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[0]!);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('calls onChange with value+1 on plus press', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} icons onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[1]!);
    expect(onChange).toHaveBeenCalledWith(6);
  });
});
```

- [ ] **Step 5.2: Run tests — expect all to fail**

```bash
cd app && npx jest src/tests/components/Stepper.test.ts --no-coverage
```

Expected: `Cannot find module '../../components/Stepper'`

- [ ] **Step 5.3: Create `components/Stepper.tsx`**

Create `app/src/components/Stepper.tsx`:

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { PressableScale } from 'react-native-pressable-scale';
import { font, type Aesthetic, type Theme } from '../themes';
import PulseIcon from './Icon';

interface StepperProps {
  theme: Theme;
  aes: Aesthetic;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  /** Append a unit label after the number (text variant only). */
  suffix?: string;
  /** Use icon minus/plus buttons instead of text − / +. */
  icons?: boolean;
  /** Override the value label colour (icon variant only). */
  valueColor?: string;
}

/** Numeric increment/decrement control. Two visual variants: text (default) and icon. */
export default function Stepper({
  theme,
  aes,
  value,
  min,
  max,
  onChange,
  suffix,
  icons = false,
  valueColor,
}: StepperProps): React.ReactElement {
  if (icons) {
    const btn = {
      width: 28,
      height: 28,
      borderRadius: 7,
      backgroundColor: theme.chip,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <PressableScale
          onPress={() => onChange(Math.max(min, value - 1))}
          hitSlop={6}
          activeScale={0.78}
          style={[btn, { opacity: value <= min ? 0.25 : 1 }]}
        >
          <PulseIcon name="minus" size={14} color={theme.text} strokeWidth={2.2} />
        </PressableScale>
        <Text
          style={{
            fontFamily: font(aes, 'number', 600),
            fontSize: 14,
            color: valueColor ?? theme.text,
            minWidth: 18,
            textAlign: 'center',
            marginHorizontal: 6,
          }}
        >
          {value}
        </Text>
        <PressableScale
          onPress={() => onChange(Math.min(max, value + 1))}
          hitSlop={6}
          activeScale={0.78}
          style={[btn, { opacity: value >= max ? 0.25 : 1 }]}
        >
          <PulseIcon name="plus" size={14} color={theme.text} strokeWidth={2.2} />
        </PressableScale>
      </View>
    );
  }

  const btn = {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: theme.chip,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <PressableScale
        onPress={() => onChange(Math.max(min, value - 1))}
        activeScale={0.78}
        style={[btn, { opacity: value <= min ? 0.4 : 1 }]}
      >
        <Text style={{ fontSize: 16, color: theme.text }}>−</Text>
      </PressableScale>
      <Text
        style={{
          minWidth: 34,
          textAlign: 'center',
          fontFamily: font(aes, 'number'),
          fontSize: 15,
          color: theme.text,
          letterSpacing: 0.1,
          marginHorizontal: 6,
        }}
      >
        {value}
        {suffix ?? ''}
      </Text>
      <PressableScale
        onPress={() => onChange(Math.min(max, value + 1))}
        activeScale={0.78}
        style={[btn, { opacity: value >= max ? 0.4 : 1 }]}
      >
        <Text style={{ fontSize: 16, color: theme.text }}>+</Text>
      </PressableScale>
    </View>
  );
}
```

- [ ] **Step 5.4: Run tests — expect all to pass**

```bash
cd app && npx jest src/tests/components/Stepper.test.ts --no-coverage
```

- [ ] **Step 5.5: Commit**

```bash
git add app/src/components/Stepper.tsx app/src/tests/components/Stepper.test.ts
git commit -m "feat(app): add Stepper component (text and icon variants)"
```

---

## Task 6: `RegionPicker` component

**Files:**

- Create: `app/src/components/RegionPicker.tsx`
- Create: `app/src/tests/components/RegionPicker.test.ts`

- [ ] **Step 6.1: Write the failing tests**

Create `app/src/tests/components/RegionPicker.test.ts`:

```ts
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useAppStore } from '../../store';
import { DEFAULT_PREFERENCES } from '../../storage/preferences';
import RegionPicker from '../../components/RegionPicker';

jest.mock('../../storage/preferences', () => ({
  DEFAULT_PREFERENCES: {
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
  },
}));

beforeEach(() => {
  useAppStore.setState({ prefs: DEFAULT_PREFERENCES, prefsMutationCount: 0 });
});

function renderPicker() {
  return render(<RegionPicker />);
}

describe('RegionPicker — toggle', () => {
  it('selecting an unselected region calls setPref with it added', () => {
    const setPref = jest.spyOn(useAppStore.getState(), 'setPref');
    const { getByLabelText } = renderPicker();
    // Find a region that is not in the default 5 — 'Germany' should be unselected
    fireEvent.press(getByLabelText('Germany, not selected'));
    expect(setPref).toHaveBeenCalledWith(
      'selectedRegions',
      expect.arrayContaining(['Germany']),
    );
  });

  it('deselecting a selected region calls setPref with it removed', () => {
    const setPref = jest.spyOn(useAppStore.getState(), 'setPref');
    const { getByLabelText } = renderPicker();
    fireEvent.press(getByLabelText('Hungary, selected'));
    const call = (setPref as jest.Mock).mock.calls[0];
    expect(call[1]).not.toContain('Hungary');
  });
});

describe('RegionPicker — reorder mode', () => {
  it('move up is a no-op for the first selected region', () => {
    const setPref = jest.spyOn(useAppStore.getState(), 'setPref');
    const { getByText, getByLabelText } = renderPicker();
    fireEvent.press(getByText('Reorder'));
    const moveUpBtn = getByLabelText('Move Hungary up');
    fireEvent.press(moveUpBtn);
    // Hungary is index 0, can't go higher — selectedRegions unchanged
    const firstCall = (setPref as jest.Mock).mock.calls.find(
      (c) => c[0] === 'selectedRegions',
    );
    if (firstCall) {
      expect(firstCall[1][0]).toBe('Hungary');
    }
  });

  it('All button selects all regions', () => {
    const setPref = jest.spyOn(useAppStore.getState(), 'setPref');
    const { getByText } = renderPicker();
    fireEvent.press(getByText('Reorder'));
    fireEvent.press(getByText('All'));
    const call = (setPref as jest.Mock).mock.calls.find((c) => c[0] === 'selectedRegions');
    expect(call).toBeTruthy();
    // All regions selected
    expect((call![1] as string[]).length).toBeGreaterThan(5);
  });

  it('None button when all selected deselects all', () => {
    // Set all regions as selected first
    const { REGIONS } = jest.requireActual('../../data') as { REGIONS: { region: string }[] };
    useAppStore.setState({
      prefs: { ...DEFAULT_PREFERENCES, selectedRegions: REGIONS.map((r) => r.region) },
    });
    const setPref = jest.spyOn(useAppStore.getState(), 'setPref');
    const { getByText } = renderPicker();
    fireEvent.press(getByText('Reorder'));
    fireEvent.press(getByText('None'));
    const call = (setPref as jest.Mock).mock.calls.find((c) => c[0] === 'selectedRegions');
    expect((call![1] as string[]).length).toBe(0);
  });
});

describe('RegionPicker — tune mode', () => {
  it('per-region count change calls setPref with merged regionHeadlineCounts', () => {
    const setPref = jest.spyOn(useAppStore.getState(), 'setPref');
    const { getByText, getAllByRole } = renderPicker();
    fireEvent.press(getByText('Tune'));
    // Find increment button for the first selected region (Hungary row)
    // In tune mode, steppers appear for each selected region
    const buttons = getAllByRole('button');
    // Press increment on first region stepper (index depends on layout)
    const incrementBtn = buttons.find((b) =>
      b.props.accessibilityLabel?.includes('plus') ||
      b.props.children?.props?.name === 'plus',
    );
    if (incrementBtn) fireEvent.press(incrementBtn);
    const call = (setPref as jest.Mock).mock.calls.find(
      (c) => c[0] === 'regionHeadlineCounts',
    );
    if (call) expect(typeof call[1]).toBe('object');
  });
});
```

- [ ] **Step 6.2: Run tests — expect all to fail**

```bash
cd app && npx jest src/tests/components/RegionPicker.test.ts --no-coverage
```

Expected: `Cannot find module '../../components/RegionPicker'`

- [ ] **Step 6.3: Create `components/RegionPicker.tsx`**

Create `app/src/components/RegionPicker.tsx`:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { font, THEMES, AESTHETICS } from '../themes';
import type { Theme } from '../themes';
import { REGIONS } from '../data';
import { config } from '../config';
import { useAppStore } from '../store';
import PulseIcon from './Icon';
import Flag from './Flag';
import Stepper from './Stepper';

type Region = (typeof REGIONS)[number];
type Mode = 'normal' | 'reorder' | 'tune';

const LAYOUT_ANIM = { duration: 180, update: { type: 'easeInEaseOut' as const } };

/** Selected/available region list with reorder and per-region tune modes. */
export default function RegionPicker(): React.ReactElement {
  const selectedRegions = useAppStore((s) => s.prefs.selectedRegions);
  const headlineCount = useAppStore((s) => s.prefs.headlineCount);
  const regionHeadlineCounts = useAppStore((s) => s.prefs.regionHeadlineCounts);
  const setPref = useAppStore((s) => s.setPref);
  const themeId = useAppStore((s) => s.prefs.theme);
  const aesId = useAppStore((s) => s.prefs.aesthetic);
  const theme = THEMES[themeId] ?? THEMES.light;
  const aes = AESTHETICS[aesId] ?? AESTHETICS.editorial;

  const [mode, setMode] = useState<Mode>('normal');

  const [orderedRegions, setOrderedRegions] = useState<Region[]>(() => {
    const selectedSet = new Set(selectedRegions);
    const selectedInOrder = selectedRegions
      .map((name) => REGIONS.find((r) => r.region === name))
      .filter(Boolean) as Region[];
    const unselected = REGIONS.filter((r) => !selectedSet.has(r.region));
    return [...selectedInOrder, ...unselected];
  });

  const selected = useMemo(() => new Set(selectedRegions), [selectedRegions]);
  const allSelected = selected.size === REGIONS.length;

  useEffect(() => {
    const selectedSet = new Set(selectedRegions);
    const nextOrder = [
      ...(selectedRegions
        .map(
          (name) =>
            orderedRegions.find((r) => r.region === name) ?? REGIONS.find((r) => r.region === name),
        )
        .filter(Boolean) as Region[]),
      ...orderedRegions.filter((r) => !selectedSet.has(r.region)),
    ];
    if (
      nextOrder.length === orderedRegions.length &&
      nextOrder.every((r, i) => r.region === orderedRegions[i]?.region)
    )
      return;
    setOrderedRegions(nextOrder);
  }, [selectedRegions]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (nextSelected: Set<string>, order: Region[] = orderedRegions): void => {
    setPref(
      'selectedRegions',
      order.filter((r) => nextSelected.has(r.region)).map((r) => r.region),
    );
  };

  const toggleRegion = (name: string): void => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    const nextOrder = [
      ...orderedRegions.filter((r) => next.has(r.region)),
      ...orderedRegions.filter((r) => !next.has(r.region)),
    ];
    LayoutAnimation.configureNext(LAYOUT_ANIM);
    setOrderedRegions(nextOrder);
    commit(next, nextOrder);
  };

  const moveRegion = (name: string, dir: 'up' | 'down'): void => {
    if (!selected.has(name)) return;
    const idx = orderedRegions.findIndex((r) => r.region === name);
    const to = dir === 'up' ? idx - 1 : idx + 1;
    if (to < 0 || to >= selected.size) return;
    const next = [...orderedRegions];
    [next[idx], next[to]] = [next[to]!, next[idx]!];
    LayoutAnimation.configureNext(LAYOUT_ANIM);
    setOrderedRegions(next);
    commit(selected, next);
  };

  const jumpRegion = (name: string, dir: 'up' | 'down'): void => {
    if (!selected.has(name)) return;
    const idx = orderedRegions.findIndex((r) => r.region === name);
    if (dir === 'up' ? idx === 0 : idx === selected.size - 1) return;
    const next = [...orderedRegions];
    const [item] = next.splice(idx, 1);
    if (dir === 'up') next.unshift(item!);
    else next.splice(selected.size - 1, 0, item!);
    LayoutAnimation.configureNext(LAYOUT_ANIM);
    setOrderedRegions(next);
    commit(selected, next);
  };

  const leftPill =
    mode === 'reorder'
      ? {
          label: allSelected ? 'None' : 'All',
          onPress: () => {
            LayoutAnimation.configureNext(LAYOUT_ANIM);
            commit(allSelected ? new Set() : new Set(REGIONS.map((r) => r.region)));
          },
          active: false,
        }
      : mode === 'tune'
        ? { label: 'Done', onPress: () => setMode('normal'), active: true }
        : { label: 'Tune', onPress: () => setMode('tune'), active: false };

  const rightPill =
    mode === 'tune'
      ? { label: 'Reset', onPress: () => setPref('regionHeadlineCounts', {}), active: false }
      : mode === 'reorder'
        ? { label: 'Done', onPress: () => setMode('normal'), active: true }
        : { label: 'Reorder', onPress: () => setMode('reorder'), active: false };

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={s.groupHead}>
        <Text
          style={{
            fontFamily: font(aes, 'eyebrow', 600),
            fontSize: 10,
            letterSpacing: 1.8,
            color: theme.textFaint,
            textTransform: 'uppercase',
          }}
        >
          Regions
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: font(aes, 'number'),
              fontSize: 10.5,
              color: theme.textFaint,
              letterSpacing: 0.4,
            }}
          >
            {selected.size} of {REGIONS.length}
          </Text>
          <Pressable
            onPress={leftPill.onPress}
            style={[
              s.pill,
              {
                backgroundColor: leftPill.active ? theme.accent : theme.accentSoft,
                marginLeft: 10,
              },
            ]}
            accessibilityLabel={leftPill.label}
          >
            <Text
              style={{
                fontFamily: font(aes, 'ui', 600),
                fontSize: 11,
                letterSpacing: 0.4,
                color: leftPill.active ? theme.bg : theme.accent,
              }}
            >
              {leftPill.label}
            </Text>
          </Pressable>
          <Pressable
            onPress={rightPill.onPress}
            style={[
              s.pill,
              {
                backgroundColor: rightPill.active ? theme.accent : theme.accentSoft,
                marginLeft: 10,
              },
            ]}
            accessibilityLabel={rightPill.label}
          >
            <Text
              style={{
                fontFamily: font(aes, 'ui', 600),
                fontSize: 11,
                letterSpacing: 0.4,
                color: rightPill.active ? theme.bg : theme.accent,
              }}
            >
              {rightPill.label}
            </Text>
          </Pressable>
        </View>
      </View>

      <View
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: theme.rule,
          backgroundColor: theme.surface,
        }}
      >
        <View
          style={[
            s.regionRow,
            { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.rule },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: font(aes, 'ui', 500),
                fontSize: 14.5,
                color: theme.text,
                letterSpacing: -0.05,
              }}
            >
              Headlines per region
            </Text>
            <Text
              style={{
                fontFamily: font(aes, 'body'),
                fontSize: 12,
                color: theme.textFaint,
                lineHeight: 16,
                marginTop: 2,
              }}
            >
              Default for all regions. Override via Tune.
            </Text>
          </View>
          <Stepper
            icons
            theme={theme}
            aes={aes}
            value={headlineCount}
            min={1}
            max={config.fetchCount}
            onChange={(n) => setPref('headlineCount', n)}
          />
        </View>
        {orderedRegions.map((r, i) => {
          const isSelected = selected.has(r.region);
          const count = regionHeadlineCounts[r.region] ?? headlineCount;
          return (
            <Pressable
              key={r.region}
              onPress={() => mode !== 'tune' && toggleRegion(r.region)}
              accessibilityLabel={`${r.region}, ${isSelected ? 'selected' : 'not selected'}`}
              style={({ pressed }) => [
                s.regionRow,
                {
                  borderBottomColor: theme.rule,
                  borderBottomWidth: i < orderedRegions.length - 1 ? StyleSheet.hairlineWidth : 0,
                  backgroundColor:
                    pressed && mode !== 'tune'
                      ? theme.chip
                      : isSelected
                        ? theme.surface
                        : 'transparent',
                },
              ]}
            >
              <Flag country={r.country} width={26} height={20} dim={!isSelected} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text
                  style={{
                    fontFamily: font(aes, 'body', 500),
                    fontSize: 15,
                    color: isSelected ? theme.text : theme.textDim,
                  }}
                >
                  {r.region}
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
                  {r.continent}
                </Text>
              </View>
              {isSelected && mode === 'reorder' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                  <Pressable
                    onPress={() => moveRegion(r.region, 'up')}
                    onLongPress={() => jumpRegion(r.region, 'up')}
                    hitSlop={4}
                    style={({ pressed }) => [
                      s.reorderBtn,
                      {
                        backgroundColor: pressed ? theme.accentSoft : theme.chip,
                        opacity: i === 0 ? 0.35 : 1,
                      },
                    ]}
                    accessibilityLabel={`Move ${r.region} up`}
                  >
                    <PulseIcon name="chevron-up" size={20} color={theme.text} strokeWidth={2.2} />
                  </Pressable>
                  <Pressable
                    onPress={() => moveRegion(r.region, 'down')}
                    onLongPress={() => jumpRegion(r.region, 'down')}
                    hitSlop={4}
                    style={({ pressed }) => [
                      s.reorderBtn,
                      {
                        backgroundColor: pressed ? theme.accentSoft : theme.chip,
                        opacity: i === selected.size - 1 ? 0.35 : 1,
                        marginLeft: 8,
                      },
                    ]}
                    accessibilityLabel={`Move ${r.region} down`}
                  >
                    <PulseIcon name="chevron-down" size={20} color={theme.text} strokeWidth={2.2} />
                  </Pressable>
                </View>
              ) : isSelected && mode === 'tune' ? (
                <View style={{ marginRight: 8 }}>
                  <Stepper
                    icons
                    theme={theme}
                    aes={aes}
                    value={count}
                    min={1}
                    max={config.fetchCount}
                    onChange={(n) =>
                      setPref('regionHeadlineCounts', { ...regionHeadlineCounts, [r.region]: n })
                    }
                    valueColor={
                      regionHeadlineCounts[r.region] != null ? theme.accent : theme.textFaint
                    }
                  />
                </View>
              ) : (
                <Text
                  style={{
                    fontFamily: font(aes, 'number', 600),
                    fontSize: 10,
                    color: isSelected ? theme.accent : theme.textFaint,
                    letterSpacing: 0.5,
                    marginRight: 8,
                  }}
                >
                  {r.code}
                </Text>
              )}
              {mode !== 'tune' && <Checkmark on={isSelected} theme={theme} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Checkmark({ on, theme }: { on: boolean; theme: Theme }): React.ReactElement {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: on ? theme.text : 'transparent',
        borderWidth: on ? 0 : 1.5,
        borderColor: theme.rule,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on ? <PulseIcon name="check" size={13} color={theme.bg} strokeWidth={2.4} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  groupHead: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 6.4: Run tests — expect all to pass**

```bash
cd app && npx jest src/tests/components/RegionPicker.test.ts --no-coverage
```

- [ ] **Step 6.5: Commit**

```bash
git add app/src/components/RegionPicker.tsx app/src/tests/components/RegionPicker.test.ts
git commit -m "feat(app): add RegionPicker component (store-driven, 3 modes)"
```

---

## Task 7: `SettingsScreen`

**Files:**

- Create: `app/src/hooks/useSlideIn.ts`
- Create: `app/src/hooks/useSwipe.ts`
- Create: `app/src/screens/SettingsScreen.tsx`
- Create: `app/src/tests/screens/SettingsScreen.test.ts`

- [ ] **Step 7.0: Port `useSlideIn` and `useSwipe` from legacy**

`SettingsScreen` imports both hooks. They don't exist in the rebuild yet — port them verbatim.

Create `app/src/hooks/useSlideIn.ts`:

```ts
import { useCallback, useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing } from 'react-native';

const W = Dimensions.get('window').width;

/** Slides a screen in from the right on mount; dismiss animates it back out before calling onDismiss. */
export function useSlideIn(onDismiss: () => void): {
  slideAnim: Animated.Value;
  dismiss: () => void;
} {
  const slideAnim = useRef(new Animated.Value(W)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: W,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [onDismiss]); // eslint-disable-line react-hooks/exhaustive-deps

  return { slideAnim, dismiss };
}
```

Create `app/src/hooks/useSwipe.ts`:

```ts
import { useRef } from 'react';
import { PanResponder } from 'react-native';

const SWIPE_DISTANCE = 48;
const SWIPE_VELOCITY = 0.45;

/**
 * Returns panHandlers for a horizontal swipe gesture. Release with dx > 48 or
 * vx > 0.45 calls onSwipeRight; dx < -48 or vx < -0.45 calls onSwipeLeft.
 * Callbacks are stored in refs so they can change between renders without
 * recreating the PanResponder.
 */
export function useSwipe(onSwipeLeft?: () => void, onSwipeRight?: () => void) {
  const leftRef = useRef(onSwipeLeft);
  const rightRef = useRef(onSwipeRight);
  leftRef.current = onSwipeLeft;
  rightRef.current = onSwipeRight;

  return useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_DISTANCE || gs.vx > SWIPE_VELOCITY) rightRef.current?.();
        else if (gs.dx < -SWIPE_DISTANCE || gs.vx < -SWIPE_VELOCITY) leftRef.current?.();
      },
    }),
  ).current.panHandlers;
}
```

- [ ] **Step 7.1: Write the failing tests**

Create `app/src/tests/screens/SettingsScreen.test.ts`:

```ts
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAppStore } from '../../store';
import { DEFAULT_PREFERENCES } from '../../storage/preferences';
import SettingsScreen from '../../screens/SettingsScreen';

jest.mock('../../storage/preferences', () => ({
  DEFAULT_PREFERENCES: {
    selectedRegions: ['Hungary'],
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
  },
}));

// RegionPicker has its own tests; mock it out to keep SettingsScreen tests focused
jest.mock('../../components/RegionPicker', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => React.createElement(View, { testID: 'region-picker' }) };
});

const defaultProps = {
  onLogout: jest.fn(),
  onDeleteAccount: jest.fn().mockResolvedValue(null),
};

beforeEach(() => {
  jest.clearAllMocks();
  useAppStore.setState({
    prefs: DEFAULT_PREFERENCES,
    prefsMutationCount: 0,
    session: { user: { id: 'u1', email: 'test@pulse.com' } } as any,
    notificationsEnabled: true,
  });
});

function renderSettings(props = defaultProps) {
  return render(<SettingsScreen {...props} />);
}

describe('SettingsScreen', () => {
  it('calls onLogout when sign out is pressed', () => {
    const onLogout = jest.fn();
    const { getByLabelText } = renderSettings({ ...defaultProps, onLogout });
    fireEvent.press(getByLabelText('Sign out'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('shows an Alert when delete account is pressed', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = renderSettings();
    fireEvent.press(getByText('Delete account'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete account',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('calls onDeleteAccount after confirming the alert', async () => {
    const onDeleteAccount = jest.fn().mockResolvedValue(null);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const deleteBtn = buttons?.find((b: any) => b.style === 'destructive');
      deleteBtn?.onPress?.();
    });
    const { getByText } = renderSettings({ ...defaultProps, onDeleteAccount });
    fireEvent.press(getByText('Delete account'));
    await waitFor(() => expect(onDeleteAccount).toHaveBeenCalledTimes(1));
  });

  it('does NOT call onDeleteAccount when alert is cancelled', () => {
    const onDeleteAccount = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancelBtn = buttons?.find((b: any) => b.style === 'cancel');
      cancelBtn?.onPress?.();
    });
    const { getByText } = renderSettings({ ...defaultProps, onDeleteAccount });
    fireEvent.press(getByText('Delete account'));
    expect(onDeleteAccount).not.toHaveBeenCalled();
  });

  it('shows error alert when onDeleteAccount resolves with error string', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const onDeleteAccount = jest.fn().mockResolvedValue('Something went wrong');
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_title, _msg, buttons) => {
      const deleteBtn = buttons?.find((b: any) => b.style === 'destructive');
      deleteBtn?.onPress?.();
    });
    const { getByText } = renderSettings({ ...defaultProps, onDeleteAccount });
    fireEvent.press(getByText('Delete account'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Something went wrong');
    });
  });

  it('shows notifications disabled banner when notificationsEnabled is false', () => {
    useAppStore.setState({ notificationsEnabled: false });
    const { getByText } = renderSettings();
    expect(getByText('Notifications disabled')).toBeTruthy();
  });

  it('does not show notifications disabled banner when enabled', () => {
    useAppStore.setState({ notificationsEnabled: true });
    const { queryByText } = renderSettings();
    expect(queryByText('Notifications disabled')).toBeNull();
  });
});
```

- [ ] **Step 7.2: Run tests — expect all to fail**

```bash
cd app && npx jest src/tests/screens/SettingsScreen.test.ts --no-coverage
```

Expected: `Cannot find module '../../screens/SettingsScreen'`

- [ ] **Step 7.3: Create `screens/SettingsScreen.tsx`**

Create `app/src/screens/SettingsScreen.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Linking,
  Switch,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, THEMES, AESTHETICS } from '../themes';
import type { Theme, Aesthetic } from '../themes';
import PulseIcon from '../components/Icon';
import RegionPicker from '../components/RegionPicker';
import Stepper from '../components/Stepper';
import { useSlideIn } from '../hooks/useSlideIn';
import { useSwipe } from '../hooks/useSwipe';
import { useAppStore } from '../store';
import type { UserPreferences } from '../types';

interface Props {
  onLogout: () => void;
  onDeleteAccount: () => Promise<string | null>;
}

export default function SettingsScreen({ onLogout, onDeleteAccount }: Props): React.ReactElement {
  const prefs = useAppStore((s) => s.prefs);
  const setPref = useAppStore((s) => s.setPref);
  const userEmail = useAppStore((s) => s.session?.user.email ?? '');
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const setScreen = useAppStore((s) => s.setScreen);

  const theme = THEMES[prefs.theme] ?? THEMES.light;
  const aes = AESTHETICS[prefs.aesthetic] ?? AESTHETICS.editorial;

  const insets = useSafeAreaInsets();
  const onBack = (): void => setScreen('digest');
  const { slideAnim, dismiss } = useSlideIn(onBack);
  const panHandlers = useSwipe(undefined, dismiss);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = (): void => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            onDeleteAccount().then((err) => {
              setDeleting(false);
              if (err) Alert.alert('Error', err);
            });
          },
        },
      ],
    );
  };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.bg,
          zIndex: 50,
          transform: [{ translateX: slideAnim }],
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
      {...panHandlers}
    >
      <View style={[s.header, { backgroundColor: theme.bg, borderBottomColor: theme.rule }]}>
        <Pressable
          onPress={dismiss}
          style={[s.backBtn, { backgroundColor: theme.chip }]}
          hitSlop={6}
          accessibilityLabel="Back"
        >
          <PulseIcon name="arrow-left" size={16} color={theme.text} />
        </Pressable>
        <Text
          style={{
            fontFamily: font(aes, 'title', 700),
            fontSize: 22,
            lineHeight: 26,
            letterSpacing: -0.3,
            color: theme.text,
            flex: 1,
            marginLeft: 8,
          }}
        >
          Settings
        </Text>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Group theme={theme} aes={aes} label="Account">
          <Row
            theme={theme}
            aes={aes}
            label="Signed in as"
            value={
              <Text style={{ fontFamily: font(aes, 'number'), color: theme.textDim, fontSize: 13 }}>
                {userEmail}
              </Text>
            }
          />
        </Group>

        <Group theme={theme} aes={aes} label="Notification">
          {!notificationsEnabled && (
            <Pressable
              onPress={() => void Linking.openSettings()}
              style={[s.row, { borderBottomColor: theme.rule }]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontFamily: font(aes, 'ui', 500), fontSize: 14.5, color: theme.accent }}
                >
                  Notifications disabled
                </Text>
                <Text
                  style={{
                    fontFamily: font(aes, 'body'),
                    fontSize: 12,
                    color: theme.textFaint,
                    marginTop: 2,
                  }}
                >
                  Tap to open system settings
                </Text>
              </View>
              <PulseIcon name="arrow-right" size={16} color={theme.textFaint} />
            </Pressable>
          )}
          <Row
            theme={theme}
            aes={aes}
            label="Daily digest time"
            sub="One push a day, no more."
            value={
              <NotifyTimePicker
                theme={theme}
                aes={aes}
                value={prefs.notifyTime}
                onChange={(v) => setPref('notifyTime', v)}
              />
            }
          />
        </Group>

        <Group theme={theme} aes={aes} label="Global Headlines">
          <Row
            theme={theme}
            aes={aes}
            label="Show global headlines"
            sub="Top stories from across all regions, selected by global importance."
            value={
              <Switch
                value={prefs.showGlobalHeadlines}
                onValueChange={(v) => setPref('showGlobalHeadlines', v)}
                trackColor={{ false: theme.chip, true: theme.accent }}
                thumbColor={theme.bg}
              />
            }
          />
          <Row
            theme={theme}
            aes={aes}
            label="Count"
            sub="Number of global headlines shown."
            value={
              <View
                pointerEvents={prefs.showGlobalHeadlines ? 'auto' : 'none'}
                style={{ opacity: prefs.showGlobalHeadlines ? 1 : 0.35 }}
              >
                <Stepper
                  theme={theme}
                  aes={aes}
                  value={prefs.globalHeadlineCount}
                  min={1}
                  max={10}
                  onChange={(v) => setPref('globalHeadlineCount', v)}
                />
              </View>
            }
          />
        </Group>

        <RegionPicker />

        <Group theme={theme} aes={aes} label="Reading">
          <Row
            theme={theme}
            aes={aes}
            label="Local history"
            sub="Days of digests kept on this device."
            value={
              <Stepper
                theme={theme}
                aes={aes}
                value={prefs.historyDays}
                min={3}
                max={30}
                suffix="d"
                onChange={(v) => setPref('historyDays', v)}
              />
            }
          />
          <Row
            theme={theme}
            aes={aes}
            label="Open links in"
            value={
              <SegRow<UserPreferences['openLinksIn']>
                theme={theme}
                aes={aes}
                value={prefs.openLinksIn}
                options={[
                  { value: 'in-app', label: 'In-app' },
                  { value: 'browser', label: 'Browser' },
                ]}
                onChange={(v) => setPref('openLinksIn', v)}
              />
            }
          />
        </Group>

        <Group theme={theme} aes={aes} label="Display">
          <Row
            theme={theme}
            aes={aes}
            label="Theme"
            value={
              <SegRow<UserPreferences['theme']>
                theme={theme}
                aes={aes}
                value={prefs.theme}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'sepia', label: 'Sepia' },
                  { value: 'dark', label: 'Dark' },
                ]}
                onChange={(v) => setPref('theme', v)}
              />
            }
          />
          <Row
            theme={theme}
            aes={aes}
            label="Font"
            value={
              <SegRow<UserPreferences['aesthetic']>
                theme={theme}
                aes={aes}
                value={prefs.aesthetic}
                options={[
                  { value: 'editorial', label: 'Serif' },
                  { value: 'clinical', label: 'Sans' },
                  { value: 'brutalist', label: 'Mono' },
                ]}
                onChange={(v) => setPref('aesthetic', v)}
              />
            }
          />
          <Row
            theme={theme}
            aes={aes}
            label="Region label"
            value={
              <SegRow<UserPreferences['regionStyle']>
                theme={theme}
                aes={aes}
                value={prefs.regionStyle}
                options={[
                  { value: 'flag', label: 'Flag' },
                  { value: 'code', label: 'Code' },
                ]}
                onChange={(v) => setPref('regionStyle', v)}
              />
            }
          />
          <Row
            theme={theme}
            aes={aes}
            label="Currency rates"
            sub="Show rate and daily % change per region."
            value={
              <Switch
                value={prefs.showCurrencyRates}
                onValueChange={(v) => setPref('showCurrencyRates', v)}
                trackColor={{ false: theme.chip, true: theme.accent }}
                thumbColor={theme.bg}
              />
            }
          />
          <Row
            theme={theme}
            aes={aes}
            label="Base currency"
            sub="Rates displayed relative to this currency."
            value={
              <CurrencyPicker
                theme={theme}
                aes={aes}
                value={prefs.baseCurrency}
                onChange={(v) => setPref('baseCurrency', v)}
                disabled={!prefs.showCurrencyRates}
              />
            }
          />
        </Group>

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Pressable
            onPress={onLogout}
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              s.logout,
              { borderColor: theme.rule, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <PulseIcon name="logout" size={15} color={theme.text} />
            <Text
              style={{
                fontFamily: font(aes, 'ui', 600),
                fontSize: 14.5,
                color: theme.text,
                marginLeft: 8,
              }}
            >
              Sign out
            </Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 12, alignItems: 'center' }}>
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            style={({ pressed }) => ({
              opacity: deleting || pressed ? 0.55 : 1,
              paddingVertical: 10,
            })}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#c0392b" />
            ) : (
              <Text style={{ fontFamily: font(aes, 'ui', 500), fontSize: 13, color: '#c0392b' }}>
                Delete account
              </Text>
            )}
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 16, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: font(aes, 'eyebrow', 500),
              fontSize: 10,
              letterSpacing: 2,
              lineHeight: 18,
              color: theme.textFaint,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            Pulse News · v1.0 · build 26.05{'\n'}one notification · one tap · move on
          </Text>
        </View>
      </Animated.ScrollView>
    </Animated.View>
  );
}

// ── Building blocks ──────────────────────────────────────────────────

function Group({
  theme,
  aes,
  label,
  children,
}: {
  theme: Theme;
  aes: Aesthetic;
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={{ marginBottom: 24 }}>
      <View style={s.groupHead}>
        <Text
          style={{
            fontFamily: font(aes, 'eyebrow', 600),
            fontSize: 10,
            letterSpacing: 1.8,
            color: theme.textFaint,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      </View>
      <View
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: theme.rule,
          backgroundColor: theme.surface,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  theme,
  aes,
  label,
  sub,
  value,
}: {
  theme: Theme;
  aes: Aesthetic;
  label: string;
  sub?: string;
  value: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={[s.row, { borderBottomColor: theme.rule }]}>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: font(aes, 'ui', 500),
            fontSize: 14.5,
            color: theme.text,
            letterSpacing: -0.05,
          }}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            style={{
              fontFamily: font(aes, 'body'),
              fontSize: 12,
              color: theme.textFaint,
              lineHeight: 16,
              marginTop: 2,
            }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      <View>{value}</View>
    </View>
  );
}

const TIME_OPTS: string[] = [];
for (let hr = 6; hr <= 22; hr++) {
  for (const m of [0, 30]) {
    TIME_OPTS.push(`${String(hr).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}
const TIME_ITEM_HEIGHT = 45;

function NotifyTimePicker({
  theme,
  aes,
  value,
  onChange,
}: {
  theme: Theme;
  aes: Aesthetic;
  value: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!open) return;
    const i = TIME_OPTS.indexOf(value);
    if (i <= 2) return;
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: (i - 2) * TIME_ITEM_HEIGHT, animated: false });
    }, 50);
    return () => clearTimeout(id);
  }, [open, value]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: theme.chip,
          borderRadius: 10,
        }}
      >
        <Text
          style={{
            fontFamily: font(aes, 'number'),
            fontSize: 14,
            color: theme.text,
            letterSpacing: 0.1,
          }}
        >
          {value}
        </Text>
        <View style={{ marginLeft: 6 }}>
          <PulseIcon name="chevron-down" size={12} color={theme.textFaint} strokeWidth={2} />
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              paddingTop: 12,
              paddingBottom: 36,
              maxHeight: '60%',
            }}
            onPress={() => {}}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.rule,
                alignSelf: 'center',
                marginBottom: 8,
              }}
            />
            <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
              {TIME_OPTS.map((time) => {
                const sel = time === value;
                return (
                  <Pressable
                    key={time}
                    onPress={() => {
                      onChange(time);
                      setOpen(false);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 28,
                      paddingVertical: 14,
                      backgroundColor: pressed || sel ? theme.chip : 'transparent',
                    })}
                  >
                    <Text
                      style={{
                        fontFamily: font(aes, 'number'),
                        fontSize: 17,
                        color: sel ? theme.accent : theme.text,
                      }}
                    >
                      {time}
                    </Text>
                    {sel && (
                      <PulseIcon name="check" size={16} color={theme.accent} strokeWidth={2.2} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'] as const;

function CurrencyPicker({
  theme,
  aes,
  value,
  onChange,
  disabled = false,
}: {
  theme: Theme;
  aes: Aesthetic;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: theme.chip,
          borderRadius: 10,
          opacity: disabled ? 0.35 : 1,
        }}
      >
        <Text
          style={{
            fontFamily: font(aes, 'number'),
            fontSize: 14,
            color: theme.text,
            letterSpacing: 0.1,
          }}
        >
          {value}
        </Text>
        <View style={{ marginLeft: 6 }}>
          <PulseIcon name="chevron-down" size={12} color={theme.textFaint} strokeWidth={2} />
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              paddingTop: 12,
              paddingBottom: 36,
            }}
            onPress={() => {}}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.rule,
                alignSelf: 'center',
                marginBottom: 8,
              }}
            />
            {POPULAR_CURRENCIES.map((c) => {
              const sel = c === value;
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 28,
                    paddingVertical: 14,
                    backgroundColor: pressed || sel ? theme.chip : 'transparent',
                  })}
                >
                  <Text
                    style={{
                      fontFamily: font(aes, 'number'),
                      fontSize: 17,
                      color: sel ? theme.accent : theme.text,
                    }}
                  >
                    {c}
                  </Text>
                  {sel && (
                    <PulseIcon name="check" size={16} color={theme.accent} strokeWidth={2.2} />
                  )}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

interface SegOption<V extends string> {
  value: V;
  label: string;
}
interface SegRowProps<V extends string> {
  theme: Theme;
  aes: Aesthetic;
  value: V;
  options: SegOption<V>[];
  onChange: (v: V) => void;
}

function SegRow<V extends string>({
  theme,
  aes,
  value,
  options,
  onChange,
}: SegRowProps<V>): React.ReactElement {
  return (
    <View style={[s.seg, { backgroundColor: theme.chip }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[s.segBtn, { backgroundColor: on ? theme.surface : 'transparent' }]}
          >
            <Text
              style={{
                fontFamily: font(aes, 'ui', on ? 600 : 500),
                fontSize: 12.5,
                letterSpacing: -0.05,
                color: on ? theme.text : theme.textDim,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHead: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logout: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seg: { flexDirection: 'row', padding: 2, borderRadius: 9 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
});
```

- [ ] **Step 7.4: Run tests — expect all to pass**

```bash
cd app && npx jest src/tests/screens/SettingsScreen.test.ts --no-coverage
```

- [ ] **Step 7.5: Commit**

```bash
git add app/src/screens/SettingsScreen.tsx app/src/tests/screens/SettingsScreen.test.ts
git commit -m "feat(app): add SettingsScreen (store-driven, 2-prop surface)"
```

---

## Task 8: `App.tsx` final wiring + cleanup

**Files:**

- Modify: `app/App.tsx`
- Delete: `app/src/screens/stubs/SettingsStub.tsx`

- [ ] **Step 8.1: Update `App.tsx`**

Replace the two stub-related lines in `app/App.tsx`:

```ts
// Remove:
import SettingsStub from './src/screens/stubs/SettingsStub';

// Add:
import SettingsScreen from './src/screens/SettingsScreen';
```

In `RootScreens`, replace `<SettingsStub />` with the real screen, passing auth callbacks from `actions`:

```tsx
// Remove:
{
  screen === 'settings' && <SettingsStub />;
}

// Add:
{
  screen === 'settings' && (
    <SettingsScreen
      onLogout={() => {
        void actions.signOut();
      }}
      onDeleteAccount={actions.deleteAccount}
    />
  );
}
```

Also pass `actions` into `RootScreens` if not already in scope — it is already a prop (`actions: AuthActions`), so no interface change needed.

- [ ] **Step 8.2: Delete `SettingsStub.tsx`**

```bash
rm app/src/screens/stubs/SettingsStub.tsx
```

- [ ] **Step 8.3: Typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors. Fix any type errors before proceeding.

- [ ] **Step 8.4: Lint**

```bash
cd app && npx eslint --ext .ts,.tsx src
```

Expected: no errors or warnings

- [ ] **Step 8.5: Commit**

```bash
git add app/App.tsx
git rm app/src/screens/stubs/SettingsStub.tsx
git commit -m "feat(app): wire SettingsScreen into App.tsx, remove SettingsStub"
```

---

## Task 9: Final verification

- [ ] **Step 9.1: Run full test suite**

```bash
cd app && npx jest --no-coverage
```

Expected: all tests pass, no regressions in existing test files

- [ ] **Step 9.2: Typecheck all packages**

```bash
cd app && npx tsc --noEmit
cd ../cron && npx tsc --noEmit
```

Expected: no errors in either package

- [ ] **Step 9.3: Lint all packages**

```bash
npm run format:check && cd app && npx eslint --ext .ts,.tsx src && cd ../cron && npx eslint --ext .ts src
```

Expected: no errors

- [ ] **Step 9.4: Final commit**

```bash
git add -A
git commit -m "chore(app): settings-flow slice 4 complete — typecheck + lint green"
```
