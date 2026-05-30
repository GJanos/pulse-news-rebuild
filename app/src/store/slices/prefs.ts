import type { StateCreator } from 'zustand';
import type { UserPreferences } from '../../types';
import { DEFAULT_PREFERENCES } from '../../storage/preferences';

export type { UserPreferences };
export { DEFAULT_PREFERENCES };

export interface PrefsSlice {
  prefs: UserPreferences;
  /** Counts user-initiated setPref calls. Incremented by setPref, NOT by setPrefs.
   *  usePreferences watches this to debounce flush without reacting to hydration writes. */
  prefsMutationCount: number;
  /** Replace the full prefs object (hydration / remote sync). Does not dirty-mark. */
  setPrefs: (prefs: UserPreferences) => void;
  /** Update a single preference key, bump updatedAt, increment prefsMutationCount. */
  setPref: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
}

export const createPrefsSlice: StateCreator<PrefsSlice> = (set) => ({
  prefs: DEFAULT_PREFERENCES,
  prefsMutationCount: 0,
  setPrefs: (prefs) => set({ prefs }),
  setPref: (key, value) =>
    set((s) => ({
      prefs: { ...s.prefs, [key]: value, updatedAt: new Date().toISOString() },
      prefsMutationCount: s.prefsMutationCount + 1,
    })),
});
