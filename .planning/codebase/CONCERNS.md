# Codebase Concerns

**Analysis Date:** 2026-05-24

---

## Tech Debt

**Repo is Phase 0 only — no feature code exists yet:**

- Issue: `app/src/index.ts` and `cron/src/index.ts` are both `export {};` stubs. `shared/src/` is an empty `.gitkeep`. Zero implementation files have been ported from legacy.
- Files: `app/src/index.ts`, `cron/src/index.ts`, `shared/src/.gitkeep`
- Impact: The entire behavioral surface — 8 backend slices + 6 frontend slices — is unimplemented. Any feature planning must account for the full rebuild before production can be reached.
- Fix approach: Execute slices in order per `REBUILD_PLAN.md` §7. Backend first: `shared` → `cron/config` → `cron/fetch` → `cron/dedup` → `cron/rank` → `cron/digest` → `cron/notify` → `cron/api`. Then frontend: `app/foundation` → `app/auth-flow` → `app/digest-flow` → `app/settings-flow` → `app/article` → `app/notifications`.

**`moduleResolution: "node"` deprecated in TypeScript 6:**

- Issue: `tsconfig.base.json` sets `"moduleResolution": "node"`, which TypeScript 6 marks deprecated. `cron/tsconfig.json` carries `"ignoreDeprecations": "6.0"` to suppress the error.
- Files: `tsconfig.base.json`, `cron/tsconfig.json`
- Impact: The suppression works now but signals that both configs need migration to `"moduleResolution": "bundler"` (for app/) and `"moduleResolution": "node16"` or `"nodenext"` (for cron/). Deferring means more divergence accumulates before the forced migration.
- Fix approach: When landing `app/foundation`, switch `app/tsconfig.json` to extend `expo/tsconfig.base` (which uses `"bundler"`) and drop the `tsconfig.base.json` extension for app. For cron, migrate to `"node16"` after all cron slices land and verify imports use explicit extensions or path aliases.

**`CRON_SECRET` missing from `cron/.env.example`:**

- Issue: `todo.md` documents `CRON_SECRET` as a required Vercel env var that gates cron invocations. It is absent from `cron/.env.example`, so a developer setting up the project from scratch will not know to set it.
- Files: `cron/.env.example`
- Impact: A cron route deployed without `CRON_SECRET` set will accept any HTTP request — the `checkCronSecret` guard (referenced in `cron/CLAUDE.md`) will silently pass or fail in an undefined way depending on the unimplemented code.
- Fix approach: Add `CRON_SECRET=your_random_secret_here` to `cron/.env.example` with a comment explaining it must match the value set in the Vercel dashboard.

**`app/` has no Jest setup:**

- Issue: `app/package.json` has no Jest dependency, no `jest.config.cjs`, and no test script. The CI workflow has no `test-app` job.
- Files: `app/package.json`, `.github/workflows/ci.yml`
- Impact: App logic (auth state, deep link parsing, digest transformation) will ship without test coverage until the `app/foundation` slice adds `jest-expo`.
- Fix approach: `app/foundation` slice must add `jest-expo`, `ts-jest`, `@testing-library/react-native`, and a `jest.config.cjs`. CI must add a `test-app` job after that slice lands.

**`app/tsconfig.json` does not set `ignoreDeprecations` but inherits deprecated `moduleResolution`:**

- Issue: `app/tsconfig.json` extends `tsconfig.base.json` which uses `"moduleResolution": "node"`, but unlike `cron/tsconfig.json` it has no `ignoreDeprecations` suppressor. This will cause a typecheck failure when TypeScript 6 strictness is enforced on app.
- Files: `app/tsconfig.json`, `tsconfig.base.json`
- Impact: `npx tsc --noEmit` in app/ may produce deprecation warnings or errors in CI as soon as any `app/src/` file is added.
- Fix approach: Either add `"ignoreDeprecations": "6.0"` to `app/tsconfig.json` temporarily, or migrate to `expo/tsconfig.base` in the `app/foundation` slice (preferred — avoids the issue entirely).

---

## Security Considerations

**`devices` table RLS allows any authenticated user to read and write any device row:**

- Risk: `supabase/schema.sql` defines `"device self-select"` with `USING (true)`, `"device self-register"` with `WITH CHECK (true)`, and `"device self-update"` with `USING (true) WITH CHECK (true)`. Any authenticated user can SELECT all FCM tokens, INSERT device rows with arbitrary user IDs, and UPDATE any device row.
- Files: `supabase/schema.sql`
- Current mitigation: `todo.md` explicitly flags this as a known issue: "current policies use `USING (true)` / `WITH CHECK (true)`". Cron reads devices via the service-role key which bypasses RLS, so there is no server-side protection either.
- Recommendations: Restrict `SELECT` and `UPDATE` to `user_id = auth.uid()`. For anonymous devices (not yet linked to a user), route registration through the `api/account.ts` Vercel handler which can enforce identity server-side. This is specifically called out in `todo.md` as a V1 item.

**`CRON_SECRET` validation (`checkCronSecret`) is referenced but not yet implemented:**

- Risk: The Vercel cron handlers (`api/daily-digest.ts`, `api/notify.ts`) are expected to call `checkCronSecret` from `src/config.ts` to reject unauthorized invocations. Neither handler exists yet (cron src is a stub), so there is no guarantee the check will be wired when they are ported.
- Files: `cron/src/index.ts` (stub), `cron/CLAUDE.md` (module map reference)
- Current mitigation: None — no deployed endpoints yet.
- Recommendations: When implementing `cron/api` slice, the security review (`/security-review`) must verify that every Vercel handler calls `checkCronSecret` before doing any work. Add a unit test for the check.

**Firebase private key stored with literal `\n` in environment variable:**

- Risk: `FIREBASE_PRIVATE_KEY` must be stored with literal backslash-n (`\n`) rather than real newlines in Vercel and `.env`. This is a brittle pattern — misconfiguration silently produces an invalid PEM and FCM initialization fails at runtime with a cryptic error, not at startup.
- Files: `cron/.env.example`
- Current mitigation: `.env.example` documents the expected format. `cron/CLAUDE.md` notes the requirement.
- Recommendations: Add runtime validation in `src/config.ts` (when implemented) that checks `FIREBASE_PRIVATE_KEY.includes('\\n')` and throws a descriptive error at startup rather than letting Firebase Admin fail silently later.

**`SUPABASE_SECRET_KEY` (service-role key) used directly in cron — bypasses all RLS:**

- Risk: The service-role key grants full database access with no row-level restrictions. If it leaks (e.g., logged, included in error responses, or committed), the entire Supabase project is compromised.
- Files: `cron/.env.example`, `cron/CLAUDE.md`
- Current mitigation: Key is in `.env` (gitignored). `.env.example` uses a placeholder.
- Recommendations: When `src/config.ts` is implemented, ensure the key is never logged (not even partially). Never pass it to Perplexity or Anthropic API calls. Consider masking it in Winston log output.

**`app/.env.example` names `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` but column name in legacy is `anon`:**

- Risk: Minor naming inconsistency — the Supabase dashboard labels the key as `anon` key, but `app/.env.example` uses `PUBLISHABLE_KEY`. If the app slice uses `process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` but the developer copies the wrong key, auth will silently fail.
- Files: `app/.env.example`
- Current mitigation: None.
- Recommendations: Ensure the app slice's `src/supabase/client.ts` reads the exact variable name documented in `.env.example`. Add a startup assertion if the variable is empty.

---

## Performance Bottlenecks

**No module-level memory caches in app — they must be re-implemented per slice:**

- Problem: The legacy app has module-level `Map` caches in `useDigest`, `useGlobalHeadlines`, and `useCurrencyRates` that survive component remount and give zero-latency on revisits. These are described in `devlog.md` (2026-05-21) as a deliberate performance optimization that eliminated a header/content render dependency. The rebuild starts from scratch.
- Files: `app/src/index.ts` (stub — nothing implemented yet)
- Cause: Legacy patterns must be explicitly ported; they will not appear automatically.
- Improvement path: When porting `app/digest-flow`, copy the module-level cache pattern from `pulse-news-legacy/app/src/hooks/useDigest.ts` and `useCurrencyRates.ts`. Do not revert to `useState`-only caching.

**`digestPrefs` freeze pattern must be re-implemented:**

- Problem: The legacy app passes a frozen snapshot of preferences to `DigestPager` while settings is open, preventing every `selectedRegions` change from re-running `useDigest` on the JS thread. This pattern is documented in `devlog.md` (2026-05-21) and prevents UI jank during settings interaction.
- Files: Legacy `app/App.tsx`
- Cause: Not yet ported.
- Improvement path: Port the freeze pattern in the `app/digest-flow` or `app/settings-flow` slice. Reference `pulse-news-legacy/app/App.tsx`.

---

## Fragile Areas

**`cron/jest.config.cjs` coverage threshold set to 60% but no tests exist (`passWithNoTests: true`):**

- Files: `cron/jest.config.cjs`
- Why fragile: `passWithNoTests: true` makes the CI `test-cron` job pass with zero tests and zero coverage. The `coverageThreshold: { global: { lines: 60 } }` only triggers when there is at least one test file. A cron slice could be merged with incomplete tests and CI would not catch it.
- Safe modification: When the first cron slice adds test files, verify that removing `passWithNoTests: true` does not break CI on the main branch (it should not, since tests will exist). Remove `passWithNoTests` in the `cron/config` or `cron/fetch` slice PR.
- Test coverage: Zero tests currently. Target is 60–70% on ranking, dedup, URL filtering, and text utilities.

**Perplexity URL resolution is known to fail silently for `recency=day`:**

- Files: Legacy `cron/src/fetchNews.ts`, `cron/src/lib/parseHeadlines.ts`
- Why fragile: The devlog (2026-05-16) documents that `recency=day` returns 1–3 homepage-level search results, so `matchUrl` has no article URL candidates for some regions. This causes empty or low-quality digest entries with no error raised — the retry loop proceeds to `recency=week` silently.
- Safe modification: When porting `cron/fetch`, preserve the three-layer URL dedup and JUNK_PATH_PATTERNS exactly from legacy. The ITV article URL fix (removing `/\/watch\//` from junk patterns) must not be regressed.
- Test coverage: Legacy has `parseHeadlines.test.ts` and `urlUtils.test.ts` — port these in the same PR.

**FCM token staleness cleanup depends on `UNREGISTERED` error from Firebase:**

- Files: Legacy `cron/src/notify.ts`
- Why fragile: Stale FCM token deletion relies on Firebase returning `UNREGISTERED` error codes per-token in the multicast response. If Firebase changes error taxonomy or the batch response format, stale tokens accumulate silently, degrading notification delivery without any observable failure.
- Safe modification: When porting `cron/notify`, add a unit test that mocks the Firebase response with `UNREGISTERED` tokens and asserts the DELETE call is made with the correct token set.
- Test coverage: Not tested in legacy.

**Deep link password reset handles two URL patterns (PKCE and implicit):**

- Files: Legacy `app/src/hooks/useDeepLinkRecovery.ts`, `app/src/hooks/useSupabaseAuth.ts`
- Why fragile: The devlog (2026-05-17, 2026-05-19) documents a bug where `setSession()` always fires `SIGNED_IN`, never `PASSWORD_RECOVERY`, so the recovery screen was unreachable. The fix reads `type=recovery` from the URL hash before calling `setSession` and sets `isPasswordRecovery` synchronously. This ordering is critical and easy to get wrong during the port.
- Safe modification: When porting `app/auth-flow`, write a unit test for `useDeepLinkRecovery` that covers both the `pulse://reset-password?code=<pkce_code>` (PKCE) and the `pulse://reset-password#access_token=…&type=recovery` (implicit) patterns. This slice requires `/security-review`.
- Test coverage: Not tested in legacy.

**`preferences` flush pattern replaces a 5-second debounce loop — regression risk:**

- Files: Legacy `app/src/hooks/usePreferences.ts`
- Why fragile: The devlog (2026-05-21) replaces a per-`setPref` Supabase push and debounce loop with a `flush()` function called on settings close and app background. If the `flush()` call is missed in App.tsx wiring or the `AppState.addEventListener` is not set up, preference changes are lost silently on hard close.
- Safe modification: When porting `app/settings-flow` or `app/foundation`, add a test asserting `flush()` is called when `AppState` transitions to `background`.
- Test coverage: Not tested in legacy.

---

## Test Coverage Gaps

**No integration tests for Supabase, FCM, or Perplexity:**

- What's not tested: End-to-end flows: `persistDigests` writing to Supabase, `sendNotifications` sending to FCM, `fetchDigest` calling Perplexity Sonar. These are explicitly deferred to manual dev runners per `cron/CLAUDE.md`.
- Files: All `cron/src/` files (unimplemented), Legacy `cron/src/notify.ts`, `cron/src/fetchNews.ts`
- Risk: A config or schema change (e.g., Supabase column rename, FCM API version bump) will not be caught until a manual run.
- Priority: Medium — acceptable per project strategy. Document manual run procedure in `cron/README.md` when the relevant slices land.

**`app/` has no tests at all:**

- What's not tested: All of: auth state machine, deep link parsing, digest data transformation, cache/stale logic, preference sync conflict resolution.
- Files: `app/src/index.ts` (stub), `app/package.json` (no Jest)
- Risk: High. These are the paths that "break silently" per `BEHAVIOR.md`. Auth bugs and deep link misparses are invisible until a real device test.
- Priority: High — `app/foundation` slice must establish Jest before any logic slice lands.

**`shared/` has no tests and no test infrastructure:**

- What's not tested: Region constants, config schema, type exports. These are consumed by both app and cron so a regression here breaks everything.
- Files: `shared/src/.gitkeep`
- Risk: Low for constants; medium for config loader once it exists.
- Priority: Low until the `shared` slice adds real files; revisit then.

---

## Missing Critical Features

**All 14 rebuild slices are unimplemented:**

- Problem: The rebuild repo contains only Phase 0 tooling (ESLint, Prettier, TypeScript, Jest scaffold, Husky, CI). No `shared/` types, no `cron/` pipeline code, no `app/` UI code has been ported yet.
- Blocks: The app cannot be built or run. The cron cannot be deployed. No Vercel deployment is possible. Any test of user-facing behavior requires using `pulse-news-legacy/`.

**No `global_digests` table in `supabase/schema.sql`:**

- Problem: `BEHAVIOR.md` documents a `global_digests` table (one row per date, written by cron after cross-region ranking). `supabase/schema.sql` defines `digests`, `devices`, and `user_preferences` but not `global_digests`.
- Files: `supabase/schema.sql`
- Blocks: The `cron/rank` and `cron/digest` slices will need this table. Without it, global headline ranking cannot be persisted and the app's `showGlobalHeadlines` feature cannot work.
- Priority: Add the `global_digests` table definition to `supabase/schema.sql` in the `cron/digest` slice (or as a prerequisite migration).

**Vercel deployment not yet performed:**

- Problem: `todo.md` lists Vercel deployment as an open V1 item. `EXPO_PUBLIC_API_URL` is not set. The `api/account.ts` device registration endpoint (required for secure device registration) is not reachable.
- Files: `app/.env.example`, `vercel.json`
- Blocks: Server-side device registration via `/api/account`. The `devices` RLS tightening (see security section) depends on routing registration through this endpoint.

**`notify_at` per-user preference not yet wired:**

- Problem: `todo.md` notes that `notify_at` belongs to the user, not the device, and that the whole code path is being replaced. Currently `notify_at` is a column on the `devices` table. The `api/notify.ts` handler must read it from `user_preferences` instead for per-user notification times to work correctly.
- Files: `supabase/schema.sql`, legacy `cron/api/notify.ts`
- Blocks: Customized notification times (V1 feature per `BEHAVIOR.md`).

---

## Scaling Limits

**Cron cost scales with active regions, not users:**

- Current capacity: 8 regions active. Cost approximately $0.005 per Perplexity call × 8 regions = ~$0.04 per daily run for fetch. Ranking adds ~$0.002 per Claude call.
- Limit: At ~9 regions the devlog estimates $0.05/day total. Adding more regions linearly increases cost.
- Scaling path: Documented in `BEHAVIOR.md` — active region count is configurable via `api.regions` in `pulse.config.json`. No architectural change needed; cost monitoring is the constraint.

**`digests` table has no index beyond the composite primary key:**

- Current capacity: The schema comment notes "max ~56 rows (8 regions × 7 days)" and states no extra index is needed. Correct at current scale.
- Limit: If regions expand significantly (>20) or eviction is disabled, a range scan on `(region, date)` will remain fast but bulk SELECT for many regions at once may degrade.
- Scaling path: The current composite PK `(region, date)` is the right index for the primary query pattern. Revisit only if region count or retention window expands materially.

---

## Dependencies at Risk

**`@anthropic-ai/sdk` installed but no source files consume it:**

- Risk: Version `^0.97.0` is pinned in `cron/package.json` but there is no usage yet. If the SDK releases a breaking change before the `cron/rank` slice is implemented, the installed version may be incompatible with the API used in the legacy cron files.
- Impact: `cron/src/rankHeadlines.ts` (when ported) may need API call pattern changes.
- Migration plan: When porting `cron/rank`, check the SDK changelog between the legacy-used version and `^0.97.0`. The legacy `cron/src/rankHeadlines.ts` uses the `messages.create` API — verify the call signature is unchanged.

**`@supabase/supabase-js` installed but no source files consume it:**

- Risk: Same pattern as above. Version `^2.105.4` is installed. Schema or client API changes between the legacy-used version and the current install could affect `persistDigests`, `sendNotifications`, and app auth flows.
- Impact: `cron/src/notify.ts` and `app/src/supabase/client.ts` (when ported).
- Migration plan: Check breaking changes in the `@supabase/supabase-js` v2 changelog before implementing slices that use it.

**`firebase-admin` v13 installed — Firebase Admin SDK major version jump:**

- Risk: Legacy `cron/src/notify.ts` was written against an earlier version. Version 13 may have breaking changes in `initializeApp`, `getMessaging`, or `sendEachForMulticast`.
- Impact: FCM dispatch (`cron/src/notify.ts`) when ported.
- Migration plan: Review firebase-admin v13 release notes before the `cron/notify` slice. The legacy pattern initializes with `cert()` from env vars and calls `sendEachForMulticast` — confirm these APIs are unchanged in v13.

**`typescript: "^6.0.3"` in both `cron/` and `app/` — TypeScript 6 is a major version:**

- Risk: TypeScript 6 introduced breaking changes (deprecated `moduleResolution: "node"`, stricter inference). The `ignoreDeprecations: "6.0"` suppressor in `cron/tsconfig.json` is a workaround, not a fix. Future TypeScript 6.x minor releases may add new breaking changes.
- Impact: Typechecks may start failing without a code change if TypeScript 6.x tightens inference further.
- Migration plan: Track TypeScript 6.x release notes. Migrate `moduleResolution` to a supported mode before `ignoreDeprecations` stops being accepted.

---

## Known Bugs (from `todo.md` — must be incorporated in rebuild slices)

**Notification badge not cleared on app open from notification:**

- Symptoms: When tapping a push notification to open the app, the notification badge/icon persists and the notification itself does not disappear.
- Files: Legacy `app/src/notifications/register.ts`, `app/App.tsx`
- Trigger: Tap any FCM notification from killed or backgrounded state.
- Workaround: None documented.

**Currency cache uses current day in cache key:**

- Symptoms: Currency rate cache expires daily instead of using a much looser timeframe. Causes unnecessary re-fetches.
- Files: Legacy `app/src/hooks/useCurrencyRates.ts`
- Trigger: Any day transition.
- Workaround: None.

**Settings `maxRegions` value uses hardcoded constant instead of `config.fetchCount`:**

- Symptoms: The maximum allowed regions value is a fixed constant rather than reading from config.
- Files: Legacy `app/src/screens/SettingsScreen.tsx` or `RegionPicker.tsx`
- Trigger: Always.
- Workaround: None.

**Cron request retry recency logic is hardcoded:**

- Symptoms: The `day day day day week week` retry recency sequence is inline rather than extracted into config, making it hard to tune without code changes.
- Files: Legacy `cron/src/fetchNews.ts`
- Trigger: Any retry scenario.
- Workaround: None.

**Android swipe navigation conflicts with in-app gestures:**

- Symptoms: Android 10+ system back gesture interferes with DigestPager horizontal swipe navigation.
- Files: Legacy `app/src/components/DigestPager.tsx`
- Trigger: Swipe from screen edge on Android 10+.
- Workaround: None implemented yet. Fix requires `systemGestureExclusionRects` on the pager surface.

**Preferences still uses AsyncStorage in some paths (legacy):**

- Symptoms: Some preference paths in legacy use `AsyncStorage` alongside MMKV. The 2026-05-23 devlog entry notes AsyncStorage was removed in `preferences.ts`, `useNavState.ts`, and `register.ts` — but the `todo.md` item remains.
- Files: Legacy `app/src/storage/preferences.ts`
- Trigger: Preference reads/writes.
- Workaround: Rebuild slices must use MMKV exclusively.

---

_Concerns audit: 2026-05-24_
