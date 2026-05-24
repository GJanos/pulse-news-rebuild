# Testing Patterns

**Analysis Date:** 2026-05-24

## Test Framework

**Runner:**

- Jest 29.7.0
- Config: `cron/jest.config.cjs`
- Preset: `ts-jest` (TypeScript compilation via ts-jest 29.2.5)
- Test environment: `node`

**Assertion Library:**

- Jest built-in (`expect`, `toBe`, `toEqual`, `toHaveLength`, `toBeNull`, `rejects.toThrow`, `toHaveBeenCalledTimes`, `toHaveBeenCalledWith`)

**Type definitions:**

- `@types/jest` 29.5.14

**Run Commands:**

```bash
cd cron && npm test                  # Run all tests (passWithNoTests:true — passes with zero tests)
cd cron && npm run test:watch        # Watch mode
cd cron && npm run test:coverage     # Jest + coverage report
```

## Test File Organization

**Location:** `cron/src/tests/` — separate `tests/` subdirectory under `src/`, not co-located with source files

**Naming pattern:** `<module>.test.ts` matching the filename of the module under test:

- `cron/src/tests/textUtils.test.ts` → tests `cron/src/lib/textUtils.ts`
- `cron/src/tests/urlUtils.test.ts` → tests `cron/src/lib/urlUtils.ts`
- `cron/src/tests/topicUtils.test.ts` → tests `cron/src/lib/topicUtils.ts`
- `cron/src/tests/parseHeadlines.test.ts` → tests `cron/src/lib/parseHeadlines.ts`
- `cron/src/tests/perplexityClient.test.ts` → tests `cron/src/lib/perplexityClient.ts`

**Jest roots config:** `roots: ['<rootDir>/src']` — discovers all `*.test.ts` files under `cron/src/`

**App tests:** No test files yet. `app/` jest configuration will be added in the `app/foundation` slice. Strategy: hooks and pure utilities via Jest + ts-jest (no renderer), components via `@testing-library/react-native` + `jest-expo`.

**Structure:**

```
cron/
└── src/
    ├── tests/
    │   ├── parseHeadlines.test.ts
    │   ├── perplexityClient.test.ts
    │   ├── textUtils.test.ts
    │   ├── topicUtils.test.ts
    │   └── urlUtils.test.ts
    └── lib/
        ├── parseHeadlines.ts
        ├── perplexityClient.ts
        ├── textUtils.ts
        ├── topicUtils.ts
        └── urlUtils.ts
```

## Test Structure

**Suite Organization:**

```typescript
describe('moduleName', () => {
  // optional logger mock at suite level
  const log = { debug: jest.fn(), info: jest.fn(), warn: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    // or: jest.useFakeTimers()
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('description of what is tested and expected result', () => {
    expect(fn(input)).toBe(expected);
  });

  test('async operation resolves correctly', async () => {
    const result = await fn(args);
    expect(result.field).toHaveLength(1);
  });
});
```

**Patterns:**

- One `describe` block per module, named after the module: `describe('textUtils', ...)`
- Individual `test()` calls (not `it()`) with descriptive sentences: `'stripCitations removes numeric citation markers and collapses whitespace'`
- `beforeEach` resets mocks via `jest.clearAllMocks()` or sets up fake timers
- `afterEach` restores real timers and mocks when fake timers or spies are used
- Async tests use `async/await` throughout — no `.then()` chaining in test assertions

## Mocking

**Framework:** Jest built-in mocking (`jest.fn()`, `jest.mock()`, `jest.spyOn()`, fake timers)

**Logger mock pattern** (inject as dependency, mock at test level):

```typescript
const log = { debug: jest.fn(), info: jest.fn(), warn: jest.fn() };
```

The logger is passed as a parameter to functions under test — never imported globally in library modules. This makes logger injection the natural mocking seam.

**Global fetch mock pattern:**

```typescript
beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn() as unknown as typeof fetch;
});

// Then mock specific responses:
(global.fetch as jest.Mock).mockResolvedValue(response);
(global.fetch as jest.Mock)
  .mockResolvedValueOnce(failureResponse)
  .mockResolvedValueOnce(successResponse);
```

**Fake timers for retry delay testing:**

```typescript
const promise = callPerplexity(...);
await jest.advanceTimersByTimeAsync(2000);  // advance past retry delay
const result = await promise;
```

**Type casting for mocks:** Use `as unknown as TargetType` when Jest mocks don't satisfy strict TypeScript shapes:

```typescript
body as any; // for partial API response shapes in integration-style unit tests
```

**What to mock:**

- External HTTP calls: `global.fetch`
- Logger instances: inline `{ debug: jest.fn(), info: jest.fn(), warn: jest.fn() }`
- Time-dependent code: `jest.useFakeTimers()` + `jest.advanceTimersByTimeAsync()`

**What NOT to mock:**

- Pure utility functions under test (test them directly, not their mocks)
- Supabase, FCM, Perplexity API — integration tests requiring live keys are run manually with dev runners, not in CI
- Internal helper functions that are unit-testable on their own

## Fixtures and Factories

**Test data:** Inline literal objects within each test — no shared factory functions or fixtures files yet:

```typescript
const body = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          headlines: [
            {
              title: 'Important economy news',
              summary: 'The economy is growing [1]',
              url: 'https://site.com/2026/05/economy-news',
              category: 'Business',
              source_name: 'Site',
            },
          ],
        }),
      },
    },
  ],
  search_results: [
    {
      title: 'Economy news today',
      url: 'https://site.com/2026/05/economy-news',
      snippet: 'economy grows today',
      date: '2026-05-22',
    },
  ],
};
```

**Mutable state initialization:** Use `new Set<string>()` for `usedUrls` and `usedSlugs` per test to avoid state leakage between tests.

**Location:** No separate fixture files — all test data lives inline in the test file.

## Coverage

**Requirements:** 60% line coverage enforced via `coverageThreshold`:

```javascript
coverageThreshold: {
  global: { lines: 60 },
}
```

**Collected from:** `src/**/*.ts` excluding `src/**/*.test.ts` (configured via `collectCoverageFrom` in `cron/jest.config.cjs`)

**Target:** 60–70% on logic that breaks silently. See CLAUDE.md: "ranking, deduplication, text utilities, URL filtering" are the priority targets.

**View Coverage:**

```bash
cd cron && npm run test:coverage
```

**CI enforcement:** CI runs `npm run test:coverage` — coverage failures cause CI to fail.

**`passWithNoTests: true`:** Jest passes when no test files are found. This allows the tooling to be in place before test files are added.

## Test Types

**Unit Tests:**

- Scope: pure functions in `cron/src/lib/` — no I/O, no network, no database
- `textUtils.ts`: string transformation utilities
- `urlUtils.ts`: URL validation, slug extraction, placeholder detection, URL matching
- `topicUtils.ts`: Jaccard deduplication, topic spread calculations
- `parseHeadlines.ts`: Perplexity response parsing + filtering pipeline
- `perplexityClient.ts`: HTTP client retry behavior (uses fake timers + fetch mock)

**Integration Tests:**

- Skip in CI: tests that need live API keys (Supabase, FCM, Perplexity) are run manually using dev runner scripts (`cron/index.ts`, `cron/testFetch.ts`, `cron/testNotify.ts`)

**E2E Tests:**

- Not used. End-to-end validation is done via manual device testing with a local Expo build.

**App Tests (planned, not yet present):**

- Hooks tested with Jest + ts-jest (no React Native renderer): `useDigest`, `useSupabaseAuth`, `useDeepLinkRecovery`
- Component tests: `@testing-library/react-native` + `jest-expo` (added in `app/foundation` slice)
- Snapshot tests: explicitly skipped on presentation components per CLAUDE.md

## Common Patterns

**Async Testing:**

```typescript
test('parses valid Perplexity output and filters placeholders', async () => {
  const result = await parseHeadlines(body as any, 2, log, usedUrls, usedSlugs, 1);
  expect(result.headlines).toHaveLength(1);
  expect(result.headlines[0].summary).toBe('The economy is growing');
});
```

**Error/Rejection Testing:**

```typescript
test('throws when response content is invalid JSON', async () => {
  const body = {
    choices: [{ message: { content: 'not json' } }],
    search_results: [],
  };

  await expect(parseHeadlines(body as any, 1, log, new Set(), new Set(), 1)).rejects.toThrow(
    'Failed to parse Perplexity JSON response',
  );
});
```

**Assert mock call count and arguments:**

```typescript
expect(global.fetch).toHaveBeenCalledTimes(2);
expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Perplexity 500'));
```

**Assert side effects on mutable Sets:**

```typescript
expect(usedUrls.has('https://site.com/2026/05/economy-news')).toBe(true);
expect(usedSlugs.has('economy-news')).toBe(true);
```

**Numeric range assertion:**

```typescript
expect(calcAvgTopicSpread(headlines)).toBeLessThan(0.5);
```

## Module Resolution in Tests

**`@shared/*` alias in tests** is configured via `moduleNameMapper` in `cron/jest.config.cjs`:

```javascript
moduleNameMapper: {
  '^@shared/(.*)$': '<rootDir>/../shared/src/$1',
}
```

When `app/` tests are added, the same pattern must be configured in `app/jest.config.cjs`.

---

_Testing analysis: 2026-05-24_
