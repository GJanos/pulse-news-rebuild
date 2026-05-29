import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadDailyDigest } from '../storage/digests';
import { getTodayISO } from '../data';
import { getLogger } from '../logger';
import type { DailyDigest } from '../types';

const log = getLogger('useDigest');
const FETCH_TIMEOUT_MS = 10_000;

export interface DigestQueryFnArgs {
  date: string;
  regions: string[];
  historyDays: number;
  staleMinutes: number;
  forced: boolean;
}

/** Exported for unit testing. Contains all business logic. */
export async function digestQueryFn({
  date,
  regions,
  historyDays,
  staleMinutes,
  forced,
}: DigestQueryFnArgs): Promise<DailyDigest> {
  const effectiveStale = forced ? 0 : staleMinutes;
  log.info(`fetching digest for ${date}${forced ? ' [forced]' : ''}`);
  return await Promise.race([
    loadDailyDigest(date, regions, { historyDays, staleMinutes: effectiveStale }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('digest fetch timed out')), FETCH_TIMEOUT_MS),
    ),
  ]);
}

export interface UseDigestResult {
  digest: DailyDigest | undefined;
  isLoading: boolean;
  /** True only on cold miss (no cached data) — matches legacy behavior. */
  error: boolean;
  forceRefresh: () => Promise<void>;
}

export function useDigest(
  date: string,
  regions: string[],
  historyDays: number,
  staleMinutes: number,
): UseDigestResult {
  const regionsKey = regions.slice().sort().join('|');
  const forcedRef = useRef(false);

  const query = useQuery<DailyDigest>({
    queryKey: ['digest', date, regionsKey],
    staleTime: date === getTodayISO() ? staleMinutes * 60_000 : Infinity,
    gcTime: 24 * 60 * 60_000,
    queryFn: async () => {
      const forced = forcedRef.current;
      forcedRef.current = false;
      return digestQueryFn({ date, regions, historyDays, staleMinutes, forced });
    },
  });

  const forceRefresh = useCallback((): Promise<void> => {
    if (date !== getTodayISO()) return Promise.resolve(); // no-op on past dates
    forcedRef.current = true;
    return query.refetch().then(() => undefined);
  }, [date, query]);

  return {
    digest: query.data,
    isLoading: query.isPending,
    error: query.isError && !query.data,
    forceRefresh,
  };
}
