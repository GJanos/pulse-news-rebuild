# Phase 0 — Tooling Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the full Phase 0 tooling baseline — ESLint, Prettier, TypeScript, Jest, Husky, GitHub Actions CI, CODEOWNERS, and CLAUDE.md files — across root/shared/app/cron before any feature slice begins.

**Architecture:** Root package owns shared devtools (Prettier, ESLint root config, Husky, lint-staged). cron/ and app/ each have their own package.json with their own deps, a tsconfig.json that extends the shared base, and an .eslintrc.cjs that extends the root config. No npm workspaces. `shared/` is consumed by app/ and cron/ via the `@shared/*` TS path alias (→ `../shared/src/*`). CI installs and checks each package independently.

**Tech Stack:** TypeScript 5.9, ESLint 8.57 + @typescript-eslint 6, Prettier 3.3, Jest 29 + ts-jest 29, Husky 9, lint-staged 15, GitHub Actions ubuntu-latest / Node 20.

---

## File Map

**Created by this plan:**

- `package.json` — root devtools (ESLint, Prettier, Husky, lint-staged)
- `package-lock.json` — root lockfile
- `.prettierrc` — format rules
- `.eslintrc.cjs` — root ESLint config, extended by subpackages
- `tsconfig.base.json` — shared TS compiler options
- `CLAUDE.md` — repo-wide Claude instructions
- `CODEOWNERS` — GitHub ownership
- `.github/workflows/ci.yml` — CI: format + lint + typecheck + test per package
- `.husky/pre-commit` — pre-commit hook (runs lint-staged)
- `shared/CLAUDE.md` — Claude instructions for shared/
- `shared/src/.gitkeep` — placeholder (filled by shared slice)
- `cron/package.json` — cron devtools + runtime deps
- `cron/package-lock.json`
- `cron/tsconfig.json` — extends tsconfig.base.json
- `cron/.eslintrc.cjs` — extends root .eslintrc.cjs
- `cron/jest.config.cjs` — ts-jest, @shared alias
- `cron/src/.gitkeep` — placeholder (filled by cron/\* slices)
- `cron/README.md` — Vercel/Supabase setup (ported from legacy)
- `cron/CLAUDE.md` — Claude instructions for cron/
- `app/package.json` — app devtools (Expo + runtime added in app/foundation)
- `app/package-lock.json`
- `app/tsconfig.json` — extends tsconfig.base.json (updated to expo/tsconfig.base in app/foundation)
- `app/.eslintrc.cjs` — extends root .eslintrc.cjs
- `app/src/.gitkeep` — placeholder (filled by app/\* slices)
- `app/README.md` — Expo dev setup (ported from legacy)
- `app/CLAUDE.md` — Claude instructions for app/

**Not created here (belongs to slices):**

- `shared/src/*` — shared slice
- `shared/pulse.config.json` — shared slice
- `cron/src/*` — cron/\* slices
- `cron/api/*` — cron/api slice
- `app/src/*` — app/\* slices
- `app/App.tsx`, `app/index.ts`, `app/app.json`, `app/babel.config.js` — app/foundation slice

---

### Task 1: Root package.json + Prettier

**Files:**

- Create: `package.json`
- Create: `.prettierrc`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "pulse-news",
  "private": true,
  "scripts": {
    "prepare": "husky",
    "lint": "eslint --ext .ts,.tsx . --ignore-path .gitignore",
    "lint:fix": "eslint --ext .ts,.tsx . --ignore-path .gitignore --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\" --ignore-path .gitignore",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\" --ignore-path .gitignore"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.21.0",
    "@typescript-eslint/parser": "^6.21.0",
    "eslint": "^8.57.1",
    "husky": "^9.1.7",
    "lint-staged": "^15.2.10",
    "prettier": "^3.3.3"
  },
  "lint-staged": {
    "cron/**/*.ts": ["prettier --write", "bash -c 'npx tsc --noEmit --project cron/tsconfig.json'"],
    "app/**/*.{ts,tsx}": [
      "prettier --write",
      "bash -c 'npx tsc --noEmit --project app/tsconfig.json'"
    ],
    "shared/**/*.ts": ["prettier --write"],
    "**/*.{json,md}": ["prettier --write"]
  }
}
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 3: Install root dependencies**

```bash
cd /home/hp/projects/pulse-news && npm install
```

Expected: `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 4: Verify Prettier runs**

```bash
cd /home/hp/projects/pulse-news && echo 'const x={a:1,b:2}' > /tmp/fmt-check.ts && npx prettier --check /tmp/fmt-check.ts; echo "exit $?"
```

Expected: Prettier reports "Forgot to run Prettier?" (exit 1). That means it's working — the file is intentionally unformatted.

- [ ] **Step 5: Commit**

```bash
cd /home/hp/projects/pulse-news
git add package.json package-lock.json .prettierrc
git commit -m "chore: add root package.json and Prettier config"
```

---

### Task 2: TypeScript base config

**Files:**

- Create: `tsconfig.base.json`

- [ ] **Step 1: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 2: Verify it is valid JSON**

```bash
cd /home/hp/projects/pulse-news && node -e "JSON.parse(require('fs').readFileSync('tsconfig.base.json','utf8'))" && echo "valid"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add tsconfig.base.json
git commit -m "chore: add shared TypeScript base config"
```

---

### Task 3: Root ESLint config

**Files:**

- Create: `.eslintrc.cjs`

- [ ] **Step 1: Create `.eslintrc.cjs`**

```js
'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2020: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    'no-console': 'warn',
  },
  ignorePatterns: ['node_modules/', 'dist/', '.expo/', 'android/', '*.config.js', '*.config.cjs'],
};
```

- [ ] **Step 2: Verify ESLint starts without crashing**

```bash
cd /home/hp/projects/pulse-news && npx eslint --ext .ts . --ignore-path .gitignore 2>&1 | head -10
```

Expected: No "Cannot find module" errors. No output or only warnings about no TS files found. Exit 0.

- [ ] **Step 3: Commit**

```bash
git add .eslintrc.cjs
git commit -m "chore: add root ESLint config"
```

---

### Task 4: cron/ tooling

**Files:**

- Create: `cron/package.json`
- Create: `cron/tsconfig.json`
- Create: `cron/.eslintrc.cjs`
- Create: `cron/jest.config.cjs`
- Create: `cron/src/.gitkeep`

- [ ] **Step 1: Create `cron/package.json`**

Runtime dependencies (anthropic, supabase-js, firebase-admin, dotenv, winston, ws) are included here because they are needed by all cron slices and installing them per-slice would cause integration issues. DevDeps cover TypeScript, testing, and the ts-node runner used by dev scripts.

```json
{
  "name": "pulse-cron",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "build": "tsc --noEmit",
    "lint": "eslint --ext .ts src",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@types/node": "^20.17.10",
    "@types/ws": "^8.18.1",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.2"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.97.0",
    "@supabase/supabase-js": "^2.105.4",
    "dotenv": "^17.4.2",
    "firebase-admin": "^13.0.0",
    "winston": "^3.11.0",
    "ws": "^8.21.0"
  }
}
```

- [ ] **Step 2: Create `cron/tsconfig.json`**

`rootDir: "./src"` scopes compilation to source files for Phase 0. The cron/api slice will expand `include` to add `"api/**/*"` and adjust rootDir accordingly.

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `cron/.eslintrc.cjs`**

```js
'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['../.eslintrc.cjs'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
```

- [ ] **Step 4: Create `cron/jest.config.cjs`**

`setupFiles` is omitted here because `src/bootstrap.ts` (the dotenv loader) does not exist until the cron/config slice. It will be added then.

```js
'use strict';

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
  coverageThreshold: {
    global: { lines: 60 },
  },
};
```

- [ ] **Step 5: Install cron dependencies**

```bash
cd /home/hp/projects/pulse-news/cron && npm install
```

Expected: `cron/node_modules/` created, `cron/package-lock.json` written. No errors.

- [ ] **Step 6: Write a Jest smoke test**

Create `cron/src/smoke.test.ts`:

```typescript
describe('jest smoke', () => {
  it('2 + 2 is 4', () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 7: Run the smoke test — must pass**

```bash
cd /home/hp/projects/pulse-news/cron && npx jest src/smoke.test.ts --no-coverage
```

Expected:

```
PASS src/smoke.test.ts
  jest smoke
    ✓ 2 + 2 is 4
```

- [ ] **Step 8: Run typecheck — must pass**

```bash
cd /home/hp/projects/pulse-news/cron && npx tsc --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 9: Delete the smoke test and add src/ placeholder**

```bash
rm /home/hp/projects/pulse-news/cron/src/smoke.test.ts
touch /home/hp/projects/pulse-news/cron/src/.gitkeep
```

- [ ] **Step 10: Commit**

```bash
cd /home/hp/projects/pulse-news
git add cron/
git commit -m "chore: scaffold cron/ tooling (TypeScript, ESLint, Jest + ts-jest)"
```

---

### Task 5: app/ tooling

**Files:**

- Create: `app/package.json`
- Create: `app/tsconfig.json`
- Create: `app/.eslintrc.cjs`
- Create: `app/src/.gitkeep`

Note: Expo and all React Native runtime dependencies are added in the `app/foundation` slice. `app/tsconfig.json` currently extends `tsconfig.base.json`; the foundation slice will switch it to extend `expo/tsconfig.base`. Jest for app/ also requires `jest-expo` which needs Expo — this is deferred to the foundation slice. Phase 0 covers typecheck and lint only for app/.

- [ ] **Step 1: Create `app/package.json`**

```json
{
  "name": "pulse-app",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "build": "tsc --noEmit",
    "lint": "eslint --ext .ts,.tsx src"
  },
  "devDependencies": {
    "@types/node": "^20.17.10",
    "@types/react": "^19.1.1",
    "typescript": "^5.9.2"
  },
  "dependencies": {}
}
```

- [ ] **Step 2: Create `app/tsconfig.json`**

`jsx: "react-native"` is required for TSX parsing. The foundation slice will replace `extends` with `expo/tsconfig.base` and add `moduleResolution: "bundler"`.

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-native",
    "lib": ["ES2020"],
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "android", "ios", ".expo"]
}
```

- [ ] **Step 3: Create `app/.eslintrc.cjs`**

```js
'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['../.eslintrc.cjs'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: false,
  },
};
```

- [ ] **Step 4: Install app devDependencies**

```bash
cd /home/hp/projects/pulse-news/app && npm install
```

Expected: `app/node_modules/` created, `app/package-lock.json` written. No errors.

- [ ] **Step 5: Verify typecheck passes on empty src/**

```bash
mkdir -p /home/hp/projects/pulse-news/app/src
touch /home/hp/projects/pulse-news/app/src/.gitkeep
cd /home/hp/projects/pulse-news/app && npx tsc --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
cd /home/hp/projects/pulse-news
git add app/package.json app/package-lock.json app/tsconfig.json app/.eslintrc.cjs app/src/.gitkeep
git commit -m "chore: scaffold app/ tooling (TypeScript, ESLint; Jest + Expo deferred to app/foundation)"
```

---

### Task 6: shared/ scaffold

**Files:**

- Create: `shared/CLAUDE.md`
- Create: `shared/src/.gitkeep`

- [ ] **Step 1: Create `shared/CLAUDE.md`**

````markdown
# shared/

Source of truth for all types, config schema, region/currency constants, and utilities shared between `app/` and `cron/`.

## Rules

- No imports from `app/` or `cron/` inside `shared/`. It has zero runtime consumers in its own dependency graph.
- If a type or constant is used by both packages, it belongs here. If it is used by only one, it belongs in that package.
- `shared/` has no `package.json`. It is not a standalone package. Both consumers compile it directly via the `@shared/*` TS path alias.

## Import pattern

```typescript
import type { Headline } from '@shared/types';
import { REGIONS } from '@shared/regions';
```
````

Alias `@shared/*` resolves to `../shared/src/*`. Configured in each package's `tsconfig.json` `paths` and `jest.config.cjs` `moduleNameMapper`.

## Contents (added by slices)

- `src/types.ts` — shared TypeScript types (Headline, Digest, Region, UserPreferences …)
- `src/regions.ts` — region code constants and metadata
- `src/config.ts` — pulse.config.json loader and schema
- `pulse.config.json` — runtime config (regions, fetch params, scheduling, log level)

````

- [ ] **Step 2: Create src/ placeholder**

```bash
mkdir -p /home/hp/projects/pulse-news/shared/src
touch /home/hp/projects/pulse-news/shared/src/.gitkeep
````

- [ ] **Step 3: Commit**

```bash
cd /home/hp/projects/pulse-news
git add shared/
git commit -m "chore: scaffold shared/ directory and CLAUDE.md"
```

---

### Task 7: Human-facing READMEs

Port cron/ and app/ READMEs from legacy, stripping legacy-only content and updating for the rebuild structure.

**Files:**

- Create: `cron/README.md`
- Create: `app/README.md`

- [ ] **Step 1: Create `cron/README.md`**

````markdown
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
````

---

## Dev commands

All commands run from inside `cron/`.

```bash
npm run build           # tsc --noEmit (typecheck)
npm test                # run Jest test suite
npm run test:coverage   # Jest with coverage report
npm run lint            # ESLint on src/
```

Dev runners (added by cron/\* slices):

```bash
npm run testFetch           # fetch-only, no DB writes, prints headlines
npm run testNotify          # send FCM push to every registered device
npm run testGlobalRanking   # re-run global ranking on today's Supabase digests
npm run run                 # full pipeline: fetch + persist + FCM + quality log
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

````

- [ ] **Step 2: Create `app/README.md`**

```markdown
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
````

---

## Environment variables

Copy `.env.example` to `.env` inside `app/` and fill in:

| Variable                        | Description                     |
| ------------------------------- | ------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Supabase project URL            |
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

````

- [ ] **Step 3: Commit**

```bash
cd /home/hp/projects/pulse-news
git add cron/README.md app/README.md
git commit -m "docs: port cron/ and app/ READMEs from legacy"
````

---

### Task 8: CLAUDE.md files

**Files:**

- Create: `CLAUDE.md` (root)
- Create: `cron/CLAUDE.md`
- Create: `app/CLAUDE.md`

- [ ] **Step 1: Create root `CLAUDE.md`**

```markdown
# Pulse News — CLAUDE.md

## Repo layout
```

pulse-news/
├── shared/ ← types, config, region constants (no package.json; compiled by consumers)
├── app/ ← React Native / Expo, Android-first
├── cron/ ← Vercel cron jobs, Node.js
└── supabase/ ← schema reference only (no code)

```

## Build & test commands

| Package | Typecheck | Lint | Test |
|---------|-----------|------|------|
| cron | `cd cron && npx tsc --noEmit` | `cd cron && npx eslint --ext .ts src` | `cd cron && npm test` |
| app | `cd app && npx tsc --noEmit` | `cd app && npx eslint --ext .ts,.tsx src` | deferred to app/foundation |

Prettier (run from root): `npm run format:check` / `npm run format`

## Branching

```

main ← protected; merges from develop only; tagged releases
develop ← protected; all feature slices merge here; CI must be green
feat/_ ← one slice per branch
fix/_ ← one bug per branch (post-parity only)

````

Never commit directly to `main` or `develop`. Always open a PR.

## Slice discipline

- **One slice = one PR to `develop`.**
- Match legacy behavior exactly — same inputs, same outputs. Structural improvements (renaming, extracting helpers) are allowed. Algorithm changes are not — defer them to `todo.md`.
- Before opening a PR: `/code-review`.
- On slices touching auth, notifications, API endpoints, or deep links: `/security-review`.
- PR description must link the legacy file(s) it replaces.
- Tests in the same PR. Target 60–70% line coverage on logic that breaks silently.

## Legacy reference

Legacy codebase: `/home/hp/projects/pulse-news-legacy/`

When starting a slice: read the corresponding legacy file first, then port behavior exactly.
Do not delete the legacy repo until parity is declared and `v1.0.0` is tagged.

## Shared imports

```typescript
import type { Headline } from '@shared/types';
import { REGIONS } from '@shared/regions';
````

`@shared/*` resolves to `../shared/src/*`. Configured via `paths` in each `tsconfig.json` and `moduleNameMapper` in each `jest.config.cjs`.

## No npm workspaces

Run `npm install` inside each package directory independently.
Root `npm install` installs only shared devtools (Prettier, ESLint, Husky).

## CI

GitHub Actions runs on every PR to `develop` or `main`:

- format:check (root)
- lint (root, covering all packages)
- typecheck per package
- jest (cron)

````

- [ ] **Step 2: Create `cron/CLAUDE.md`**

```markdown
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
````

## Module map (populated by slices)

| File                          | Role                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/types.ts`                | Core types — `RegionHeadline`, `RegionDigest`, `DigestSource`, `DigestUsage`                         |
| `src/config.ts`               | Loads + merges `pulse.config.json` with defaults; env overrides; `createSource()`; `checkCronSecret` |
| `src/pipeline.ts`             | `runFetchPipeline` (staggered `Promise.allSettled`); run log helpers                                 |
| `src/fetchNews.ts`            | `PerplexitySource` — implements `DigestSource`; retry loop; URL resolution and filtering             |
| `src/rankHeadlines.ts`        | Per-region Claude reorder + cross-region global selection                                            |
| `src/notify.ts`               | `persistDigests`, `persistGlobalDigest`, `dispatchFcm`, `sendNotifications`                          |
| `src/prompt.ts`               | All prompt builders for fetch, ranking, and global selection                                         |
| `src/regions.ts`              | `resolveRegions()` (re-exports `ALL_REGIONS` from `@shared/regions`)                                 |
| `src/logging.ts`              | Winston logger factory                                                                               |
| `src/bootstrap.ts`            | dotenv loader — must be imported first by all runners                                                |
| `src/lib/perplexityClient.ts` | HTTP client with iterative retry                                                                     |
| `src/lib/parseHeadlines.ts`   | URL resolution + quality annotation                                                                  |
| `src/lib/urlUtils.ts`         | Article URL validation and slug extraction                                                           |
| `src/lib/topicUtils.ts`       | Jaccard deduplication, topic spread                                                                  |
| `src/lib/textUtils.ts`        | `stripCitations`, `summaryHasUrl`                                                                    |
| `api/daily-digest.ts`         | Vercel handler — fetch + persist + global rank + FCM (null-notify_at devices)                        |
| `api/notify.ts`               | Vercel handler — FCM to devices in the current 30-minute window                                      |
| `api/account.ts`              | Vercel handler — device registration and account deletion                                            |

## Environment variables

See `.env.example`. Never commit `.env`.

| Variable                | Description                                  |
| ----------------------- | -------------------------------------------- |
| `PERPLEXITY_API_KEY`    | Sonar API key                                |
| `SUPABASE_URL`          | Supabase project URL                         |
| `SUPABASE_SECRET_KEY`   | Service-role key (bypasses RLS)              |
| `FIREBASE_PROJECT_ID`   | Firebase project ID                          |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email               |
| `FIREBASE_PRIVATE_KEY`  | Firebase private key (`\n` literal newlines) |

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

````

- [ ] **Step 3: Create `app/CLAUDE.md`**

```markdown
# app/ — CLAUDE.md

## What this package does

React Native (Expo) app, Android-first. Fetches daily digests from Supabase on notification tap. One push notification per day.

## Dev commands

```bash
cd app
npx tsc --noEmit                    # typecheck
npx eslint --ext .ts,.tsx src       # lint
npm test                            # Jest (available after app/foundation)
npx expo start --dev-client         # dev server (after app/foundation)
npx expo run:android                # build + install on Android (after app/foundation)
````

## Module map (populated by slices)

| File                               | Role                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `App.tsx`                          | Root: font loading, screen routing; composes `useAppServices` + `useAppNavigation` |
| `src/types.ts`                     | Domain types (`Region`, `Headline`, `Digest`, `UserPreferences`, …)                |
| `src/config.ts`                    | Typed re-export of `pulse.config.json` + `API_URL` constant                        |
| `src/data.ts`                      | Re-exports `REGIONS` from `@shared`; `sortedSelectedRegions`, date helpers         |
| `src/themes.ts`                    | `THEMES`, `AESTHETICS`, `font()` helper                                            |
| `src/logger.ts`                    | Structured logger; level from `pulse.config.json`                                  |
| `src/supabase/client.ts`           | Lazy Supabase client; MMKV-backed session persistence                              |
| `src/storage/mmkv.ts`              | Shared MMKV instance                                                               |
| `src/storage/preferences.ts`       | MMKV cache + Supabase pull/push; conflict resolution via `updatedAt`               |
| `src/storage/digests.ts`           | Cache-first digest storage; stale window for today; immutable past dates           |
| `src/notifications/register.ts`    | FCM token + Supabase upsert; `linkDeviceToUser`; `registerNotificationHandlers`    |
| `src/hooks/useAppServices.ts`      | Aggregates auth + device + preferences + theme for `App.tsx`                       |
| `src/hooks/useAppNavigation.ts`    | Nav state + Android back + FCM routing + auth-gate redirects                       |
| `src/hooks/useSupabaseAuth.ts`     | Session management — sign in/up/out/reset/delete                                   |
| `src/hooks/useDeepLinkRecovery.ts` | `pulse://reset-password` PKCE + implicit token exchange                            |
| `src/hooks/useDigest.ts`           | Module-level cache + stale window + `forceRefresh`                                 |
| `src/hooks/useCurrencyRates.ts`    | jsDelivr/Cloudflare fallback; % change computation; module-level cache             |

## Expo gotchas

- Use `expo-linking` (not RN core `Linking`) for all deep links.
- `AsyncStorage` is `@react-native-async-storage/async-storage`, not a core import.
- Navigation: `@react-navigation/native-stack` — stack only, no tabs or drawer.
- FCM: `@react-native-firebase/messaging` (native module). Expo Go will not work.

## Android only

Do not add iOS-specific code. `ios/` directory is not committed.
`google-services.json` must be at `app/android/app/google-services.json` for FCM.

## Shared imports

```typescript
import type { Digest } from '@shared/types';
import { REGIONS } from '@shared/regions';
```

`@shared/*` → `../shared/src/*`. Configured in `tsconfig.json`; Jest alias added in `app/foundation`.

## Test strategy

Test hooks and pure utilities with Jest + ts-jest (no renderer).
Component tests use `@testing-library/react-native` + `jest-expo` (foundation slice).
Skip snapshot tests on presentation components.
Target 60–70% on: auth state, deep link parsing, digest data transformation.

````

- [ ] **Step 4: Commit**

```bash
cd /home/hp/projects/pulse-news
git add CLAUDE.md cron/CLAUDE.md app/CLAUDE.md
git commit -m "docs: add root, cron/, and app/ CLAUDE.md files"
````

---

### Task 9: Husky + lint-staged pre-commit hook

**Files:**

- Create: `.husky/pre-commit`

Husky 9 does not use the `_/husky.sh` shim. The hook file is a plain shell script. The `prepare` script in root `package.json` (already written in Task 1) initializes Husky when `npm install` runs.

- [ ] **Step 1: Initialize Husky (creates the .husky/ directory)**

```bash
cd /home/hp/projects/pulse-news && npx husky init
```

Expected: `.husky/pre-commit` created with a default `npm test` line.

- [ ] **Step 2: Overwrite `.husky/pre-commit`**

```sh
npx lint-staged
```

Write exactly this one line. No shebang, no sourcing — Husky 9 handles that.

- [ ] **Step 3: Verify the hook is executable**

```bash
ls -la /home/hp/projects/pulse-news/.husky/pre-commit
```

Expected: `-rwxr-xr-x` permissions (husky init sets this automatically).

- [ ] **Step 4: Smoke-test lint-staged against a staged file**

```bash
cd /home/hp/projects/pulse-news
echo 'export const x   =   1' > /tmp/staged-test.ts
cp /tmp/staged-test.ts ./staged-test.ts
git add staged-test.ts
npx lint-staged
git restore --staged staged-test.ts
rm staged-test.ts
```

Expected: Prettier reformats `staged-test.ts`. ESLint runs (may warn about `no-console` if any console calls). lint-staged exits 0.

- [ ] **Step 5: Commit**

```bash
cd /home/hp/projects/pulse-news
git add .husky/
git commit -m "chore: add Husky pre-commit hook with lint-staged"
```

---

### Task 10: GitHub Actions CI + CODEOWNERS

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `CODEOWNERS`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```bash
mkdir -p /home/hp/projects/pulse-news/.github/workflows
```

```yaml
name: CI

on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop]

jobs:
  format-and-lint:
    name: Format & Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint

  typecheck-cron:
    name: Typecheck cron/
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: cron/package-lock.json
      - run: npm ci
        working-directory: cron
      - run: npx tsc --noEmit
        working-directory: cron

  test-cron:
    name: Test cron/
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: cron/package-lock.json
      - run: npm ci
        working-directory: cron
      - run: npm run test:coverage
        working-directory: cron

  typecheck-app:
    name: Typecheck app/
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: app/package-lock.json
      - run: npm ci
        working-directory: app
      - run: npx tsc --noEmit
        working-directory: app
```

- [ ] **Step 2: Create `CODEOWNERS`**

```
# All files — Janos Gorondi owns everything until additional contributors join.
* @GJanos
```

- [ ] **Step 3: Commit**

```bash
cd /home/hp/projects/pulse-news
git add .github/ CODEOWNERS
git commit -m "ci: add GitHub Actions CI workflow and CODEOWNERS"
```

---

### Task 11: End-to-end local CI simulation

Simulate the full CI pipeline locally before declaring Phase 0 complete.

- [ ] **Step 1: Format check (root)**

```bash
cd /home/hp/projects/pulse-news && npm run format:check
```

Expected: exit 0. If any files fail, run `npm run format` then re-check.

- [ ] **Step 2: Lint (root — covers all packages)**

```bash
cd /home/hp/projects/pulse-news && npm run lint
```

Expected: exit 0. No TS source files exist yet in src/ dirs, so nothing to lint. Fine.

- [ ] **Step 3: cron typecheck**

```bash
cd /home/hp/projects/pulse-news/cron && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: cron tests**

```bash
cd /home/hp/projects/pulse-news/cron && npm test
```

Expected: "No tests found" or 0 test files (smoke test was deleted). Exit 0 with a "no tests" message. Acceptable — real tests come with slices.

- [ ] **Step 5: app typecheck**

```bash
cd /home/hp/projects/pulse-news/app && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 6: Verify clean working tree**

```bash
cd /home/hp/projects/pulse-news && git status
```

Expected: `nothing to commit, working tree clean`.

---

## Self-Review

### Spec coverage

| REBUILD_PLAN §4 requirement                                     | Status                                     |
| --------------------------------------------------------------- | ------------------------------------------ |
| `.github/workflows/ci.yml`                                      | ✓ Task 10                                  |
| `.husky/`                                                       | ✓ Task 9                                   |
| `.gitignore`                                                    | Already exists                             |
| `.prettierrc`                                                   | ✓ Task 1                                   |
| `.eslintrc.cjs` (root)                                          | ✓ Task 3                                   |
| `tsconfig.base.json`                                            | ✓ Task 2                                   |
| `README.md`                                                     | Already exists                             |
| `BEHAVIOR.md`, `REBUILD_PLAN.md`, `devlog.md`, `todo.md`        | Already exist                              |
| `CLAUDE.md` (root)                                              | ✓ Task 8                                   |
| `CODEOWNERS`                                                    | ✓ Task 10                                  |
| `shared/CLAUDE.md`                                              | ✓ Task 6                                   |
| `shared/pulse.config.json`                                      | **Deferred to shared slice** (not Phase 0) |
| `shared/src/`                                                   | ✓ placeholder Task 6                       |
| `app/README.md`, `app/CLAUDE.md`                                | ✓ Tasks 7, 8                               |
| `app/package.json`, `app/tsconfig.json`, `app/.eslintrc.cjs`    | ✓ Task 5                                   |
| `cron/README.md`, `cron/CLAUDE.md`                              | ✓ Tasks 7, 8                               |
| `cron/package.json`, `cron/tsconfig.json`, `cron/.eslintrc.cjs` | ✓ Task 4                                   |

| REBUILD_PLAN §5 requirement                                     | Status                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ESLint + `@typescript-eslint` — root + subpackages extend       | ✓ Tasks 3, 4, 5                                                                             |
| Prettier — root config                                          | ✓ Task 1                                                                                    |
| TypeScript — `tsc --noEmit` per package, shared base            | ✓ Tasks 2, 4, 5                                                                             |
| Jest + `ts-jest` in cron/                                       | ✓ Task 4                                                                                    |
| Jest in app/                                                    | **Deferred to app/foundation** (requires `jest-expo`)                                       |
| Husky + lint-staged — pre-commit: format + typecheck            | ✓ Task 9                                                                                    |
| GitHub Actions — lint + typecheck + test on every PR to develop | ✓ Task 10                                                                                   |
| Branch protection on `main` and `develop`                       | **Manual** — configure in GitHub UI: Settings → Branches → Add rule → require PR + CI green |
| CODEOWNERS                                                      | ✓ Task 10                                                                                   |

### Placeholder scan

No TBD / TODO / "implement later" found.

### Type consistency

No types defined yet — that begins with the shared slice. No conflicts possible.

### Known gaps

1. **Branch protection** must be set manually in GitHub repository settings after the CI workflow is pushed and green. It cannot be configured via files.
2. **`shared/pulse.config.json`** is the shared slice's first deliverable, not Phase 0.
3. **app/ Jest** requires `jest-expo` which depends on Expo SDK — added in `app/foundation`.
4. **`cron/jest.config.cjs` `setupFiles`** will be extended by the `cron/config` slice to add `src/bootstrap.ts` (the dotenv loader).
