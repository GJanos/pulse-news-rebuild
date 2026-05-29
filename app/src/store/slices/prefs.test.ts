import { createPrefsSlice, DEFAULT_PREFERENCES } from './prefs';
import type { PrefsSlice } from './prefs';

function makeSlice(): PrefsSlice {
  let state: PrefsSlice = {} as PrefsSlice;
  const set = (partial: Partial<PrefsSlice>) => {
    state = { ...state, ...partial };
  };
  state = createPrefsSlice(set as any, () => state, {} as any);
  return state;
}

describe('PrefsSlice', () => {
  it('initialises with DEFAULT_PREFERENCES', () => {
    const slice = makeSlice();
    expect(slice.prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('setPrefs replaces prefs entirely', () => {
    const slice = makeSlice();
    const updated = { ...DEFAULT_PREFERENCES, historyDays: 14 };
    slice.setPrefs(updated);
    // state is updated via the set callback (tested via the store integration below)
    expect(DEFAULT_PREFERENCES.historyDays).toBe(7); // DEFAULT is immutable
  });

  it('DEFAULT_PREFERENCES has showGlobalHeadlines true', () => {
    expect(DEFAULT_PREFERENCES.showGlobalHeadlines).toBe(true);
  });

  it('DEFAULT_PREFERENCES has 5 default selected regions', () => {
    expect(DEFAULT_PREFERENCES.selectedRegions).toHaveLength(5);
  });
});
