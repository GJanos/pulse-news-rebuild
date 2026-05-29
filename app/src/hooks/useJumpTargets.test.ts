import { buildJumpIndex } from './useJumpTargets';
import type { VisibleBucket } from './useDigestPageData';
import type { GlobalHeadline, Region } from '../types';

// ── helpers ──────────────────────────────────────────────────────────

function makeRegion(name: string): Region {
  return {
    region: name,
    country: name.slice(0, 2).toUpperCase(),
    code: name.slice(0, 2).toUpperCase(),
    continent: 'Europe',
    currency: 'EUR',
    sources: [],
  };
}

function makeBucket(name: string, headlineCount = 1): VisibleBucket {
  return {
    region: makeRegion(name),
    items: Array.from({ length: headlineCount }, (_, i) => ({
      title: `${name} headline ${i}`,
      summary: 's',
      url: `https://example.com/${name}/${i}`,
    })),
  };
}

function makeGlobalHeadlines(count: number): GlobalHeadline[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Global ${i}`,
    summary: 's',
    url: `https://global.com/${i}`,
    region: 'Hungary',
  }));
}

const GLOBAL = makeGlobalHeadlines(3);

// ── global row placement ──────────────────────────────────────────────

describe('buildJumpIndex — global row placement', () => {
  it('global row is first when hasGlobal=true', () => {
    const { listData } = buildJumpIndex([makeBucket('Hungary')], GLOBAL, true);
    expect(listData[0]!.key).toBe('__global__');
    expect(listData[0]!.type).toBe('global');
  });

  it('no global row when hasGlobal=false', () => {
    const { listData } = buildJumpIndex([makeBucket('Hungary')], GLOBAL, false);
    expect(listData.every((it) => it.key !== '__global__')).toBe(true);
  });

  it('global row payload is exactly the globalHeadlines array passed in', () => {
    const hl = makeGlobalHeadlines(2);
    const { listData } = buildJumpIndex([makeBucket('Hungary')], hl, true);
    const globalItem = listData.find((it) => it.key === '__global__')!;
    expect(globalItem.payload).toBe(hl); // same reference
  });

  it('hasGlobal=true with empty visible → only global row', () => {
    const { listData } = buildJumpIndex([], GLOBAL, true);
    expect(listData).toHaveLength(1);
    expect(listData[0]!.key).toBe('__global__');
  });

  it('hasGlobal=false with empty visible → empty listData', () => {
    const { listData } = buildJumpIndex([], GLOBAL, false);
    expect(listData).toHaveLength(0);
  });

  it('hasGlobal=true with empty globalHeadlines array still produces global row', () => {
    const { listData } = buildJumpIndex([makeBucket('Hungary')], [], true);
    expect(listData[0]!.key).toBe('__global__');
    const globalItem = listData[0]!;
    expect(globalItem.type).toBe('global');
    if (globalItem.type === 'global') {
      expect(globalItem.payload).toEqual([]);
    }
  });
});

// ── region rows ───────────────────────────────────────────────────────

describe('buildJumpIndex — region rows', () => {
  it('each region row key equals region.region', () => {
    const buckets = [makeBucket('Hungary'), makeBucket('Ukraine'), makeBucket('Russia')];
    const { listData } = buildJumpIndex(buckets, GLOBAL, false);
    expect(listData.map((it) => it.key)).toEqual(['Hungary', 'Ukraine', 'Russia']);
  });

  it('region row payload is the exact VisibleBucket reference', () => {
    const bucket = makeBucket('Hungary');
    const { listData } = buildJumpIndex([bucket], GLOBAL, false);
    const regionItem = listData[0]!;
    expect(regionItem.type).toBe('region');
    if (regionItem.type === 'region') {
      expect(regionItem.payload).toBe(bucket); // same reference
    }
  });

  it('region row type is "region"', () => {
    const { listData } = buildJumpIndex([makeBucket('Hungary')], [], false);
    expect(listData[0]!.type).toBe('region');
  });

  it('region rows follow visible order exactly', () => {
    const buckets = [makeBucket('Ukraine'), makeBucket('Hungary'), makeBucket('Russia')];
    const { listData } = buildJumpIndex(buckets, GLOBAL, false);
    expect(listData.map((it) => it.key)).toEqual(['Ukraine', 'Hungary', 'Russia']);
  });
});

// ── index map ─────────────────────────────────────────────────────────

describe('buildJumpIndex — indexMap correctness', () => {
  it('indexMap maps __global__ to 0 when hasGlobal=true', () => {
    const { indexMap } = buildJumpIndex([makeBucket('Hungary')], GLOBAL, true);
    expect(indexMap.get('__global__')).toBe(0);
  });

  it('indexMap maps region keys to correct FlatList indices with global', () => {
    const { indexMap } = buildJumpIndex(
      [makeBucket('Hungary'), makeBucket('Ukraine'), makeBucket('Russia')],
      GLOBAL,
      true,
    );
    expect(indexMap.get('__global__')).toBe(0);
    expect(indexMap.get('Hungary')).toBe(1);
    expect(indexMap.get('Ukraine')).toBe(2);
    expect(indexMap.get('Russia')).toBe(3);
  });

  it('indexMap maps region keys to correct indices without global', () => {
    const { indexMap } = buildJumpIndex(
      [makeBucket('Hungary'), makeBucket('Ukraine')],
      GLOBAL,
      false,
    );
    expect(indexMap.get('Hungary')).toBe(0);
    expect(indexMap.get('Ukraine')).toBe(1);
    expect(indexMap.has('__global__')).toBe(false);
  });

  it('indexMap.size equals listData.length', () => {
    const { listData, indexMap } = buildJumpIndex(
      [makeBucket('Hungary'), makeBucket('Ukraine')],
      GLOBAL,
      true,
    );
    expect(indexMap.size).toBe(listData.length);
  });

  it('all indexMap values are unique (no collisions)', () => {
    const { indexMap } = buildJumpIndex(
      [makeBucket('Hungary'), makeBucket('Ukraine'), makeBucket('Russia')],
      GLOBAL,
      true,
    );
    const vals = Array.from(indexMap.values());
    expect(new Set(vals).size).toBe(vals.length);
  });

  it('indexMap indices are contiguous from 0', () => {
    const buckets = [makeBucket('Hungary'), makeBucket('Ukraine'), makeBucket('Russia')];
    const { indexMap } = buildJumpIndex(buckets, GLOBAL, true);
    const sorted = Array.from(indexMap.values()).sort((a, b) => a - b);
    expect(sorted).toEqual([0, 1, 2, 3]);
  });

  it('unknown key is not in indexMap', () => {
    const { indexMap } = buildJumpIndex([makeBucket('Hungary')], GLOBAL, true);
    expect(indexMap.has('NonExistent')).toBe(false);
  });

  it('empty visible + no global → empty indexMap', () => {
    const { indexMap } = buildJumpIndex([], [], false);
    expect(indexMap.size).toBe(0);
  });
});

// ── listData length ───────────────────────────────────────────────────

describe('buildJumpIndex — listData length', () => {
  it('no global, 3 regions → length 3', () => {
    const { listData } = buildJumpIndex(
      [makeBucket('Hungary'), makeBucket('Ukraine'), makeBucket('Russia')],
      GLOBAL,
      false,
    );
    expect(listData).toHaveLength(3);
  });

  it('with global, 3 regions → length 4', () => {
    const { listData } = buildJumpIndex(
      [makeBucket('Hungary'), makeBucket('Ukraine'), makeBucket('Russia')],
      GLOBAL,
      true,
    );
    expect(listData).toHaveLength(4);
  });

  it('with global, 0 regions → length 1', () => {
    const { listData } = buildJumpIndex([], GLOBAL, true);
    expect(listData).toHaveLength(1);
  });

  it('no global, 0 regions → length 0', () => {
    const { listData } = buildJumpIndex([], GLOBAL, false);
    expect(listData).toHaveLength(0);
  });

  it('large list — 10 regions + global → length 11', () => {
    const regions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map(makeBucket);
    const { listData } = buildJumpIndex(regions, GLOBAL, true);
    expect(listData).toHaveLength(11);
  });
});
