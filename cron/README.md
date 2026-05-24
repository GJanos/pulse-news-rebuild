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

Dev runners (added by cron/* slices):

```bash
npm run testFetch           # fetch-only, no DB writes, prints headlines
npm run testNotify          # send FCM push to every registered device
npm run testGlobalRanking   # re-run global ranking on today's Supabase digests
npm run run                 # full pipeline: fetch + persist + FCM + quality log
```

---

## Environment variables

| Variable | Description |
|---|---|
| `PERPLEXITY_API_KEY` | Perplexity Sonar API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Service-role key (bypasses RLS) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase private key (newlines as `\n` in the string) |

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
