# app/article (Slice 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the in-app article reader (`ArticleScreen`) and wire the headline-tap handoff so `openLinksIn` decides between the in-app reader and the system browser.

**Architecture:** `ArticleScreen` is a self-contained overlay screen ported from legacy, reading `theme`/`aes` from the Zustand store (per §8.1) instead of props. `App.tsx`'s `RootScreens` branches `onOpenArticle` on `prefs.openLinksIn` and renders `ArticleScreen` when `nav.article` is set. The nav-slice `article` state, `setArticle`, and the hardware back-handler already exist from earlier slices.

**Tech Stack:** React Native (Expo), TypeScript, Zustand, `expo-web-browser`, `expo-clipboard`, Jest + `jest-expo` + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-05-31-app-article-design.md`
**Legacy reference:** `pulse-news-legacy/app/src/screens/ArticleScreen.tsx`, `pulse-news-legacy/app/App.tsx` lines 76–82 + 146–152.
**Branch:** `feat/app-article` (already created).

---

## File Structure

- **Create** `app/src/screens/ArticleScreen.tsx` — the in-app reader overlay. One responsibility: render a single article + its open/copy/dismiss actions.
- **Create** `app/src/tests/screens/ArticleScreen.test.tsx` — tests for hostname parse, copy-link, CTA, conditional rendering.
- **Modify** `app/App.tsx` — export `RootScreens`; add `openLinksIn` branch in `onOpenArticle`; render `<ArticleScreen>`.
- **Create** `app/src/tests/App.openArticle.test.tsx` — tests the `openLinksIn` branch in `RootScreens` (DigestPager + ArticleScreen mocked).

---

## Task 1: Port `ArticleScreen.tsx`

**Files:**

- Create: `app/src/screens/ArticleScreen.tsx`

This is a verbatim port of the legacy screen with the single structural change from the spec: `theme`/`aes` come from store selectors, not props. No behavior changes.

- [ ] **Step 1: Create the component file**

Create `app/src/screens/ArticleScreen.tsx` with exactly this content:

```tsx
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, THEMES, AESTHETICS } from '../themes';
import { useAppStore } from '../store';
import PulseIcon from '../components/Icon';
import Flag from '../components/Flag';
import { useSwipe } from '../hooks/useSwipe';
import { useSlideIn } from '../hooks/useSlideIn';
import type { Headline, Region } from '../types';

interface Props {
  headline: Headline;
  region: Region;
  onClose: () => void;
}

export default function ArticleScreen({
  headline,
  region,
  onClose,
}: Props): React.ReactElement | null {
  const theme = useAppStore((s) => THEMES[s.prefs.theme]);
  const aes = useAppStore((s) => AESTHETICS[s.prefs.aesthetic]);
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const { slideAnim, dismiss } = useSlideIn(onClose);

  const openArticle = (): void => {
    void WebBrowser.openBrowserAsync(headline.url);
  };

  const panHandlers = useSwipe(openArticle, dismiss);

  const hostname = useMemo<string>(() => {
    try {
      return new URL(headline.url).hostname.replace(/^www\./, '');
    } catch {
      return headline.url;
    }
  }, [headline.url]);

  const copyLink = (): void => {
    void Clipboard.setStringAsync(headline.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: theme.bg, zIndex: 100, transform: [{ translateX: slideAnim }] },
      ]}
      {...panHandlers}
    >
      <View
        style={[
          s.header,
          { paddingTop: insets.top, backgroundColor: theme.surface, borderBottomColor: theme.rule },
        ]}
      >
        <View style={s.headerRow}>
          <Pressable
            onPress={dismiss}
            style={[s.headerBtn, { backgroundColor: theme.chip }]}
            hitSlop={6}
            accessibilityLabel="Back to digest"
          >
            <PulseIcon name="arrow-left" size={16} color={theme.text} />
          </Pressable>

          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: 'center',
              marginHorizontal: 12,
              fontFamily: font(aes, 'eyebrow', 600),
              fontSize: 10,
              letterSpacing: 2,
              color: theme.accent,
              textTransform: 'uppercase',
            }}
          >
            {headline.sourceName ?? 'Article'}
          </Text>

          <View style={s.headerBtn} />
        </View>
      </View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontFamily: font(aes, 'title', 700),
            fontSize: 22,
            lineHeight: 27,
            letterSpacing: -0.4,
            color: theme.text,
          }}
        >
          {headline.title}
        </Text>

        <View style={[s.byline, { borderBottomColor: theme.rule }]}>
          <Flag
            country={region.country?.length === 2 ? region.country : region.code}
            width={32}
            height={22}
          />
          <Text
            style={{
              marginLeft: 14,
              fontFamily: font(aes, 'body'),
              fontSize: 18,
              color: theme.textDim,
            }}
          >
            {region.region}
          </Text>
          {headline.category && (
            <View style={[s.categoryChip, { backgroundColor: theme.accentSoft, marginLeft: 14 }]}>
              <Text
                style={{
                  fontFamily: font(aes, 'eyebrow', 600),
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: theme.accent,
                  textTransform: 'uppercase',
                }}
              >
                {headline.category}
              </Text>
            </View>
          )}
        </View>

        <View style={[s.summaryBlock, { borderLeftColor: theme.accent }]}>
          <Text
            style={{
              fontFamily: font(aes, 'body', 600),
              fontSize: 16,
              lineHeight: 24,
              color: theme.text,
            }}
          >
            {headline.summary}
          </Text>
        </View>

        {headline.detail && (
          <Text
            style={{
              fontFamily: font(aes, 'body'),
              fontSize: 16,
              lineHeight: 26,
              color: theme.textDim,
              marginTop: 16,
            }}
          >
            {headline.detail}
          </Text>
        )}

        <Pressable
          onPress={openArticle}
          accessibilityLabel="Read full article"
          style={({ pressed }) => [
            s.readBtn,
            { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1, marginTop: 28 },
          ]}
        >
          <Text
            style={{
              fontFamily: font(aes, 'ui', 600),
              fontSize: 15,
              color: '#fff',
              letterSpacing: -0.1,
            }}
          >
            Read full article
          </Text>
          <View style={{ marginLeft: 8 }}>
            <PulseIcon name="arrow-right" size={14} color="#fff" strokeWidth={2} />
          </View>
        </Pressable>

        <View style={[s.copyRow, { backgroundColor: theme.chip }]}>
          <PulseIcon name="link" size={13} color={theme.textFaint} strokeWidth={1.8} />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: font(aes, 'number'),
              fontSize: 11,
              color: theme.textFaint,
            }}
          >
            {hostname}
          </Text>
          <Pressable
            onPress={copyLink}
            accessibilityLabel={copied ? 'Link copied' : 'Copy link'}
            style={[s.copyBtn, { borderColor: copied ? theme.accent : theme.ruleStrong }]}
          >
            <PulseIcon
              name={copied ? 'check' : 'copy'}
              size={13}
              color={copied ? theme.accent : theme.textDim}
              strokeWidth={1.8}
            />
            <Text
              style={{
                fontFamily: font(aes, 'ui', 600),
                fontSize: 12,
                color: copied ? theme.accent : theme.textDim,
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>
        </View>

        <View style={s.swipeHints}>
          <Text
            style={{
              fontFamily: font(aes, 'eyebrow', 600),
              fontSize: 9,
              letterSpacing: 1.4,
              color: theme.textFaint,
              textTransform: 'uppercase',
            }}
          >
            ← swipe right · close
          </Text>
          <Text
            style={{
              fontFamily: font(aes, 'eyebrow', 600),
              fontSize: 9,
              letterSpacing: 1.4,
              color: theme.textFaint,
              textTransform: 'uppercase',
            }}
          >
            swipe left · open →
          </Text>
        </View>
      </Animated.ScrollView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  byline: {
    marginTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  summaryBlock: {
    marginTop: 18,
    paddingLeft: 14,
    borderLeftWidth: 3,
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  copyRow: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    paddingHorizontal: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: PASS (no errors). If `region.country` / `region.code` / `region.region` errors, confirm the `Region` type fields against `app/src/types.ts` — they must already match because `RegionSection` uses the same fields.

- [ ] **Step 3: Lint**

Run: `cd app && npx eslint --ext .tsx src/screens/ArticleScreen.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/ArticleScreen.tsx
git commit -m "feat(app): port ArticleScreen reader (store-driven theme/aes)"
```

---

## Task 2: Test `ArticleScreen`

**Files:**

- Create: `app/src/tests/screens/ArticleScreen.test.tsx`

Tests the silent-break logic: hostname parse, copy-link clipboard call + state toggle, the "Read full article" CTA, and conditional rendering of the category chip and detail paragraph. Presentation/animation and the PanResponder swipe are not asserted (per `app/CLAUDE.md` — skip presentation; swipe-open uses the same `openArticle` path the CTA covers).

- [ ] **Step 1: Write the test file**

Create `app/src/tests/screens/ArticleScreen.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { useAppStore } from '../../store';
import { DEFAULT_PREFERENCES } from '../../storage/preferences';
import ArticleScreen from '../../screens/ArticleScreen';
import type { Headline, Region } from '../../types';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

const headline: Headline = {
  title: 'Test headline',
  summary: 'A summary.',
  url: 'https://www.example.com/news/story',
  category: 'Politics',
  sourceName: 'Example Times',
};

const region: Region = {
  code: 'HU',
  country: 'HU',
  region: 'Hungary',
  continent: 'Europe',
  currency: 'HUF',
} as Region;

beforeEach(() => {
  jest.clearAllMocks();
  useAppStore.setState({
    prefs: { ...DEFAULT_PREFERENCES, theme: 'light', aesthetic: 'editorial' },
  });
});

function renderArticle(h: Headline = headline, r: Region = region) {
  return render(<ArticleScreen headline={h} region={r} onClose={jest.fn()} />);
}

describe('ArticleScreen', () => {
  it('renders hostname with leading www stripped', () => {
    const { getByText } = renderArticle();
    expect(getByText('example.com')).toBeTruthy();
  });

  it('falls back to the raw url when it cannot be parsed', () => {
    const { getByText } = renderArticle({ ...headline, url: 'not a valid url' });
    expect(getByText('not a valid url')).toBeTruthy();
  });

  it('opens the browser with no options when Read full article is pressed', () => {
    const { getByLabelText } = renderArticle();
    fireEvent.press(getByLabelText('Read full article'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(headline.url);
  });

  it('copies the url and toggles the copied state, then resets', () => {
    jest.useFakeTimers();
    const { getByLabelText } = renderArticle();
    fireEvent.press(getByLabelText('Copy link'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(headline.url);
    // flush the resolved clipboard promise so the copied state applies
    return Promise.resolve().then(() => {
      expect(getByLabelText('Link copied')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(getByLabelText('Copy link')).toBeTruthy();
      jest.useRealTimers();
    });
  });

  it('shows the category chip only when category is set', () => {
    const { queryByText, rerender } = renderArticle();
    expect(queryByText('Politics')).toBeTruthy();
    rerender(
      <ArticleScreen
        headline={{ ...headline, category: undefined }}
        region={region}
        onClose={jest.fn()}
      />,
    );
    expect(queryByText('Politics')).toBeNull();
  });

  it('shows the detail paragraph only when detail is set', () => {
    const { queryByText, rerender } = renderArticle();
    expect(queryByText('Deep dive text')).toBeNull();
    rerender(
      <ArticleScreen
        headline={{ ...headline, detail: 'Deep dive text' }}
        region={region}
        onClose={jest.fn()}
      />,
    );
    expect(queryByText('Deep dive text')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests, expect them to drive out any gaps**

Run: `cd app && npm test -- ArticleScreen`
Expected: PASS (6 tests).

If the copied-state test is flaky because the clipboard promise + timer interleave, switch it to `async`/`await`:

```tsx
it('copies the url and toggles the copied state, then resets', async () => {
  jest.useFakeTimers();
  const { getByLabelText } = renderArticle();
  fireEvent.press(getByLabelText('Copy link'));
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(headline.url);
  await act(async () => {});
  expect(getByLabelText('Link copied')).toBeTruthy();
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  expect(getByLabelText('Copy link')).toBeTruthy();
  jest.useRealTimers();
});
```

- [ ] **Step 3: Lint the test**

Run: `cd app && npx eslint --ext .tsx src/tests/screens/ArticleScreen.test.tsx`
Expected: PASS. (If `as Region` triggers `no-explicit-any`-adjacent rules, fill in the exact `Region` fields instead of casting — check `app/src/types.ts` for the full interface.)

- [ ] **Step 4: Commit**

```bash
git add app/src/tests/screens/ArticleScreen.test.tsx
git commit -m "test(app): ArticleScreen hostname, copy, CTA, conditional render"
```

---

## Task 3: Wire `App.tsx` — `openLinksIn` branch + render

**Files:**

- Modify: `app/App.tsx`

Three edits: imports, the `RootScreens` handler + `openLinksIn` selector + render block, and exporting `RootScreens` for the next task's test.

- [ ] **Step 1: Add imports**

In `app/App.tsx`, change the React import (line 1) to add `useCallback`:

```tsx
import React, { useCallback, useEffect, useRef } from 'react';
```

Add the WebBrowser import (after the `expo-splash-screen` import on line 6):

```tsx
import * as WebBrowser from 'expo-web-browser';
```

Add the `ArticleScreen` import (next to the other screen imports, after line 37 `SettingsScreen`):

```tsx
import ArticleScreen from './src/screens/ArticleScreen';
```

Extend the `types` import (line 40) to include `Headline` and `Region`:

```tsx
import type { AppState, ScreenId, Headline, Region } from './src/types';
```

- [ ] **Step 2: Add the `openLinksIn` selector and branching handler inside `RootScreens`**

In `RootScreens`, just after the existing `const setScreen = useAppStore((s) => s.setScreen);` line, add:

```tsx
const openLinksIn = useAppStore((s) => s.prefs.openLinksIn);

const onOpenArticle = useCallback(
  (h: Headline, r: Region) => {
    if (openLinksIn === 'browser') {
      void WebBrowser.openBrowserAsync(h.url, { showInRecents: false });
    } else {
      setArticle({ h, r });
    }
  },
  [openLinksIn, setArticle],
);
```

- [ ] **Step 3: Use the handler and render the article overlay**

In the `appState === 'ready'` return block, replace the inline DigestPager handler:

```tsx
          onOpenArticle={(h, r) => setArticle({ h, r })}
```

with:

```tsx
onOpenArticle = { onOpenArticle };
```

Then add the article overlay immediately after the closing `)}` of the `{screen === 'settings' && (...)}` block and before `</SafeAreaView>`:

```tsx
{
  article && (
    <ArticleScreen headline={article.h} region={article.r} onClose={() => setArticle(null)} />
  );
}
```

- [ ] **Step 4: Export `RootScreens` for testing**

Change its declaration from:

```tsx
function RootScreens({
```

to:

```tsx
export function RootScreens({
```

- [ ] **Step 5: Typecheck and lint**

Run: `cd app && npx tsc --noEmit && npx eslint --ext .tsx App.tsx`
Expected: PASS. (The previously-unused `setArticle` is now used by both the handler and the overlay's `onClose`.)

- [ ] **Step 6: Commit**

```bash
git add app/App.tsx
git commit -m "feat(app): branch onOpenArticle on openLinksIn, render ArticleScreen"
```

---

## Task 4: Test the `openLinksIn` branch in `RootScreens`

**Files:**

- Create: `app/src/tests/App.openArticle.test.tsx`

Renders `RootScreens` directly with `appState='ready'`, `screen='digest'`. `DigestPager` is mocked to a button that calls `onOpenArticle(headline, region)`; `ArticleScreen` and `SettingsScreen` are mocked to keep the test focused on the branch. Assertions read the resulting store `article` and the `WebBrowser` mock.

- [ ] **Step 1: Write the test file**

Create `app/src/tests/App.openArticle.test.tsx`:

```tsx
import React from 'react';
import { Pressable } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { RootScreens } from '../../App';
import { useAppStore } from '../store';
import { DEFAULT_PREFERENCES } from '../storage/preferences';
import { THEMES } from '../themes';
import type { AuthActions } from '../hooks/useSupabaseAuth';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue(undefined),
}));

const HEADLINE = {
  title: 'H',
  summary: 'S',
  url: 'https://example.com/a',
};
const REGION = {
  code: 'HU',
  country: 'HU',
  region: 'Hungary',
  continent: 'Europe',
  currency: 'HUF',
};

jest.mock('../components/DigestPager', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ReactLocal = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pressable: P } = require('react-native');
  return {
    __esModule: true,
    default: (props: { onOpenArticle: (h: unknown, r: unknown) => void }) =>
      ReactLocal.createElement(P, {
        testID: 'open-article',
        onPress: () => props.onOpenArticle(HEADLINE, REGION),
      }),
  };
});

jest.mock('../screens/SettingsScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../screens/ArticleScreen', () => ({
  __esModule: true,
  default: () => null,
}));

const actions = {
  signIn: jest.fn(),
  signUp: jest.fn(),
  resetPassword: jest.fn(),
  updatePassword: jest.fn(),
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
} as unknown as AuthActions;

function renderRoot() {
  return render(
    <RootScreens
      appState="ready"
      screen="digest"
      theme={THEMES.light}
      isPasswordRecovery={false}
      actions={actions}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useAppStore.setState({ prefs: DEFAULT_PREFERENCES, article: null });
});

describe('RootScreens onOpenArticle', () => {
  it('opens the system browser and does not set article when openLinksIn is "browser"', () => {
    useAppStore.setState({ prefs: { ...DEFAULT_PREFERENCES, openLinksIn: 'browser' } });
    const { getByTestId } = renderRoot();
    fireEvent.press(getByTestId('open-article'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(HEADLINE.url, {
      showInRecents: false,
    });
    expect(useAppStore.getState().article).toBeNull();
  });

  it('sets the article and does not open the browser when openLinksIn is "in-app"', () => {
    useAppStore.setState({ prefs: { ...DEFAULT_PREFERENCES, openLinksIn: 'in-app' } });
    const { getByTestId } = renderRoot();
    fireEvent.press(getByTestId('open-article'));
    expect(useAppStore.getState().article).toEqual({ h: HEADLINE, r: REGION });
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
});
```

> Note: the unused top-level `Pressable` import is intentional only if referenced — remove it if eslint flags `no-unused-vars` (the mock uses its own local `require`). Delete the line `import { Pressable } from 'react-native';` if unused.

- [ ] **Step 2: Run the tests**

Run: `cd app && npm test -- App.openArticle`
Expected: PASS (2 tests).

If `RootScreens` fails to render because `SafeAreaView` needs a provider, wrap the render in `SafeAreaProvider` from `react-native-safe-area-context` (the repo's `__mocks__/react-native-safe-area-context.ts` should already stub it — only add the provider if the test errors).

- [ ] **Step 3: Lint**

Run: `cd app && npx eslint --ext .tsx src/tests/App.openArticle.test.tsx`
Expected: PASS. Remove any unused import the linter flags.

- [ ] **Step 4: Commit**

```bash
git add app/src/tests/App.openArticle.test.tsx
git commit -m "test(app): openLinksIn branch routes to browser vs in-app reader"
```

---

## Task 5: Full verification + review gates

**Files:** none (verification only).

- [ ] **Step 1: Run the full app suite**

Run: `cd app && npx tsc --noEmit && npx eslint --ext .ts,.tsx src App.tsx && npm test`
Expected: typecheck clean, lint clean, all tests pass.

- [ ] **Step 2: Root format check**

Run: `npm run format:check`
Expected: PASS. If it fails, run `npm run format` and commit the formatting:

```bash
git add -A && git commit -m "chore: prettier format app/article slice"
```

- [ ] **Step 3: Manual smoke (per spec §8 DoD)**

Run: `cd app && npx expo run:android` (or an existing dev build). Verify:

- Settings → "Open links in" = **In-app** → tapping a headline opens the reader; CTA + swipe-left open the browser; Copy copies the link; back / swipe-right / hardware-back dismiss.
- Settings → "Open links in" = **Browser** → tapping a headline opens the system browser directly (no reader).

- [ ] **Step 4: Code review**

Run `/code-review` on the branch. Fix findings on `feat/app-article` before the PR.

- [ ] **Step 5: Security review**

Run `/security-review` — this slice hands an untrusted `headline.url` to `WebBrowser.openBrowserAsync`. Confirm the URL is not interpolated into a JS-enabled WebView and that non-http(s) schemes are acceptable to pass through (legacy parity: it passes the url as-is). Record any deferred hardening in `todo.md`.

- [ ] **Step 6: Open the PR**

```bash
git push -u origin feat/app-article
gh pr create --base develop --title "feat(app): article reader + openLinksIn handoff (slice 5)" --body "$(cat <<'EOF'
Frontend slice 5 (app/article). Ports the in-app article reader and wires the headline-tap handoff.

Replaces legacy: `app/src/screens/ArticleScreen.tsx` + the `openArticle` handler in legacy `app/App.tsx`.
Spec: `docs/superpowers/specs/2026-05-31-app-article-design.md`.

- ArticleScreen ported (theme/aes via store selectors per §8.1)
- `onOpenArticle` branches on `prefs.openLinksIn` (browser → WebBrowser; in-app → reader)
- Tests: hostname parse, copy-link, CTA, conditional render, openLinksIn branch

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Confirm the PR targets `develop` before creating.

---

## Self-Review notes

- **Spec coverage:** §3.1 ArticleScreen → Task 1; §3.2 App wiring → Task 3; §4 data flow → Tasks 3–4; §5 error handling (hostname try/catch) → in Task 1 code + Task 2 test; §6 testing → Tasks 2 & 4; §7 gates → Task 5. All sections mapped.
- **Type consistency:** `Headline`/`Region` used identically in component, both test files, and App handler. `onOpenArticle(h: Headline, r: Region)` matches the existing prop signature on `DigestPager`/`DigestPage`/`RegionSection`. `ArticleEntry` shape `{ h, r }` matches the nav slice.
- **Region fields:** `code`, `country`, `region`, `continent`, `currency` — same fields `RegionSection` reads; verify against `app/src/types.ts` `Region` interface during Task 1 (replace the `as Region` cast in tests with the full literal if lint requires).
