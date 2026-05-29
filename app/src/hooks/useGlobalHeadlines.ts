import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadGlobalHeadlines } from '../storage/digests';
import { getTodayISO } from '../data';
import { getLogger } from '../logger';
import type { GlobalHeadline } from '../types';

const log = getLogger('useGlobalHeadlines');

export interface GlobalQueryFnArgs {
  date: string;
  staleMinutes: number;
  forced: boolean;
}

/** Exported for unit testing. */
export async function globalQueryFn({
  date,
  staleMinutes,
  forced,
}: GlobalQueryFnArgs): Promise<GlobalHeadline[]> {
  const effectiveStale = forced ? 0 : staleMinutes;
  log.info(`fetching global headlines for ${date}${forced ? ' [forced]' : ''}`);
  return loadGlobalHeadlines(date, { staleMinutes: effectiveStale });
}

export interface UseGlobalHeadlinesResult {
  headlines: GlobalHeadline[];
  forceRefresh: () => void;
}

export function useGlobalHeadlines(
  date: string,
  enabled: boolean,
  staleMinutes: number,
): UseGlobalHeadlinesResult {
  const forcedRef = useRef(false);

  const query = useQuery<GlobalHeadline[]>({
    queryKey: ['global', date],
    enabled,
    staleTime: date === getTodayISO() ? staleMinutes * 60_000 : Infinity,
    gcTime: 24 * 60 * 60_000,
    queryFn: async () => {
      const forced = forcedRef.current;
      forcedRef.current = false;
      return globalQueryFn({ date, staleMinutes, forced });
    },
  });

  const forceRefresh = useCallback(() => {
    if (date !== getTodayISO()) return; // no-op on past dates (matches legacy)
    forcedRef.current = true;
    void query.refetch();
  }, [date, query]);

  return {
    headlines: query.data ?? [],
    forceRefresh,
  };
}
