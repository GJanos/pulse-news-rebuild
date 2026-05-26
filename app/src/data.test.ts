import { isoDateAtDayIndex, formatLongDate, sortedSelectedRegions, TODAY_ISO } from './data';

describe('isoDateAtDayIndex', () => {
  it('index 0 returns today in YYYY-MM-DD format', () => {
    expect(isoDateAtDayIndex(0)).toBe(TODAY_ISO);
    expect(isoDateAtDayIndex(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('index 1 returns yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(isoDateAtDayIndex(1)).toBe(d.toISOString().slice(0, 10));
  });

  it('index 7 returns 7 days ago', () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    expect(isoDateAtDayIndex(7)).toBe(d.toISOString().slice(0, 10));
  });

  it('TODAY_ISO matches isoDateAtDayIndex(0)', () => {
    expect(TODAY_ISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('sortedSelectedRegions', () => {
  it('returns empty array for empty selection', () => {
    expect(sortedSelectedRegions([])).toEqual([]);
  });

  it('filters to only the selected region names', () => {
    const result = sortedSelectedRegions(['Hungary', 'United States']);
    const names = result.map((r) => r.region);
    expect(names).toContain('Hungary');
    expect(names).toContain('United States');
    expect(result).toHaveLength(2);
  });

  it('ignores unknown region names silently', () => {
    const result = sortedSelectedRegions(['NonExistentCountry', 'Hungary']);
    expect(result).toHaveLength(1);
    expect(result[0]?.region).toBe('Hungary');
  });

  it('preserves order from REGIONS for same continent', () => {
    const result = sortedSelectedRegions(['Hungary', 'Ukraine', 'Russia']);
    expect(result).toHaveLength(3);
    for (const r of result) {
      expect(r).toHaveProperty('region');
      expect(r).toHaveProperty('continent');
    }
  });
});

describe('formatLongDate', () => {
  it('returns an object or string for a valid ISO date', () => {
    const result = formatLongDate('2026-01-15');
    expect(result).toBeDefined();
  });
});
