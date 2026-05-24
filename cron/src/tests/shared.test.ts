import { REGIONS } from '@shared/regions';
import type { Headline, UserPreferences } from '@shared/types';
import '@shared/config'; // runtime module existence check — config.ts has no value exports
import type { SharedConfig } from '@shared/config';

describe('@shared/regions', () => {
  it('exports 9 regions', () => {
    expect(REGIONS).toHaveLength(9);
  });

  it('every region has required fields', () => {
    for (const r of REGIONS) {
      expect(r.region).toBeTruthy();
      expect(r.country).toMatch(/^[A-Z]{2}$/);
      expect(r.currency).toMatch(/^[A-Z]{3}$/);
      expect(r.sources.length).toBeGreaterThan(0);
    }
  });

  it('Hungary is first in display order', () => {
    expect(REGIONS[0]?.region).toBe('Hungary');
  });
});

describe('@shared/types type smoke', () => {
  it('Headline shape compiles', () => {
    const h: Headline = {
      title: 'Test',
      summary: 'Summary',
      url: 'https://example.com',
    };
    expect(h.title).toBe('Test');
  });

  it('UserPreferences shape compiles', () => {
    const prefs: UserPreferences = {
      selectedRegions: ['Hungary'],
      headlineCount: 5,
      regionHeadlineCounts: {},
      historyDays: 7,
      notifyTime: '07:00',
      openLinksIn: 'in-app',
      regionStyle: 'flag',
      baseCurrency: 'USD',
      showCurrencyRates: true,
      showGlobalHeadlines: false,
      globalHeadlineCount: 5,
      theme: 'light',
      aesthetic: 'editorial',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(prefs.selectedRegions).toContain('Hungary');
  });
});

describe('@shared/config type smoke', () => {
  it('SharedConfig app subtree shape compiles', () => {
    const cfg: Pick<SharedConfig, 'app'> = {
      app: {
        screenStateTtlMs: 1800000,
        splashAdvanceMs: 900,
        deviceRegistrationTimeoutMs: 10000,
        prefsDebounceMs: 100,
        logLevel: 'info',
        digestStaleMins: 60,
        currencyStaleMins: 5,
        fetchCount: 5,
      },
    };
    expect(cfg.app.screenStateTtlMs).toBe(1800000);
  });
});
