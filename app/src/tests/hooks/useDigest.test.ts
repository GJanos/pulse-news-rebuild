import { digestQueryFn } from '../../hooks/useDigest';
import { loadDailyDigest } from '../../storage/digests';
import { TODAY_ISO } from '../../data';

jest.mock('../../storage/digests', () => ({ loadDailyDigest: jest.fn() }));
jest.mock('../../logger', () => ({ getLogger: () => ({ info: jest.fn(), warn: jest.fn() }) }));

const REGIONS = ['Hungary', 'Ukraine'];
const PAST = '2020-01-01';
const DIGEST = { date: TODAY_ISO, regions: { Hungary: [{ title: 'A', summary: 'S', url: 'u' }] } };

beforeEach(() => jest.clearAllMocks());

describe('digestQueryFn', () => {
  it('passes staleMinutes and historyDays through when not forced', async () => {
    jest.mocked(loadDailyDigest).mockResolvedValue(DIGEST);
    await digestQueryFn({
      date: TODAY_ISO,
      regions: REGIONS,
      historyDays: 7,
      staleMinutes: 60,
      forced: false,
    });
    expect(loadDailyDigest).toHaveBeenCalledWith(TODAY_ISO, REGIONS, {
      historyDays: 7,
      staleMinutes: 60,
    });
  });

  it('passes staleMinutes: 0 when forced (bypasses stale window)', async () => {
    jest.mocked(loadDailyDigest).mockResolvedValue(DIGEST);
    await digestQueryFn({
      date: TODAY_ISO,
      regions: REGIONS,
      historyDays: 7,
      staleMinutes: 60,
      forced: true,
    });
    expect(loadDailyDigest).toHaveBeenCalledWith(TODAY_ISO, REGIONS, {
      historyDays: 7,
      staleMinutes: 0,
    });
  });

  it('staleMinutes: 0 with forced: false stays 0 (not confused with forced)', async () => {
    jest.mocked(loadDailyDigest).mockResolvedValue(DIGEST);
    await digestQueryFn({
      date: TODAY_ISO,
      regions: REGIONS,
      historyDays: 7,
      staleMinutes: 0,
      forced: false,
    });
    expect(loadDailyDigest).toHaveBeenCalledWith(TODAY_ISO, REGIONS, {
      historyDays: 7,
      staleMinutes: 0,
    });
  });

  it('rejects after 10 seconds (timeout)', async () => {
    jest.useFakeTimers();
    jest
      .mocked(loadDailyDigest)
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(DIGEST), 15_000)),
      );
    const promise = digestQueryFn({
      date: TODAY_ISO,
      regions: REGIONS,
      historyDays: 7,
      staleMinutes: 60,
      forced: false,
    });
    jest.advanceTimersByTime(10_001);
    await expect(promise).rejects.toThrow('digest fetch timed out');
    jest.useRealTimers();
  });

  it('resolves with digest data before timeout fires', async () => {
    jest.useFakeTimers();
    jest.mocked(loadDailyDigest).mockResolvedValue(DIGEST);
    const promise = digestQueryFn({
      date: TODAY_ISO,
      regions: REGIONS,
      historyDays: 7,
      staleMinutes: 60,
      forced: false,
    });
    jest.advanceTimersByTime(100);
    await expect(promise).resolves.toEqual(DIGEST);
    jest.useRealTimers();
  });

  it('propagates loadDailyDigest rejection', async () => {
    jest.mocked(loadDailyDigest).mockRejectedValue(new Error('network error'));
    await expect(
      digestQueryFn({
        date: PAST,
        regions: REGIONS,
        historyDays: 7,
        staleMinutes: 60,
        forced: false,
      }),
    ).rejects.toThrow('network error');
  });

  it('passes regions array unchanged to loadDailyDigest', async () => {
    jest.mocked(loadDailyDigest).mockResolvedValue(DIGEST);
    const regions = ['Hungary', 'Ukraine', 'Russia'];
    await digestQueryFn({ date: PAST, regions, historyDays: 14, staleMinutes: 30, forced: false });
    expect(loadDailyDigest).toHaveBeenCalledWith(PAST, regions, {
      historyDays: 14,
      staleMinutes: 30,
    });
  });
});
