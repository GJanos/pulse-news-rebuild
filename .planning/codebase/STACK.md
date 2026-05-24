# Technology Stack

**Analysis Date:** 2026-05-24

## Languages

**Primary:**

- TypeScript 6.0.3 — all source code in `cron/`, `app/`, and `shared/`

**Secondary:**

- SQL — Supabase schema definition in `supabase/schema.sql`

## Runtime

**Environment:**

- Node.js 20 (LTS) — required by CI (`actions/setup-node@v4` with `node-version: '20'`); local install v20.20.2

**Package Manager:**

- npm — used independently per package (`cron/`, `app/`, root)
- Lockfiles: `cron/package-lock.json`, `app/package-lock.json`, `package-lock.json` (all present)
- No npm workspaces — each package is managed independently

## Frameworks

**Backend / Cron:**

- Vercel Serverless Functions — `cron/api/*.ts` handlers; schedule defined in `vercel.json`
- Cron schedule: `/api/daily-digest` at `0 5 * * *` (5am UTC daily); `/api/notify` at `*/30 * * * *` (every 30 min)

**Frontend / App:**

- React Native + Expo — `app/` package; Android-first; Expo dev-client required (not Expo Go due to native FCM module)
- Navigation: `@react-navigation/native-stack` (stack only; no tabs/drawer)
- Note: `app/` `package.json` currently has no runtime dependencies listed — Expo and React Native packages are defined per CLAUDE.md but not yet installed (early build stage)

**Testing:**

- Jest 29.7.0 — `cron/` test runner
- ts-jest 29.2.5 — TypeScript preset for Jest in `cron/`
- Config: `cron/jest.config.cjs`

**Build/Dev:**

- TypeScript compiler (`tsc`) — `--noEmit` for typecheck; output to `cron/dist/` when built
- ts-node 10.9.2 — dev runner for `cron/` scripts

## Key Dependencies

**cron/ — Critical:**

- `@anthropic-ai/sdk ^0.97.0` — Claude API client for headline ranking (`cron/src/rankHeadlines.ts`)
- `@supabase/supabase-js ^2.105.4` — Supabase client for persisting digests and reading devices (`cron/src/notify.ts`)
- `firebase-admin ^13.0.0` — Firebase Admin SDK for FCM push notifications (`cron/src/notify.ts`)
- `ws ^8.21.0` — WebSocket client (used by Perplexity Sonar streaming API in `cron/src/lib/perplexityClient.ts`)
- `dotenv ^17.4.2` — Environment variable loader; must be imported first via `cron/src/bootstrap.ts`
- `winston ^3.11.0` — Structured logger (`cron/src/logging.ts`)

**app/ — Planned (per CLAUDE.md; not yet in package.json):**

- `@supabase/supabase-js` — Supabase client with MMKV-backed session persistence (`src/supabase/client.ts`)
- `react-native-mmkv` — Fast key-value storage for sessions and digest cache (`src/storage/mmkv.ts`)
- `@react-native-firebase/messaging` — FCM native module for push notifications (`src/notifications/register.ts`)
- `expo-linking` — Deep link handling (`src/hooks/useDeepLinkRecovery.ts`)
- `@react-native-async-storage/async-storage` — Used for Supabase session adapter

**Infrastructure:**

- `@types/node ^20.17.10` — Node type definitions
- `@types/jest ^29.5.14` — Jest type definitions
- `@types/ws ^8.18.1` — WebSocket type definitions

## Configuration

**Environment:**

- `cron/` loads env via `cron/src/bootstrap.ts` (dotenv); must be first import in all runners
- `cron/.env.example` — required vars: `PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `app/.env.example` — required vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `pulse.config.json` — runtime config (regions, fetch params, scheduling, log level); planned in `shared/` and loaded by both packages

**TypeScript:**

- Base config: `tsconfig.base.json` — target ES2020, module CommonJS, strict mode, `noUncheckedIndexedAccess`, `noImplicitReturns`
- `cron/tsconfig.json` — extends base; rootDir `./src`, outDir `./dist`; `@shared/*` path alias
- `app/tsconfig.json` — extends base; `jsx: react-native`; `@shared/*` path alias
- `ignoreDeprecations: "6.0"` in both consumer configs (TypeScript 6.0 compatibility shim)

**Path Alias:**

- `@shared/*` → `../shared/src/*` — configured via `paths` in both `tsconfig.json` files and `moduleNameMapper` in `cron/jest.config.cjs`

**Build:**

- `vercel.json` — defines cron schedules for the two Vercel handlers
- `cron/jest.config.cjs` — Jest config with ts-jest preset, `@shared/*` mapper, 60% line coverage threshold

## Code Quality Tooling

**Formatting:**

- Prettier 3.3.3 — config in `.prettierrc`: `semi: true`, `singleQuote: true`, `trailingComma: all`, `printWidth: 100`, `tabWidth: 2`
- Run from root: `npm run format` / `npm run format:check`

**Linting:**

- ESLint 8.57.1 — `@typescript-eslint/eslint-plugin ^6.21.0` + `@typescript-eslint/parser ^6.21.0`
- Root `.eslintrc.cjs` — `no-unused-vars` (error), `no-explicit-any` (error), `consistent-type-imports` (error), `no-console` (warn)

**Git Hooks:**

- Husky 9.1.7 — pre-commit runs `lint-staged`
- lint-staged: Prettier + `tsc --noEmit` on staged `cron/**/*.ts` and `app/**/*.{ts,tsx}`; Prettier only on `shared/**/*.ts` and `*.{json,md}`

## CI/CD

**CI:** GitHub Actions — `.github/workflows/ci.yml`

- Triggers: PRs to `develop` or `main`; pushes to `develop`
- Jobs: `format-and-lint` (root), `typecheck-cron`, `test-cron` (with coverage), `typecheck-app`
- Node version: 20 for all jobs

**Deployment:**

- Vercel — `cron/api/` handlers deployed as serverless functions

## Platform Requirements

**Development:**

- Node.js 20
- Android device/emulator for `app/` (Android-first; no iOS)
- `google-services.json` at `app/android/app/google-services.json` for FCM

**Production:**

- Vercel (cron handlers)
- Supabase (database + auth)
- Firebase (FCM push notifications)
- Perplexity Sonar API (news fetch)
- Anthropic Claude API (headline ranking)

---

_Stack analysis: 2026-05-24_
