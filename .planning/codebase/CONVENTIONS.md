# Coding Conventions

**Analysis Date:** 2026-05-24

## Naming Patterns

**Files:**

- `camelCase.ts` for utility/helper modules: `textUtils.ts`, `urlUtils.ts`, `topicUtils.ts`
- `camelCase.ts` for hook files: `useSupabaseAuth.ts`, `useDigest.ts`, `useAppServices.ts`
- `PascalCase.tsx` for React Native screen/component files: `LoginScreen.tsx`, `DigestPage.tsx`, `RegionPicker.tsx`
- `camelCase.ts` for service/module files: `fetchNews.ts`, `rankHeadlines.ts`, `pipeline.ts`
- `camelCase.ts` for infrastructure/plumbing: `logging.ts`, `bootstrap.ts`, `config.ts`
- Vercel handler files use `kebab-case.ts`: `api/daily-digest.ts`, `api/notify.ts`
- Test files co-located under `src/tests/` (cron), named `<module>.test.ts`: `textUtils.test.ts`, `urlUtils.test.ts`

**Functions:**

- `camelCase` for all functions and methods: `stripCitations`, `isValidHeadlineUrl`, `calcAvgTopicSpread`
- Verb-noun pattern for pure utilities: `tokenise`, `matchUrl`, `urlSlug`, `topicWords`
- Boolean predicates prefixed with `is`, `has`, `can`: `isValidHeadlineUrl`, `isFakePlaceholder`, `isModelUrlPlausible`, `summaryHasUrl`
- React hooks prefixed with `use`: `useSupabaseAuth`, `useDigest`, `useAppNavigation`
- Initializer functions prefixed with `init`: `initializeLogger`
- Factory/accessor functions prefixed with `get` or `create`: `getLogger`, `getSupabase`, `createSource`

**Variables:**

- `camelCase` for all variables: `bestScore`, `bestUrl`, `pathWords`, `titleWords`
- `SCREAMING_SNAKE_CASE` for module-level constants and exported domain constants: `VIDEO_DOMAINS`, `JUNK_PATH_PATTERNS`, `URL_MATCH_THRESHOLD`, `ALL_REGIONS`
- Module-level logger instances named `log`: `const log = getLogger('useSupabaseAuth')`
- Unused function parameters prefixed with `_` (ESLint `argsIgnorePattern: '^_'` enforced)

**Types and Interfaces:**

- `PascalCase` for all: `RegionHeadline`, `DigestUsage`, `FetchConfig`, `AuthActions`
- Interfaces preferred over type aliases for object shapes: `interface Headline`, `interface RegionDigest`
- `type` aliases for unions and primitives: `type ThemeId = 'light' | 'sepia' | 'dark'`
- Config interfaces suffixed with `Config`: `FetchConfig`, `RankingConfig`, `ModelConfig`, `ApiConfig`
- Result/return interfaces grouped in the same file as their function, exported when needed

**Directories:**

- `src/lib/` for pure utility/helper modules with no side effects (URL parsing, text processing, deduplication)
- `src/hooks/` for React hooks
- `src/storage/` for persistence layer
- `src/screens/` for full-screen React Native components
- `src/components/` for reusable React Native components
- `src/supabase/` for Supabase client setup
- `src/notifications/` for push notification registration
- `api/` (at package root, not under `src/`) for Vercel serverless handlers

## Code Style

**Formatting tool:** Prettier 3.3.3

**Settings** (from `.prettierrc`):

- `semi: true` — semicolons required
- `singleQuote: true` — single quotes for strings
- `trailingComma: "all"` — trailing commas in all multi-line contexts (arrays, objects, function params)
- `printWidth: 100` — lines wrap at 100 characters
- `tabWidth: 2` — 2-space indentation

**Linting tool:** ESLint 8 with `@typescript-eslint/recommended`

**Key rules** (from `.eslintrc.cjs`):

- `@typescript-eslint/no-unused-vars: error` — unused vars are errors; prefix with `_` to suppress
- `@typescript-eslint/no-explicit-any: error` — `any` is banned; use proper types or `unknown`
- `@typescript-eslint/consistent-type-imports: error` — type-only imports must use `import type`
- `no-console: warn` — use the Winston logger (`getLogger`) in cron, the app logger in `app/`; `console.*` generates a warning

## TypeScript Strictness

All packages extend `tsconfig.base.json` which enforces:

- `strict: true` — all strict checks on (null checks, no implicit any, strict function types)
- `noUncheckedIndexedAccess: true` — array/record index access returns `T | undefined`; must handle with null check or non-null assertion
- `noImplicitReturns: true` — all code paths in non-void functions must return a value
- `noFallthroughCasesInSwitch: true` — switch cases must be exhaustive or have explicit fallthrough
- `forceConsistentCasingInFileNames: true`
- `ignoreDeprecations: "6.0"` — TypeScript 6.0.3 compatibility shim in each package

## Import Organization

**Type imports must be separated** using `import type` (ESLint rule enforced):

```typescript
import type { Headline } from '@shared/types';
import { REGIONS } from '@shared/regions';
```

**Order** (not enforced by tooling, but consistently followed in legacy):

1. Node built-ins (e.g. `fs`, `path`)
2. Third-party packages (e.g. `winston`, `@supabase/supabase-js`)
3. Internal shared imports via `@shared/*` alias
4. Local relative imports (same package)

**Path Aliases:**

- `@shared/*` resolves to `../shared/src/*` — configured in each package's `tsconfig.json` `paths` and `jest.config.cjs` `moduleNameMapper`
- No barrel index files; always import directly from the module file

## Error Handling

**Cron pattern:** throw `Error` with a descriptive message string; callers handle with `try/catch` or `Promise.allSettled`:

```typescript
throw new Error('Failed to parse Perplexity JSON response');
throw new Error(`Perplexity request failed: ${status} ${statusText}`);
```

**App hooks pattern:** async functions return `string | null` (error message) or `null` (success); callers inspect the return value:

```typescript
signIn: (email: string, password: string) => Promise<string | null>;
resetPassword: (email: string) => Promise<string | null>;
```

**Catch blocks:** cast error to `String(e)` when logging unknown errors; never `(e as Error).message` directly on unknown values.

**Retry pattern:** retry on 5xx responses; throw immediately on 4xx. Delay between retries using `setTimeout`-based sleep.

## Logging

**Framework:** Winston (cron), custom logger (app — `src/logger.ts`)

**Cron pattern:**

- Call `initializeLogger(config)` once at startup (in `bootstrap.ts`)
- Obtain a component-scoped child logger: `const log = getLogger('componentName')`
- Pass `log` as a parameter to functions that need it — do not import the global logger directly in library modules

**App pattern:**

- `const log = getLogger('hookName')` at module level in each hook/module file

**Log levels:** `debug`, `info`, `warn`, `error` — controlled by `log.level` in `pulse.config.json` (cron) or `logLevel` (app config)

**Constraint:** `no-console` is a warning in ESLint. Use the logger, not `console.log`. `console.*` is only acceptable in dev scripts and test runners.

## Comments

**JSDoc on exported functions** when the behavior is non-obvious or has edge cases:

```typescript
/**
 * Manages Supabase Auth session state. Restores persisted session on mount,
 * subscribes to auth state changes, and exposes sign-in/sign-up/sign-out.
 *
 * signIn/signUp return null on success, an error string on failure.
 * authReady: "we've finished the initial session check" — NOT "logged in".
 */
```

**Inline comments** for non-obvious logic (regex patterns, threshold values, fallback behavior):

```typescript
/** Strips Perplexity citation markers ([1], [1][2], etc.) and collapses extra whitespace. */
export function stripCitations(text: string): string {
```

**Section dividers** using `// ── Name ────` in large type definition files to group related interfaces.

**No TODO comments in source** — deferred work goes in `todo.md`, not in code comments.

## Function Design

**Size:** Functions are kept small and single-purpose; library functions in `src/lib/` are pure (no side effects, no I/O).

**Parameters:**

- Logger instances (`log`) passed as explicit parameters to library functions (not imported as singletons)
- Complex function signatures use interface types for grouped parameters
- `noUncheckedIndexedAccess` enforces explicit null handling on array index access — use `arr[i]!` when proven non-null or `arr[i] ?? defaultValue`

**Return values:**

- Pure utilities return typed values directly (never `void` or bare `any`)
- Async functions resolving to nullable outcomes return `Promise<T | null>`
- Functions that can fail in caller-visible ways return `{ url: string | null; score: number }` style result objects rather than throwing

## Module Design

**Exports:** Named exports exclusively — no default exports (consistent with `@typescript-eslint/recommended` and the import patterns throughout legacy codebase).

**Barrel files:** Not used. Consumers import directly from module files:

```typescript
import { stripCitations, summaryHasUrl } from '../lib/textUtils';
import { isValidHeadlineUrl, matchUrl } from '../lib/urlUtils';
```

**shared/ constraints:** No imports from `app/` or `cron/` inside `shared/`. It compiles with zero runtime consumers in its own dependency graph. Types or constants used by both packages belong in `shared/`; those used by only one belong in that package.

**Vercel handlers** (`api/*.ts`) live at `cron/api/`, not under `cron/src/`, because Vercel expects them at the function root.

---

_Convention analysis: 2026-05-24_
