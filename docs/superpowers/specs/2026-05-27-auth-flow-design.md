# app/auth-flow — Design Spec

**Date:** 2026-05-27
**Slice:** Phase 10 — app/auth-flow
**Branch:** feat/app-auth-flow
**PR target:** develop
**Legacy reference:** `pulse-news-legacy/app/src/screens/LoginScreen.tsx`, `ResetPasswordScreen.tsx`, `SplashScreen.tsx`, `hooks/useSupabaseAuth.ts`, `hooks/useDeepLinkRecovery.ts`, `hooks/useAppServices.ts`

---

## Goal

Port the authentication flow from the legacy app into the new Zustand-driven architecture. Delivers: session management, sign-in, sign-up, password reset via deep link, and the loading screen shown during session restoration. Replaces `AuthFlowStub`. Completes the `auth-check` boot window so the app can transition to either `unauthenticated` or `prefs-loading`.

---

## Reforms vs Legacy

Six improvements made during this port — all behaviorally transparent to the user:

| #   | Reform                             | Legacy problem                                                                            | Fix                                                                    |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Auth Zustand slice                 | `session`/`authReady`/`isPasswordRecovery` in local `useState`, invisible to boot machine | New `auth.ts` store slice; `useSupabaseAuth` writes to store           |
| 2   | `useAuthInit` hook                 | No code drives `auth-check → unauthenticated/prefs-loading` transition                    | Dedicated hook observes `authReady` in store, fires `setAppState`      |
| 3   | Reanimated SplashScreen            | `Animated` API runs on JS thread during busy boot                                         | Reanimated v3 worklets run on UI thread; dots stay smooth              |
| 4   | `LoginScreen` sub-components       | `createMode` boolean mixes two flows in one component                                     | `SignInForm` + `SignUpForm` sub-components; email state lifted         |
| 5   | Stable deep link callback          | `onRecoveryStart` inline function re-registers Linking listener each render               | With auth in Zustand, callback is a stable store dispatch reference    |
| 6   | `KeyboardAvoidingView` + safe area | `behavior={undefined}` on Android; no safe area in `unauthenticated` route                | `behavior='height'` on Android; `useSafeAreaInsets()` in `LoginScreen` |

**Not ported in this slice:** `useAppServices` (depends on `usePreferences` and `useDeviceRegistration` from later slices — assembled in settings-flow).

---

## Architecture

### Boot sequence

```
booting       ← App mounts, native splash visible, fonts loading
    ↓  useAppInit: fonts done + nav restored
auth-check    ← Native splash hidden; custom SplashScreen (Reanimated dots) shown
    ↓  useAuthInit: getSession() resolves → auth slice updated
unauthenticated   OR   prefs-loading
```

If `pulse://reset-password?code=xxx` deep link arrives at any boot state, `isPasswordRecovery` in the auth slice flips to `true` and `ResetPasswordScreen` is rendered full-screen over everything.

### App.tsx routing order (updated)

```typescript
if (isPasswordRecovery)         return <ResetPasswordScreen … />;
if (appState === 'booting')     return <View style={bg} />;     // under native splash
if (appState === 'auth-check'
  || appState === 'prefs-loading')  return <SplashScreen … />;
if (appState === 'unauthenticated') return <LoginScreen … />;
if (appState === 'update-required') return <UpdateRequiredScreen />;
if (appState === 'maintenance')     return <MaintenanceScreen />;
// appState === 'ready' → digest-flow (next slice)
```

`useAuthInit` is called unconditionally in `App` alongside `useAppInit`. It is a no-op until `appState` reaches `auth-check`.

---

## File Map

| File                                  | Status | Role                                                          |
| ------------------------------------- | ------ | ------------------------------------------------------------- |
| `src/store/slices/auth.ts`            | NEW    | Zustand auth slice                                            |
| `src/store/index.ts`                  | UPDATE | Compose auth slice into `useAppStore`                         |
| `src/hooks/useSupabaseAuth.ts`        | NEW    | Session restore + subscription + action functions             |
| `src/hooks/useDeepLinkRecovery.ts`    | NEW    | `pulse://reset-password` PKCE + implicit token handler        |
| `src/hooks/useAuthInit.ts`            | NEW    | Boot transition: `auth-check → unauthenticated/prefs-loading` |
| `src/screens/SplashScreen.tsx`        | NEW    | Reanimated pulsing dots; shown during `auth-check`            |
| `src/screens/LoginScreen.tsx`         | NEW    | Tab container with `SignInForm` / `SignUpForm`                |
| `src/screens/ResetPasswordScreen.tsx` | NEW    | New-password entry after deep link recovery                   |
| `App.tsx`                             | UPDATE | Wire `useAuthInit`; updated routing; remove `AuthFlowStub`    |
| `src/screens/stubs/AuthFlowStub.tsx`  | DELETE | Replaced by real `LoginScreen`                                |

---

## Interface Contracts

### `AuthSlice` (src/store/slices/auth.ts)

```typescript
export interface AuthSlice {
  session: Session | null;
  authReady: boolean; // "session check done" — NOT "logged in"
  isPasswordRecovery: boolean;

  setSession: (s: Session | null) => void;
  setAuthReady: (v: boolean) => void;
  setIsPasswordRecovery: (v: boolean) => void;
}
```

Initial state: `{ session: null, authReady: false, isPasswordRecovery: false }`.

### `useSupabaseAuth` (src/hooks/useSupabaseAuth.ts)

```typescript
export interface SignUpResult {
  error: string | null;
  needsConfirmation: boolean;
}

export interface AuthActions {
  signIn: (email: string, pw: string) => Promise<string | null>;
  signUp: (email: string, pw: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (newPw: string) => Promise<string | null>;
  deleteAccount: () => Promise<string | null>;
}

export function useSupabaseAuth(): AuthActions;
```

Internal behaviour:

- `getSession()` on mount → `setSession` + `setAuthReady(true)` (also fires `setAuthReady(true)` on catch)
- `onAuthStateChange` subscription → `setSession`; `PASSWORD_RECOVERY` event → `setIsPasswordRecovery(true)`
- `updatePassword` success → `setIsPasswordRecovery(false)`
- `deleteAccount` → `supabase.rpc('delete_my_account')` + `storage.clearAll()` + `signOut()`
- `getSupabase() === null` guard on all actions: return `'Supabase not configured'` error string; `setAuthReady(true)` on mount
- `useDeepLinkRecovery` wired internally with `useAppStore.getState().setIsPasswordRecovery` (stable reference)

### `useAuthInit` (src/hooks/useAuthInit.ts)

```typescript
export function useAuthInit(): AuthActions;
```

- Calls `useSupabaseAuth()` to initialise auth
- Subscribes to `authReady` in the store; when it flips true: reads `session`, calls `setAppState(session ? 'prefs-loading' : 'unauthenticated')`
- Returns `AuthActions` so `App.tsx` can pass them to screens without re-calling `useSupabaseAuth`

### `LoginScreen` (src/screens/LoginScreen.tsx)

```typescript
interface Props {
  theme: Theme;
  aes: Aesthetic;
  onSignIn: (email: string, pw: string) => Promise<string | null>;
  onSignUp: (email: string, pw: string) => Promise<SignUpResult>;
  onResetPassword: (email: string) => Promise<string | null>;
}
```

Internal structure:

- `LoginScreen` — `useSafeAreaInsets()`, tab toggle state, shared `email` state lifted here
- `SignInForm` — `pw`, `showPw`, `busy`, `message`; "Forgot password?" calls `onResetPassword`
- `SignUpForm` — `pw`, `showPw`, `busy`, `message`; `zxcvbn` strength bar; `score >= 3` required for valid

Password validation: `email.includes('@') && pw.length >= 6` for sign-in; additionally `strength.score >= 3` for sign-up.

`KeyboardAvoidingView behavior`: `'padding'` on iOS, `'height'` on Android. Wrapped in `ScrollView keyboardShouldPersistTaps="handled"`.

### `ResetPasswordScreen` (src/screens/ResetPasswordScreen.tsx)

```typescript
interface Props {
  theme: Theme;
  aes: Aesthetic;
  onUpdatePassword: (newPw: string) => Promise<string | null>;
}
```

State: `pw`, `confirm`, `showPw`, `busy`, `error`. Valid when `pw.length >= 6 && pw === confirm`. Same KAV + safe area fixes as `LoginScreen`.

### `SplashScreen` (src/screens/SplashScreen.tsx)

```typescript
interface Props {
  theme: Theme;
  aes: Aesthetic;
}
```

Pulsing dot animation via Reanimated v3: `useSharedValue` + `withRepeat(withSequence(withTiming…))` as UI-thread worklet. Three dots with staggered delays (0ms, 150ms, 300ms). `cancelAnimation` on unmount.

### `useDeepLinkRecovery` (src/hooks/useDeepLinkRecovery.ts)

```typescript
export function useDeepLinkRecovery(
  supabase: SupabaseClient | null,
  onRecoveryStart: () => void,
): void;
```

- Checks `Linking.getInitialURL()` on mount + `Linking.addEventListener('url', …)`
- Dedup: skips URL if same as `lastUrlRef.current`
- PKCE path: extracts `code=` param → `exchangeCodeForSession(code)`
- Implicit path: extracts `access_token` + `refresh_token` from hash → `setSession`; calls `onRecoveryStart` if `type === 'recovery'`
- `mounted` flag + `requestIdRef` prevent stale async responses

---

## Behavioral Contracts (parity with legacy)

All the following match legacy exactly — no algorithm changes:

- `signIn` / `signUp` return `null` on success, error string on failure
- `signUp` returns `{ error: null, needsConfirmation: true }` when Supabase returns no session (email confirmation required)
- Info message on sign-up pending: `"Check your email to confirm your account."`
- Info message on reset sent: `"Reset link sent — check your email."`
- Error message when email missing for reset: `"Enter your email above first."`
- Password reset `redirectTo`: `'pulse://reset-password'`
- `deleteAccount` calls `supabase.rpc('delete_my_account')` then `storage.clearAll()` then `signOut()`
- `isPasswordRecovery` set to `false` after successful `updatePassword`
- Strength colors: `['#c0392b', '#e67e22', '#d4a017', '#27ae60', '#27ae60']`
- Strength labels: `['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']`

---

## Test Strategy

Four test files. Target overall 60–70% line coverage.

| Test file                     | Coverage target | Key scenarios                                                                                                                                                    |
| ----------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.test.ts`                | 100%            | Initial state; each setter mutates only its field                                                                                                                |
| `useSupabaseAuth.test.ts`     | ~80%            | Session restore (success + catch); `PASSWORD_RECOVERY` event; `null` Supabase guard; `deleteAccount` wipes storage; `updatePassword` clears `isPasswordRecovery` |
| `useDeepLinkRecovery.test.ts` | ~80%            | PKCE code path; implicit token path; duplicate URL skipped; non-recovery URL ignored; `null` supabase no-op                                                      |
| `useAuthInit.test.ts`         | ~90%            | `authReady=true + session=null → 'unauthenticated'`; `authReady=true + session → 'prefs-loading'`; `authReady=false → no transition`                             |

**Skipped:** screen rendering tests (purely presentational), Reanimated animation tests (UI-thread worklets don't run in Jest), zxcvbn output values (third-party), Supabase network calls (mocked at boundary).

**Mock strategy:** `jest.mock('../supabase/client')` → `getSupabase()` returns controlled mock or `null`. `react-native` Linking mocked in Jest setup. Supabase client methods return controllable promises per test.

---

## Security Notes

This slice touches auth — `/security-review` must be run before the PR is opened.

Key areas to review:

- Deep link URL validation (only `pulse://reset-password` scheme processed)
- PKCE code not logged
- `storage.clearAll()` on account delete wipes all local tokens
- Session tokens handled exclusively by Supabase SDK + MMKV (never exposed to JS as plaintext)
