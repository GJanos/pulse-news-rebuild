import type { ContinentName, Region } from '@shared/regions';

export type { ContinentName, Region };

export interface Headline {
  title: string;
  summary: string;
  /** 3-4 sentence deep-dive. Absent on old cached digests. */
  detail?: string;
  url: string;
  category?: string;
  sourceName?: string;
}

export interface RegionDigestPayload {
  headlines: Headline[];
}

export interface DailyDigest {
  date: string;
  regions: Record<string, Headline[]>;
}

export type ThemeId = 'light' | 'sepia' | 'dark';
export type AestheticId = 'editorial' | 'clinical' | 'brutalist';
export type ScreenId = 'splash' | 'digest' | 'settings' | 'login';

export type AppState =
  | 'booting'
  | 'auth-check'
  | 'unauthenticated'
  | 'prefs-loading'
  | 'ready'
  | 'update-required'
  | 'maintenance';

export interface UserPreferences {
  selectedRegions: string[];
  headlineCount: number;
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
  /** ISO timestamp. Newer wins on Supabase ↔ local conflict resolution. */
  updatedAt: string;
}

export interface DeviceRow {
  id: string;
  fcmToken: string;
  userId: string | null;
  notifyAt: string | null;
}

export interface ArticleEntry {
  h: Headline;
  r: Region;
}
