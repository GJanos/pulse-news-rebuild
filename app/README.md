# Pulse News — Mobile App (Expo + React Native)

Android-first. Reads daily digests from Supabase, displays them by region, and receives one push notification per day via FCM.

---

## Prerequisites

- Node.js 20+, Android Studio / SDK
- A physical Android device or emulator
- Firebase project with `google-services.json`
- Supabase project with the schema from `supabase/schema.sql` applied

---

## Install

```bash
cd app
npm install
```

---

## Environment variables

Copy `.env.example` to `.env` inside `app/` and fill in:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |

FCM config lives in `app/android/app/google-services.json`, not env vars.

---

## Running (added by app/foundation slice)

This app uses native modules (`@react-native-firebase/messaging`), so **Expo Go will not work** — a custom dev client is required.

```bash
cd app
npx expo prebuild               # generate /android (one-time)
npx expo run:android            # first native build + install
npx expo start --dev-client     # subsequent runs — scan QR in the installed dev client
```

---

## Dev commands

```bash
npm run build     # tsc --noEmit (typecheck)
npm run lint      # ESLint on src/
npm test          # Jest (available after app/foundation slice)
```

---

## Data flow

**Digests:** cache-first (MMKV) with a configurable stale window for today. Notification tap forces a full remote fetch. Past dates are immutable — never re-fetched.

**Auth:** `useSupabaseAuth` manages session via Supabase. MMKV persists the session across restarts. Password-reset deep links (`pulse://reset-password`) use PKCE or implicit token flow depending on what Supabase sends.

**Preferences:** keyed on `session.user.id`. Local writes are immediate. Supabase push is batched — flushed on settings close and on app background.

**Device registration:** Stable UUID on first launch, FCM token upserted to Supabase `devices`. Token rotation is handled by `onTokenRefresh`. After login, `user_id` is stamped on the device row.

---

## Building for stores

```bash
eas build -p android
```
