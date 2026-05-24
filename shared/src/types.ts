export type { ContinentName, Region } from './regions';

// ── Headlines ───────────────────────────────────────────────────────

/** A single headline. Canonical cross-package type (unifies legacy app.Headline and cron.RegionHeadline). */
export interface Headline {
  title: string;
  summary: string;
  /** 3-4 sentence deep-dive. Absent on old cached digests. */
  detail?: string;
  url: string;
  category?: string;
  sourceName?: string;
}

/** Payload stored in `digests.payload` JSONB. One row per (region, date). */
export interface RegionDigestPayload {
  headlines: Headline[];
}

/** A globally-important headline selected across all regions. */
export interface GlobalHeadline {
  title: string;
  summary: string;
  detail?: string;
  url: string;
  region: string;
  sourceName?: string;
}

/** Payload stored in `global_digests.payload` JSONB. One row per date. */
export interface GlobalDigestPayload {
  headlines: GlobalHeadline[];
}

/** A region's digest for a specific date, as the app consumes it. */
export interface RegionDigest {
  region: string;
  /** ISO date YYYY-MM-DD. */
  date: string;
  headlines: Headline[];
}

/** A whole day's digest across all regions the user reads. */
export interface DailyDigest {
  /** ISO date YYYY-MM-DD. */
  date: string;
  regions: Record<string, Headline[]>;
}

// ── Settings ────────────────────────────────────────────────────────

export type ThemeId = 'light' | 'sepia' | 'dark';
export type AestheticId = 'editorial' | 'clinical' | 'brutalist';
export type ScreenId = 'login' | 'splash' | 'digest' | 'settings';

export interface UserPreferences {
  selectedRegions: string[];
  headlineCount: number;
  /** Per-region headline count overrides. Missing key → fall back to `headlineCount`. */
  regionHeadlineCounts: Record<string, number>;
  historyDays: number;
  /** "HH:MM" 24h. */
  notifyTime: string;
  openLinksIn: 'in-app' | 'browser';
  regionStyle: 'flag' | 'code';
  baseCurrency: string;
  showCurrencyRates: boolean;
  showGlobalHeadlines: boolean;
  globalHeadlineCount: number;
  theme: ThemeId;
  aesthetic: AestheticId;
  /** ISO timestamp. Used for Supabase ↔ local conflict resolution: newer wins. */
  updatedAt: string;
}

// ── Devices (Supabase) ──────────────────────────────────────────────

/** Mirrors the `devices` row exactly (Supabase column names → camelCase). */
export interface DeviceRow {
  id: string;
  fcmToken: string;
  notifyAt: string | null;
  updatedAt: string;
}
