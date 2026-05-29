import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLogger } from '../logger';

const log = getLogger('useCurrencyRates');

/** Intentional improvement: 5 minutes (legacy was 60 minutes). */
const STALE_MS = 5 * 60_000;

export interface CurrencyRate {
  rate: number;
  changePercent: number | null;
}

function currencyUrls(base: string, date: 'latest' | string): [string, string] {
  const key = base.toLowerCase();
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${key}.json`,
    `https://${date}.currency-api.pages.dev/v1/currencies/${key}.json`,
  ];
}

export async function fetchRates(
  base: string,
  date: 'latest' | string,
): Promise<Record<string, number> | null> {
  const key = base.toLowerCase();
  const urls = currencyUrls(base, date);
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        log.warn(`currency fetch failed: HTTP ${res.status} (${url})`);
        continue;
      }
      const json = (await res.json()) as Record<string, Record<string, number>>;
      const rates = json[key] ?? null;
      if (rates) return rates;
    } catch (e) {
      log.warn(`currency fetch threw: ${String(e)} (${url})`);
    }
  }
  return null;
}

/** Exported for unit testing. Fetches today + yesterday rates and builds the CurrencyRate map. */
export async function buildCurrencyRates(
  codes: string[],
  baseCurrency: string,
): Promise<Record<string, CurrencyRate>> {
  const yesterdayDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  log.info(`fetching ${baseCurrency} rates for [${codes.join(', ')}]`);
  const [today, yesterday] = await Promise.all([
    fetchRates(baseCurrency, 'latest'),
    fetchRates(baseCurrency, yesterdayDate),
  ]);
  if (!today) {
    log.warn('today rates unavailable — returning {}');
    return {};
  }
  const result: Record<string, CurrencyRate> = {};
  for (const code of codes) {
    if (code === baseCurrency) continue;
    const key = code.toLowerCase();
    const rate = today[key];
    if (rate == null) continue;
    const prevRate = yesterday?.[key] ?? null;
    const changePercent = prevRate != null ? ((prevRate - rate) / prevRate) * 100 : null;
    result[code] = { rate, changePercent };
  }
  return result;
}

export function formatRate(rate: number): string {
  if (rate >= 10_000) return Math.round(rate).toLocaleString('en-US');
  if (rate >= 100) return Math.round(rate).toString();
  if (rate >= 10) return rate.toFixed(2);
  if (rate >= 1) return rate.toFixed(3);
  return rate.toFixed(3);
}

export interface UseCurrencyRatesResult {
  rates: Record<string, CurrencyRate>;
  forceRefresh: () => void;
}

export function useCurrencyRates(
  codes: string[],
  enabled: boolean,
  baseCurrency = 'USD',
): UseCurrencyRatesResult {
  const codesKey = codes.slice().sort().join(',');
  const forcedRef = useRef(false);

  const query = useQuery<Record<string, CurrencyRate>>({
    queryKey: ['currency', baseCurrency, codesKey],
    enabled: enabled && codesKey !== '',
    staleTime: STALE_MS,
    gcTime: 60 * 60_000,
    queryFn: async () => {
      forcedRef.current = false;
      return buildCurrencyRates(codes, baseCurrency);
    },
    throwOnError: false,
  });

  const forceRefresh = useCallback(() => {
    forcedRef.current = true;
    void query.refetch();
  }, [query]);

  return {
    rates: query.data ?? {},
    forceRefresh,
  };
}
