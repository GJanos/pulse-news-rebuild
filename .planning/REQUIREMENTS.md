# Requirements: Pulse News Rebuild

**Defined:** 2026-05-24
**Core Value:** Rebuilt codebase matches legacy output on identical input — behavioral parity before v1.0.0

## v1 Requirements

### Shared Package

- [ ] **SHR-01**: `shared/src/types.ts` exports all cross-package domain types (Headline, GlobalHeadline, RegionDigestPayload, GlobalDigestPayload, RegionDigest, DailyDigest, UserPreferences, DeviceRow, ThemeId, AestheticId, ScreenId)
- [ ] **SHR-02**: `shared/src/regions.ts` exports REGIONS array and Region/ContinentName types (identical to legacy `shared/regions.ts`)
- [ ] **SHR-03**: `shared/src/config.ts` exports PulseConfig type and all sub-types (ModelConfig, FetchConfig, RankingConfig, ApiConfig, DbConfig, LogConfig)
- [ ] **SHR-04**: `shared/pulse.config.json` is the single runtime config file consumed by both app and cron
- [ ] **SHR-05**: `@shared/*` path alias resolves to `../shared/src/*` in both `app/tsconfig.json` and `cron/tsconfig.json`
- [ ] **SHR-06**: `@shared/*` moduleNameMapper resolves correctly in both `app/jest.config.cjs` and `cron/jest.config.cjs`

### Cron Config

- [ ] **CFG-01**: `cron/src/config.ts` loads and merges `pulse.config.json` with typed defaults from `@shared/config`
- [ ] **CFG-02**: `loadPulseConfig()` applies env var overrides (LOG_LEVEL, COUNT, MIN_RESULTS)
- [ ] **CFG-03**: `loadPulseConfig()` deep-merges partial overrides without overwriting unspecified defaults

### Cron Fetch

- [ ] **FET-01**: `fetchNews.ts` fetches headlines for a region via Perplexity API
- [ ] **FET-02**: Retry logic follows `recencySequence` with `maxAttempts` and `attemptDelay`/`retryDelay`
- [ ] **FET-03**: Response parsed and filtered to produce `RegionHeadline[]`

### Cron Dedup

- [ ] **DED-01**: Duplicate headlines filtered by URL and fuzzy title match before ranking

### Cron Rank

- [ ] **RNK-01**: Local ranking reorders headlines per region via Claude API
- [ ] **RNK-02**: Global ranking selects top headlines across all regions
- [ ] **RNK-03**: Ranking behavior is covered by unit tests (highest test priority in the project)

### Cron Digest

- [ ] **DIG-01**: Digest assembled from ranked headlines per region
- [ ] **DIG-02**: Digest + global digest persisted to Supabase `digests` / `global_digests` tables
- [ ] **DIG-03**: Old digests evicted from DB according to `db.evict`/`db.evictDays` config

### Cron Notify

- [ ] **NOT-01**: FCM push notifications dispatched to devices in the current 30-min window
- [ ] **NOT-02**: Devices with `notify_at = null` receive notification at digest generation time

### Cron API

- [ ] **API-01**: `api/daily-digest.ts` entry wires pipeline (fetch → rank → persist → notify)
- [ ] **API-02**: `api/notify.ts` dispatches FCM to devices in current window
- [ ] **API-03**: `api/account.ts` handles device registration (POST) and deletion (DELETE)
- [ ] **API-04**: Cron secret verified on all API endpoints

### App Foundation

- [ ] **APP-01**: App.tsx shell with font loading, safe areas, navigation skeleton, error boundaries
- [ ] **APP-02**: Theme system (light/sepia/dark) and aesthetic system (editorial/clinical/brutalist)

### App Auth Flow

- [ ] **AUTH-01**: User can log in with email/password via Supabase
- [ ] **AUTH-02**: User can sign up with email/password
- [ ] **AUTH-03**: User can reset password via email link
- [ ] **AUTH-04**: Session persists across app restarts

### App Digest Flow

- [ ] **DGST-01**: User can view daily digest for selected regions
- [ ] **DGST-02**: User can page through region digests with swipe
- [ ] **DGST-03**: Currency rates displayed inline (fetched in app)
- [ ] **DGST-04**: Global headlines section displayed when enabled
- [ ] **DGST-05**: User preferences (selected regions, headline counts, history) applied to digest display

### App Settings Flow

- [ ] **SET-01**: User can edit selected regions
- [ ] **SET-02**: User can edit notification time, headline counts, theme, aesthetic, currency display preferences
- [ ] **SET-03**: Preferences synced to Supabase and persisted locally via MMKV

### App Article

- [ ] **ART-01**: Tapping a headline opens article in in-app browser or system browser per preference

### App Notifications

- [ ] **NTF-01**: Device registered with FCM and Supabase on first launch
- [ ] **NTF-02**: Deep link from notification navigates to correct digest
- [ ] **NTF-03**: Password recovery deep link handled and routed to reset screen

## v2 Requirements

- No v2 scope defined yet — behavioral parity is the entire v1 goal

## Out of Scope

| Feature                   | Reason                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| Algorithm changes         | Behavioral parity first; defer to todo.md for post-parity fix/\* branches |
| Currency fetching in cron | Happens in app; no cron/currency slice                                    |
| npm workspaces            | Two consumers don't justify tooling tax                                   |
| release/ branch           | Until beta channel exists                                                 |
| New features              | Out of scope until v1.0.0 is tagged                                       |

## Traceability

| Requirement        | Phase    | Status  |
| ------------------ | -------- | ------- |
| SHR-01 to SHR-06   | Phase 1  | Pending |
| CFG-01 to CFG-03   | Phase 2  | Pending |
| FET-01 to FET-03   | Phase 3  | Pending |
| DED-01             | Phase 4  | Pending |
| RNK-01 to RNK-03   | Phase 5  | Pending |
| DIG-01 to DIG-03   | Phase 6  | Pending |
| NOT-01 to NOT-02   | Phase 7  | Pending |
| API-01 to API-04   | Phase 8  | Pending |
| APP-01 to APP-02   | Phase 9  | Pending |
| AUTH-01 to AUTH-04 | Phase 10 | Pending |
| DGST-01 to DGST-05 | Phase 11 | Pending |
| SET-01 to SET-03   | Phase 12 | Pending |
| ART-01             | Phase 13 | Pending |
| NTF-01 to NTF-03   | Phase 14 | Pending |

**Coverage:**

- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0 ✓

---

_Requirements defined: 2026-05-24_
_Last updated: 2026-05-24 after initialization from REBUILD_PLAN.md_
