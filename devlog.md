# Pulse — Dev Log

---

## 2026-04-26 — Project conception & architecture

**What happened today:**
Came up with the idea for Pulse: a minimal, distraction-free daily news digest app. One notification per day. No feed, no scroll, no algorithm. User picks regions, gets 3–5 neutral headline summaries, reads, closes.

**Session with Claude:**
Spent a session asking a lot of clarifying questions about the technology stack — specifically around:

- Why Vercel serverless cron vs a dedicated server
- Whether Expo was the right call for React Native
- How FCM handles delivery when the app is closed
- Supabase free tier limits
- How to keep summarization neutral (wire services + prompt constraints)

Decided to trust the LLM's recommendations on the stack rather than second-guess every choice. Architecture locked in:

```
NewsAPI → Vercel Cron → Claude API → FCM → Expo (React Native)
         (daily)       (summarize)  (push)  (display)
```

Supabase stores device tokens and user preferences. Claude API handles summarization with a neutrality constraint in the prompt.

**Outcome:**

- `README.md` written and committed
- Git repo initialized and pushed
- Ready for development

---

## 2026-04-27 — Data architecture deep-dive & project skeleton

**Topics discussed:**

_Data & Preferences — going full Supabase from day one:_
Decided to skip the AsyncStorage-only phase entirely. User's instinct matched the recommendation: store preferences in both Supabase (authoritative) and AsyncStorage (local read cache). Same pattern as most well-designed mobile apps — local for speed and offline, Supabase for truth.

Agreed on the read/write pattern:

- App open → local first, Supabase sync in background
- Settings change → local write immediately (instant UI), Supabase write authoritative (cron reads from here)
- Conflict resolution: compare `updated_at`, Supabase wins if newer

_Digest history — sliding window + user-configurable local cache:_
User proposed a 7-day rolling server-side window and user-configurable local cache. Both ideas were good independently and work well together:

- Supabase keeps last 7 days per user (portability: covers reinstalls and phone switches)
- Local cache keeps however many days the user sets (default 7, no server cost)
- Local can accumulate longer history than the server window over time
- "No backtracking until you have a week" is emergent, not enforced — the app shows what exists

Key insight locked in: **local-first reads, Supabase as fallback/recovery**. Normal daily use never hits Supabase for reads. Server reads only matter on fresh install or after missed days.

**Open decisions resolved:**

- Notification time: user-configurable per account
- Offline cache: yes, user-adjustable day count in settings
- Platform: Android first (user has Android device)
- Claude model: defer until prompt is written

**Outcome:**

- README.md updated with full data architecture, resolved decisions, schema sketch
- Project file skeleton created (all files empty)
- Devlog started

---

## 2026-04-28 — NewsAPI investigation & first fetch implementation

**What happened:**
Investigated the two NewsAPI endpoints in detail before writing any real fetch logic.

`/v2/top-headlines` returns actual articles — this is the one the cron calls. Supports `country`, `category`, `sources`, `q`, and pagination. Does **not** support `language`.

`/v2/top-headlines/sources` returns a list of publisher IDs, not articles. It's a discovery endpoint — useful only if you want to pre-select specific sources. Supports `language`, `country`, `category`. The only way to enforce language filtering is to use this endpoint first to get source IDs, then pass those to `top-headlines?sources=...` — but that sacrifices the `category` param (NewsAPI forbids mixing `sources` with `country` or `category`).

**Push-back on over-engineering:**
Initial fetch logic included a `language` field in `FetchSettings`. Pushed back: `top-headlines` silently ignores it, so it was dead code. The two-step sources-lookup approach was considered and rejected — too much complexity for marginal benefit. Country filter alone is sufficient; for target regions like Hungary or the US, the dominant language follows the country.

**Outcome:**

- `cron/fetchNews.ts` implemented: typed `Article` interface, multi-country × multi-category fan-out via `Promise.all`, URL deduplication
- `language` param removed from `FetchSettings` and `buildParams`
- README updated with NewsAPI endpoint notes

---

## 2026-04-29 — News API evaluation & pivot to GNews

**What happened:**
Continued from yesterday's `fetchNews.ts` by actually running requests and stress-testing the NewsAPI setup. Hit real limitations fast, explored alternatives, and locked in a new approach.

**NewsAPI investigation — what broke:**

`top-headlines?country=hu` returns **0 results**. NewsAPI has zero indexed Hungarian sources for this endpoint — confirmed via the `/sources` endpoint too. The `everything` endpoint with `language=hu` and a keyword query does return articles (origo.hu, index.hu, portfolio.hu), but exposes a deeper problem.

**Source bias problem:**

- origo.hu — state-aligned propaganda outlet
- index.hu — lost editorial independence post-2020
- portfolio.hu — neutral, but finance-only

The sources we actually want (telex.hu, hvg.hu, 444.hu — independent, neutral) are **not indexed by NewsAPI at all**. This is a hard ceiling, not a query problem.

**English-language fallback attempt:**
Tried `language=en` with `q=Hungary OR Orbán OR Budapest` to pull in international wire services (Reuters, AP, FT) covering Hungary. Returns 5 articles max, with noise (travel blogs, unrelated pieces). Volume too low to be useful for a daily digest.

**Pivot to GNews:**
GNews `top-headlines?country=hu` uses Google News ranking — it actually works. Results included **Telex** (the neutral independent source we wanted), alongside Portfolio, Index, Nemzeti Sport, M4 Sport. 10 real, current articles with meaningful descriptions.

Free tier limitation shared with NewsAPI: **12-hour delay** on article freshness. Both APIs are day-old on free tier. Acceptable for a morning digest use case.

**Architecture decision locked in — local fetch + Claude translates:**
For each user region, fetch in the local language (Hungary → `lang=hu`, Ukraine → `lang=uk`, etc.) using a country→language mapping. Pass all articles to Claude with an instruction to output in the user's preferred language. Translation and summarization happen in one prompt, one API call. This is cheaper than two separate calls and Claude handles both well.

Country→language mapping goes in the pipeline orchestrator, not in the fetch layer. Multi-language countries (Belgium, Switzerland) are an edge case deferred until non-Hungarian regions are added.

**Added `EverythingSettings` to `fetchNews.ts`** with full NewsAPI everything-endpoint support: `searchIn`, `sources`, `domains`, `excludeDomains`, `from`, `to`. Kept as a fallback module but GNews is now the primary fetch path.

**Created `fetchGNews.ts`:**

- `GNewsSettings` interface with all supported params including `nullable`
- Maps GNews article shape → shared `Article` interface so the rest of the pipeline is unchanged
- `nullable: ['image', 'content']` — image not needed for text digest, content is truncated on free tier anyway

**Outcome:**

- `cron/fetchGNews.ts` — complete, tested against live API
- GNews confirmed as primary news source, NewsAPI kept as reference implementation
- Translation-via-Claude architecture decided: one prompt handles both jobs
- Free tier delay (~12h) accepted as a constraint; `from`/`to` set to yesterday at cron time

---

## 2026-04-30 — GNews consolidation, refactor, and RSS pivot decision

**What happened:**
Started by merging the split GNews/NewsAPI files into a single canonical fetcher, then ran into a deeper problem: no free API gives full article content, which changes the data source strategy entirely.

**GNews consolidation:**
`fetchGNews.ts` and `fetchNews.ts` were separate — one the old NewsAPI module, one the new GNews module. Merged: GNews implementation moved into `fetchNews.ts` as the sole fetcher, `fetchGNews.ts` deleted, `testFetch.ts` import updated. `fetchHeadlines` is now the only export.

**Refactor — removing NewsAPI residue from `Article`:**
`Article` still carried `source.id` (always `null`) and `author` (always `null`) — shape inherited from NewsAPI, meaningless for GNews. Also had `urlToImage` instead of GNews's native `image`, requiring an internal `GNewsArticle` type + `toArticle` mapper just to bridge the mismatch. Removed all three: dropped the dead fields, dropped the mapper, `Article` now matches GNews response directly. `GNewsCategory` renamed to `Category`. `GNewsResponse.articles` typed as `Article[]` directly — no transformation step.

**Pivot decision — GNews → Google News RSS:**
Researched free-tier content availability. Finding: every major news API (NewsAPI, GNews, mediastack) truncates article content to ~200 chars on free tiers. Full text is paywalled at hundreds of dollars/month. GNews is not viable as a content source, only as a headline source.

Google News RSS identified as replacement: free, no API key, returns headline + one-sentence snippet. Limitation is the same as paid APIs — no full content — but the cost is zero and it surfaces the right local sources (Telex, Index, 444 for Hungary with `hl=hu&gl=HU`).

**Content strategy — accepted constraint:**
With no free full-text source available, the pipeline becomes: headline + snippet → Claude, which summarizes using its own knowledge to fill gaps. Accepted as the baseline approach. The snippet provides anchor context; Claude provides depth.

**Outcome:**

- `cron/fetchNews.ts` — consolidated, refactored, type-checked clean
- `cron/fetchGNews.ts` — deleted
- GNews confirmed as dead end for content; Google News RSS decided as next data source
- `Article` interface now accurately reflects actual data shape (no phantom null fields)

---

## 2026-05-06 — Logging refactor and config integration

**What happened:**
Following the Perplexity API switch, added support for a config file and centralized logging to replace scattered console logs and improve debugging.

**Config file support:**
Added `pulse.config.json` for user-configurable settings like debug mode and news sources. Integrated dotenv to load environment variables, ensuring API keys and config are managed externally.

**Logging centralization:**
Switched from manual `console.log` and `console.debug` calls to winston for structured logging. Logger initialized in config.ts with custom format including timestamps, levels, and component names.

**Dependencies update:**
Added winston to package.json for logging library; removed deprecated @types/winston as winston provides its own types.

**Outcome:**

- `cron/config.ts` updated to load config and initialize winston logger
- `cron/logging.ts` refactored to use winston with custom formatting
- `cron/fetchNews.ts` updated to use winston logger for info and debug messages
- `package.json` modified to include winston dependency

---

## 2026-05-07 — Perplexity API tuning, prompt extraction, URL resolution

**What happened:**
Resumed after a week gap. Focused on the Perplexity fetch layer: prompt extraction, request parameter tuning, and attempted URL quality fixes.

**Prompt extraction:**
Prompts moved to `cron/prompt.ts`. System prompt tightened (~30% fewer tokens), added explicit URL rule (direct article links only) and source diversity rule (≥2 outlets). Country code dropped from user message — already carried by `web_search_options.user_location`.

**Interface change:**
`fetchDigest(region)` → `fetchDigest({ region, country, count? })`. Callers read `COUNTRY` and `COUNT` from env.

**Request tuning (iterative, live-tested):**

- `search_type: 'pro'` → `'auto'`, `search_context_size: 'high'` → `'low'`, `reasoning_effort` → `'low'`
- Removed undocumented params: `return_citations`, `language_preference`, `search_after_date_filter`
- Added `search_recency_filter: 'day'` (documented) and `response_format: json_schema` (strict schema, eliminates markdown fallback)
- Cost: $0.012 → ~$0.005 per call

**`search_domain_filter` — tried and rejected:**
Domain allow-list (telex.hu, hvg.hu, etc.) returned `{"headlines":[]}` — filter is exclusive, found nothing for today. Removed; diversity handled via prompt rule instead.

**URL resolution:**
Added `search_results` to response type. `matchUrl()` scores results by title word overlap and replaces model-generated URLs with real article URLs. Video URLs (YouTube, `/video/` paths) filtered out before matching; model URL kept as fallback if no article match found.

**Outcome:**

- `cron/prompt.ts` — new, `SYSTEM_PROMPT` + `buildUserPrompt`
- `cron/fetchNews.ts` — `DigestRequest`, request params, `matchUrl`, usage + search_results logging
- `.claude/commands/get-up-to-speed.md` — session-start briefing command
- Cost per call: ~$0.005

---

## 2026-05-08 — Multi-region pipeline, regions catalog, fallback

**What happened:**
Extended the single-region fetch into a full multi-region pipeline with a region catalog and auto-retry.

**regions.ts:**
`ALL_REGIONS` catalog of 23 regions (Europe, Middle East, Asia, Africa, Americas, Oceania). `SELECTED_REGIONS` is a plain string list that gets resolved against the catalog at startup — easy to edit without touching the type layer. Active set: Hungary, Ukraine, Russia, United States, Iran, Israel.

**Pipeline changes:**
`cron/index.ts` and `testFetch.ts` now run `Promise.all` over `DEFAULT_REGIONS`. `testFetch.ts` accumulates token and cost totals across all regions and prints a final summary row.

**Auto-retry fallback:**
If `recency: 'day'` returns an empty headlines array, immediately retry with `recency: 'week'`. Handles transient indexing gaps without manual intervention. Usage is accumulated across both calls if the fallback fires.

**Source hint bug:**
Israel returned empty because the user prompt hardcoded a hint toward Hungarian outlets. Changed to `"Prefer local ${region} news sources when available"` — generic and region-aware.

**search_language_filter removed:**
Passing `language_preference: 'en'` at top level is sufficient. The language filter starves non-English regions (Israel, Iran) of results; `user_location.country` already steers sourcing.

**Outcome:**

- `cron/regions.ts` — new, region catalog + selected list pattern
- `cron/fetchNews.ts` — auto-retry, per-region usage accumulation, source hint fix
- `cron/testFetch.ts` — multi-region output + cost total
- Cost: ~$0.008/region, ~$0.05 for 6 regions per run

---

## 2026-05-09 — Cron cleanup, Supabase architecture, auth design

**What happened:**
Cron layer cleanup followed by full architecture design session for the Supabase + notification layer.

**Cron cleanup:**
Removed `summarize.ts` (dead stub — Perplexity handles summarization). Dropped `language` from `RegionConfig` and `DigestRequest` (field was unused after `search_language_filter` removal). Moved `COUNT` env parsing into `PulseConfig` alongside `sourceType` — both callers (`index.ts`, `testFetch.ts`) now read `config.count`. Added retry-with-backoff to `callPerplexity`: retries once on 429 or 5xx with 2s delay, non-retriable errors (400) throw immediately. Switched `Promise.all` → `Promise.allSettled` in both `index.ts` and `testFetch.ts` — one failed region no longer kills the whole run; failures are logged and skipped. Added `/ship` slash command for git add + commit + push workflow.

**Digest storage architecture:**
One row per region per date in `digests` table, shared across all users. Cron fetches each active region once daily and stores it. App queries only the regions the user has selected. Cost scales with regions, not users. Active region catalog trimmed to 8 to avoid querying regions nobody watches.

**Notification flow:**
Silent background FCM fetch rejected — Android Doze mode and OEM battery killers make it unreliable. Decision: cron sends a regular FCM notification message after writing Supabase data. User taps → app opens in foreground → fetches from Supabase. Per-user notification times deferred to V2.

**Device identity:**
UUID generated by app on first launch, stored in AsyncStorage. Stable across FCM token rotation; resets on reinstall (acceptable). FCM token stored alongside UUID in `devices` table and updated via Firebase `onTokenRefresh` callback.

**Supabase auth design:**
Two-key model: `anon` key ships in app (safe, public), `service_role` key stays server-side only. RLS on `digests`: SELECT open to all (public data). `devices` writes go through a Supabase Edge Function — app POSTs to an HTTP endpoint, Edge Function uses `service_role` internally so the key never reaches the client. Cron uses `service_role` directly for all reads and writes.

**Outcome:**

- `cron/fetchNews.ts` — retry-with-backoff on `callPerplexity`, `language` field removed
- `cron/regions.ts` — `language` removed from `RegionConfig`, catalog trimmed
- `cron/config.ts` — `count` added to `PulseConfig`
- `cron/index.ts`, `testFetch.ts` — `Promise.allSettled`, `config.count`
- `cron/summarize.ts` — deleted
- `.claude/commands/ship.md` — new slash command
- Supabase schema, auth model, and notification flow locked in (not yet coded)

---

## 2026-05-09 (continued) — Setup, tooling, code quality

**What happened:**
Continued same-day session: applied schema, wired Supabase, reorganized Claude commands, code quality pass.

**Cron quality:**
`logging.ts` `any` removed (index signature access). `PulseConfig.debug` and `count` made required — `loadPulseConfig()` always populates them. `flatMap` narrowing in `index.ts` infers `RegionDigest[]` without explicit annotation (explicit annotation required an import TypeScript flagged as unused).

**CLAUDE.md rejected:**
User: "too rigid, one more thing to keep in sync." Replaced with `.claude/rules/` (path-scoped, narrower surface).

**Rules:**
`typescript.md` (ts/tsx): no `any`, `import type`, non-optional config fields, `Promise.allSettled` over `Promise.all`, prefer inference.
`clean-code.md` (ts/tsx/sql/md): WHY-only comments, no dead code, no scope creep, parse defaults once, intent-naming.

**Command reorganization:**
`devlog`→`sync-devlog`, `readme-sync`→`sync-readme`, `ship`→`sync-repo`, `get-up-to-speed`→`sync-context`. New `sync-work.md` aggregates all four by path reference; `/simplify` is step one.

**Supabase setup:**
Wrong package caught: Supabase wizard generated `@supabase/ssr` (Next.js only) — removed, kept `@supabase/supabase-js`. `NEXT_PUBLIC_` prefix on secret key (wizard output) removed — would expose it in browser bundles. `.mcp.json` added (Supabase HTTP MCP, OAuth). Schema applied via `apply_migration`. `schema.sql` terminology updated: anon→publishable, service_role→secret.

**Outcome:**

- `cron/` — quality-pass changes (any removal, required fields, flatMap)
- `.claude/rules/typescript.md`, `clean-code.md` — new
- `.claude/commands/sync-*.md` — renamed + `sync-work.md` aggregator
- `.mcp.json` — Supabase MCP
- `supabase/schema.sql` — terminology corrected, applied to remote
- `package.json` — `@supabase/supabase-js` in, `@supabase/ssr` out

---

## 2026-05-10 — Digest persistence, source hints, URL quality, retry loop

**What happened:**
Wired digest persistence to Supabase and improved Perplexity result quality (URL filtering, fake placeholders, retry strategy).

**Persistence (`notify.ts`):**
`persistDigests` does eviction (DELETE older than `evictDays`) then upsert (`onConflict: 'region,date'`). Re-running same day overwrites — safe since Perplexity is non-deterministic. `devices.preferences JSONB` replaced with `notify_at TIME` (nullable; null = notify at cron time).

**Config consolidation:**
`evict`, `evictDays`, `regions`, `summarySentences`, `maxFetchAttempts` moved into `pulse.config.json`. `SELECTED_REGIONS`/`DEFAULT_REGIONS` replaced with `resolveRegions(names)`.

**Source hints and prompt:**
`sources: string[]` added to `RegionConfig`; prompt emits `"Preferred outlets: ..."` (soft, not a hard filter — hard filter caused fake placeholder results). `SYSTEM_PROMPT` → `buildSystemPrompt(n)`. Source rule changed to prefer local national outlets over wire services. Temperature 0.2 → 0.5.

**URL quality:**
Three pattern arrays filter model output (video, junk paths, social). `isValidHeadlineUrl` also rejects single-segment paths (`/news`). HTTP HEAD validation removed — section pages return 200, news sites return 403. Retry loop uses `recencies: ['day','day','week','week']`; on retry, `buildPayload` requests `needed` not `count`.

**Outcome:**

- `cron/notify.ts` — new
- `cron/regions.ts`, `fetchNews.ts`, `prompt.ts`, `config.ts`, `pulse.config.json` — updated
- `supabase/schema.sql` — `preferences JSONB` → `notify_at TIME`

---

## 2026-05-12 — Digest quality: topic dedup, URL dedup, retry quota

**What happened:**
After 2 days of real usage, three repeating quality problems surfaced: same-topic headlines within one region, the same search result URL assigned to multiple headlines, and no way to set a minimum acceptable result count independently from `count`.

**Topic deduplication:**
Added `topicWords` + `isDuplicateTopic` using Jaccard similarity (threshold 0.4, minimum 2 shared words ≥4 chars). Applied across retry batches so duplicates from round 2 are checked against everything collected in round 1. Added a "Distinct events" rule to the system prompt as a first-line hint.

**URL dedup — three-layer fix:**
`matchUrl` previously used `isArticleUrl` (video-only filter) so section pages like `/newsfeed/` could become candidates. Changed to `isValidHeadlineUrl`. Added `usedUrls: Set<string>` shared across retry iterations so URLs from round 1 can't be reused in round 2. Introduced `batchUrls` (local copy) for intra-batch `matchUrl` dedup; `seenInBatch` in the filter step catches fallback-URL duplicates (e.g. model returning same `h.url` for all headlines). URLs only promoted to `usedUrls` after surviving all filters — prevents invalid URLs from permanently claiming a slot.

**Retry quota + delay:**
Renamed `minResults` → `minFetchResults`, `evict` → `evictDBData`, `evictDays` → `evictDBDays`, `regions` → `digestRegions`. Added `fetchAttemptDelay` (ms between retry attempts). Loop now exits when `collected.length >= minFetchResults`, not `count` — lets callers trade completeness for cost.

**Israel source fix:**
Times of Israel removed — its search results were dominated by section pages (`/newsfeed/`) and dated liveblog indexes (1 segment, rejected by the URL filter). `matchUrl` word-overlap fails when model titles don't align with available liveblog-entry slugs. Replaced with Jerusalem Post (direct article URLs) + Reuters Israel.

**Retry statistics:**
`RegionDigest.attempts` field added. `testFetch.ts` prints a per-region bar chart; `index.ts` logs a `region:attempts:headlines` summary line.

**Outcome:**

- `cron/fetchNews.ts` — topic dedup helpers, 3-layer URL dedup, `minFetchResults`, `fetchAttemptDelay`, `attempts` counter
- `cron/regions.ts` — Israel sources updated
- `cron/config.ts`, `pulse.config.json` — field renames + new fields
- `cron/notify.ts` — renamed field references
- `cron/prompt.ts` — "Distinct events" rule added
- `cron/index.ts`, `testFetch.ts` — retry summary output

---

## 2026-05-13 — FCM dispatch, logging helpers, empty-digest guard

**What happened:**
Wired the last cron-side piece and cleaned up inline logic in `main()`.

**FCM dispatch:**
`sendNotifications(digests)` added to `notify.ts`: reads device tokens from Supabase, fires `sendEachForMulticast`, cleans up stale tokens in one batched DELETE. `initMessaging()` lazily initializes Firebase Admin from env vars (`FIREBASE_PRIVATE_KEY` needs `\n`-restore for PEM). `firebase-admin` added to `package.json`; credentials filled in `.env`.

**Logging helpers:**
Inline logging logic extracted to private helpers — `usageSummary`/`retrySummary` in `index.ts`; `printHeadlines`/`printTotals` with `RetryStats`/`UsageTotals` types in `testFetch.ts`. Moving these to `logging.ts` was considered and rejected: infrastructure should not import domain types.

**Outcome:**

- `cron/notify.ts` — `sendNotifications`, `firebase-admin` wired
- `cron/index.ts` — private helpers, empty-digest guard, `Promise.all`
- `cron/testFetch.ts` — `printHeadlines`, `printTotals`, local types
- `package.json` — `firebase-admin` added
- Cron layer complete; React Native app is next

---

## 2026-05-15 — Claude-designed UI scaffold → first working Expo build

**What happened:**
Claude's design tool produced a complete Expo TypeScript project as a UI sketch. Today's work was getting it to actually build and render on the Android emulator.

**Design artifact → real project:**
The output already had the full structure: screens (Login, Splash, Digest, Settings, Article), hooks (useDigest, usePreferences, useDeviceRegistration), storage, supabase client, types, themes, and 7 days of fixture headlines. Adopted as-is — no redesign needed.

**Build failure chain (Expo 55 + RN 0.76.5 mismatch):**
Expo 55 targets RN 0.83.6; project was on 0.76.5. Each upgrade exposed the next layer: `@types/react@18` → bumped to `^19.1.1`; Gradle 8.10.2 below AGP minimum → updated `withGradle8.js` to 8.13; `expo-notifications` + `@react-native-firebase/messaging` both declare `default_notification_color` → manifest merger fails, fixed with `withAndroidManifest` injecting `tools:replace`; `babel-preset-expo` silently dropped by `npm install --legacy-peer-deps` → Metro crash on first launch.

**Blank screen — FCM hang:**
Bundle loaded (984 modules) but screen stayed blank. Loading guard in `App.tsx` blocks on `deviceReady`, which is set in `useDeviceRegistration`'s `finally` block — but `messaging().getToken()` never resolves on an emulator without a configured Firebase project, so `finally` never runs. Fixed with a 10s timeout that sets `ready=true` regardless.

**Phase 0 rollout:**
Rather than debug all features at once, stubbed out Firebase and Supabase dependencies in `App.tsx` with `PHASE`-marked comments and started directly on the digest screen. `FEATURE_PHASES.md` documents the 4-phase dependency graph (fixture → prefs → live digests → push).

**Outcome:**

- `app/src/` — full project tree committed from design artifact
- `app/plugins/withGradle8.js` — Gradle 8.13, Kotlin 2.0.21, manifest conflict fix
- `app/src/hooks/useDeviceRegistration.ts` — 10s FCM timeout
- `app/App.tsx` — Phase 0 stubs, fonts-only loading guard, starts on digest screen
- `app/FEATURE_PHASES.md` — 4-phase rollout plan in repo
- `BUILD SUCCESSFUL`; app renders fixture digest on Pixel_10 emulator

---

## 2026-05-16 — Phase 1 complete: preferences, article open, UX polish

**What happened:**
Continued from the Phase 0 baseline. Phase 1 (local preferences via AsyncStorage) was already unblocked; this session finished the remaining wiring, fixed two reported bugs, and closed the one genuine Phase 1 gap identified by a codebase audit.

**Splash stuck after logout:**
The splash auto-advance `useEffect` was commented out during earlier debugging and never restored — logout → login → splash would hang forever. Uncommented and restored.

**NotifyTimePicker UX:**
Tap-to-cycle (incremented 30 min per tap) replaced with a bottom sheet modal. Opens with the selected time scrolled into view (50ms delay after fade-in, `(i − 2) × 45px` offset). `TIME_OPTS` moved to module level to avoid rebuilding on every render; map variable renamed `time` to avoid shadowing the outer `t: UserPreferences` prop.

**Open links in preference not respected:**
The `onOpenArticle` callback in `App.tsx` always pushed to `ArticleScreen` regardless of `openLinksIn`. Fixed: when `'browser'`, fires `Linking.openURL` directly and skips `ArticleScreen` entirely. As a consequence, `ArticleScreen`'s `openLinksIn` prop and dead `Linking` branch were removed — the screen only ever mounts in the in-app path, so its Open button unconditionally calls `WebBrowser.openBrowserAsync`.

**TypeScript `URL` properties:**
`hostname` and `pathname` were generating TS errors because `"lib": ["ES2020"]` doesn't include the WHATWG URL interface — those types live in `lib.dom`. Added `"DOM"` to the lib array; this was a pre-existing latent error surfaced by the review.

**Outcome:**

- `App.tsx` — splash auto-advance restored; `onOpenArticle` respects `openLinksIn`; `expo-web-browser` wired
- `ArticleScreen.tsx` — dead `openLinksIn` prop removed; Open button wired to `WebBrowser.openBrowserAsync`
- `SettingsScreen.tsx` — `NotifyTimePicker` replaced with modal bottom sheet; scroll-to-selected on open
- `tsconfig.json` — `"DOM"` added to lib

---

## 2026-05-16 (session 2) — App logging layer, ArticleScreen redesign, cron URL fixes, digest freshness

**What happened:**
App-side quality work (logging, ArticleScreen redesign, fixture removal) plus a multi-attempt debug of cron URL failures that had been silently producing empty US/UK digests.

**App logging:**
Added `app/src/logger.ts` — lightweight logger matching cron winston format, level from `pulse.config.json` `logLevel`, suppressed methods bound to noop. Applied across all async/non-UI files. Silent `.catch(() => {})` patterns replaced with logged warns.

**ArticleScreen redesign:**
Removed fake browser chrome (URL pill, lock icon, progress bar). Replaced with: minimal header (close · source name · open button), title, byline, summary, copy-link row. `expo-clipboard` added; `PulseIcon` extended with `'copy'` icon.

**Fixture removal:**
`FIXTURE_DIGESTS` fallback removed from `digests.ts` — Supabase is live, the fixture was stale 2026-05-13 data. Empty state is the correct fallback now.

**Cron URL failures:**
Root cause: Perplexity `recency=day` returns 1–3 homepage-level search results, so `matchUrl` has no article candidates. Approaches tried and rejected: `search_context_size: 'high'` (50% cost increase, no improvement), `maxFetchAttempts: 6` (user reverted), "fewer items acceptable" prompt language (caused model to return `{"headlines":[]}`). Fixes that landed: removed `/\/watch\//` from `JUNK_PATH_PATTERNS` (was blocking valid ITV article URLs — YouTube already blocked by `VIDEO_DOMAINS`); extended patterns with newsletter/press-center/digest/roundup/playbook/live-blog paths; updated US sources to outlets with distinctive URL slugs; removed "omit headline if no URL" from system prompt.

**Digest freshness:**
`loadDailyDigest` changed from cache-first for all dates to remote-first for today (Supabase queried on every app open; local cache is offline fallback). Past dates remain cache-first (immutable).

**Outcome:**

- `app/src/logger.ts`, `app/pulse.config.json`, `app/src/config.ts` — logging infrastructure
- `app/src/storage/digests.ts` — fixture removed, logging added, remote-first for today
- `app/src/screens/ArticleScreen.tsx` — full redesign, copy-link
- `app/src/components/Icon.tsx` — `'copy'` icon added
- `cron/fetchNews.ts` — JUNK_PATH_PATTERNS updated, URL source debug log
- `cron/prompt.ts` — URL rule tightened, "omit headline" sentence removed
- `cron/testFetch.ts` — block-char bar removed from retry display

---

## 2026-05-17 — Project housekeeping

**What happened:**
No feature work. Focused on project structure and documentation hygiene.

**Outcome:**

- Supabase keys moved from `app.json extra` to `app/.env` (`EXPO_PUBLIC_*`); `client.ts` simplified accordingly
- Root directory cleaned: `package.json`, `tsconfig.json`, `node_modules` moved into `cron/`
- READMEs restructured: main README slimmed to ~60 lines, subsystem READMEs own their details; `supabase/README.md` written
- `devlog.md` → `DEVLOG.md`, `todo.md` → `TODO.md`; `FEATURE_PHASES.md` updated to Phase 2 complete

---

## 2026-05-17 (session 2) — Phase 3 complete: FCM handlers, real phone

**What happened:**
Completed Phase 3 end-to-end on a real Android device.

**Real device build:** `npx expo run:android --device <serial>`; first build installs APK directly. Notifications required manual permission enable in Android settings.

**FCM emulator vs real phone:** Emulator FCM unreliable (no Google Play Services). `testNotify.ts` added as a standalone dev-test script (reads tokens from `devices`, calls `sendNotifications`).

**Notification handlers:** All three Firebase scenarios wired — background tap, killed-state tap, foreground arrival. `setBackgroundMessageHandler` in `index.ts` fixes the "ReactNativeFirebaseMessagingHeadlessTask" warning.

**notify_at scope:** Confirmed `notify_at` belongs to the user, not the device — will move to `user_preferences` in Phase 4. No no-op guard added; the whole code path is being replaced.

**Outcome:**

- `app/index.ts` — `setBackgroundMessageHandler` at module level
- `app/src/notifications/register.ts` — `registerNotificationHandlers`, `DAILY_DIGEST_TYPE` constant, cancelled flag
- `app/App.tsx` — handlers wired, silent catch replaced with logged warn
- `cron/testNotify.ts` — new FCM test script
- Phase 3 fully complete; push notifications working end-to-end on real device

---

## 2026-05-17 (session 3) — Phase 4: auth, swipe gestures, cron split

**What happened:**
Completed Phase 4 (Supabase Auth + per-user preferences), added swipe gestures across all screens, and split the cron pipeline into two Vercel API routes.

**Auth:** `useSupabaseAuth` hook; `client.ts` uses `AsyncStorage` for session persistence. Preferences migrated from device-keyed to `user_preferences` (auth.uid()). `signUp` returns `{ error, needsConfirmation }` — typed, not string-inspected. Reset password sends email; redirect-to-localhost issue deferred to TODO V2.

**Swipe gestures:** Article screen right-swipe closes (was backwards). Digest screen left/right swipes day navigation. Settings screen right-swipe goes back. PanResponder stale-closure fixed with index refs. Kept arrow buttons alongside swipe — both coexist fine.

**LogBox overlay:** Firebase v22 deprecation warnings triggered the debug overlay on every launch. Fixed with `LogBox.ignoreLogs` + all logger levels unified to `console.log`.

**Cron split:** `cron/index.ts` remains local test runner. Two new Vercel handlers: `api/daily-digest.ts` (fetch + persist + FCM to null-notify_at devices, daily at 05:00) and `api/notify.ts` (FCM to time-windowed devices, every 30 min). `buildClient` made a singleton; `checkCronSecret` extracted to `config.ts`.

**Outcome:**

- `useSupabaseAuth.ts`, `preferences.ts`, `LoginScreen.tsx`, `SettingsScreen.tsx` — auth wired end-to-end
- `DigestScreen.tsx`, `ArticleScreen.tsx`, `SettingsScreen.tsx` — swipe navigation
- `cron/api/daily-digest.ts` + `cron/api/notify.ts` — Vercel API route handlers
- `supabase/schema.sql` — `user_preferences` table, `user_id` on devices
- `vercel.json` — cron schedule config

---

## 2026-05-18 — Digest freshness, 3-tier content, brand mark, quality pass

**What happened:**
Session covered several independent improvements: notification tap correctness, cache staleness control, a richer content tier, brand identity, and a full `/simplify` quality pass.

**Notification tap:**
Tapping a notification now navigates to the digest screen and forces a fresh Supabase query (`staleMinutes: 0`). A session guard (`if (!session) return`) prevents navigation when the user is logged out — previously this would crash or render an empty screen.

**Stale timer (cache-first):**
`loadDailyDigest` was remote-first for today's date (Supabase on every open). Changed to cache-first with a configurable stale window (`digestStaleMins` in `app/pulse.config.json`, default 60). Regions cached within the window are served from AsyncStorage with no network call; only stale/missing regions hit Supabase. `forceRefresh()` bypasses the window (sets `staleMinutes: 0`). Remote-first on every open was discussed; accepted after realizing it only matters once a day and degraded offline UX for no reason.

**3-tier detail field:**
Added a `detail` field (3 sentences: context + implications + what's next) throughout the cron pipeline and `ArticleScreen`. `RESPONSE_SCHEMA` marks `detail` as required; summary stays 1 sentence. Concern: cost nearly doubled — resolved by trimming `detailSentences` from 4 → 3. `stripCitations()` extracted as a shared helper; applied to both summary and detail. Both fields shown on `ArticleScreen` (summary as lede, detail in muted text below); initial proposal to drop summary entirely on ArticleScreen reversed after observing the model produced non-redundant content reliably.

**Pulse brand mark:**
`PulseMark.tsx` SVG component (ECG trace + accent dot) added using `react-native-svg`. Applied at Login (size 52), Splash (size 72 with animation dot), and DigestScreen header (size 22). PNG assets (`icon.png`, `adaptive-icon.png`, `splash-icon.png`, `notification-icon.png`) copied into `app/assets/`; `app.json` wired.

**UI polish:**
ArticleScreen swipe hints moved below the copy-link row. DigestScreen footer border removed; text changed to "— End of digest —" (a "— No more —" variant was tried and immediately reverted by the user). "You're caught up." sentence dropped.

**Quality pass (`/simplify`):**
`useSwipe` hook extracted — consolidates the PanResponder + ref pattern used in three screens; callbacks stored in refs so the responder is created once but always calls the latest handler. `totalHeadlines` in DigestScreen wrapped in `useMemo`. Empty `<View>` wrapper around headline list in `RegionSection` removed. `digests.ts`: `stale.includes()` O(n) loop replaced with a Set; `fetchAndCache()` helper extracted (deduplicates the fetch+writeThrough loop); `trimLocalCache` gated to `date === today` (no point evicting on past-date reads). `fetchNews.ts`: `tokenise()` helper extracted from three near-identical word-extraction patterns; `matchUrl` and `topicWords` unified; intentional recency duplication commented.

**Outcome:**

- `app/src/hooks/useSwipe.ts` — new hook
- `app/src/components/PulseMark.tsx` — new SVG brand mark
- `app/assets/` — icon + splash assets added; `app.json` wired
- `app/src/storage/digests.ts` — cache-first + stale window, `fetchAndCache`, Set dedup, trimLocalCache gate
- `app/src/hooks/useDigest.ts` — `forceRefresh`, `refreshKey`, `staleMinutes` param
- `app/App.tsx` — `onDailyDigestRef` pattern; notification tap forces refresh + session guard
- `app/src/screens/ArticleScreen.tsx`, `DigestScreen.tsx`, `LoginScreen.tsx`, `SplashScreen.tsx` — PulseMark, useSwipe, UI polish
- `app/pulse.config.json` — `digestStaleMins: 60`
- `cron/src/fetchNews.ts` — `detail` field, `stripCitations`, `tokenise`, recency comment
- `cron/src/prompt.ts` — detail instruction, citation-marker rule
- `cron/src/config.ts`, `pulse.config.json` — `detailSentences` param

---

## 2026-05-19 — RegionPicker rewrite: reorder/tune modes, per-region counts

**What happened:**
Settings screen region section grew complex enough to extract; session added two interactive modes and per-region headline count overrides.

**RegionPicker extraction:**
Region list moved from SettingsScreen into its own `RegionPicker` component. The inline region rows (including `Checkmark`, `reorderMode` state, and `LayoutAnimation` calls) were all carrying state that didn't belong in a general settings screen.

**Reorder mode:**
Replaced the "•••" context menu with pill-based mode switching. Reorder mode shows up/down chevrons side-by-side on selected rows; available rows remain visible and selectable (no collapsing). Arrows enlarged to size 23, placed inline with row controls. Row height is identical in both modes — was previously different due to stacking arrows vertically, fixed by switching to `flexDirection: 'row'`.

**Checkmarks on all rows:**
All rows now show a checkmark (filled circle = selected, empty ring = unselected). Previously only selected rows showed feedback. This was the main UX gap in the original design.

**Tune mode and per-region counts:**
Added a second mode for per-region headline count overrides. Tune mode shows `- N +` steppers on selected rows (1–10 range); count colored accent when overridden, faint when using the global default. In tune mode, selection/deselection is disabled and checkmarks are hidden. Reset clears `regionHeadlineCounts` back to `{}`. `regionHeadlineCounts` is a `Record<string, number>` in `UserPreferences`; missing key falls back to global `headlineCount` at render time — no cron changes needed.

**Mode matrix:**
Refactored from two boolean states (`reorderMode`, `tuneMode`) to a single `type Mode = 'normal' | 'reorder' | 'tune'` enum. Eliminates mutual-exclusion guards. Module-level `LAYOUT_ANIM` const replaces repeated inline animation config objects.

**Digest meta row:**
Centered "X STORIES · Y REGIONS" summary line. Removed separator between day nav and meta row; single `borderBottom` on the meta View itself. Removed `paddingVertical` from the meta row — was creating unequal vertical rhythm with the day nav.

**Outcome:**

- `app/src/components/RegionPicker.tsx` — new component with normal/reorder/tune mode matrix
- `app/src/components/Icon.tsx` — `chevron-up`, `plus`, `minus` icons added; `more-horizontal` removed
- `app/src/screens/SettingsScreen.tsx` — inline region section replaced with `<RegionPicker>`
- `app/src/screens/DigestScreen.tsx` — centered meta row, per-region count applied in `visible` memo
- `app/src/types.ts` — `regionHeadlineCounts: Record<string, number>` added to `UserPreferences`

---

## 2026-05-19 (session 2) — Currency rates, password reset fix, settings Data group

**What happened:**
Session added ambient currency rate display to the digest and fixed a silent auth bug introduced by the implicit OAuth flow.

**Password reset deep link:**
`setSession()` always fires `SIGNED_IN`, never `PASSWORD_RECOVERY`. The recovery screen was unreachable. Fix: read `type=recovery` from the URL hash before calling `setSession` and set `isPasswordRecovery` synchronously — that flag is what gates navigation to `ResetPasswordScreen`.

**Currency rates feature:**
`useCurrencyRates` hook fetches today + yesterday rates from the `@fawazahmed0/currency-api` CDN, computes `changePercent` as `(prevRate - currRate) / prevRate * 100` (positive = local currency strengthened vs base). `CurrencyChip` renders two stacked lines next to each region header: `{localCurrency}/{baseCurrency}` on top, colored `↑/↓X.X%` below. Only shown for today's digest; hidden on historical days.

**API reliability — Cloudflare Pages only:**
jsDelivr CDN worked for USD-base requests (heavily cached) but failed silently for EUR, JPY, and other bases. Switched all fetches — both `latest` and historical date — to the Cloudflare Pages subdomain form (`latest.currency-api.pages.dev`, `{YYYY-MM-DD}.currency-api.pages.dev`). jsDelivr's `@{date}` semver tag syntax was also rejected by their resolver for non-USD bases.

**Configurable base currency:**
`CurrencyPicker` bottom-sheet modal (same pattern as `NotifyTimePicker`) added to a new **Data** settings group. Seven options: USD/EUR/GBP/JPY/CHF/CAD/AUD. Data group placed before Display. `baseCurrency` and `showCurrencyRates` added to `UserPreferences` and `DEFAULT_PREFERENCES`.

**Headlines per region moved to RegionPicker:**
The global headline count stepper was in a separate "Reading" row; moved into `RegionPicker` as its first row inside the bordered section — visually signals it is the default that the per-region Tune mode overrides. `onHeadlineCountChange` prop added; `Stepper` row removed from SettingsScreen.

**Quality pass:**
Ternary chain in `CurrencyChip` (`changeColor`, `arrow`) flattened into a `changeDisplay()` helper. No-op `onPress={() => {}}` on inner `Pressable` in `CurrencyPicker` replaced with a plain `View`.

**Outcome:**

- `app/src/hooks/useCurrencyRates.ts` — new hook; Cloudflare Pages CDN only
- `app/src/screens/DigestScreen.tsx` — `CurrencyChip`, `changeDisplay` helper, `currencyCodes` memo
- `app/src/screens/SettingsScreen.tsx` — `CurrencyPicker`, Data group, `Switch` for rates toggle
- `app/src/components/RegionPicker.tsx` — headlines-per-region stepper row, `onHeadlineCountChange` prop
- `app/src/hooks/useSupabaseAuth.ts` — recovery type detected from URL param before `setSession`
- `app/src/types.ts`, `app/src/storage/preferences.ts` — `baseCurrency`, `showCurrencyRates`
- `shared/regions.ts` — `currency` field on each region; `dailynewshungary.com` removed from HU sources
- `cron/pulse.config.json` — temperature raised 0.2 → 0.35

---

## 2026-05-21 — DigestPager architecture, memory caching, settings freeze

**What happened:**
Performance audit revealed the DigestScreen + DigestPage split caused a cross-component re-render chain that made the header load slower than the content. Session was a large structural refactor plus a series of targeted bug fixes.

**Architecture collapse — DigestScreen → DigestPage:**
Merged all chrome (wordmark, date display, settings button, jump modal) directly into `DigestPage`. `DigestPager` is now a pure gesture strip — it renders full-screen pages and passes `setDayIndex`/`onOpenSettings` down. `DigestScreen` deleted entirely. This eliminated the header/content render dependency that was causing the slow header.

**Module-level memory caches:**
All three data hooks — `useDigest`, `useGlobalHeadlines`, `useCurrencyRates` — gained module-level `Map` caches that survive unmount/remount. `useState` lazy initializer serves cache instantly on mount, so revisiting a date is zero-latency. `memoryCacheTimestamps` added to `useDigest` and `useGlobalHeadlines` so today re-fetches only after `staleMinutes` expires rather than on every remount.

**useCurrencyRates double-fire:**
Effect was using an array reference as dep, so any upstream re-render triggered a new fetch. Fixed by deriving `codesKey = codes.slice().sort().join(',')` and using that string as the dep instead.

**Settings state bugs:**
Two bugs caused by stale cache not being pushed to state on effect re-run: (a) toggling `showGlobalHeadlines` off then on left headlines blank; (b) changing `selectedRegions` while on a day that had already loaded showed stale content. Fix: always call the state setter with the cached value before the stale-window early-return.

**Preferences flush pattern:**
Replaced the 5-second debounce write loop and per-`setPref` Supabase push with a `flush()` function. `flush()` saves local + pushes remote only if `dirtyRef.current`. Called on settings close (`onBack`) and when app goes to background via `AppState.addEventListener`. Local cache is still hydrated on mount so offline reads are instant; remote push is now batched per session.

**digestPrefs freeze:**
While settings is open, `DigestPager` receives a frozen `digestPrefs` snapshot rather than live `prefs`. Prevents every `selectedRegions` change from re-running `useDigest` on the JS thread and blocking the settings UI.

**RegionPicker order stability:**
All/None and individual toggles were mutating the displayed region order. Refactored to a single `orderedRegions` state initialized once on mount (selected in user order, unselected in REGIONS order). `commit(nextSelected, order)` emits in stable order. Toggle/All/None never touch `orderedRegions`.

**Scroll reset fix:**
`RefreshControl` was mounted conditionally (`active && isToday`), causing a `undefined → component` flip that reset the ScrollView offset on page transition. Fixed by always mounting it with `enabled={active && isToday}`.

**Nav arrows removed:**
Swipe navigation made them redundant. Removed arrow buttons and `maxDayIndex` prop from header.

**Outcome:**

- `app/src/components/DigestPage.tsx` — new; full-screen self-contained page with all chrome
- `app/src/components/DigestPager.tsx` — now a pure gesture strip; `getSlotSetter` stable ref factory
- `app/src/screens/DigestScreen.tsx` — deleted
- `app/src/hooks/useDigest.ts` — module-level cache + timestamps + stale window
- `app/src/hooks/useGlobalHeadlines.ts` — same cache pattern; no-op setter guard
- `app/src/hooks/useCurrencyRates.ts` — string codesKey dep; module-level cache
- `app/src/hooks/usePreferences.ts` — flush pattern; dirtyRef; AppState background flush
- `app/App.tsx` — digestPrefs freeze; flush on settings close; section-header comments removed
- `app/src/components/RegionPicker.tsx` — orderedRegions single source of truth; commit helper

## 2026-05-22 — Refactor cron: extract helpers & tests

**What happened:**
Refactored the cron fetch pipeline: extracted URL, topic and text helpers, moved Perplexity client and parsing into `src/lib`, centralized types and dotenv bootstrap, migrated tests to Jest, and added convenience npm scripts.

**Refactor & tests:**
Split `src/fetchNews.ts` into a thin orchestrator and pure helpers (`src/lib/urlUtils.ts`, `src/lib/topicUtils.ts`, `src/lib/textUtils.ts`, `src/lib/perplexityClient.ts`, `src/lib/parseHeadlines.ts`). Added `src/types.ts` to remove circular imports. Centralized environment loading in `src/bootstrap.ts`. Migrated unit tests to Jest and added focused tests for URL, topic, parsing, text cleaning, and the Perplexity retry behavior. Deleted accidentally generated `.js` files left by an earlier compile run.

**Outcome:**

- Extracted helpers under `cron/src/lib` and `cron/src/types.ts` added
- Added `cron/src/bootstrap.ts`, `cron/jest.config.cjs`, and Jest tests under `cron/src/tests`
- Updated `cron/package.json` with npm scripts for `run`, `testFetch`, `testNotify`, and `testGlobalRanking`
- Investigated `npm audit` warnings (transitive `uuid`) and left safe state unchanged to avoid breaking downgrades

---

## 2026-05-23 — Rebuild plan: fresh repo, sliced port, parity-first discipline

**What happened:**
With cron and app both feature-complete but carrying accumulated structural debt (40-file WIP, duplicated configs, no shared tooling, no CI, App.tsx and DigestPage touched by everything), decided to rebuild in a fresh repository rather than refactor in place. Session was entirely planning — produced `REBUILD_PLAN.md`.

**Legacy strategy:**
Current `pulse-news/` will be renamed to `pulse-news-legacy/` (sibling directory, not subfolder — keeps imports, git history, and tooling globs clean). New empty `pulse-news/` next to it, fresh GitHub repo (`pulse-news-rebuild`). Claude Code relaunches in the new dir with legacy added as a working dir so both trees are readable. Per-slice prompts will reference legacy regions explicitly.

**Repo shape — workspaces rejected:**
Considered npm workspaces for shared eslint/tsconfig. Rejected: two consumers (`app/`, `cron/`) is not enough tooling justification. Root holds CI, husky, prettier, base eslint/tsconfig; subpackages keep their own configs and extend root. `shared/` keeps its existing role (consolidated `pulse.config.json` + config loader + types) but is not a standalone package — consumed via relative imports.

**Slicing:**
8 backend slices (shared → cron/config → fetch → dedup → rank → digest → notify → api). 6 frontend slices (foundation → auth-flow → digest-flow → settings-flow → article → notifications). Original frontend list (10 slices) collapsed after pushback that UI dependencies are too bidirectional to slice that fine — digest-flow bundles prefs+data+page+pager+sections as one PR. No `cron/currency` slice — currency fetching lives in the UI.

**Per-slice rule — improve structure, not behavior:**
Initial wording was ambiguous ("improve" allowed mid-slice). Tightened: structural improvements (extract helpers, rename, split files) allowed in the same PR; algorithm or output-changing improvements go to `todo.md` and ship in `fix/*` branches after parity. Rule of thumb: if legacy and rebuild would produce different output on the same input, it's a behavior change and must be deferred.

**Definition of caught up:**
Every bullet in `BEHAVIOR.md` implemented, every WIP fix from `todo.md` parity list incorporated, CI green on `develop`, local Expo build usable end-to-end without regression vs legacy. Then `develop` → `main`, tag v1.0.0, rename rebuild repo to `pulse-news`, archive the old one.

**Outcome:**

- `REBUILD_PLAN.md` — new, 9 sections covering legacy mechanics, BEHAVIOR.md spec, WIP snapshot, repo structure, tooling baseline, branching, slice order, per-slice discipline, caught-up definition
- Decision locked: rebuild in fresh repo, port slice-by-slice, parity first
- Next session: commit WIP, consolidate READMEs into `BEHAVIOR.md`, snapshot WIP into `todo.md`, then do the rename and start Phase 0 tooling

---

## 2026-05-23 (session 2) — Pre-rebuild prep: docs sync, storage migration, pipeline fixes

**What happened:**
Legacy codebase hardening before the rename — the rebuild slices will diff against this tree, so it needs to be accurate and consistent first.

**README audits:**
Both READMEs had significant drift from reality: app was missing 11 files, cron had a fully stale config table (flat keys, pre-restructure). Audited every source file and rewrote both docs to match.

**AsyncStorage → MMKV:**
Three files (`preferences.ts`, `useNavState.ts`, `register.ts`) still used AsyncStorage alongside MMKV. Consolidated to a single storage layer and removed the dependency — simpler to reason about in the rebuild.

**Fixes:**

- Node 20 WebSocket crash on first `npm run run` from WSL2 clone — installed `ws`, passed as `realtime.transport`
- FCM was firing before global headlines were persisted — reordered: persist → rank global → notify

**Outcome:**

- `app/README.md`, `cron/README.md` — synced to actual file tree
- `preferences.ts`, `useNavState.ts`, `register.ts` — AsyncStorage removed; dependency uninstalled
- `cron/src/notify.ts` — Node 20 WebSocket fix
- `cron/index.ts` — notification ordering fixed
- `.claude/commands/sync-work.md` — `/simplify` replaced with inline 6-pass analysis
