# Pulse — Cron Pipeline

Daily digest pipeline: fetches regional headlines from Perplexity, stores results in Supabase, and fires FCM push notifications to registered devices.

---

## Prerequisites

Node.js 20+. Copy `.env.example` to `.env` inside `cron/` and fill in all values.

---

## Install

```bash
cd cron
npm install
```

---

## Dev commands

All commands run from inside `cron/`.

```bash
npm run build           # tsc --noEmit (typecheck)
npm test                # run Jest test suite
npm run test:coverage   # Jest with coverage report
npm run lint            # ESLint on src/
```

E2E runners (call real APIs — require `.env` to be populated):

```bash
npm run e2e:fetch                           # fetch + rank, no DB writes
npm run e2e:full                            # full pipeline: fetch → persist → FCM → quality log
npm run e2e:notify                          # FCM push to all registered devices
npm run e2e:globalRanking                   # re-rank today's Supabase digests globally
npm run e2e:countryRanking -- US GB DE      # per-region rank on selected regions
```

---

## Environment variables

| Variable                | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| `PERPLEXITY_API_KEY`    | Perplexity Sonar API key                              |
| `SUPABASE_URL`          | Supabase project URL                                  |
| `SUPABASE_SECRET_KEY`   | Service-role key (bypasses RLS)                       |
| `FIREBASE_PROJECT_ID`   | Firebase project ID                                   |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email                        |
| `FIREBASE_PRIVATE_KEY`  | Firebase private key (newlines as `\n` in the string) |

`SUPABASE_PUBLISHABLE_KEY` is not used here — cron uses the secret key directly.

---

## Configuration

Runtime config lives in `shared/pulse.config.json`. See `shared/CLAUDE.md` for the full field reference.

---

## Pipeline

```
loadPulseConfig() → createSource()
  → runFetchPipeline()
      → resolveRegions()
      → fetchDigest() × N  [Promise.allSettled, staggered]
          → Perplexity retry loop
          → parseHeadlines() → URL filter + slug dedup + topic dedup
          → rankHeadlines()  [Claude — per-region reorder]
  → persistDigests()         [upsert to Supabase]
  → rankGlobalHeadlines()    [Claude — cross-region top stories]
  → persistGlobalDigest()
  → sendNotifications()      [FCM multicast]
  → writeRunLog()
```

`api/daily-digest.ts` follows the same path but only FCM-pings devices with `notify_at = NULL`. `api/notify.ts` handles devices with a specific scheduled time.

---

## Key source files

See `cron/CLAUDE.md` for the full module map.
