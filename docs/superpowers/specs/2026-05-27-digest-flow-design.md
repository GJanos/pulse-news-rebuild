# app/digest-flow — Design Spec

Date: 2026-05-27
Author: Janos Gorondi
Status: Approved

---

## 1. Goal

Port the digest display layer from the legacy codebase (`DigestPager`, `DigestPage`, section
components, data hooks, storage layer) using the rebuild's modern stack — React Query v5 for
data fetching, Zustand selectors for shared state, Reanimated v4 throughout — while preserving
all behavioral contracts exactly. One intentional improvement: currency stale window reduced to
5 minutes (from 1 hour) with forced refresh support.

Legacy reference files:

- `app/src/components/DigestPager.tsx`
- `app/src/components/DigestPage.tsx`
- `app/src/components/GlobalSection.tsx`
- `app/src/components/RegionSection.tsx`
- `app/src/components/Flag.tsx`
- `app/src/components/JumpModal.tsx`
- `app/src/hooks/useDigest.ts`
- `app/src/hooks/useGlobalHeadlines.ts`
- `app/src/hooks/useCurrencyRates.ts`
- `app/src/hooks/useDigestPageData.ts`
- `app/src/hooks/useJumpTargets.ts`
- `app/src/hooks/useSlideIn.ts`
- `app/src/hooks/useForcedEffect.ts`
- `app/src/hooks/useNavState.ts` (behavior already in nav slice)
- `app/src/storage/digests.ts`
- `app/App.tsx` (partial — QueryClientProvider, DigestPager wiring, BackHandler)

---

## 2. Architecture

### 2.1 Layer overview

```
App.tsx
└── QueryClientProvider
    └── GestureHandlerRootView
        └── DigestPager          ← RNGH v2 pan + Reanimated v4 spring
            └── DigestPage[]     ← FlatList, ±WINDOW=1 preload
                ├── GlobalSection
                └── RegionSection[]

Zustand store
├── app slice    (boot state machine)
├── auth slice   (session)
├── nav slice    (screen, dayIndex, article — MMKV persisted)
└── prefs slice  (UserPreferences defaults — persistence added in settings-flow)

React Query cache
├── ['digest', date, regionsKey]
├── ['global', date]
└── ['currency', baseCurrency]

storage/digests.ts   ← MMKV + Supabase, unchanged from legacy
```

### 2.2 What's removed vs legacy

| Legacy pattern                     | Replacement                                               |
| ---------------------------------- | --------------------------------------------------------- |
| Module-level `Map` caches in hooks | React Query in-memory cache                               |
| `useForcedEffect` hook             | `forcedRef` + `query.refetch()`                           |
| Prop drilling `t`, `theme`, `aes`  | Zustand store selectors in each component                 |
| `digestPrefs` freeze in App.tsx    | Eliminated — Zustand selectors prevent cascade re-renders |
| `Animated.Value` in JumpModal      | Reanimated `useSharedValue` + `useAnimatedStyle`          |
| `useNavState` hook                 | Already in nav slice from foundation slice                |

---

## 3. File Map

| Action | Path                                   | Responsibility                                      |
| ------ | -------------------------------------- | --------------------------------------------------- |
| Create | `app/src/storage/digests.ts`           | MMKV + Supabase cache layer — ported exactly        |
| Create | `app/src/hooks/useDigest.ts`           | React Query wrapper over `loadDailyDigest`          |
| Create | `app/src/hooks/useGlobalHeadlines.ts`  | React Query wrapper over `loadGlobalHeadlines`      |
| Create | `app/src/hooks/useCurrencyRates.ts`    | React Query wrapper, staleTime 5 min                |
| Create | `app/src/hooks/useDigestPageData.ts`   | Assembles visible buckets — logic ported exactly    |
| Create | `app/src/hooks/useJumpTargets.ts`      | FlatList ref + `scrollToItem` — ported as-is        |
| Create | `app/src/hooks/useSlideIn.ts`          | Reanimated v4 slide-in                              |
| Create | `app/src/components/DigestPager.tsx`   | Horizontal pan pager — ported as-is                 |
| Create | `app/src/components/DigestPage.tsx`    | FlatList page, FlatList-optimized, prefs from store |
| Create | `app/src/components/GlobalSection.tsx` | Global headlines, `React.memo`, theme from store    |
| Create | `app/src/components/RegionSection.tsx` | Region headlines + currency, `React.memo`           |
| Create | `app/src/components/Flag.tsx`          | Country flag SVG — ported as-is                     |
| Create | `app/src/components/JumpModal.tsx`     | Jump modal, Reanimated animation                    |
| Create | `app/src/store/slices/prefs.ts`        | Default `UserPreferences` stub, no persistence      |
| Modify | `app/src/store/index.ts`               | Add `PrefsSlice`                                    |
| Modify | `app/App.tsx`                          | `QueryClientProvider`, `DigestPager`, BackHandler   |

**Not in this slice:** `Stepper`, `useSwipe`, `usePreferences`, `storage/preferences.ts`,
`SettingsScreen`, `ArticleScreen`, `notifications/register.ts`, `useDeviceRegistration`.

---

## 4. Data Layer

### 4.1 storage/digests.ts

Ported exactly from legacy. No changes to:

- MMKV key scheme: `pulse.digest.v1::DATE::REGION`, `pulse.global.v1::DATE`
- Stale-window logic (cache-first for today, immutable for past)
- Offline fallback (stale MMKV served when Supabase returns empty)
- `trimLocalCache` (drops entries older than `historyDays`)
- Supabase query shape (`digests` table, `payload JSONB`)

Public API exported: `loadDailyDigest`, `loadGlobalHeadlines`, `saveLocalRegionDigest`,
`trimLocalCache`, `fetchRemoteDigestsForDate`.

### 4.2 useDigest

```ts
queryKey: ['digest', date, regionsKey]; // regionsKey = regions.slice().sort().join('|')
staleTime: date === TODAY_ISO ? staleMinutes * 60_000 : Infinity;
gcTime: 24 * 60 * 60_000;
```

**Behavioral contracts preserved:**

- **Cache-first + stale window (today):** `staleTime` maps 1:1 to legacy `staleMinutes`.
- **Past dates immutable:** `staleTime: Infinity` — React Query never background-refetches.
- **`forceRefresh()`:** Sets `forcedRef.current = true`, then calls `query.refetch()`. The
  `queryFn` reads and resets `forcedRef`, passing `staleMinutes: 0` to `loadDailyDigest` on
  the forced run — same as legacy.
- **10-second timeout:** `queryFn` races `loadDailyDigest` against a 10s `setTimeout`. On
  timeout: if React Query has no prior data for this key, `isError = true`; if MMKV has data
  (served via `initialData` on mount), the component already shows it and `isError` stays
  false — the timeout only surfaces an error on a true cold miss. Matches legacy exactly.
- **Offline fallback:** Handled inside `loadDailyDigest` — no changes needed at hook level.
- **`gcTime: 24h`:** Keeps results in React Query memory after DigestPage unmounts (when
  WINDOW slides past), so swipe-back restores instantly without a spinner.

### 4.3 useGlobalHeadlines

Same pattern as `useDigest`. Additional contract:

- `enabled: false` → `enabled` option passed to `useQuery`; returns `[]` immediately, no fetch.
- `forceRefresh` on a past date → no-op (legacy behavior: only today supports forced refresh).

```ts
queryKey: ['global', date];
staleTime: date === TODAY_ISO ? staleMinutes * 60_000 : Infinity;
gcTime: 24 * 60 * 60_000;
enabled: enabled;
```

### 4.4 useCurrencyRates

**Intentional behavior improvement (approved):**

```ts
queryKey: ['currency', baseCurrency];
staleTime: 5 * 60_000; // 5 minutes (legacy: 60 minutes)
gcTime: 60 * 60_000;
```

`forceRefresh()` added via `forcedRef` + `refetch()`. DigestPage includes currency refetch as
part of its `forceRefresh` handle (pull-to-refresh also refreshes currency).

Returns `{}` on fetch error — no error thrown to caller (same graceful degradation as legacy).

### 4.5 useDigestPageData

Pure computation hook — logic ported exactly from legacy:

- Filters `digest.regions` by `selectedRegions` from prefs store selector
- Orders by `sortedSelectedRegions` (user's region order)
- Assembles `VisibleBucket[]`, `visibleGlobalHeadlines`, `hasGlobal`, `totalHeadlines`
- No behavioral changes

### 4.6 Deleted: useForcedEffect

Existed only to provide `refreshKey` / `consumeForced` / `forceRefresh`. Replaced entirely by
React Query's `refetch()` + `forcedRef` pattern.

---

## 5. Components

### 5.1 DigestPager

Ported as-is — legacy already uses RNGH v2 (`Gesture.Pan()`) and Reanimated v4.

Preserved exactly:

- Spring: `{ damping: 28, stiffness: 220, mass: 0.9 }`
- WINDOW = 1 (±1 slot around active page is mounted)
- `txFor` layout formula (oldest page at left, today at right)
- `skipNextSpring` ref pattern (prevents double-spring on gesture commit)
- `DigestPageHandle` ref array via `usePageRefs`

Props simplified: `t`, `theme`, `aes` removed. DigestPager reads `theme` and `aes` from store
selectors. `dayIndex` and `setDayIndex` remain as props (owned by nav slice, passed from App.tsx).

### 5.2 DigestPage

Props: `{ dayIndex: number; active: boolean; onOpenArticle: (h, r) => void }`

Reads from store internally:

- `prefs` via selector (`selectedRegions`, `historyDays`, `digestStaleMins`, `globalEnabled`, `notifyTime`)
- `theme`, `aes` via selectors

`DigestPageHandle` interface preserved:

- `forceRefresh()` — invalidates and refetches `useDigest`, `useGlobalHeadlines`, `useCurrencyRates`
- `openJumpModal()` — sets `jumpOpen = true`

FlatList optimizations added:

- `removeClippedSubviews` (Android performance)
- `maxToRenderPerBatch={8}`
- `windowSize={5}`
- `renderItem` in `useCallback`
- `keyExtractor` stable (region string for buckets, `'__global__'` for global)

### 5.3 GlobalSection / RegionSection

Both `React.memo`'d. Read `theme` and `aes` from store selectors — no longer accept them as
props. `RegionSection` still accepts `currencyRate` as a prop (per-region data from the currency
query result map).

### 5.4 Flag

Ported as-is.

### 5.5 JumpModal

`panelAnim: Animated.Value` removed from props. Animation owned internally:

```ts
const opacity = useSharedValue(0);
// on open prop change:
useEffect(() => {
  opacity.value = withTiming(open ? 1 : 0, { duration: 180 });
}, [open]);
const animStyle = useAnimatedStyle(() => ({
  opacity: opacity.value,
  transform: [{ translateY: interpolate(opacity.value, [0, 1], [16, 0]) }],
}));
```

Same visual result as legacy (fade + 16px translateY). Caller no longer manages `panelAnim`.

---

## 6. Store

### 6.1 prefs slice (new)

Default `UserPreferences` matching legacy `DEFAULT_PREFERENCES` exactly. No MMKV reads or
writes in this slice. Settings-flow will add a `hydratePrefs(prefs)` action and the persistence
layer.

Exports:

- `PrefsSlice` interface
- `createPrefsSlice` StateCreator
- `DEFAULT_PREFERENCES` constant (used in tests)

### 6.2 store/index.ts change

Add `PrefsSlice` to combined store type. Add `createPrefsSlice` to `create()(...)` call.

---

## 7. App.tsx Changes

```tsx
// Added at module level (outside component):
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

// Wrap tree:
<QueryClientProvider client={queryClient}>
  <GestureHandlerRootView>...</GestureHandlerRootView>
</QueryClientProvider>;

// Replace DigestFlowStub with real DigestPager:
const activePageRef = useRef<DigestPageHandle | null>(null);
// (screen === 'digest' || screen === 'settings') && <DigestPager ... activePageRef={activePageRef} />

// BackHandler effect (inline in App.tsx, not in a hook):
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

// digestPrefs freeze: DELETED
```

---

## 8. Testing

Coverage targets: 75%+ on storage and hooks; 60%+ on components.

### 8.1 storage/digests.test.ts

- Today, all regions fresh → Supabase not called
- Today, 2 of 5 regions stale → only stale regions fetched from Supabase
- Today, all missing → all fetched, written to MMKV
- Today, Supabase returns empty → stale MMKV served (offline fallback)
- Today, Supabase error → stale MMKV served
- Past date, cache hit → immutable, no Supabase call
- Past date, cache miss → Supabase fetched, written through
- `saveLocalRegionDigest` write + read roundtrip
- `trimLocalCache`: entry on exact cutoff date kept; day before dropped
- Supabase JSONB payload parsing: `payload.headlines` extracted correctly
- `loadGlobalHeadlines`: same stale/miss/offline variants

### 8.2 useDigest.test.ts

- Mounts with fresh MMKV data → no loading state
- `staleTime` expired → background refetch triggered
- `forceRefresh()` → queryFn called with `staleMinutes: 0`
- Timeout fires, no prior cache → `isError = true`
- Timeout fires, stale cache exists → stale data shown, `isError = false`
- `regionsKey` changes → new query key, new fetch
- Unmount during fetch → no state updates

### 8.3 useGlobalHeadlines.test.ts

- `enabled: false` → `[]` returned, no fetch
- `enabled` toggled true → fetch fires
- `forceRefresh` on past date → no-op
- Stale window respected for today

### 8.4 useDigestPageData.test.ts

- Filters by `selectedRegions`
- Preserves `sortedSelectedRegions` order
- Region in prefs but missing from digest → excluded from visible
- Empty digest → `visible = []`, `totalHeadlines = 0`
- `globalEnabled = false` → `hasGlobal = false`, `visibleGlobalHeadlines = []`
- Counts `totalHeadlines` correctly across all buckets

### 8.5 useCurrencyRates.test.ts

- `staleTime` 5 minutes (not 1 hour)
- `forceRefresh()` triggers refetch
- Fetch error → returns `{}`
- Multiple base currencies don't share cache entries

### 8.6 Component tests (behavioral states)

**DigestPage:**

- Spinner shown when `isLoading = true`
- Error state + retry button when `isError = true`
- Empty state when digest loaded but no visible regions
- Loaded state renders FlatList

**JumpModal:**

- Renders region list from `visible` prop
- Global row absent when `hasGlobal = false`
- Calls `jumpTo('__global__')` when Global pressed
- Calls `jumpTo(region)` with correct region key

---

## 9. Behavioral Regression Notes

All of these legacy behaviors must pass end-to-end:

1. Swipe right → older day, spring animates, date in header updates immediately (not after spring settles)
2. Pull-to-refresh on today's page → forced remote fetch bypassing MMKV stale window
3. Notification tap → `activePageRef.current.forceRefresh()` called, page updates
4. FCM navigates to today → `dayIndex` set to 0, spring animates
5. Past date → no network call after first load in session
6. Settings open → DigestPager stays mounted behind SettingsScreen (both rendered simultaneously)
7. Hardware back from settings → returns to digest
8. Hardware back with article open → closes article, stays on digest
9. `dayIndex === 0` = today; positive values = older days
10. ±WINDOW=1: only 3 DigestPage instances mounted at most

---
