# app/foundation — Design Spec

Date: 2026-05-26
Slice: Frontend slice 1 of 6
Branch: `feat/app-foundation`
Status: Approved — ready for implementation plan

---

## 1. Purpose

Establish the complete infrastructure layer for the Pulse app: Expo entry point, Zustand store skeleton, boot state machine, font loading, theme/config/type ports, MMKV storage, Supabase client, React Query provider, root error boundary, and screen stubs. Every subsequent frontend slice builds on top of this and adds to it — nothing here gets replaced, only extended.

---

## 2. Scope

### Files created by this slice

```
app/
├── index.ts                              ← AppRegistry + SplashScreen.preventAutoHideAsync()
├── App.tsx                               ← boot gate + screen routing
├── src/
│   ├── store/
│   │   ├── index.ts                     ← composed useAppStore (devtools, one create() call)
│   │   └── slices/
│   │       ├── app.ts                   ← AppState machine
│   │       └── nav.ts                   ← screen, dayIndex, article + MMKV persistence
│   ├── hooks/
│   │   └── useAppInit.ts               ← advances boot machine after fonts load
│   ├── screens/
│   │   └── stubs/
│   │       ├── AuthFlowStub.tsx         ← placeholder; replaced by auth-flow slice
│   │       ├── DigestFlowStub.tsx       ← placeholder; replaced by digest-flow slice
│   │       ├── SettingsStub.tsx         ← placeholder; replaced by settings-flow slice
│   │       ├── UpdateRequiredScreen.tsx ← future boot gate; unstyled
│   │       └── MaintenanceScreen.tsx    ← future boot gate; unstyled
│   ├── components/
│   │   └── ErrorBoundary.tsx            ← root-level recoverable error boundary
│   ├── config.ts                        ← port from legacy
│   ├── data.ts                          ← port from legacy
│   ├── logger.ts                        ← port from legacy
│   ├── themes.ts                        ← port from legacy
│   ├── types.ts                         ← port from legacy
│   ├── supabase/
│   │   └── client.ts                   ← port (lazy singleton + MMKV session adapter)
│   └── storage/
│       └── mmkv.ts                     ← port (shared MMKV instance + supabaseStorage adapter)
```

### Out of scope for this slice

- Auth logic (`useSupabaseAuth`, login/signup screens) → auth-flow
- Preferences (`usePreferences`, prefs Zustand slice) → settings-flow
- Digest fetching, DigestPager, DigestPage, RegionSection → digest-flow
- FCM registration, notification handlers, deep link parsing → notifications
- Device registration → notifications
- `@tanstack/react-query` query definitions → digest-flow (client + provider installed here)

---

## 3. Dependencies

All installed in `app/package.json` by this slice.

| Package                             | Purpose                                                             |
| ----------------------------------- | ------------------------------------------------------------------- |
| `expo`                              | Expo SDK runtime                                                    |
| `react-native`                      | RN runtime                                                          |
| `zustand`                           | Global state store                                                  |
| `@tanstack/react-query`             | Query client + provider (queries added in digest-flow)              |
| `expo-splash-screen`                | Native splash hold until boot completes                             |
| `expo-font`                         | Font loading hook                                                   |
| `@expo-google-fonts/source-serif-4` | Editorial/sepia font family                                         |
| `@expo-google-fonts/inter`          | Sans-serif font family                                              |
| `@expo-google-fonts/jetbrains-mono` | Mono font family (brutalist aesthetic)                              |
| `expo-status-bar`                   | Status bar style control                                            |
| `expo-navigation-bar`               | Android navigation bar color                                        |
| `expo-system-ui`                    | Background color during launch                                      |
| `react-native-gesture-handler`      | Required root wrapper for Reanimated/RNGH                           |
| `react-native-safe-area-context`    | SafeAreaProvider + useSafeAreaInsets                                |
| `react-native-reanimated`           | Required by DigestPager in later slice; babel plugin registered now |
| `react-native-mmkv`                 | Local storage: prefs, nav state, Supabase session                   |
| `@supabase/supabase-js`             | Supabase client                                                     |
| `@react-native-firebase/app`        | Firebase core (messaging added in notifications slice)              |

---

## 4. Architecture decisions (summary)

Full rationale in `REBUILD_PLAN.md §8`. Summary for implementers:

- **State**: Zustand for synchronous global state; React Query for async server data; no React Context for app-wide state.
- **Store pattern**: split slice files (`slices/app.ts`, `slices/nav.ts`, …); one composed `useAppStore` in `store/index.ts`. Later slices add a new slice file and spread it into the composed type — existing files untouched.
- **Store writer pattern**: hooks (auth, prefs, device) own complex async logic and write to the store via `useAppStore.setState`. They do not return values to App.tsx.
- **Navigation**: manual conditional rendering on `screen` from the nav slice. No React Navigation for V1.
- **Boot**: explicit named state machine in the `app` slice. No boolean flags.
- **Native splash**: held via `SplashScreen.preventAutoHideAsync()` until `appState` leaves `'booting'`.

---

## 5. Boot state machine

Owned by `src/store/slices/app.ts`.

```
'booting'          initial state; fonts loading, MMKV reading, nav state restoring
     │
     ▼  (fonts done → useAppInit advances)
'auth-check'       waiting for Supabase session check (auth-flow owns this transition)
     │
     ├──▶ 'unauthenticated'   no session → render AuthFlowStub / LoginScreen
     │
     └──▶ 'prefs-loading'     session exists; hydrating prefs + device registration
               │
               ▼
           'ready'             all systems go; route by nav slice screen value
```

Future states (wired but not triggered in V1):

- `'update-required'` — backend signals mandatory app update
- `'maintenance'` — backend signals downtime

`App.tsx` switches on `appState`. Each transition is a named `setAppState` action. Auth-flow slice owns the `auth-check → unauthenticated/prefs-loading` transitions. Settings-flow slice owns `prefs-loading → ready`.

---

## 6. Zustand store

### `src/store/slices/app.ts`

```ts
export type AppState =
  | 'booting'
  | 'auth-check'
  | 'unauthenticated'
  | 'prefs-loading'
  | 'ready'
  | 'update-required'
  | 'maintenance';

export interface AppSlice {
  appState: AppState;
  setAppState: (state: AppState) => void;
}

export const createAppSlice: StateCreator<AppSlice> = (set) => ({
  appState: 'booting',
  setAppState: (appState) => set({ appState }),
});
```

### `src/store/slices/nav.ts`

Ports the logic of `useNavState` from legacy:

- MMKV read on `restoreNavState()` (called once by `useAppInit`)
- Debounced MMKV write (700 ms) on `setScreen`/`setDayIndex`
- 30-minute TTL on restore: stale state falls back to `screen: 'digest'`, `dayIndex: 0`
- `'splash'` and `'login'` never persisted; restore falls back to `'digest'`

```ts
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
```

Notification handlers navigate via `useAppStore.getState().setScreen('digest')` — no refs, no callbacks.

### `src/store/index.ts`

```ts
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

Future slices extend the type: `create<AppSlice & NavSlice & AuthSlice & PrefsSlice & DeviceSlice>()`.

---

## 7. App.tsx shell

```
index.ts
  └── SplashScreen.preventAutoHideAsync()   ← module level, before any React
  └── AppRegistry.registerComponent(App)

App()
  ├── useFonts(12 variants)                 ← expo-font
  ├── useAppInit(fontsReady)                ← advances boot machine; restores nav state
  ├── useAppStore(s => s.appState)          ← drives boot gate
  ├── useAppStore(s => s.screen)            ← drives screen routing
  ├── useEffect: SplashScreen.hideAsync()   ← fires when appState leaves 'booting'
  ├── useEffect: NavigationBar color        ← synced to theme.bg
  └── return:
        GestureHandlerRootView
          SafeAreaProvider
            ErrorBoundary
              QueryClientProvider
                RootScreens(appState, screen, theme)
                StatusBar
```

`queryClient` created at module scope (not inside the component).

`RootScreens` is a small pure component that switches on `appState` and `screen`. It keeps App.tsx's return readable and avoids deeply nested ternaries.

During `'booting'`, `'auth-check'`, `'prefs-loading'`: native splash is still visible; `RootScreens` renders a plain `View` with `backgroundColor: theme.bg` (invisible under the splash, but prevents a flash when the splash fades).

---

## 8. useAppInit

`src/hooks/useAppInit.ts` — fires once after fonts are ready.

```ts
export function useAppInit(fontsReady: boolean): void {
  const setAppState = useAppStore((s) => s.setAppState);
  const restoreNavState = useAppStore((s) => s.restoreNavState);

  useEffect(() => {
    if (!fontsReady) return;
    restoreNavState(); // sync MMKV read; sets screen + dayIndex
    setAppState('auth-check'); // auth-flow slice takes over from here
  }, [fontsReady]);
}
```

Responsibility boundary: `useAppInit` advances to `'auth-check'` and stops. Auth-flow's `useSupabaseAuth` hook picks up from `'auth-check'` and advances to `'unauthenticated'` or `'prefs-loading'`. Settings-flow's `usePreferences` hook advances from `'prefs-loading'` to `'ready'`.

---

## 9. Infrastructure ports

Straight ports from `legacy/app/src/`. No behavior changes. TypeScript improvements allowed (stronger types, no loosening).

| File                 | Key notes                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`           | Re-exports `Region`, `ContinentName` from `@shared/regions`. Defines all domain types. Also re-exports `AppState` from the store slice so it lives with other types. |
| `config.ts`          | Typed re-export of `pulse.config.json` + `API_URL` from `EXPO_PUBLIC_API_URL`.                                                                                       |
| `data.ts`            | `REGIONS` re-export, `sortedSelectedRegions`, `isoDateAtDayIndex`, `formatLongDate`, `TODAY_ISO`.                                                                    |
| `themes.ts`          | `THEMES`, `AESTHETICS`, `font()` helper. Fully typed; no changes needed.                                                                                             |
| `logger.ts`          | `getLogger(namespace)` with level gating from `config.logLevel`. Improve: replace raw `console.*` with a typed `LogLevel` union.                                     |
| `storage/mmkv.ts`    | Single `MMKV({ id: 'pulse' })` instance + `supabaseStorage` adapter (sync, matches Supabase's AsyncStorage interface).                                               |
| `supabase/client.ts` | Lazy singleton via `getSupabase()`. Returns `null` when env vars absent. Session persisted via `supabaseStorage`.                                                    |

---

## 10. Error boundary

`src/components/ErrorBoundary.tsx` — class component (required by React's error boundary API).

Behavior:

- `getDerivedStateFromError` captures the error into state.
- `componentDidCatch` logs via `getLogger('ErrorBoundary')`.
- Renders a recoverable error screen with a "Try again" pressable that calls `setState({ error: null })`.
- Intentionally unstyled in this slice (no theme access in class components without a wrapper); gets styled in a later slice.

Placed in `App.tsx` wrapping `QueryClientProvider` and all screen content.

---

## 11. Screen stubs

Five minimal placeholder components. Each renders a centered label so routing can be visually verified on device.

| File                   | Label                          | Replaced by            |
| ---------------------- | ------------------------------ | ---------------------- |
| `AuthFlowStub`         | "auth-flow — slice 2"          | auth-flow slice        |
| `DigestFlowStub`       | "digest-flow — slice 3"        | digest-flow slice      |
| `SettingsStub`         | "settings-flow — slice 4"      | settings-flow slice    |
| `UpdateRequiredScreen` | "Update required" + store link | V2 / backend gate work |
| `MaintenanceScreen`    | "Back shortly"                 | V2 / backend gate work |

---

## 12. Tests

Jest + `ts-jest` wired up via `app/jest.config.cjs`. MMKV mocked at module level (same pattern as `cron/`).

| File                  | Test targets                                                                                                      | Why                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `themes.ts`           | `font()` — all 3 aesthetics × 5 roles × 4 weights = correct family+weight string                                  | Wrong font name = invisible text crash at runtime    |
| `data.ts`             | `isoDateAtDayIndex(0)` = today; `isoDateAtDayIndex(1)` = yesterday; `sortedSelectedRegions` ordering              | Date math errors are silent and affect every page    |
| `store/slices/app.ts` | Initial state is `'booting'`; `setAppState` updates state                                                         | Boot machine regression kills the entire app         |
| `store/slices/nav.ts` | `setScreen`/`setDayIndex`/`setArticle` update state; `restoreNavState` falls back correctly on empty/expired MMKV | Nav state corruption = user stuck on wrong screen    |
| `storage/mmkv.ts`     | `supabaseStorage`: get returns `null` on miss; set+get round-trip; remove clears key                              | Supabase session adapter break = silent auth failure |

Target: 65% line coverage on the files above. Zero coverage required on stubs, error boundary UI, or App.tsx render logic (too RN-runtime-dependent for unit tests).

---

## 13. Definition of done

- `npm run build` (tsc --noEmit) passes with zero errors.
- `npm run lint` passes.
- `npm test` passes with ≥ 65% coverage on files in §12.
- A local Expo dev build (`expo start --dev-client`) boots on Android, holds the native splash, then transitions to `auth-check` and shows `AuthFlowStub`.
- `/code-review` findings addressed before PR open.
- PR description links legacy files replaced: `App.tsx`, `src/hooks/useNavState.ts`, `src/hooks/useAppNavigation.ts`, `src/hooks/useAppServices.ts`, `src/storage/mmkv.ts`, `src/supabase/client.ts`, `src/themes.ts`, `src/types.ts`, `src/config.ts`, `src/data.ts`, `src/logger.ts`.
