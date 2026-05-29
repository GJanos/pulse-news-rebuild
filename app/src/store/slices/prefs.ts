import type { StateCreator } from 'zustand';
import type { UserPreferences } from '../../types';

export const DEFAULT_PREFERENCES: UserPreferences = {
  selectedRegions: ['Hungary', 'Ukraine', 'Russia', 'United States', 'United Kingdom'],
  headlineCount: 5,
  regionHeadlineCounts: {},
  historyDays: 7,
  notifyTime: '07:30',
  openLinksIn: 'in-app',
  regionStyle: 'flag',
  baseCurrency: 'USD',
  showCurrencyRates: false,
  showGlobalHeadlines: true,
  globalHeadlineCount: 5,
  theme: 'light',
  aesthetic: 'editorial',
  updatedAt: new Date(0).toISOString(),
};

export interface PrefsSlice {
  prefs: UserPreferences;
  /** Settings-flow will call this after loading from MMKV/Supabase. */
  setPrefs: (prefs: UserPreferences) => void;
}

export const createPrefsSlice: StateCreator<PrefsSlice> = (set) => ({
  prefs: DEFAULT_PREFERENCES,
  setPrefs: (prefs) => set({ prefs }),
});
