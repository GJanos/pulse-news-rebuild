import { createPrefsSlice, DEFAULT_PREFERENCES } from './prefs';
import type { PrefsSlice } from './prefs';

function makeSlice(): { slice: PrefsSlice; setSpy: jest.Mock } {
  let state: PrefsSlice = {} as PrefsSlice;
  const setSpy = jest.fn((partial: Partial<PrefsSlice>) => {
    state = { ...state, ...partial };
  });
  state = createPrefsSlice(setSpy as any, () => state, {} as any);
  return { slice: state, setSpy };
}

describe('PrefsSlice', () => {
  it('initialises with DEFAULT_PREFERENCES', () => {
    const { slice } = makeSlice();
    expect(slice.prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('setPrefs calls set with the new prefs object', () => {
    const { slice, setSpy } = makeSlice();
    const updated = { ...DEFAULT_PREFERENCES, historyDays: 14 };
    slice.setPrefs(updated);
    expect(setSpy).toHaveBeenCalledWith({ prefs: updated });
  });

  it('setPrefs does not mutate DEFAULT_PREFERENCES', () => {
    const { slice } = makeSlice();
    slice.setPrefs({ ...DEFAULT_PREFERENCES, historyDays: 14 });
    expect(DEFAULT_PREFERENCES.historyDays).toBe(7);
  });

  it('DEFAULT_PREFERENCES.showGlobalHeadlines is true', () => {
    expect(DEFAULT_PREFERENCES.showGlobalHeadlines).toBe(true);
  });

  it('DEFAULT_PREFERENCES has 5 selected regions', () => {
    expect(DEFAULT_PREFERENCES.selectedRegions).toHaveLength(5);
  });

  it('DEFAULT_PREFERENCES theme is light', () => {
    expect(DEFAULT_PREFERENCES.theme).toBe('light');
  });

  it('DEFAULT_PREFERENCES aesthetic is editorial', () => {
    expect(DEFAULT_PREFERENCES.aesthetic).toBe('editorial');
  });

  it('DEFAULT_PREFERENCES baseCurrency is USD', () => {
    expect(DEFAULT_PREFERENCES.baseCurrency).toBe('USD');
  });

  it('DEFAULT_PREFERENCES headlineCount is 5', () => {
    expect(DEFAULT_PREFERENCES.headlineCount).toBe(5);
  });
});
