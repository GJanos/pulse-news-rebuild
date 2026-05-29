import { storage } from './mmkv';
import type {
  DailyDigest,
  Headline,
  RegionDigestPayload,
  GlobalHeadline,
  GlobalDigestPayload,
} from '../types';
import { getSupabase } from '../supabase/client';
import { getLogger } from '../logger';

const log = getLogger('digests');

const CACHE_KEY_PREFIX = 'pulse.digest.v1';
const GLOBAL_CACHE_KEY_PREFIX = 'pulse.global.v1';

function cacheKey(region: string, date: string): string {
  return `${CACHE_KEY_PREFIX}::${date}::${region}`;
}

interface CachedRegionDigest {
  region: string;
  date: string;
  headlines: Headline[];
  cachedAt: string;
}

interface CachedGlobalDigest {
  date: string;
  headlines: GlobalHeadline[];
  cachedAt: string;
}

export async function loadLocalRegionDigest(
  region: string,
  date: string,
): Promise<Headline[] | null> {
  try {
    const raw = storage.getString(cacheKey(region, date));
    if (!raw) {
      log.debug(`cache miss: ${region} ${date}`);
      return null;
    }
    const parsed = JSON.parse(raw) as CachedRegionDigest;
    log.debug(`cache hit: ${region} ${date} (${parsed.headlines.length} headlines)`);
    return parsed.headlines;
  } catch {
    log.warn(`failed to read cache for ${region} ${date}`);
    return null;
  }
}

function multiGetRegionDigests(
  regions: string[],
  date: string,
): Record<string, CachedRegionDigest> {
  if (regions.length === 0) return {};
  const out: Record<string, CachedRegionDigest> = {};
  for (const region of regions) {
    const raw = storage.getString(cacheKey(region, date));
    if (!raw) continue;
    try {
      out[region] = JSON.parse(raw) as CachedRegionDigest;
    } catch {
      log.warn(`failed to parse cached entry for ${region} ${date}`);
    }
  }
  log.debug(`multiGet: ${Object.keys(out).length}/${regions.length} cache hits for ${date}`);
  return out;
}

export function saveLocalRegionDigest(region: string, date: string, headlines: Headline[]): void {
  const entry: CachedRegionDigest = { region, date, headlines, cachedAt: new Date().toISOString() };
  try {
    storage.set(cacheKey(region, date), JSON.stringify(entry));
    log.debug(`cached ${region} ${date} (${headlines.length} headlines)`);
  } catch {
    log.warn(`failed to write cache for ${region} ${date}`);
  }
}

export function trimLocalCache(historyDays: number): void {
  try {
    const keys = storage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(CACHE_KEY_PREFIX + '::'));
    if (ours.length === 0) return;
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - historyDays);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const toDrop = ours.filter((k) => {
      const parts = k.split('::');
      const date = parts[1];
      return date ? date < cutoffISO : false;
    });
    if (toDrop.length > 0) {
      for (const key of toDrop) storage.remove(key);
      log.info(`trimmed ${toDrop.length} stale cache entries (cutoff ${cutoffISO})`);
    }
  } catch {
    log.warn('cache trim failed');
  }
}

export async function fetchRemoteDigestsForDate(
  date: string,
  regions: string[],
): Promise<Array<{ region: string; headlines: Headline[] }>> {
  const supabase = getSupabase();
  if (!supabase || regions.length === 0) return [];
  log.info(`fetching ${regions.length} region(s) from Supabase for ${date}`);
  const { data, error } = await supabase
    .from('digests')
    .select('region, payload')
    .eq('date', date)
    .in('region', regions);
  if (error || !data) {
    log.warn(`Supabase fetch failed: ${error?.message ?? 'no data returned'}`);
    return [];
  }
  return data.map((row) => {
    const payload = row.payload as RegionDigestPayload;
    return { region: row.region as string, headlines: payload.headlines ?? [] };
  });
}

function writeThrough(region: string, date: string, headlines: Headline[]): void {
  saveLocalRegionDigest(region, date, headlines);
}

async function fetchAndCache(
  date: string,
  regions: string[],
  out: Record<string, Headline[]>,
): Promise<Array<{ region: string; headlines: Headline[] }>> {
  const remote = await fetchRemoteDigestsForDate(date, regions);
  for (const row of remote) {
    out[row.region] = row.headlines;
    writeThrough(row.region, date, row.headlines);
  }
  return remote;
}

export async function loadDailyDigest(
  date: string,
  regions: string[],
  options?: { historyDays?: number; staleMinutes?: number },
): Promise<DailyDigest> {
  log.info(`loading digest ${date} for ${regions.length} region(s)`);
  const out: Record<string, Headline[]> = {};
  const today = new Date().toISOString().slice(0, 10);

  if (date === today) {
    const staleMs = (options?.staleMinutes ?? 60) * 60 * 1000;
    const now = Date.now();
    const cached = multiGetRegionDigests(regions, date);
    const stale = regions.filter((r) => {
      const entry = cached[r];
      if (!entry) return true;
      return now - new Date(entry.cachedAt).getTime() > staleMs;
    });
    const staleSet = new Set(stale);
    for (const r of regions.filter((r) => !staleSet.has(r))) out[r] = cached[r]!.headlines;
    if (stale.length > 0) {
      const remote = await fetchAndCache(date, stale, out);
      const fromRemote = new Set(remote.map((r) => r.region));
      for (const r of stale.filter((r) => !fromRemote.has(r))) {
        if (cached[r]) {
          out[r] = cached[r]!.headlines;
        }
      }
    }
  } else {
    const cached = multiGetRegionDigests(regions, date);
    for (const [r, entry] of Object.entries(cached)) out[r] = entry.headlines;
    const missing = regions.filter((r) => !cached[r]);
    if (missing.length > 0) await fetchAndCache(date, missing, out);
  }

  if (options?.historyDays && date === today) trimLocalCache(options.historyDays);

  return { date, regions: out };
}

function loadLocalGlobalDigest(date: string, staleMs: number): GlobalHeadline[] | null {
  try {
    const raw = storage.getString(`${GLOBAL_CACHE_KEY_PREFIX}::${date}`);
    if (!raw) {
      log.debug(`global cache miss: ${date}`);
      return null;
    }
    const parsed = JSON.parse(raw) as CachedGlobalDigest;
    if (staleMs > 0 && Date.now() - new Date(parsed.cachedAt).getTime() > staleMs) {
      log.debug(`global cache stale: ${date}`);
      return null;
    }
    return parsed.headlines;
  } catch {
    log.warn(`failed to read global cache for ${date}`);
    return null;
  }
}

function writeGlobalThrough(date: string, headlines: GlobalHeadline[]): void {
  const entry: CachedGlobalDigest = { date, headlines, cachedAt: new Date().toISOString() };
  try {
    storage.set(`${GLOBAL_CACHE_KEY_PREFIX}::${date}`, JSON.stringify(entry));
  } catch (e) {
    log.warn(`failed to write global cache: ${String(e)}`);
  }
}

export async function loadGlobalHeadlines(
  date: string,
  options?: { staleMinutes?: number },
): Promise<GlobalHeadline[]> {
  log.info(`loading global headlines for ${date}`);
  const today = new Date().toISOString().slice(0, 10);
  const staleMs = date === today ? (options?.staleMinutes ?? 60) * 60 * 1000 : 0;
  const cached = loadLocalGlobalDigest(date, staleMs);
  if (cached) return cached;
  const supabase = getSupabase();
  if (!supabase) {
    log.warn('Supabase not configured');
    return [];
  }
  const { data, error } = await supabase
    .from('global_digests')
    .select('payload')
    .eq('date', date)
    .maybeSingle();
  if (error) {
    log.warn(`Supabase global fetch failed: ${error.message}`);
    return [];
  }
  if (!data) {
    log.info(`no global digest for ${date}`);
    return [];
  }
  const headlines = (data.payload as GlobalDigestPayload).headlines ?? [];
  writeGlobalThrough(date, headlines);
  return headlines;
}
