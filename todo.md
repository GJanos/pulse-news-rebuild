# Pulse — Todo

## V1

## Code

- [ ] **Set `EXPO_PUBLIC_API_URL`** — once Vercel is deployed, add the deployment URL to `app/.env` so `POST /api/account` (server-side device registration) becomes available
- [ ] **Tighten `devices` table RLS** — current policies use `USING (true)` / `WITH CHECK (true)`, meaning any authenticated user can read/write any device row. Restrict to `user_id = auth.uid()` or move registration through the Vercel `/api/account` route which enforces identity server-side
- [ ] **Vercel deployment** — deploy the two cron API routes to Vercel:
  - Vercel project root directory must be set to `cron/` (dashboard → Settings → General → Root Directory)
  - `vercel.json` at repo root defines the two cron schedules; Vercel reads it from the project root
  - Required env vars (set in Vercel dashboard → Settings → Environment Variables):
    - `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
    - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (store private key with literal `\n`, not real newlines)
    - `PERPLEXITY_API_KEY`
    - `CRON_SECRET` — any random string; Vercel sends `Authorization: Bearer <CRON_SECRET>` on each cron invocation to prevent unauthorized triggers
  - Route split:
    - `GET /api/daily-digest` — fetch + persist + FCM to null-notify_at devices; schedule `0 5 * * *`
    - `GET /api/notify` — FCM to devices in current 30-min window; schedule `*/30 * * * *`
  - `cron/index.ts` remains the local test runner (sends to all devices, no time filtering)

- recurd user usage statistics for metrics and analysis #referencing the gdpr section
- preferences still uses asyncstorage

## Features

### App folder review — high-level findings

### Cron folder review

# UI

- Article view needs to be better organized
- Article view lost the summary text and now only contains title + description
- Tune and reorder menu button is not visible enough
- Reorder buttons need to be larger, more spaced out, and proper buttons instead of arrows
- "Jump to Today" button should be moved to a different location
  - Possibly to the right side of the current date?

- Bring back top arrow navigation buttons (left and right)
  - Only display available navigation directions

- Lock vertical screen orientation while using the app

# Small Bugs

- Currency cache should not use the current day in the cache key; use a much looser timeframe instead
- Settings max regions value should use `config.fetchCount` instead of a fixed constant of 10
- Cron request retry recency logic (`day day day day week week`) should be extracted into config
  - Try week/month retry intervals as tests

# Behaviour

- When opening the app from a notification, the notification does not disappear and the app still shows a notification badge/icon
- Android swipe navigation should be disabled because it interferes with app gestures
  - When an article is opened in the browser or via the "Open Article" button, enable left-swipe back navigation again

- Swipe navigation should be more sensitive

# Extra Features (I need your opinion on whether to implement these or not)

- When clicking currency display data, show a small weekly chart
- Allow choosing a date by clicking the current date and navigating directly to it
  - Might be tricky or unnecessary since navigation is limited to `localHistory` days

Reviewing the current app patterns for navigation, swipe behavior, and summary layout so I can give accurate planning advice.

Searched for regex `Jump to Today|jump to today|localHistory|swipe|swipe navigation|summary` (`**/app/src/**`), 32 results

Searched for regex `currency|Currency` (`**/app/src/**`), 84 results

Searched for regex `notification badge|notification|badge|onNotification|open from notification` (`**/app/src/**`), 48 results

## Plan review

Yes — these are all reasonable improvements, and the list is a good roadmap. I’d group them by priority and risk.

---

### UI

- `Only display available navigation directions` — ✅ also good. Don’t show inactive arrows.
- `Lock vertical screen orientation while using the app` — probably okay, but with caveats:
  - if the layout is strongly portrait-first and landscape looks bad, lock it.

---

---

### Behaviour

- `Android swipe navigation should be disabled because it interferes with app gestures` — ✅ valid. If app-level horizontal swipes are core navigation, disable conflicting system gestures.
  - `When an article is opened in the browser or via the "Open Article" button, enable left-swipe back navigation again` — also reasonable. Just make sure the behavior is predictable and documented visually.
    On disabling Android system swipe-back during digest navigation: Yes, agree. The DigestPager uses RNGH pan for horizontal navigation — left/right edges where Android 10+ wants the system back gesture. Conflict is real and worth fixing.

Caveat — this is not trivial:

React Native exposes View.systemGestureExclusionRects (Android only) to tell the system "don't intercept gestures in these rects." This is the right API.
Caveats: only excludes up to 200dp total per edge (Android system limit), and only available in newer RN/Expo versions. Check what your version supports before assuming.
An alternative (more aggressive) is setNavigationMode via a native module — but it requires custom native code and changes the entire system UI mode. Don't recommend.
I'd start with systemGestureExclusionRects on the pager surface.
On article screen left-swipe-back: Need clarification — two different things:

Restore Android system edge-swipe-back when on article screen — this happens automatically if you don't apply systemGestureExclusionRects on the article screen (it's per-View opt-in). Free.
Add a JS-level horizontal pan on the article screen that closes it on swipe — this is a real implementation: another GestureDetector wrapping the article content.
If you mean (1), it's already the default — just don't extend the exclusion to the article screen. If you mean (2), it's more work but gives consistent UX with the pager.

---

### Extra Features

- `When clicking currency display data, show a small weekly chart` — optional and nice-to-have.
  - I’d treat it as a secondary polish after the main digest/notification flow is stable.
  - Implement only if the currency data is already available and the chart doesn’t clutter the screen.

---

## V2

- [ ] **Sources filtering**

- [ ] **Topic filtering** — user selects preferred/suppressed categories (economy, politics, sports…)
- [ ] **Pulse weekly** clickabel grey down pointing kacsacsor, next to pulse daily text ,when clicked -> dropdown allowing selection of daily/weekly/monthly digest
  - [ ] daily is currently ready, weekly is the same call, but with recency week, monthly with recency month

- [ ] IOS in general **To actually receive push notifications** on iOS, FCM needs an APNs key from your Apple Developer account uploaded to Firebase. Path: Firebase Console → Project Settings → Cloud Messaging → Apple app configuration → APNs Authentication Key. This requires a paid Apple Developer account ($99/yr). You can defer this until you're ready to test push on a real iOS device — Android push works without it.

- [ ] setting for returned article langue get english news -> then mistral llm for translation
  - Setting in Settings: user picks their language (default: English / no translation)
    Cron side, one language at a time: translate the full digest after fetching, store it alongside the original in Supabase under the same structure but with a lang column on the digests table
    Use DeepL (not Claude, not Mistral) — it's purpose-built for translation, free up to 500k chars/month, and better quality than an LLM for most language pairs

# Go live

## Usage statistics

On GDPR and usage stats: Yes, allowed — but you need a lawful basis. For product analytics (which articles get read, time in app), "legitimate interests" covers it without needing a consent popup, as long as your Privacy Policy discloses it. The line is: aggregate/pseudonymous stats (user ID + article ID + timestamp) = fine with disclosure. Selling or sharing that data with third parties = needs explicit consent. Keep it internal for product improvement and you're clean.

Play Store / App Store eligibility — what you actually need:

Mandatory (both stores):

Privacy Policy hosted at a URL — must name: email, device token, preferences stored in Supabase; third parties Perplexity, Anthropic, Firebase. Link must appear in the app (Settings) and in the store listing
Account deletion in-app — Google now hard-requires this for any app with accounts. Apple strongly recommends it. Already on the todo
Content rating questionnaire (IARC for Play, similar for App Store)
Store assets: icon all sizes, 2-8 screenshots, short + long description
Play Store specifically:

Data Safety form — accurately declare what you collect and share; mismatch with actual behaviour gets you rejected
Target SDK 34+ (Android 14)
App Store specifically:

Apple Developer account ($99/yr)
Privacy nutrition labels
APNs key for push (already noted in your todo)
Privacy manifest file if you use certain Apple APIs
GDPR (if EU users):

Right to deletion (account deletion covers this)
Right to data export — lower priority, rarely enforced for small apps
Consent for anything beyond strictly necessary processing — your use case is pretty clean here

# Business model:

Pro deepsearch model runs for potential VIP tier users , but that whould almost 10x my costs so maybe i whould need users first then the feature, but I suppose that is not how it works

Your real constraint is API cost. Rough estimate per active user per day: Perplexity (~9 regions × $0.005) + Anthropic ranking ($0.002) ≈ $0.05/day = ~$18/year. That's before Supabase, Firebase, hosting. A free app with no monetisation loses money at scale.

What works for this type of app:

Freemium (my recommendation):

Free: today only, 3 regions max, no global headlines, no history
Premium ($2.99/month or $19.99/year): all regions, global headlines, full history, tune mode, currency rates, custom notify time
The free tier is genuinely useful enough to hook users. The premium features are the ones power users actually want. At $20/year you cover API costs at ~1,000 active users and start profiting beyond that.
