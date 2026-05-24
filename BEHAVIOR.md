# Pulse — Behavior Spec

This document is the acceptance test for rebuild parity. Every bullet must be implemented before a slice is considered complete. It does not describe how anything works — implementation lives in code.

---

## Screens

### SplashScreen

- Shown on first app launch and while fonts and auth state are loading.
- Advances automatically after `splashAdvanceMs` once both fonts and auth are ready.
- Navigates to LoginScreen if no session; navigates to DigestScreen if a session exists.

### LoginScreen

- Presents email + password fields with sign-in and sign-up modes.
- Sign-up validates password strength (score ≥ 3 via zxcvbn) before enabling submit.
- Displays inline error and info messages for auth outcomes.
- "Forgot password" sends a password-reset email and shows a confirmation message.
- On successful sign-in or sign-up, navigates to DigestScreen.

### ResetPasswordScreen

- Reached only via the password-reset deep link (see Deep Links).
- Accepts a new password and confirmation.
- Submits via Supabase `updateUser`. On success, navigates to DigestScreen.

### DigestScreen (DigestPager + DigestPage)

- Full-screen horizontally-scrollable digest pages, one per date.
- Displays today's digest and up to `historyDays` days of past digests.
- Each page shows a date header, a global headlines section (when enabled), and one section per selected region.
- Each region section shows up to `headlineCount` headlines (or the per-region override).
- Each headline shows a title, summary, and optional detail.
- Tapping a headline navigates to ArticleScreen.
- Currency rate chips are shown per-region section when `showCurrencyRates` is true; shows today-vs-yesterday percentage change in `baseCurrency`.
- A jump modal allows navigating to any region or global section on the current page.
- Swipe left/right or nav arrows advance between dates.
- A settings button navigates to SettingsScreen.

### SettingsScreen

- Slides in from the right; swipe right to dismiss.
- Displays the logged-in user's email.
- Exposes all user preferences (see User Preferences).
- RegionPicker shows all available regions with reorder and per-region headline-count override.
- Notification time selector updates `notify_at` on the device row.
- Sign-out button ends the session and returns to LoginScreen.
- Delete account button (with confirmation alert) permanently deletes the account and all data.
- Preference changes are applied immediately to local state; flushed to Supabase on close and on app background.

### ArticleScreen

- Opens the URL of the tapped headline.
- Opens in an in-app browser (WebBrowser) or the system browser, depending on `openLinksIn`.

---

## Cron Steps

1. **Load config** — reads `pulse.config.json` and merges with defaults. Validates required env vars (`PERPLEXITY_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`).
2. **Resolve regions** — maps `api.regions` names to `Region` objects from `shared/regions.ts`.
3. **Fetch digests** — runs `fetchDigest()` for each region in parallel (staggered by `attemptDelay`). Each region retries up to `maxAttempts` rounds using the `recencySequence` windows. Each round:
   - Sends a structured prompt to Perplexity requesting `count + buffer` headlines.
   - Resolves article URLs from `search_results` first; falls back to model-provided URLs.
   - Applies URL quality filter, slug deduplication, and Jaccard topic deduplication.
   - Exits the retry loop early when `minResults` accepted headlines are found.
4. **Rank headlines per region** — when `api.ranking.local.enabled`, calls Claude to reorder accepted headlines by importance.
5. **Persist digests** — evicts rows older than `db.evictDays` when `db.evict` is true. Upserts one row per (region, date) into `digests`.
6. **Rank global headlines** — when `api.ranking.global.enabled`, calls Claude to select the top `api.ranking.global.count` stories across all regions.
7. **Persist global digest** — upserts one row for today's date into `global_digests`.
8. **Send notifications** — sends one FCM multicast per batch of registered devices. Stale tokens that return `UNREGISTERED` are deleted from `devices`.
9. **Write quality log** — when `log.qualityLog` is true, writes a per-run JSON report to `logs/quality-*.json`.

### Vercel API variants

- `api/daily-digest.ts` — runs steps 1–8, but FCM is sent only to devices where `notify_at IS NULL`.
- `api/notify.ts` — runs only step 8 for devices whose `notify_at` falls in the current 30-minute window.
- `api/account.ts` — POST registers a device for an authenticated user; DELETE permanently deletes the account and all associated rows.

---

## Config Keys

### app/pulse.config.json

| Key                           | Description                                                               |
| ----------------------------- | ------------------------------------------------------------------------- |
| `screenStateTtlMs`            | Nav state TTL — resets to today's digest after this many ms of inactivity |
| `splashAdvanceMs`             | Minimum time (ms) the splash screen is shown before advancing             |
| `deviceRegistrationTimeoutMs` | Max ms to wait for FCM registration on startup before unblocking          |
| `prefsDebounceMs`             | Debounce window (ms) for preference writes                                |
| `logLevel`                    | App log level: `"debug"`, `"info"`, `"warn"`, or `"error"`                |
| `digestStaleMins`             | Stale window for today's cached digest — triggers a remote refetch        |
| `currencyStaleMins`           | Stale window for cached currency rates                                    |
| `fetchCount`                  | Default number of headlines shown per region                              |

### cron/pulse.config.json — model block

| Key                       | Description                             |
| ------------------------- | --------------------------------------- |
| `model.name`              | Perplexity model name                   |
| `model.reasoningEffort`   | Perplexity `reasoning_effort` parameter |
| `model.temperature`       | Perplexity sampling temperature         |
| `model.searchType`        | Perplexity `search_type`                |
| `model.searchContextSize` | Perplexity `search_context_size`        |

### cron/pulse.config.json — api block

| Key                            | Description                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `api.regions`                  | Active region names — must match entries in `shared/regions.ts`              |
| `api.fetch.count`              | Headlines requested per region per attempt                                   |
| `api.fetch.buffer`             | Extra headlines above `count` to absorb filter losses                        |
| `api.fetch.summarySentences`   | Sentence count for the headline summary field                                |
| `api.fetch.detailSentences`    | Sentence count for the headline detail field                                 |
| `api.fetch.maxAttempts`        | Max retry rounds per region                                                  |
| `api.fetch.attemptDelay`       | ms stagger between parallel region fetches                                   |
| `api.fetch.retryDelay`         | ms pause between retry rounds within a region                                |
| `api.fetch.minResults`         | Minimum accepted headlines; exits retry loop early when reached              |
| `api.fetch.recencySequence`    | Ordered recency windows tried per round (e.g. `["day","day","week","week"]`) |
| `api.ranking.local.enabled`    | Enable per-region Claude reranking                                           |
| `api.ranking.local.model`      | Claude model for per-region ranking                                          |
| `api.ranking.local.maxTokens`  | Max output tokens for per-region ranking call                                |
| `api.ranking.global.enabled`   | Enable global cross-region headline selection                                |
| `api.ranking.global.count`     | Number of global headlines to select                                         |
| `api.ranking.global.model`     | Claude model for global selection                                            |
| `api.ranking.global.maxTokens` | Max output tokens for global selection                                       |
| `api.ranking.global.chunkSize` | Headlines per chunk when the total exceeds one prompt                        |

### cron/pulse.config.json — db and log blocks

| Key              | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| `db.evict`       | Whether to evict old rows before each write                   |
| `db.evictDays`   | Delete rows older than this many days when `db.evict` is true |
| `log.level`      | Winston log level                                             |
| `log.qualityLog` | Write per-run quality report to `logs/quality-*.json`         |

---

## Supabase Tables

| Table              | Purpose                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `digests`          | One row per (region, date). `payload` JSONB holds a `headlines[]` array. Written by cron; read by app.                                                                                                                            |
| `global_digests`   | One row per date. `payload` JSONB holds a globally-selected `headlines[]` array. Written by cron; read by app when `showGlobalHeadlines` is true.                                                                                 |
| `devices`          | One row per app install. Columns: `id` (stable UUID), `fcm_token`, `user_id` (nullable, set after login), `notify_at` (HH:MM or null), `updated_at`. Upserted by app on launch and token rotation; read by cron for FCM dispatch. |
| `user_preferences` | One row per authenticated user. Columns: `user_id`, `prefs` JSONB, `updated_at`. Written and read by the app for cloud sync.                                                                                                      |

---

## Deep Links

The app registers the `pulse://` scheme.

| URL pattern                                                           | Behavior                                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pulse://reset-password?code=<pkce_code>`                             | Exchanges the PKCE code for a session via `exchangeCodeForSession`. Navigates to ResetPasswordScreen on success. |
| `pulse://reset-password#access_token=…&refresh_token=…&type=recovery` | Sets the session directly via `setSession`. Navigates to ResetPasswordScreen when `type=recovery`.               |

Both patterns are handled on cold start (via `getInitialURL`) and while the app is running (via `Linking.addEventListener`). Duplicate URLs are ignored.

---

## Notification Types

| Type           | Trigger                                                                   | App behavior on tap                                                                                |
| -------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `daily_digest` | Cron sends once per day per device via FCM. `data.type = "daily_digest"`. | Clears the badge count. Forces a full remote refetch. Navigates to the current day's DigestScreen. |

Notification taps are handled in three states: app in foreground (`onMessage`), app backgrounded (`onNotificationOpenedApp`), and app killed (`getInitialNotification`).

---

## User Preferences

All preferences are stored locally (MMKV) and synced to `user_preferences` in Supabase. Conflict resolution: newer `updatedAt` wins.

| Preference             | Type                                       | Description                                                         |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| `selectedRegions`      | `string[]`                                 | Regions the user follows, in display order                          |
| `headlineCount`        | `number`                                   | Default headlines shown per region                                  |
| `regionHeadlineCounts` | `Record<string, number>`                   | Per-region headline count overrides                                 |
| `historyDays`          | `number`                                   | How many days of digest history to show                             |
| `notifyTime`           | `"HH:MM"`                                  | Preferred daily push time; empty string = let the cron decide       |
| `openLinksIn`          | `"in-app" \| "browser"`                    | How article URLs are opened                                         |
| `regionStyle`          | `"flag" \| "code"`                         | Whether regions show as flag images or ISO codes                    |
| `baseCurrency`         | `string`                                   | ISO 4217 code for the currency comparison baseline                  |
| `showCurrencyRates`    | `boolean`                                  | Whether to show currency rate chips on region sections              |
| `showGlobalHeadlines`  | `boolean`                                  | Whether to show the global headlines section                        |
| `globalHeadlineCount`  | `number`                                   | How many global headlines to display                                |
| `theme`                | `"light" \| "sepia" \| "dark"`             | Color theme                                                         |
| `aesthetic`            | `"editorial" \| "clinical" \| "brutalist"` | Typography and layout style                                         |
| `updatedAt`            | ISO timestamp                              | Conflict resolution timestamp — newer wins on Supabase ↔ local sync |
