import { ALL_REGIONS, resolveRegions } from '../regions';

describe('ALL_REGIONS', () => {
  it('contains region, country, and sources for every entry', () => {
    expect(ALL_REGIONS.length).toBeGreaterThan(0);
    for (const r of ALL_REGIONS) {
      expect(typeof r.region).toBe('string');
      expect(typeof r.country).toBe('string');
      expect(Array.isArray(r.sources)).toBe(true);
    }
  });
});

describe('resolveRegions', () => {
  it('returns configs for known regions in order', () => {
    const result = resolveRegions(['Hungary', 'United States']);
    expect(result).toHaveLength(2);
    expect(result[0]!.region).toBe('Hungary');
    expect(result[1]!.region).toBe('United States');
  });

  it('returns empty array for empty input', () => {
    expect(resolveRegions([])).toEqual([]);
  });

  it('throws with region name when an unknown region is given', () => {
    expect(() => resolveRegions(['Narnia'])).toThrow('Region not found in catalog: "Narnia"');
  });

  it('throws on the first unknown even when valid regions are mixed in', () => {
    expect(() => resolveRegions(['Hungary', 'Atlantis', 'United States'])).toThrow(
      'Region not found in catalog: "Atlantis"',
    );
  });

  it('returned config has all three fields', () => {
    const [r] = resolveRegions(['China']);
    expect(r).toMatchObject({
      region: 'China',
      country: expect.any(String),
      sources: expect.any(Array),
    });
  });
});
