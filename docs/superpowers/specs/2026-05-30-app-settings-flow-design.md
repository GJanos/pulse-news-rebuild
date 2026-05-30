# app/settings-flow — Slice 4 Design

Date: 2026-05-30  
Author: Janos Gorondi  
Status: Approved — ready for implementation plan

---

## Overview

Slice 4 ports the legacy settings surface into the rebuild. It replaces `SettingsStub` with the real `SettingsScreen`, wires up preference persistence (MMKV + Supabase sync), and eliminates the prop-drilling that the legacy used to pass prefs through the tree.

Legacy reference files:

- `pulse-news-legacy/app/src/screens/SettingsScreen.tsx`
- `pulse-news-legacy/app/src/hooks/usePreferences.ts`
- `pulse-news-legacy/app/src/storage/preferences.ts`
- `pulse-news-legacy/app/src/components/RegionPicker.tsx`
- `pulse-news-legacy/app/src/components/Stepper.tsx`

Behavioral constraint: same inputs → same outputs. Algorithm and UI changes are out of scope.

---

## Key decisions

### D1 — Flush ownership: hook (not store)

`setPref` in the Zustand store updates state only. The `usePreferences` hook owns dirty tracking, the 900ms debounce timer, and the AppState background listener. The store stays pure state + actions.

### D2 — `notificationsEnabled`: device slice stub

`SettingsScreen` shows a "Notifications disabled — tap to open system settings" banner when `notificationsEnabled` is `false`. The real value comes from `useDeviceRegistration` (slice 6). Slice 4 adds a `DeviceSlice` stub with `notificationsEnabled: false` so the banner is visible and testable immediately. Slice 6 calls `setNotificationsEnabled(true)` after FCM registration. **Never hardcode `true`.**  
Documented in REBUILD_PLAN.md §7 cross-slice dependency notes.

### D3 — SettingsScreen prop surface: 2 auth callbacks only

`prefs`, `setPref`, `theme`, `aes`, `userEmail`, `notificationsEnabled`, and `onBack` all move off the prop surface — read from the store instead. Only `onLogout` and `onDeleteAccount` remain as props: they are complex async auth operations that belong in the auth layer, not the store.

### D4 — Flush on settings exit

The legacy called `flush()` explicitly in `onBack`. With flush living in the hook, `usePreferences` instead watches `screen` from the store and calls flush immediately when transitioning away from `settings`. No prop needed, same guarantee.

---

## Section 1 — Store changes

### `store/slices/prefs.ts` — add `setPref`

Add a single-key setter alongside the existing `setPrefs`:

```ts
setPref: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
```

Implementation: `set(s => ({ prefs: { ...s.prefs, [key]: value, updatedAt: new Date().toISOString() } }))`.

`DEFAULT_PREFERENCES` moves out of this file into `storage/preferences.ts` (single source of truth). The slice imports it from there.

### `store/slices/device.ts` — new stub slice

```ts
interface DeviceSlice {
  notificationsEnabled: boolean; // false; slice 6 sets true after FCM
  setNotificationsEnabled: (v: boolean) => void;
}
```

### `store/index.ts` — compose DeviceSlice

Add `DeviceSlice` to the composed store type and the `create` call, same pattern as the existing four slices.

---

## Section 2 — Storage layer

**`app/src/storage/preferences.ts`** — new file, ported verbatim from legacy.

Exports:

- `DEFAULT_PREFERENCES` — canonical default, imported by `slices/prefs.ts`
- `loadLocalPreferences()` — reads MMKV key `pulse.preferences.v1`; merges result with `DEFAULT_PREFERENCES` to backfill any missing fields added since the cached version was written; returns `UserPreferences | null` (null on miss or parse failure)
- `saveLocalPreferences(prefs)` — stringifies and writes to MMKV
- `pullRemotePreferences(userId)` — `SELECT preferences, updated_at FROM user_preferences WHERE user_id = ?`; returns `UserPreferences | null`
- `pushRemotePreferences(userId, prefs)` — upserts on `user_id`; throws on Supabase error so callers can log/retry
- `resolveConflict(local, remote)` — last-write-wins by `updatedAt`; both null → `DEFAULT_PREFERENCES`
- `syncPreferences(userId)` — pulls remote, resolves conflict, saves winner locally if remote won, pushes to remote if local won; returns winning `UserPreferences`

---

## Section 3 — `usePreferences` hook

**`app/src/hooks/usePreferences.ts`** — replaces `usePrefsInit.ts` (old file deleted, `App.tsx` import updated).

Pure store writer — returns nothing.

### Hydration (on mount)

1. Call `loadLocalPreferences()`
2. Call `store.setPrefs(local ?? DEFAULT_PREFERENCES)`
3. Call `store.setAppState('ready')` — transitions boot machine out of `prefs-loading`

### Background Supabase sync (after hydration, if `userId` present)

1. Call `syncPreferences(userId)`
2. If not cancelled, call `store.setPrefs(winner)`

`userId` is `useAppStore(s => s.session?.user.id)`. Re-runs when `userId` changes (user switches accounts).

### Dirty tracking + debounced flush

`useEffect` watching `store.prefs`:

- Sets `dirtyRef.current = true`
- Cancels any pending timer
- Schedules `setTimeout(flush, 900)` where `flush` calls `saveLocalPreferences(prefs)` and, if `userId` is present, `pushRemotePreferences(userId, prefs)`
- On unmount: clears timer, calls `flush()` immediately if dirty

### Flush on settings exit

`useEffect` watching `store.screen`:

- When screen transitions away from `'settings'`, calls `flush()` immediately if dirty (D4)

### AppState background flush

`AppState.addEventListener('change', ...)`:

- On `background` or `inactive`: calls `flush()` immediately if dirty

---

## Section 4 — New components

### `app/src/components/Stepper.tsx`

Ported verbatim from legacy. Pure presentational, no store dependency.

Two variants controlled by the `icons` prop:

- **Text variant** (default): `−` / `+` text buttons, optional `suffix` label
- **Icon variant**: `PulseIcon` minus/plus buttons, optional `valueColor` override

Uses `react-native-pressable-scale`. Verify package is in `app/package.json`; add if missing.

Props: `{ theme, aes, value, min, max, onChange, suffix?, icons?, valueColor? }`

### `app/src/components/RegionPicker.tsx`

Ported from legacy with prop surface removed — reads from and writes to the store directly.

```ts
// Zero props — was 8 props in legacy
export default function RegionPicker(): React.ReactElement;
```

Store reads:

- `selectedRegions`, `headlineCount`, `regionHeadlineCounts` ← `useAppStore(s => s.prefs.*)`
- `setPref` ← `useAppStore(s => s.setPref)`
- `theme`, `aes` ← derived from `prefs.theme` / `prefs.aesthetic` via `THEMES` / `AESTHETICS`

All internal logic ported exactly: `orderedRegions` local state, three modes (`normal` / `reorder` / `tune`), `LayoutAnimation`, `toggleRegion`, `moveRegion`, `jumpRegion`, All/None, per-region count overrides. Same behavior, same outputs.

The `useEffect` reconciling `orderedRegions` when `selectedRegions` changes watches the store value instead of a prop — same effect, same behavior.

---

## Section 5 — `SettingsScreen`

**`app/src/screens/SettingsScreen.tsx`** — new file replacing `stubs/SettingsStub.tsx`.

### Props (2, down from 8)

```ts
interface Props {
  onLogout: () => void;
  onDeleteAccount: () => Promise<string | null>;
}
```

### Store reads

| Value                  | Source                                             |
| ---------------------- | -------------------------------------------------- |
| `prefs`                | `useAppStore(s => s.prefs)`                        |
| `setPref`              | `useAppStore(s => s.setPref)`                      |
| `theme`                | `THEMES[prefs.theme]`                              |
| `aes`                  | `AESTHETICS[prefs.aesthetic]`                      |
| `userEmail`            | `useAppStore(s => s.session?.user.email ?? '')`    |
| `notificationsEnabled` | `useAppStore(s => s.notificationsEnabled)`         |
| `onBack` (internal)    | `() => useAppStore.getState().setScreen('digest')` |

### Sub-components (file-local, unchanged from legacy)

`Group`, `Row`, `SegRow<V>`, `NotifyTimePicker`, `CurrencyPicker`

`RegionPicker` and `Stepper` imported from `components/`.

### Sections ported (identical to legacy)

Account · Notification (time picker + disabled banner) · Global Headlines · Regions (RegionPicker) · Reading · Display · Sign out · Delete account · Version footer

---

## Section 6 — `App.tsx` changes

1. **Delete** `usePrefsInit` import; **add** `usePreferences` import and call
2. **Delete** `SettingsStub` import; **add** `SettingsScreen` import
3. **Replace** `<SettingsStub />` with `<SettingsScreen onLogout={...} onDeleteAccount={...} />`
4. **No digestPrefs freeze** — was never added to the rebuild; DigestPager already reads from the store via selectors (landed in slice 3)

`onLogout` and `onDeleteAccount` are forwarded from the `AuthActions` returned by `useAuthInit`, same as the pattern used for `LoginScreen`.

---

## Section 7 — Tests

Target 60–70% line coverage on logic that breaks silently. No snapshot tests on presentation components.

### `tests/storage/preferences.test.ts`

**`resolveConflict`:**

- both null → `DEFAULT_PREFERENCES`
- local null → remote
- remote null → local
- local `updatedAt` newer → local wins
- remote `updatedAt` newer → remote wins
- equal timestamps → local (deterministic)

**`loadLocalPreferences`:**

- MMKV cache hit with full prefs → returns merged object
- MMKV cache hit with partial prefs (missing fields) → missing fields backfilled from defaults
- MMKV cache miss → returns null
- Corrupt JSON in MMKV → returns null, does not throw

**`saveLocalPreferences`:**

- Writes stringified JSON to MMKV under correct key

**`pullRemotePreferences`:**

- No Supabase client → returns null
- Row found → returns prefs merged with defaults
- Row not found (`maybeSingle` returns null) → returns null
- Supabase error → returns null, logs warn

**`pushRemotePreferences`:**

- No Supabase client → resolves silently
- Supabase error → throws with descriptive message

**`syncPreferences`:**

- Remote newer → `saveLocalPreferences` called, remote returned
- Local newer → `pushRemotePreferences` called, local returned
- Both equal → local returned, no extra write

### `tests/store/slices/prefs.test.ts`

- Initial state matches `DEFAULT_PREFERENCES`
- `setPref('theme', 'dark')` changes only `theme`, all other fields unchanged
- `setPref` bumps `updatedAt` to a timestamp strictly after the previous value
- Two sequential `setPref` calls each update their respective fields
- `setPrefs` replaces the entire prefs object

### `tests/store/slices/device.test.ts`

- Initial `notificationsEnabled` is `false`
- `setNotificationsEnabled(true)` sets it to `true`
- `setNotificationsEnabled(false)` after `true` restores `false`

### `tests/hooks/usePreferences.test.ts`

**Hydration:**

- MMKV hit → `setPrefs` called with local prefs; `appState` set to `'ready'`
- MMKV miss → `setPrefs` called with `DEFAULT_PREFERENCES`; `appState` set to `'ready'`
- Both paths transition `appState` regardless of MMKV result

**Supabase sync:**

- With `userId` → `syncPreferences` called; `setPrefs` called with winner
- Without `userId` → `syncPreferences` not called
- Unmount before sync resolves → `setPrefs` not called after cleanup (cancelled flag)
- `userId` changes → sync re-runs for new user

**Dirty flush:**

- `setPref` called → 900ms later `saveLocalPreferences` called exactly once
- Three rapid `setPref` calls → debounced to one `saveLocalPreferences` 900ms after the last call
- `saveLocalPreferences` called with final prefs value, not an intermediate one

**AppState flush:**

- AppState `'background'` with dirty prefs → `saveLocalPreferences` called immediately
- AppState `'inactive'` with dirty prefs → `saveLocalPreferences` called immediately
- AppState `'background'` with clean prefs → `saveLocalPreferences` not called

**Screen transition flush:**

- Screen changes from `'settings'` to `'digest'` with dirty prefs → `saveLocalPreferences` called immediately
- Screen changes from `'digest'` to `'settings'` → no flush triggered

### `tests/components/Stepper.test.ts`

- Decrement at `min` → `onChange` called with `min` (clamped, no underflow)
- Increment at `max` → `onChange` called with `max` (clamped, no overflow)
- Decrement when `value > min` → `onChange` called with `value - 1`
- Increment when `value < max` → `onChange` called with `value + 1`
- Both `icons` and text variants render without error

### `tests/components/RegionPicker.test.ts`

- Tapping an unselected region selects it and moves it into the selected group
- Tapping a selected region deselects it and moves it to the unselected group
- `moveRegion` up when already at index 0 is a no-op
- `moveRegion` down when already at last selected index is a no-op
- `jumpRegion` up moves item to index 0
- `jumpRegion` down moves item to the last selected position
- All button (reorder mode) selects all regions
- None button (reorder mode) deselects all regions
- Per-region count change in tune mode calls `setPref('regionHeadlineCounts', ...)` with correctly merged value

### `tests/screens/SettingsScreen.test.ts`

- `onLogout` prop called when sign-out pressed
- Alert shown on delete account press
- `onDeleteAccount` called after alert confirmation
- Spinner visible while `onDeleteAccount` is in flight
- Error alert shown when `onDeleteAccount` resolves with an error string
- `onDeleteAccount` not called when alert is cancelled

---

## Files changed

| File                                    | Action                                                   |
| --------------------------------------- | -------------------------------------------------------- |
| `store/slices/prefs.ts`                 | Add `setPref`; import `DEFAULT_PREFERENCES` from storage |
| `store/slices/device.ts`                | New stub slice                                           |
| `store/index.ts`                        | Compose `DeviceSlice`                                    |
| `storage/preferences.ts`                | New — full CRUD layer                                    |
| `hooks/usePreferences.ts`               | New — replaces `usePrefsInit.ts`                         |
| `hooks/usePrefsInit.ts`                 | Deleted                                                  |
| `components/Stepper.tsx`                | New — ported from legacy                                 |
| `components/RegionPicker.tsx`           | New — ported from legacy, zero props                     |
| `screens/SettingsScreen.tsx`            | New — ported from legacy, 2-prop surface                 |
| `screens/stubs/SettingsStub.tsx`        | Deleted                                                  |
| `App.tsx`                               | Wire `usePreferences`; swap stub for real screen         |
| `tests/storage/preferences.test.ts`     | New                                                      |
| `tests/store/slices/prefs.test.ts`      | Update (new actions + import path)                       |
| `tests/store/slices/device.test.ts`     | New                                                      |
| `tests/hooks/usePreferences.test.ts`    | New                                                      |
| `tests/components/Stepper.test.ts`      | New                                                      |
| `tests/components/RegionPicker.test.ts` | New                                                      |
| `tests/screens/SettingsScreen.test.ts`  | New                                                      |

---

## Out of scope

- Real FCM registration (`notificationsEnabled` wired live) — slice 6
- `useDeviceRegistration` hook — slice 6
- Deep link parsing — slice 6
- React Navigation migration — post-parity, recorded in `todo.md`
