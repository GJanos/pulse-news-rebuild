import { REGIONS, type Region } from '@shared/regions';

export type { Region };

export interface RegionConfig {
  region: string;
  country: string;
  sources: string[];
}

export const ALL_REGIONS: RegionConfig[] = REGIONS.map((r) => ({
  region: r.region,
  country: r.country,
  sources: r.sources,
}));

export function resolveRegions(names: string[]): RegionConfig[] {
  return names.map((name) => {
    const r = ALL_REGIONS.find((r) => r.region === name);
    if (!r) throw new Error(`Region not found in catalog: "${name}"`);
    return r;
  });
}
