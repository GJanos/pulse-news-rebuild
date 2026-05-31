# Slice 5: app/article — Design Spec

Date: 2026-05-31
Owner: Janos Gorondi
Status: Approved — ready for implementation plan

Frontend slice 5 of the Pulse rebuild (see `REBUILD_PLAN.md` §7). Ports the in-app
article reader and wires the headline-tap handoff. Structural-not-behavioral: same
inputs produce the same outputs as legacy, with one allowed structural change
(theme/aes via store, per §8.1).

Legacy file replaced: `pulse-news-legacy/app/src/screens/ArticleScreen.tsx`
Legacy handoff reference: `pulse-news-legacy/app/App.tsx` lines 76–82 (`openArticle`),
146–152 (`<ArticleScreen>` render).

---

## 1. Context — what already exists

Earlier slices pre-wired most of the article path. Slice 5 fills the gaps; it does
not build the plumbing from scratch.

- `ArticleEntry` type (`{ h: Headline; r: Region }`) — `app/src/types.ts`.
- nav-slice `article: ArticleEntry | null` state + `setArticle` action — `app/src/store/slices/nav.ts`.
  Article is transient (not persisted across restarts) — preserved.
- `onOpenArticle(h, r)` is already threaded `App.tsx → DigestPager → DigestPage →
RegionSection / GlobalSection`. Every headline row already calls it.
- Hardware back-handler in `App.tsx` already dismisses the article
  (`if (article) { setArticle(null); return true; }`).
- `openLinksIn: 'in-app' | 'browser'` already exists in `shared/src/types.ts` +
  `app/src/types.ts`, defaults to `'in-app'` in `app/src/storage/preferences.ts`,
  and is already editable in `SettingsScreen` (slice 4).
- `useSwipe`, `useSlideIn` hooks exist in the rebuild (used by `SettingsScreen`).
- Deps present: `expo-web-browser`, `expo-clipboard`, `react-native-safe-area-context`,
  plus `Flag` and `Icon` components.

## 2. Scope

In scope:

1. Port `app/src/screens/ArticleScreen.tsx`.
2. Render it from `App.tsx` (`{article && <ArticleScreen />}` overlay).
3. Fix the `openLinksIn` branch in the `onOpenArticle` handler (currently hardcoded
   to always open in-app, ignoring the preference).
4. Tests for the logic that breaks silently.

Out of scope (deferred to slice 6, app/notifications):

- Deep-link-to-article parsing.
- Notification-driven article opening.

## 3. Component design

### 3.1 `app/src/screens/ArticleScreen.tsx` (new)

Port the legacy reader verbatim with one structural change.

**Signature:**

```ts
interface Props {
  headline: Headline;
  region: Region;
  onClose: () => void;
}
```

`theme` and `aes` drop from props — read via store selectors
(`useAppStore(s => THEMES[s.prefs.theme])`, `useAppStore(s => AESTHETICS[s.prefs.aesthetic])`),
matching `RegionSection` and §8.1. The `article` data stays as props because `App.tsx`
already holds it for the render gate and back-handler.

**Behavior preserved 1:1 from legacy:**

- Slide-in animation via `useSlideIn(onClose)`; `dismiss` triggers the close.
- `useSwipe(openArticle, dismiss)` pan handlers: swipe-left opens the article in the
  browser, swipe-right dismisses.
- Header: back button (calls `dismiss`) + centered source eyebrow
  (`headline.sourceName ?? 'Article'`) + spacer to keep the title centered.
- Title (`headline.title`).
- Byline row: `Flag` (country if 2-char, else region code) · region name · optional
  category chip (only when `headline.category` is set).
- Accent-bordered summary block (`headline.summary`).
- Optional `detail` paragraph (only when `headline.detail` is set).
- "Read full article" CTA → `WebBrowser.openBrowserAsync(headline.url)` **with no
  options**.
- Copy-link row: link icon + hostname + Copy button. Hostname is
  `new URL(headline.url).hostname` with leading `www.` stripped, falling back to the
  raw url on parse failure. Pressing Copy calls `Clipboard.setStringAsync(headline.url)`,
  sets a "Copied" state for 1500ms, then reverts.
- Swipe hints footer.
- Absolute-fill overlay, `zIndex: 100`, `backgroundColor: theme.bg`,
  `transform: translateX(slideAnim)`.

### 3.2 `App.tsx` wiring

**Replace** the hardcoded handler:

```tsx
onOpenArticle={(h, r) => setArticle({ h, r })}
```

**with** a `useCallback` that branches on the preference (mirrors legacy `openArticle`):

```tsx
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

`openLinksIn` is read from the store: `useAppStore(s => s.prefs.openLinksIn)`.

**Add** the render block after the DigestPager / SettingsScreen blocks:

```tsx
{
  article && (
    <ArticleScreen headline={article.h} region={article.r} onClose={() => setArticle(null)} />
  );
}
```

**Deliberate asymmetry preserved from legacy:** the direct-from-list browser open
passes `{ showInRecents: false }`; the in-screen "Read full article" CTA passes no
options. Both are intentional ports, not oversights.

## 4. Data flow

```
headline row tap
  → onOpenArticle(h, r)  [App.tsx handler]
      ├─ openLinksIn === 'browser' → WebBrowser.openBrowserAsync(url, {showInRecents:false})
      └─ openLinksIn === 'in-app'  → setArticle({h, r})  [nav slice]
                                        → App renders <ArticleScreen>
                                            ├─ "Read full article" / swipe-left
                                            │     → WebBrowser.openBrowserAsync(url)
                                            ├─ Copy → Clipboard.setStringAsync(url)
                                            └─ back / swipe-right / hardware back
                                                  → onClose → setArticle(null)
```

## 5. Error handling

- Hostname parse wrapped in try/catch → raw url fallback (legacy parity).
- `WebBrowser.openBrowserAsync` and `Clipboard.setStringAsync` are fire-and-forget
  (`void` / `.then`); no added error UI — matches legacy. (If lint requires it, a
  `.catch` that logs a `warn` via `getLogger('article')` is acceptable per the app
  logging rule, without changing observable behavior.)

## 6. Testing

File: `app/src/tests/screens/ArticleScreen.test.tsx` (+ App handler coverage).
Per `app/CLAUDE.md`: `@testing-library/react-native` + `jest-expo`; skip presentation
snapshots; target the logic that breaks silently.

- **Hostname parse:** valid url → stripped host; `www.` removed; malformed url → raw
  fallback.
- **Copy-link:** press → `Clipboard.setStringAsync` called with `headline.url`;
  "Copied" state toggles then resets after the timeout.
- **openLinksIn branch (App handler):** `'browser'` → `WebBrowser.openBrowserAsync`
  called with `{ showInRecents: false }`, `setArticle` not called; `'in-app'` →
  `setArticle({h, r})` called, `WebBrowser` not called.
- **CTA:** "Read full article" press → `WebBrowser.openBrowserAsync(headline.url)`
  with no options.
- **Conditional rendering:** category chip only when `category` set; detail paragraph
  only when `detail` set.

Mocks: `expo-web-browser` and `expo-clipboard` mocked; reuse existing RN/gesture-handler
mocks.

## 7. Pre-PR gates

- `/code-review` before opening the PR; fix findings on the branch.
- `/security-review` — **applies.** This slice hands an untrusted `headline.url` to
  `WebBrowser`. Review URL handling (scheme, no injection into a WebView with JS
  enabled, etc.). No auth/notification/deep-link surface in this slice.
- PR targets `develop`, links the legacy file it replaces.

## 8. Definition of done

- `ArticleScreen.tsx` ported; renders from `App.tsx`; `openLinksIn` branch correct.
- Tests pass; coverage on hostname parse, copy-link, openLinksIn branch, CTA.
- `tsc --noEmit`, `eslint`, `npm test`, root `format:check` green.
- Manual: tapping a headline with `in-app` opens the reader; with `browser` opens the
  system browser; CTA and copy work; swipe + back dismiss.
