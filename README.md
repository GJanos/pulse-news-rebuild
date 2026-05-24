# Pulse — Personal News Digest App

A minimal, distraction-free daily news digest app. One notification. One tap. Regional headlines with short summaries and source links. That's it.

---

## The Problem

Reading the news is either too time-consuming or too algorithmically poisoned. Most news apps are designed to maximize engagement, not to inform quickly. The goal here is the opposite: get a concise, neutral overview of what matters in the regions you care about, once a day, then close it and move on.

---

## What It Does

- Sends a single push notification once a day
- Tapping the notification opens the app to a fresh digest
- The digest shows **3–5 major headlines per region**, each with a **2–3 sentence neutral summary** and a link to the original article
- Regions are configurable (e.g. Hungary, Ukraine, Russia, USA)
- No feed, no scroll, no algorithm, no engagement loop
- History: browse digests from the past week

---

## Architecture

```
Vercel Cron — /api/daily-digest (05:00 UTC daily)
  → Perplexity Sonar API × N regions (parallel)
    → format into digest JSON
      → store in Supabase
        → Firebase Cloud Messaging ping (null-notify_at devices)

Vercel Cron — /api/notify (every 30 min)
  → FCM ping to devices whose notify_at matches the current window
```

| Component           | Role                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Perplexity Sonar    | News source — one call per region; handles sourcing, recency, deduplication, summarization |
| Supabase            | Authoritative store for digests and device tokens                                          |
| Firebase (FCM)      | Lightweight "digest ready" ping; full content fetched from Supabase on tap                 |
| React Native (Expo) | Android-first app; local AsyncStorage cache + Supabase for recovery                        |

---

## Subsystems

| Directory   | README                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| `cron/`     | [cron/README.md](cron/README.md) — pipeline, config, how to run        |
| `app/`      | [app/README.md](app/README.md) — Expo setup, feature phases, data flow |
| `supabase/` | [supabase/README.md](supabase/README.md) — schema, RLS, V2 additions   |

---

## Decisions

| Topic            | Decision                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Platform         | Android first                                                                                           |
| News source      | Perplexity Sonar API — one call per region, parallel                                                    |
| Push strategy    | Cron writes to Supabase, then FCM ping; app fetches on tap                                              |
| Digest storage   | One row per region per date, shared across all users                                                    |
| Device identity  | UUID generated on first launch; resets on reinstall                                                     |
| Auth             | Supabase Auth — email/password; `user_preferences` keyed on `auth.uid()` (Phase 4, done)                |
| Device writes    | Publishable key + open INSERT/UPDATE RLS (MVP); V2: Edge Function with secret key                       |
| Source diversity | Prompt-driven (preferred outlets hint per region); domain allow-lists rejected — caused empty results   |
| URL quality      | Pattern filter on model output; HTTP HEAD validation rejected — news sites return 403 for section pages |
| Bias control     | Prompt-driven neutrality; `user_location.country` steers regional sourcing                              |
