import { globalQueryFn } from './useGlobalHeadlines';
import { loadGlobalHeadlines } from '../storage/digests';
import { TODAY_ISO } from '../data';
import type { GlobalHeadline } from '../types';

jest.mock('../storage/digests', () => ({ loadGlobalHeadlines: jest.fn() }));
jest.mock('../logger', () => ({ getLogger: () => ({ info: jest.fn(), warn: jest.fn() }) }));

const PAST = '2020-01-01';
const SAMPLE: GlobalHeadline[] = [{ title: 'G', summary: 'S', url: 'u', region: 'Hungary' }];

beforeEach(() => jest.clearAllMocks());

describe('globalQueryFn', () => {
  it('passes staleMinutes through and returns headlines when not forced', async () => {
    jest.mocked(loadGlobalHeadlines).mockResolvedValue(SAMPLE);
    const result = await globalQueryFn({ date: TODAY_ISO, staleMinutes: 60, forced: false });
    expect(loadGlobalHeadlines).toHaveBeenCalledWith(TODAY_ISO, { staleMinutes: 60 });
    expect(result).toEqual(SAMPLE);
  });

  it('passes staleMinutes: 0 when forced', async () => {
    jest.mocked(loadGlobalHeadlines).mockResolvedValue(SAMPLE);
    const result = await globalQueryFn({ date: TODAY_ISO, staleMinutes: 60, forced: true });
    expect(loadGlobalHeadlines).toHaveBeenCalledWith(TODAY_ISO, { staleMinutes: 0 });
    expect(result).toEqual(SAMPLE);
  });

  it('past date — staleMinutes passed through (storage handles immutability)', async () => {
    jest.mocked(loadGlobalHeadlines).mockResolvedValue([]);
    await globalQueryFn({ date: PAST, staleMinutes: 60, forced: false });
    expect(loadGlobalHeadlines).toHaveBeenCalledWith(PAST, { staleMinutes: 60 });
  });

  it('past date with forced: true — still sets staleMinutes: 0', async () => {
    jest.mocked(loadGlobalHeadlines).mockResolvedValue([]);
    await globalQueryFn({ date: PAST, staleMinutes: 60, forced: true });
    expect(loadGlobalHeadlines).toHaveBeenCalledWith(PAST, { staleMinutes: 0 });
  });

  it('returns empty array when loadGlobalHeadlines returns empty', async () => {
    jest.mocked(loadGlobalHeadlines).mockResolvedValue([]);
    const result = await globalQueryFn({ date: TODAY_ISO, staleMinutes: 60, forced: false });
    expect(result).toEqual([]);
  });

  it('propagates rejection from loadGlobalHeadlines', async () => {
    jest.mocked(loadGlobalHeadlines).mockRejectedValue(new Error('storage failure'));
    await expect(
      globalQueryFn({ date: TODAY_ISO, staleMinutes: 60, forced: false }),
    ).rejects.toThrow('storage failure');
  });
});
