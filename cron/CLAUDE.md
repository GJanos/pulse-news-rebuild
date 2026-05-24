# cron/ — CLAUDE.md

## What this package does

Vercel cron jobs that:
1. Fetch regional headlines from Perplexity Sonar API (parallel, one call per region)
2. Deduplicate and rank headlines (per-region + global, via Claude)
3. Assemble digest JSON and persist to Supabase
4. Ping FCM to notify devices

## Dev commands

```bash
cd cron
npx tsc --noEmit              # typecheck
npm test                      # Jest
npm run test:coverage         # Jest + coverage
npx eslint --ext .ts src      # lint
```

## Module map (populated by slices)

| File | Role |
|---|---|
| `src/types.ts` | Core types — `RegionHeadline`, `RegionDigest`, `DigestSource`, `DigestUsage` |
| `src/config.ts` | Loads + merges `pulse.config.json` with defaults; env overrides; `createSource()`; `checkCronSecret` |
| `src/pipeline.ts` | `runFetchPipeline` (staggered `Promise.allSettled`); run log helpers |
| `src/fetchNews.ts` | `PerplexitySource` — implements `DigestSource`; retry loop; URL resolution and filtering |
| `src/rankHeadlines.ts` | Per-region Claude reorder + cross-region global selection |
| `src/notify.ts` | `persistDigests`, `persistGlobalDigest`, `dispatchFcm`, `sendNotifications` |
| `src/prompt.ts` | All prompt builders for fetch, ranking, and global selection |
| `src/regions.ts` | `resolveRegions()` (re-exports `ALL_REGIONS` from `@shared/regions`) |
| `src/logging.ts` | Winston logger factory |
| `src/bootstrap.ts` | dotenv loader — must be imported first by all runners |
| `src/lib/perplexityClient.ts` | HTTP client with iterative retry |
| `src/lib/parseHeadlines.ts` | URL resolution + quality annotation |
| `src/lib/urlUtils.ts` | Article URL validation and slug extraction |
| `src/lib/topicUtils.ts` | Jaccard deduplication, topic spread |
| `src/lib/textUtils.ts` | `stripCitations`, `summaryHasUrl` |
| `api/daily-digest.ts` | Vercel handler — fetch + persist + global rank + FCM (null-notify_at devices) |
| `api/notify.ts` | Vercel handler — FCM to devices in the current 30-minute window |
| `api/account.ts` | Vercel handler — device registration and account deletion |

## Environment variables

See `.env.example`. Never commit `.env`.

| Variable | Description |
|---|---|
| `PERPLEXITY_API_KEY` | Sonar API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Service-role key (bypasses RLS) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase private key (`\n` literal newlines) |

## Shared imports

```typescript
import type { Headline } from '@shared/types';
```

`@shared/*` → `../shared/src/*`. Configured in `tsconfig.json` and `jest.config.cjs`.

## Vercel deployment

`api/*.ts` files are Vercel serverless functions. Cron schedule defined in root `vercel.json`.

## Test strategy

Unit-test: ranking, deduplication, text utilities, URL filtering.
Skip: integration tests that need live API keys (Supabase, FCM, Perplexity) — run manually with dev runners.
Coverage target: 60–70% on logic that breaks silently.
