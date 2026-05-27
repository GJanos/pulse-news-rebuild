# app/ — CLAUDE.md

## What this package does

React Native (Expo) app, Android-first. Fetches daily digests from Supabase on notification tap. One push notification per day.

## Dev commands

```bash
cd app
npx tsc --noEmit                    # typecheck
npx eslint --ext .ts,.tsx src       # lint
npm test                            # Jest (available after app/foundation)
npx expo start --dev-client         # dev server (after app/foundation)
npx expo run:android                # build + install on Android (after app/foundation)
```

## Module map (populated by slices)

| File                                         | Role                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `index.ts`                                   | AppRegistry entry point + `SplashScreen.preventAutoHideAsync()` at module scope               |
| `App.tsx`                                    | Boot gate + screen routing (switches on `appState` and `screen` from Zustand)                 |
| `src/store/index.ts`                         | Composed `useAppStore` (Zustand devtools, one `create()` call)                                |
| `src/store/slices/app.ts`                    | `AppState` boot state machine: `booting → auth-check → unauthenticated/prefs-loading → ready` |
| `src/store/slices/nav.ts`                    | Screen, dayIndex, article state + MMKV persistence with TTL from `pulse.config.json`          |
| `src/hooks/useAppInit.ts`                    | Fires after fonts load; restores nav state; advances boot to `auth-check`                     |
| `src/components/ErrorBoundary.tsx`           | Root-level recoverable error boundary                                                         |
| `src/screens/stubs/AuthFlowStub.tsx`         | Placeholder — replaced by auth-flow slice                                                     |
| `src/screens/stubs/DigestFlowStub.tsx`       | Placeholder — replaced by digest-flow slice                                                   |
| `src/screens/stubs/SettingsStub.tsx`         | Placeholder — replaced by settings-flow slice                                                 |
| `src/screens/stubs/UpdateRequiredScreen.tsx` | Boot gate screen for forced upgrade                                                           |
| `src/screens/stubs/MaintenanceScreen.tsx`    | Boot gate screen for maintenance window                                                       |
| `src/types.ts`                               | Domain types (`Region`, `Headline`, `Digest`, `UserPreferences`, `AppState`, …)               |
| `src/config.ts`                              | Typed re-export of `pulse.config.json` + `API_URL` constant                                   |
| `src/data.ts`                                | Re-exports `REGIONS` from `@shared`; `sortedSelectedRegions`, date helpers                    |
| `src/themes.ts`                              | `THEMES`, `AESTHETICS`, `font()` helper                                                       |
| `src/logger.ts`                              | Structured logger; level from `pulse.config.json`                                             |
| `src/supabase/client.ts`                     | Lazy Supabase client; MMKV-backed session persistence                                         |
| `src/storage/mmkv.ts`                        | Shared MMKV instance + `supabaseStorage` adapter                                              |
| `src/storage/preferences.ts`                 | MMKV cache + Supabase pull/push; conflict resolution via `updatedAt` _(future slice)_         |
| `src/storage/digests.ts`                     | Cache-first digest storage; stale window for today; immutable past dates _(future slice)_     |
| `src/notifications/register.ts`              | FCM token + Supabase upsert; `linkDeviceToUser` _(future slice)_                              |
| `src/hooks/useSupabaseAuth.ts`               | Session management — sign in/up/out/reset/delete _(future slice)_                             |
| `src/hooks/useDeepLinkRecovery.ts`           | `pulse://reset-password` PKCE + implicit token exchange _(future slice)_                      |
| `src/hooks/useDigest.ts`                     | Module-level cache + stale window + `forceRefresh` _(future slice)_                           |
| `src/hooks/useCurrencyRates.ts`              | jsDelivr/Cloudflare fallback; % change computation _(future slice)_                           |

## Expo gotchas

- Use `expo-linking` (not RN core `Linking`) for all deep links.
- `AsyncStorage` is `@react-native-async-storage/async-storage`, not a core import.
- Navigation: **manual conditional rendering** driven by the Zustand `nav` slice. No React Navigation for V1. See `REBUILD_PLAN.md §8.3` for rationale.
- FCM: `@react-native-firebase/messaging` (native module). Expo Go will not work.

## Android only

Do not add iOS-specific code. `ios/` directory is not committed.
`google-services.json` must be at `app/android/app/google-services.json` for FCM.

## Shared imports

```typescript
import type { Digest } from '@shared/types';
import { REGIONS } from '@shared/regions';
```

`@shared/*` → `../shared/src/*`. Configured in `tsconfig.json`; Jest alias added in `app/foundation`.

## Test strategy

Test hooks and pure utilities with Jest + ts-jest (no renderer).
Component tests use `@testing-library/react-native` + `jest-expo` (foundation slice).
Skip snapshot tests on presentation components.
Target 60–70% on: auth state, deep link parsing, digest data transformation.
