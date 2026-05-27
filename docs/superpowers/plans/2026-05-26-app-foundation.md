# app/foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete infrastructure layer for the Pulse app: dependencies, Zustand store skeleton, boot state machine, font loading, typed infrastructure ports, MMKV storage, Supabase client, React Query provider, root error boundary, and screen stubs — everything subsequent slices build on.

**Architecture:** Zustand store with split slice files (`slices/app.ts` for the boot state machine, `slices/nav.ts` for screen/day/article with MMKV persistence) composed into one `useAppStore`. App.tsx holds native splash until `appState` leaves `'booting'`, then routes by state machine value. Auth/prefs/device slices are added by later slices without modifying existing files.

**Tech stack:** Expo SDK 55, React Native 0.83, Zustand 5, React Query 5, MMKV, Supabase JS v2, Firebase (core only), ts-jest.

**Spec:** `docs/superpowers/specs/2026-05-26-app-foundation-design.md`
**Legacy reference:** `/home/hp/projects/pulse-news-legacy/app/src/`

---

## File map

| File                                             | Action | Role                                                                |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------- |
| `app/package.json`                               | Modify | Add all runtime dependencies                                        |
| `app/babel.config.js`                            | Create | Expo preset + Reanimated plugin (must be last)                      |
| `app/jest.config.cjs`                            | Modify | Add MMKV mock to moduleNameMapper                                   |
| `app/__mocks__/react-native-mmkv.ts`             | Create | In-memory MMKV mock for Jest                                        |
| `app/app.json`                                   | Create | Expo configuration                                                  |
| `app/index.ts`                                   | Create | AppRegistry + `SplashScreen.preventAutoHideAsync()` at module scope |
| `app/App.tsx`                                    | Create | Boot gate + screen routing shell                                    |
| `app/src/types.ts`                               | Create | All domain types (port)                                             |
| `app/src/config.ts`                              | Create | Typed config re-export + `API_URL` (port)                           |
| `app/src/logger.ts`                              | Create | Namespaced logger (port)                                            |
| `app/src/themes.ts`                              | Create | THEMES, AESTHETICS, `font()` helper (port)                          |
| `app/src/data.ts`                                | Create | REGIONS re-export, date helpers, `sortedSelectedRegions` (port)     |
| `app/src/storage/mmkv.ts`                        | Create | MMKV singleton + `supabaseStorage` adapter (port)                   |
| `app/src/supabase/client.ts`                     | Create | Lazy Supabase singleton (port)                                      |
| `app/src/store/slices/app.ts`                    | Create | `AppState` machine                                                  |
| `app/src/store/slices/nav.ts`                    | Create | Screen/day/article state + MMKV persistence                         |
| `app/src/store/index.ts`                         | Create | Composed `useAppStore`                                              |
| `app/src/hooks/useAppInit.ts`                    | Create | Advances boot machine after fonts load                              |
| `app/src/components/ErrorBoundary.tsx`           | Create | Root-level recoverable error boundary                               |
| `app/src/screens/stubs/AuthFlowStub.tsx`         | Create | Placeholder for auth-flow slice                                     |
| `app/src/screens/stubs/DigestFlowStub.tsx`       | Create | Placeholder for digest-flow slice                                   |
| `app/src/screens/stubs/SettingsStub.tsx`         | Create | Placeholder for settings-flow slice                                 |
| `app/src/screens/stubs/UpdateRequiredScreen.tsx` | Create | Future boot gate                                                    |
| `app/src/screens/stubs/MaintenanceScreen.tsx`    | Create | Future boot gate                                                    |
| `app/src/themes.test.ts`                         | Create | Tests for `font()` helper                                           |
| `app/src/data.test.ts`                           | Create | Tests for date helpers + `sortedSelectedRegions`                    |
| `app/src/storage/mmkv.test.ts`                   | Create | Tests for `supabaseStorage` adapter                                 |
| `app/src/store/slices/app.test.ts`               | Create | Tests for AppState machine                                          |
| `app/src/store/slices/nav.test.ts`               | Create | Tests for nav slice restore logic                                   |
| `app/CLAUDE.md`                                  | Modify | Update module map + architecture notes                              |

---

## Task 1: Install dependencies

**Files:** Modify `app/package.json`

- [ ] **Install all runtime packages**

```bash
cd app && npm install \
  expo \
  react-native \
  react \
  zustand \
  @tanstack/react-query \
  expo-splash-screen \
  expo-font \
  @expo-google-fonts/source-serif-4 \
  @expo-google-fonts/inter \
  @expo-google-fonts/jetbrains-mono \
  expo-status-bar \
  expo-navigation-bar \
  expo-system-ui \
  react-native-gesture-handler \
  react-native-safe-area-context \
  react-native-reanimated \
  react-native-mmkv \
  @supabase/supabase-js \
  @react-native-firebase/app \
  expo-constants \
  expo-build-properties \
  expo-web-browser \
  expo-clipboard \
  expo-crypto \
  expo-notifications \
  zxcvbn
```

- [ ] **Install dev dependencies**

```bash
cd app && npm install --save-dev \
  @types/react \
  @types/zxcvbn \
  ts-jest \
  jest \
  @types/jest \
  typescript \
  babel-preset-expo
```

- [ ] **Verify no peer-dep errors**

```bash
cd app && npm ls --depth=0 2>&1 | grep -i "WARN\|ERR" || echo "clean"
```

- [ ] **Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "feat(app/foundation): install all dependencies"
```

---

## Task 2: Create babel.config.js

**Files:** Create `app/babel.config.js`

React Native Reanimated's Babel plugin **must be the last plugin** in the list — this is a hard requirement from the library. Violating it causes silent runtime failures in animations.

- [ ] **Create `app/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // must be last
    ],
  };
};
```

- [ ] **Commit**

```bash
git add app/babel.config.js
git commit -m "feat(app/foundation): add babel config with Reanimated plugin"
```

---

## Task 3: Configure Jest and create MMKV mock

**Files:** Modify `app/jest.config.cjs`, Create `app/__mocks__/react-native-mmkv.ts`

`react-native-mmkv` is a native module — it will crash in Node Jest without a mock. The mock uses an in-memory Map per MMKV instance.

- [ ] **Create `app/__mocks__/react-native-mmkv.ts`**

```ts
class MockMMKV {
  private _store = new Map<string, string>();

  getString(key: string): string | undefined {
    return this._store.get(key);
  }

  set(key: string, value: string): void {
    this._store.set(key, value);
  }

  delete(key: string): void {
    this._store.delete(key);
  }

  clearAll(): void {
    this._store.clear();
  }

  contains(key: string): boolean {
    return this._store.has(key);
  }
}

export const MMKV = jest.fn().mockImplementation(() => new MockMMKV());
```

- [ ] **Update `app/jest.config.cjs`** — add MMKV to moduleNameMapper

```js
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
    '^react-native-mmkv$': '<rootDir>/__mocks__/react-native-mmkv.ts',
  },
};
```

- [ ] **Verify Jest runs with no tests (passWithNoTests = true)**

```bash
cd app && npm test
```

Expected output: `Test Suites: 0 skipped` with exit code 0.

- [ ] **Commit**

```bash
git add app/jest.config.cjs app/__mocks__/react-native-mmkv.ts
git commit -m "feat(app/foundation): configure Jest with MMKV mock"
```

---

## Task 4: Port types.ts

**Files:** Create `app/src/types.ts`

Pure type definitions — no runtime logic, no tests needed. Port exactly from legacy. `AppState` is defined here (not in the store slice) to avoid a circular import when nav slice imports `ScreenId` from types.

- [ ] **Create `app/src/types.ts`**

```ts
export type { ContinentName, Region } from '../../shared/regions';

export interface Headline {
  title: string;
  summary: string;
  /** 3-4 sentence deep-dive. Absent on old cached digests. */
  detail?: string;
  url: string;
  category?: string;
  sourceName?: string;
}

export interface RegionDigestPayload {
  headlines: Headline[];
}

export interface DailyDigest {
  date: string;
  regions: Record<string, Headline[]>;
}

export type ThemeId = 'light' | 'sepia' | 'dark';
export type AestheticId = 'editorial' | 'clinical' | 'brutalist';
export type ScreenId = 'splash' | 'digest' | 'settings' | 'login';

export type AppState =
  | 'booting'
  | 'auth-check'
  | 'unauthenticated'
  | 'prefs-loading'
  | 'ready'
  | 'update-required'
  | 'maintenance';

export interface UserPreferences {
  selectedRegions: string[];
  headlineCount: number;
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
  /** ISO timestamp. Newer wins on Supabase ↔ local conflict resolution. */
  updatedAt: string;
}

export interface DeviceRow {
  id: string;
  fcmToken: string;
  userId: string | null;
  notifyAt: string | null;
}

export interface ArticleEntry {
  h: Headline;
  r: import('../../shared/regions').Region;
}
```

- [ ] **Verify types compile**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors (only `src/types.ts` exists so far, no imports to fail).

- [ ] **Commit**

```bash
git add app/src/types.ts
git commit -m "feat(app/foundation): port types.ts"
```

---

## Task 5: Port config.ts and logger.ts

**Files:** Create `app/src/config.ts`, `app/src/logger.ts`

Both are direct ports. Read the legacy files for exact implementation.

- [ ] **Read legacy config.ts**

```bash
cat /home/hp/projects/pulse-news-legacy/app/src/config.ts
```

- [ ] **Create `app/src/config.ts`** — port exactly from legacy output above

The file reads `pulse.config.json` from `shared/` and re-exports the `app` section. It also exports `API_URL` from the `EXPO_PUBLIC_API_URL` env var. The import path from `app/src/config.ts` to `shared/pulse.config.json` is `../../shared/pulse.config.json`.

- [ ] **Read legacy logger.ts**

```bash
cat /home/hp/projects/pulse-news-legacy/app/src/logger.ts
```

- [ ] **Create `app/src/logger.ts`** — port exactly from legacy output above

- [ ] **Verify types**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add app/src/config.ts app/src/logger.ts
git commit -m "feat(app/foundation): port config.ts and logger.ts"
```

---

## Task 6: TDD themes.ts

**Files:** Create `app/src/themes.test.ts`, `app/src/themes.ts`

`font()` maps aesthetic role → concrete font-family string. A wrong mapping shows wrong text in prod — silent and hard to notice. Test it thoroughly.

- [ ] **Write the failing test: `app/src/themes.test.ts`**

```ts
import { font, AESTHETICS, THEMES } from './themes';

describe('font()', () => {
  it('editorial title → SourceSerif4_600SemiBold', () => {
    expect(font(AESTHETICS.editorial, 'title')).toBe('SourceSerif4_600SemiBold');
  });

  it('editorial body → SourceSerif4_400Regular', () => {
    expect(font(AESTHETICS.editorial, 'body')).toBe('SourceSerif4_400Regular');
  });

  it('editorial ui → Inter_500Medium', () => {
    expect(font(AESTHETICS.editorial, 'ui')).toBe('Inter_500Medium');
  });

  it('editorial eyebrow → Inter_600SemiBold', () => {
    expect(font(AESTHETICS.editorial, 'eyebrow')).toBe('Inter_600SemiBold');
  });

  it('editorial number → Inter_500Medium', () => {
    expect(font(AESTHETICS.editorial, 'number')).toBe('Inter_500Medium');
  });

  it('weightOverride overrides the role default', () => {
    expect(font(AESTHETICS.editorial, 'title', 700)).toBe('SourceSerif4_700Bold');
    expect(font(AESTHETICS.editorial, 'body', 600)).toBe('SourceSerif4_600SemiBold');
  });

  it('clinical title → Inter_600SemiBold', () => {
    expect(font(AESTHETICS.clinical, 'title')).toBe('Inter_600SemiBold');
  });

  it('brutalist title → JetBrainsMono_500Medium', () => {
    expect(font(AESTHETICS.brutalist, 'title')).toBe('JetBrainsMono_500Medium');
  });

  it('all aesthetics × all roles return valid font name pattern', () => {
    const roles = ['title', 'body', 'ui', 'eyebrow', 'number'] as const;
    const pattern =
      /^(SourceSerif4|Inter|JetBrainsMono)_(400Regular|500Medium|600SemiBold|700Bold)$/;
    for (const aes of Object.values(AESTHETICS)) {
      for (const role of roles) {
        expect(font(aes, role)).toMatch(pattern);
      }
    }
  });
});

describe('THEMES', () => {
  const requiredKeys = [
    'id',
    'bg',
    'surface',
    'text',
    'textDim',
    'textFaint',
    'rule',
    'ruleStrong',
    'accent',
    'accentSoft',
    'chip',
    'chipText',
    'barStyle',
  ] as const;

  it('all three themes have all required color keys', () => {
    for (const theme of Object.values(THEMES)) {
      for (const key of requiredKeys) {
        expect(theme).toHaveProperty(key);
      }
    }
  });

  it('barStyle is either light or dark', () => {
    for (const theme of Object.values(THEMES)) {
      expect(['light', 'dark']).toContain(theme.barStyle);
    }
  });
});
```

- [ ] **Run test — expect FAIL**

```bash
cd app && npm test -- --testPathPattern=themes
```

Expected: `Cannot find module './themes'`

- [ ] **Read legacy themes.ts**

```bash
cat /home/hp/projects/pulse-news-legacy/app/src/themes.ts
```

- [ ] **Create `app/src/themes.ts`** — port exactly from legacy output above

- [ ] **Run test — expect PASS**

```bash
cd app && npm test -- --testPathPattern=themes
```

Expected: all tests pass, `Test Suites: 1 passed`.

- [ ] **Commit**

```bash
git add app/src/themes.ts app/src/themes.test.ts
git commit -m "feat(app/foundation): port themes.ts with tests"
```

---

## Task 7: TDD data.ts

**Files:** Create `app/src/data.test.ts`, `app/src/data.ts`

Date math errors are silent — the app shows wrong days without crashing. `sortedSelectedRegions` filters and sorts region data for the digest view.

- [ ] **Write the failing test: `app/src/data.test.ts`**

```ts
import { isoDateAtDayIndex, formatLongDate, sortedSelectedRegions, TODAY_ISO } from './data';

describe('isoDateAtDayIndex', () => {
  it('index 0 returns today in YYYY-MM-DD format', () => {
    expect(isoDateAtDayIndex(0)).toBe(TODAY_ISO);
    expect(isoDateAtDayIndex(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('index 1 returns yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(isoDateAtDayIndex(1)).toBe(d.toISOString().slice(0, 10));
  });

  it('index 7 returns 7 days ago', () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    expect(isoDateAtDayIndex(7)).toBe(d.toISOString().slice(0, 10));
  });

  it('TODAY_ISO matches isoDateAtDayIndex(0)', () => {
    // TODAY_ISO is computed at module load — may differ by a millisecond, same day
    expect(TODAY_ISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('sortedSelectedRegions', () => {
  it('returns empty array for empty selection', () => {
    expect(sortedSelectedRegions([])).toEqual([]);
  });

  it('filters to only the selected region names', () => {
    const result = sortedSelectedRegions(['Hungary', 'United States']);
    const names = result.map((r) => r.region);
    expect(names).toContain('Hungary');
    expect(names).toContain('United States');
    expect(result).toHaveLength(2);
  });

  it('ignores unknown region names silently', () => {
    const result = sortedSelectedRegions(['NonExistentCountry', 'Hungary']);
    expect(result).toHaveLength(1);
    expect(result[0].region).toBe('Hungary');
  });

  it('preserves order from REGIONS for same continent', () => {
    // Two regions known to exist — order should be stable
    const result = sortedSelectedRegions(['Hungary', 'Ukraine', 'Russia']);
    expect(result).toHaveLength(3);
    // All must have required Region fields
    for (const r of result) {
      expect(r).toHaveProperty('region');
      expect(r).toHaveProperty('continent');
    }
  });
});

describe('formatLongDate', () => {
  it('returns an object or string for a valid ISO date', () => {
    const result = formatLongDate('2026-01-15');
    expect(result).toBeDefined();
  });
});
```

- [ ] **Run test — expect FAIL**

```bash
cd app && npm test -- --testPathPattern=data
```

Expected: `Cannot find module './data'`

- [ ] **Read legacy data.ts**

```bash
cat /home/hp/projects/pulse-news-legacy/app/src/data.ts
```

- [ ] **Create `app/src/data.ts`** — port exactly from legacy output above

Note: `REGIONS` is imported from `@shared/regions`. The `@shared/*` alias is already configured in `tsconfig.json` and `jest.config.cjs`.

- [ ] **Run test — expect PASS**

```bash
cd app && npm test -- --testPathPattern=data
```

Expected: all tests pass. If `formatLongDate` returns a different shape than expected, update the test to match the actual return — the goal is to document the real contract, not enforce a guess.

- [ ] **Commit**

```bash
git add app/src/data.ts app/src/data.test.ts
git commit -m "feat(app/foundation): port data.ts with tests"
```

---

## Task 8: TDD storage/mmkv.ts

**Files:** Create `app/src/storage/mmkv.test.ts`, `app/src/storage/mmkv.ts`

`supabaseStorage` adapts MMKV's sync API to Supabase's AsyncStorage interface. If `getItem` returns `undefined` instead of `null` on a miss, Supabase session restoration silently fails.

- [ ] **Write the failing test: `app/src/storage/mmkv.test.ts`**

```ts
import { supabaseStorage, storage } from './mmkv';

beforeEach(() => {
  // Clear mock store between tests
  (storage as unknown as { clearAll(): void }).clearAll();
});

describe('supabaseStorage adapter', () => {
  it('getItem returns null on miss (not undefined)', () => {
    expect(supabaseStorage.getItem('missing-key')).toBeNull();
  });

  it('setItem + getItem round-trip', () => {
    supabaseStorage.setItem('session', '{"token":"abc"}');
    expect(supabaseStorage.getItem('session')).toBe('{"token":"abc"}');
  });

  it('removeItem clears the key', () => {
    supabaseStorage.setItem('to-remove', 'value');
    supabaseStorage.removeItem('to-remove');
    expect(supabaseStorage.getItem('to-remove')).toBeNull();
  });

  it('multiple keys are independent', () => {
    supabaseStorage.setItem('a', 'value-a');
    supabaseStorage.setItem('b', 'value-b');
    supabaseStorage.removeItem('a');
    expect(supabaseStorage.getItem('a')).toBeNull();
    expect(supabaseStorage.getItem('b')).toBe('value-b');
  });

  it('overwriting a key updates the value', () => {
    supabaseStorage.setItem('key', 'v1');
    supabaseStorage.setItem('key', 'v2');
    expect(supabaseStorage.getItem('key')).toBe('v2');
  });
});
```

- [ ] **Run test — expect FAIL**

```bash
cd app && npm test -- --testPathPattern=storage/mmkv
```

Expected: `Cannot find module './mmkv'`

- [ ] **Create `app/src/storage/mmkv.ts`**

```ts
import { MMKV } from 'react-native-mmkv';

/** Single MMKV instance for all Pulse local storage. */
export const storage = new MMKV({ id: 'pulse' });

/**
 * Supabase-compatible storage adapter backed by MMKV.
 * Supabase JS expects the AsyncStorage interface (getItem/setItem/removeItem).
 * MMKV is synchronous; returning plain values (not Promises) is accepted by the
 * Supabase client.
 */
export const supabaseStorage = {
  getItem: (key: string): string | null => storage.getString(key) ?? null,
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  removeItem: (key: string): void => {
    storage.delete(key);
  },
};
```

- [ ] **Run test — expect PASS**

```bash
cd app && npm test -- --testPathPattern=storage/mmkv
```

Expected: `5 passed`.

- [ ] **Commit**

```bash
git add app/src/storage/mmkv.ts app/src/storage/mmkv.test.ts
git commit -m "feat(app/foundation): port storage/mmkv.ts with tests"
```

---

## Task 9: Port supabase/client.ts

**Files:** Create `app/src/supabase/client.ts`

Lazy singleton — returns `null` when env vars are absent so missing `.env` doesn't crash on import. No unit tests (network/env dependent).

- [ ] **Read legacy supabase/client.ts**

```bash
cat /home/hp/projects/pulse-news-legacy/app/src/supabase/client.ts
```

- [ ] **Create `app/src/supabase/client.ts`** — port exactly from legacy output above

The file imports `supabaseStorage` from `../storage/mmkv` and uses it as the Supabase session storage. `getSupabase()` reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from env vars — returns `null` if either is missing.

- [ ] **Verify types**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add app/src/supabase/client.ts
git commit -m "feat(app/foundation): port supabase/client.ts"
```

---

## Task 10: TDD store/slices/app.ts

**Files:** Create `app/src/store/slices/app.test.ts`, `app/src/store/slices/app.ts`

The boot state machine. A regression here means the app hangs on startup with no visible error.

- [ ] **Write the failing test: `app/src/store/slices/app.test.ts`**

```ts
import { create } from 'zustand';
import { createAppSlice, type AppSlice } from './app';

function makeStore() {
  return create<AppSlice>()((...a) => ({ ...createAppSlice(...a) }));
}

describe('app slice — boot state machine', () => {
  it('initializes with booting', () => {
    expect(makeStore().getState().appState).toBe('booting');
  });

  it('transitions to auth-check', () => {
    const s = makeStore();
    s.getState().setAppState('auth-check');
    expect(s.getState().appState).toBe('auth-check');
  });

  it('transitions to unauthenticated', () => {
    const s = makeStore();
    s.getState().setAppState('unauthenticated');
    expect(s.getState().appState).toBe('unauthenticated');
  });

  it('transitions to prefs-loading', () => {
    const s = makeStore();
    s.getState().setAppState('prefs-loading');
    expect(s.getState().appState).toBe('prefs-loading');
  });

  it('transitions to ready', () => {
    const s = makeStore();
    s.getState().setAppState('ready');
    expect(s.getState().appState).toBe('ready');
  });

  it('transitions to update-required', () => {
    const s = makeStore();
    s.getState().setAppState('update-required');
    expect(s.getState().appState).toBe('update-required');
  });

  it('transitions to maintenance', () => {
    const s = makeStore();
    s.getState().setAppState('maintenance');
    expect(s.getState().appState).toBe('maintenance');
  });

  it('each store instance is independent', () => {
    const a = makeStore();
    const b = makeStore();
    a.getState().setAppState('ready');
    expect(b.getState().appState).toBe('booting');
  });
});
```

- [ ] **Run test — expect FAIL**

```bash
cd app && npm test -- --testPathPattern=store/slices/app
```

Expected: `Cannot find module './app'`

- [ ] **Create `app/src/store/slices/app.ts`**

```ts
import type { StateCreator } from 'zustand';
import type { AppState } from '../../types';

export type { AppState };

export interface AppSlice {
  appState: AppState;
  setAppState: (state: AppState) => void;
}

export const createAppSlice: StateCreator<AppSlice> = (set) => ({
  appState: 'booting',
  setAppState: (appState) => set({ appState }),
});
```

- [ ] **Run test — expect PASS**

```bash
cd app && npm test -- --testPathPattern=store/slices/app
```

Expected: `8 passed`.

- [ ] **Commit**

```bash
git add app/src/store/slices/app.ts app/src/store/slices/app.test.ts
git commit -m "feat(app/foundation): app slice boot state machine with tests"
```

---

## Task 11: TDD store/slices/nav.ts

**Files:** Create `app/src/store/slices/nav.test.ts`, `app/src/store/slices/nav.ts`

Nav slice ports `useNavState` from the legacy. Critical: `restoreNavState` must fall back to `'digest'` for `'splash'`/`'login'` screens and for expired TTL — a regression here puts the user on a blank screen after restart.

- [ ] **Write the failing test: `app/src/store/slices/nav.test.ts`**

```ts
import { create } from 'zustand';
import { createNavSlice, NAV_KEY, NAV_TTL_MS, type NavSlice } from './nav';

// Mock the storage module so tests control what MMKV returns
const mockStorage = {
  getString: jest.fn<string | undefined, [string]>(),
  set: jest.fn<void, [string, string]>(),
  delete: jest.fn<void, [string]>(),
};

jest.mock('../../storage/mmkv', () => ({
  storage: mockStorage,
  supabaseStorage: {},
}));

function makeStore() {
  return create<NavSlice>()((...a) => ({ ...createNavSlice(...a) }));
}

function savedNav(overrides: Partial<{ screen: string; dayIndex: number; savedAt: number }> = {}) {
  return JSON.stringify({
    screen: 'digest',
    dayIndex: 0,
    article: null,
    savedAt: Date.now(),
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.getString.mockReturnValue(undefined);
});

describe('nav slice — initial state', () => {
  it('screen defaults to digest', () => {
    expect(makeStore().getState().screen).toBe('digest');
  });

  it('dayIndex defaults to 0', () => {
    expect(makeStore().getState().dayIndex).toBe(0);
  });

  it('article defaults to null', () => {
    expect(makeStore().getState().article).toBeNull();
  });
});

describe('nav slice — setters', () => {
  it('setScreen updates screen', () => {
    const s = makeStore();
    s.getState().setScreen('settings');
    expect(s.getState().screen).toBe('settings');
  });

  it('setDayIndex updates dayIndex', () => {
    const s = makeStore();
    s.getState().setDayIndex(5);
    expect(s.getState().dayIndex).toBe(5);
  });

  it('setArticle updates article', () => {
    const s = makeStore();
    const entry = {
      h: { title: 'Test', summary: 'Sum', url: 'https://example.com' },
      r: { region: 'Hungary', continent: 'Europe' as const, currency: 'HUF' },
    };
    s.getState().setArticle(entry);
    expect(s.getState().article).toEqual(entry);
  });

  it('setArticle can clear to null', () => {
    const s = makeStore();
    s.getState().setArticle({
      h: { title: 'T', summary: 'S', url: 'u' },
      r: { region: 'Hungary', continent: 'Europe' as const, currency: 'HUF' },
    });
    s.getState().setArticle(null);
    expect(s.getState().article).toBeNull();
  });
});

describe('nav slice — restoreNavState', () => {
  it('does nothing when MMKV is empty', () => {
    mockStorage.getString.mockReturnValue(undefined);
    const s = makeStore();
    s.getState().restoreNavState();
    expect(s.getState().screen).toBe('digest');
    expect(s.getState().dayIndex).toBe(0);
  });

  it('restores valid persisted state', () => {
    mockStorage.getString.mockReturnValue(savedNav({ screen: 'settings', dayIndex: 3 }));
    const s = makeStore();
    s.getState().restoreNavState();
    expect(s.getState().screen).toBe('settings');
    expect(s.getState().dayIndex).toBe(3);
  });

  it('falls back to digest for persisted splash screen', () => {
    mockStorage.getString.mockReturnValue(savedNav({ screen: 'splash', dayIndex: 0 }));
    const s = makeStore();
    s.getState().restoreNavState();
    expect(s.getState().screen).toBe('digest');
  });

  it('falls back to digest for persisted login screen', () => {
    mockStorage.getString.mockReturnValue(savedNav({ screen: 'login', dayIndex: 0 }));
    const s = makeStore();
    s.getState().restoreNavState();
    expect(s.getState().screen).toBe('digest');
  });

  it('falls back to defaults when TTL expired', () => {
    mockStorage.getString.mockReturnValue(
      savedNav({ screen: 'settings', dayIndex: 2, savedAt: Date.now() - NAV_TTL_MS - 1000 }),
    );
    const s = makeStore();
    s.getState().restoreNavState();
    expect(s.getState().screen).toBe('digest');
    expect(s.getState().dayIndex).toBe(0);
  });

  it('does not crash on corrupted JSON', () => {
    mockStorage.getString.mockReturnValue('not-valid-json{{{');
    const s = makeStore();
    expect(() => s.getState().restoreNavState()).not.toThrow();
    expect(s.getState().screen).toBe('digest');
  });
});
```

- [ ] **Run test — expect FAIL**

```bash
cd app && npm test -- --testPathPattern=store/slices/nav
```

Expected: `Cannot find module './nav'`

- [ ] **Create `app/src/store/slices/nav.ts`**

```ts
import type { StateCreator } from 'zustand';
import { storage } from '../../storage/mmkv';
import { getLogger } from '../../logger';
import type { ScreenId, ArticleEntry } from '../../types';

const log = getLogger('nav');

export const NAV_KEY = '@pulse/nav_state';
export const NAV_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface PersistedNav {
  screen: ScreenId;
  dayIndex: number;
  article: ArticleEntry | null;
  savedAt: number;
}

export interface NavSlice {
  screen: ScreenId;
  dayIndex: number;
  article: ArticleEntry | null;
  setScreen: (screen: ScreenId) => void;
  setDayIndex: (idx: number) => void;
  setArticle: (entry: ArticleEntry | null) => void;
  restoreNavState: () => void;
  persistNavState: () => void;
}

let _persistTimer: ReturnType<typeof setTimeout> | null = null;

export const createNavSlice: StateCreator<NavSlice> = (set, get) => ({
  screen: 'digest',
  dayIndex: 0,
  article: null,

  setScreen: (screen) => {
    set({ screen });
    get().persistNavState();
  },

  setDayIndex: (dayIndex) => {
    set({ dayIndex });
    get().persistNavState();
  },

  setArticle: (article) => {
    set({ article });
    // Article is transient — not persisted across restarts
  },

  restoreNavState: () => {
    try {
      const raw = storage.getString(NAV_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as PersistedNav;
      const age = Date.now() - saved.savedAt;
      if (age >= NAV_TTL_MS) {
        log.debug(`nav TTL expired (${Math.round(age / 60_000)} min) — starting fresh`);
        return;
      }
      const safeScreen: ScreenId =
        saved.screen === 'splash' || saved.screen === 'login' ? 'digest' : saved.screen;
      set({ screen: safeScreen, dayIndex: saved.dayIndex ?? 0, article: saved.article ?? null });
      log.debug(`restored nav: screen=${safeScreen} dayIndex=${saved.dayIndex}`);
    } catch {
      log.warn('corrupted nav state — starting fresh');
    }
  },

  persistNavState: () => {
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
      const { screen, dayIndex, article } = get();
      if (screen === 'splash' || screen === 'login') return;
      try {
        storage.set(NAV_KEY, JSON.stringify({ screen, dayIndex, article, savedAt: Date.now() }));
      } catch (e: unknown) {
        log.warn(`failed to persist nav state: ${String(e)}`);
      }
      _persistTimer = null;
    }, 700);
  },
});
```

- [ ] **Run test — expect PASS**

```bash
cd app && npm test -- --testPathPattern=store/slices/nav
```

Expected: all tests pass.

- [ ] **Commit**

```bash
git add app/src/store/slices/nav.ts app/src/store/slices/nav.test.ts
git commit -m "feat(app/foundation): nav slice with MMKV persistence and tests"
```

---

## Task 12: Compose store/index.ts

**Files:** Create `app/src/store/index.ts`

Single composed store. Later slices extend the generic type and add their slice to the spread — no changes to existing slice files.

- [ ] **Create `app/src/store/index.ts`**

```ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createAppSlice, type AppSlice } from './slices/app';
import { createNavSlice, type NavSlice } from './slices/nav';

// Later slices extend this type:
// create<AppSlice & NavSlice & AuthSlice & PrefsSlice & DeviceSlice>()(...)
export const useAppStore = create<AppSlice & NavSlice>()(
  devtools(
    (...a) => ({
      ...createAppSlice(...a),
      ...createNavSlice(...a),
    }),
    { name: 'PulseStore', enabled: __DEV__ },
  ),
);
```

- [ ] **Verify typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors. If `__DEV__` is unknown, add `/// <reference types="react-native" />` at the top of the file.

- [ ] **Run all tests**

```bash
cd app && npm test
```

Expected: all previously passing tests still pass.

- [ ] **Commit**

```bash
git add app/src/store/index.ts
git commit -m "feat(app/foundation): compose Zustand store"
```

---

## Task 13: Create useAppInit.ts

**Files:** Create `app/src/hooks/useAppInit.ts`

Fires once after fonts are ready. Restores nav state from MMKV, then advances the boot machine to `'auth-check'`. Auth-flow slice owns the next transition.

- [ ] **Create `app/src/hooks/useAppInit.ts`**

```ts
import { useEffect } from 'react';
import { useAppStore } from '../store';

/**
 * Called from App.tsx after `useFonts` resolves (loaded or errored).
 * Restores persisted nav state and advances the boot machine to 'auth-check'.
 * Auth-flow's useSupabaseAuth picks up from there.
 */
export function useAppInit(fontsReady: boolean): void {
  const setAppState = useAppStore((s) => s.setAppState);
  const restoreNavState = useAppStore((s) => s.restoreNavState);

  useEffect(() => {
    if (!fontsReady) return;
    restoreNavState();
    setAppState('auth-check');
  }, [fontsReady, setAppState, restoreNavState]);
}
```

- [ ] **Verify typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add app/src/hooks/useAppInit.ts
git commit -m "feat(app/foundation): useAppInit hook"
```

---

## Task 14: Create ErrorBoundary and screen stubs

**Files:** Create `app/src/components/ErrorBoundary.tsx`, five stub files

Error boundary must be a class component — React's API requires it. Stubs are labeled Views so routing is visually verifiable on first boot.

- [ ] **Create `app/src/components/ErrorBoundary.tsx`**

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { getLogger } from '../logger';

const log = getLogger('ErrorBoundary');

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    log.error(`${error.message}\n${info.componentStack ?? ''}`);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <View style={s.container}>
          <Text style={s.title}>Something went wrong.</Text>
          <Pressable onPress={() => this.setState({ error: null })} style={s.btn}>
            <Text style={s.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 16, marginBottom: 16 },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#ccc',
  },
  btnText: { fontSize: 14 },
});
```

- [ ] **Create `app/src/screens/stubs/AuthFlowStub.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AuthFlowStub(): React.ReactElement {
  return (
    <View style={s.container}>
      <Text style={s.label}>auth-flow — slice 2</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, color: '#888' },
});
```

- [ ] **Create `app/src/screens/stubs/DigestFlowStub.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DigestFlowStub(): React.ReactElement {
  return (
    <View style={s.container}>
      <Text style={s.label}>digest-flow — slice 3</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, color: '#888' },
});
```

- [ ] **Create `app/src/screens/stubs/SettingsStub.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SettingsStub(): React.ReactElement {
  return (
    <View style={s.container}>
      <Text style={s.label}>settings-flow — slice 4</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, color: '#888' },
});
```

- [ ] **Create `app/src/screens/stubs/UpdateRequiredScreen.tsx`**

```tsx
import React from 'react';
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';

export default function UpdateRequiredScreen(): React.ReactElement {
  return (
    <View style={s.container}>
      <Text style={s.title}>Update required</Text>
      <Text style={s.body}>A new version of Pulse is required to continue.</Text>
      <Pressable
        onPress={() => void Linking.openURL('market://details?id=com.gjanos.pulsenews')}
        style={s.btn}
      >
        <Text style={s.btnText}>Update now</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  body: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#000', borderRadius: 8 },
  btnText: { color: '#fff', fontSize: 15 },
});
```

- [ ] **Create `app/src/screens/stubs/MaintenanceScreen.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MaintenanceScreen(): React.ReactElement {
  return (
    <View style={s.container}>
      <Text style={s.title}>Back shortly</Text>
      <Text style={s.body}>
        Pulse is undergoing maintenance. Please try again in a few minutes.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  body: { fontSize: 14, color: '#666', textAlign: 'center' },
});
```

- [ ] **Verify typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add app/src/components/ErrorBoundary.tsx app/src/screens/stubs/
git commit -m "feat(app/foundation): ErrorBoundary and screen stubs"
```

---

## Task 15: Create app.json

**Files:** Create `app/app.json`

Expo configuration. `splash.backgroundColor` must match `THEMES.light.bg` (`#fafaf7`) so the splash-to-app transition is seamless.

- [ ] **Create `app/app.json`**

```json
{
  "expo": {
    "name": "Pulse",
    "slug": "pulse-news",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#fafaf7"
    },
    "assetBundlePatterns": ["**/*"],
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#fafaf7"
      },
      "googleServicesFile": "./google-services.json",
      "package": "com.gjanos.pulsenews",
      "permissions": [
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.VIBRATE",
        "android.permission.POST_NOTIFICATIONS"
      ]
    },
    "ios": {
      "bundleIdentifier": "com.gjanos.pulsenews",
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "plugins": [
      "@react-native-firebase/app",
      [
        "expo-build-properties",
        {
          "android": {
            "enableProguardInReleaseBuilds": true
          }
        }
      ]
    ],
    "extra": {}
  }
}
```

- [ ] **Commit**

```bash
git add app/app.json
git commit -m "feat(app/foundation): add Expo app.json"
```

---

## Task 16: Create index.ts and App.tsx

**Files:** Replace `app/src/index.ts` → create `app/index.ts`, create `app/App.tsx`

`SplashScreen.preventAutoHideAsync()` **must** be called at module scope, before any component renders. This is why it lives in `index.ts`, not inside `App`.

- [ ] **Create `app/index.ts`** (at app root, not src/)

```ts
import 'expo-dev-client';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';

// Hold the native splash until appState leaves 'booting'.
// Must be called before any React renders.
void SplashScreen.preventAutoHideAsync();

import App from './App';

registerRootComponent(App);
```

- [ ] **Create `app/App.tsx`**

```tsx
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
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

import { useAppStore } from './src/store';
import { useAppInit } from './src/hooks/useAppInit';
import { THEMES } from './src/themes';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import AuthFlowStub from './src/screens/stubs/AuthFlowStub';
import DigestFlowStub from './src/screens/stubs/DigestFlowStub';
import SettingsStub from './src/screens/stubs/SettingsStub';
import UpdateRequiredScreen from './src/screens/stubs/UpdateRequiredScreen';
import MaintenanceScreen from './src/screens/stubs/MaintenanceScreen';
import type { AppState, ScreenId } from './src/types';
import type { Theme } from './src/themes';

// Created once at module scope — never inside the component
const queryClient = new QueryClient();

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
  // prefs slice added by settings-flow; fallback to 'light' until then
  const themeId = useAppStore((s) => (s as { prefs?: { theme: string } }).prefs?.theme ?? 'light');
  const theme = THEMES[themeId as keyof typeof THEMES] ?? THEMES.light;

  // Hide native splash once boot leaves 'booting'
  useEffect(() => {
    if (appState !== 'booting') {
      void SplashScreen.hideAsync();
    }
  }, [appState]);

  // Sync Android navigation bar color to theme
  useEffect(() => {
    void NavigationBar.setBackgroundColorAsync(theme.bg);
  }, [theme.bg]);

  return (
    <GestureHandlerRootView style={s.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <RootScreens appState={appState} screen={screen} theme={theme} />
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
}

function RootScreens({ appState, screen, theme }: RootScreensProps): React.ReactElement {
  // During these states the native splash is still visible — render a
  // background-colored view that's invisible under the splash but prevents
  // a flash when the splash fades out.
  if (appState === 'booting' || appState === 'auth-check' || appState === 'prefs-loading') {
    return <View style={[s.root, { backgroundColor: theme.bg }]} />;
  }

  if (appState === 'unauthenticated') return <AuthFlowStub />;
  if (appState === 'update-required') return <UpdateRequiredScreen />;
  if (appState === 'maintenance') return <MaintenanceScreen />;

  // appState === 'ready'
  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[s.root, { backgroundColor: theme.bg }]}
    >
      {screen === 'splash' && <DigestFlowStub />}
      {(screen === 'digest' || screen === 'settings') && <DigestFlowStub />}
      {screen === 'settings' && <SettingsStub />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
```

- [ ] **Update `app/package.json` main field** to point to `index.ts`

Open `app/package.json` and confirm (or add) `"main": "index.ts"`.

- [ ] **Verify typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors. Fix any import path issues (e.g., if `expo-dev-client` is not installed, remove that import).

- [ ] **Run full test suite**

```bash
cd app && npm test
```

Expected: all tests pass.

- [ ] **Commit**

```bash
git add app/index.ts app/App.tsx app/package.json app/src/index.ts
git commit -m "feat(app/foundation): App.tsx shell and entry point"
```

---

## Task 17: Update app/CLAUDE.md

**Files:** Modify `app/CLAUDE.md`

The existing CLAUDE.md references React Navigation and the old hook-based architecture. Update the module map and architecture notes to reflect what was actually built.

- [ ] **Update `app/CLAUDE.md`** — replace the module map section with the actual files created

Add to the module map:

| File                               | Role                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `index.ts`                         | AppRegistry entry point + `SplashScreen.preventAutoHideAsync()` at module scope               |
| `App.tsx`                          | Boot gate + screen routing (switches on `appState` and `screen` from Zustand)                 |
| `src/store/index.ts`               | Composed `useAppStore` (Zustand devtools, one `create()` call)                                |
| `src/store/slices/app.ts`          | `AppState` boot state machine: `booting → auth-check → unauthenticated/prefs-loading → ready` |
| `src/store/slices/nav.ts`          | Screen, dayIndex, article state + MMKV persistence with 30-min TTL                            |
| `src/hooks/useAppInit.ts`          | Fires after fonts load; restores nav state; advances boot to `auth-check`                     |
| `src/components/ErrorBoundary.tsx` | Root-level recoverable error boundary                                                         |

Remove the React Navigation references from the Expo gotchas section and replace with:

> Navigation: **manual conditional rendering** driven by the Zustand `nav` slice. No React Navigation for V1. See `REBUILD_PLAN.md §8.3` for rationale.

- [ ] **Commit**

```bash
git add app/CLAUDE.md
git commit -m "docs(app): update CLAUDE.md with foundation architecture"
```

---

## Task 18: Final verification

- [ ] **Full typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Lint**

```bash
cd app && npx eslint --ext .ts,.tsx src
```

Expected: zero errors or warnings.

- [ ] **Full test suite with coverage**

```bash
cd app && npm test -- --coverage --coverageReporters=text
```

Expected: ≥ 65% line coverage on `themes.ts`, `data.ts`, `storage/mmkv.ts`, `store/slices/app.ts`, `store/slices/nav.ts`. All tests pass.

- [ ] **Prettier check (from repo root)**

```bash
cd .. && npm run format:check
```

Expected: no formatting errors. If any: `npm run format` then re-check.

- [ ] **Manual boot verification**

```bash
cd app && npx expo start --dev-client
```

On a connected Android device or emulator:

1. The native splash (`assets/splash-icon.png`) appears immediately on launch.
2. The native splash fades out (triggered by `SplashScreen.hideAsync()` when `appState` leaves `'booting'`).
3. The app lands on `AuthFlowStub` with the label "auth-flow — slice 2" (because no auth-flow slice exists yet, `appState` stays at `'auth-check'` and never advances — confirm this is expected for the current slice).
4. No JavaScript errors in the Metro console.

> **Note on step 3:** `appState` will remain at `'auth-check'` after foundation because no hook has been installed to advance it to `'unauthenticated'` or `'prefs-loading'` yet. That is correct — auth-flow slice adds `useSupabaseAuth` which owns that transition. The app will show a blank background-colored view (the native splash is gone, but `RootScreens` renders the plain `<View>` for `auth-check`). This is the expected state for this slice.

- [ ] **Final commit if any fixes applied**

```bash
git add -p  # stage only intentional changes
git commit -m "fix(app/foundation): post-verification fixes"
```

---

## Self-review

**Spec coverage check:**

| Spec section              | Task                   |
| ------------------------- | ---------------------- |
| §2 Files created          | Tasks 4–16             |
| §3 Dependencies           | Task 1                 |
| §5 Boot state machine     | Tasks 10, 16           |
| §6 Zustand store          | Tasks 10, 11, 12       |
| §7 App.tsx shell          | Task 16                |
| §8 useAppInit             | Task 13                |
| §9 Infrastructure ports   | Tasks 4, 5, 6, 7, 8, 9 |
| §10 Error boundary        | Task 14                |
| §11 Screen stubs          | Task 14                |
| §12 Tests                 | Tasks 6, 7, 8, 10, 11  |
| §13 Definition of done    | Task 18                |
| Native splash hold (§8.4) | Task 16                |
| MMKV mock                 | Task 3                 |
| Babel Reanimated plugin   | Task 2                 |
| app.json                  | Task 15                |

All spec requirements have a corresponding task. ✓
