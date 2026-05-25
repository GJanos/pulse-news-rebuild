import { rankHeadlines } from '../rankHeadlines';
import type { RegionHeadline } from '../types';
import type { PulseConfig } from '@shared/config';

// Silence logger output during tests.
jest.mock('../logging', () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

// Mock the Anthropic SDK so no real API calls are made.
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

const makeConfig = (enabled = true): PulseConfig => ({
  model: {
    name: 'sonar-pro',
    reasoningEffort: 'low',
    temperature: 0.35,
    searchType: 'pro',
    searchContextSize: 'medium',
  },
  api: {
    regions: ['Hungary'],
    fetch: {
      count: 5,
      summarySentences: 1,
      detailSentences: 3,
      maxAttempts: 4,
      attemptDelay: 2000,
      retryDelay: 3000,
      minResults: 5,
      recencySequence: ['day'],
      buffer: 1,
    },
    ranking: {
      local: { enabled, model: 'claude-sonnet-4-6', maxTokens: 256 },
      global: {
        enabled: true,
        count: 5,
        model: 'claude-sonnet-4-6',
        maxTokens: 512,
        chunkSize: 25,
      },
    },
  },
  db: { evict: false, evictDays: 14 },
  log: { level: 'debug', qualityLog: true },
});

const makeHeadlines = (n: number): RegionHeadline[] =>
  Array.from({ length: n }, (_, i) => ({
    title: `Headline ${i + 1}`,
    summary: `Summary ${i + 1}`,
    url: `https://example.com/${i + 1}`,
  }));

function makeRankingResponse(ranking: number[]) {
  return {
    content: [{ type: 'tool_use', id: 'tu_1', name: 'submit_ranking', input: { ranking } }],
    usage: { input_tokens: 100, output_tokens: 20 },
  };
}

describe('rankHeadlines', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, ANTHROPIC_API_KEY: 'test-key' };
    mockCreate.mockReset();
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('returns original order unchanged when ranking is disabled', async () => {
    const headlines = makeHeadlines(3);
    const result = await rankHeadlines(headlines, 'Hungary', makeConfig(false));
    expect(result.headlines).toEqual(headlines);
    expect(result.usage).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns original order unchanged when only 1 headline', async () => {
    const headlines = makeHeadlines(1);
    const result = await rankHeadlines(headlines, 'Hungary', makeConfig());
    expect(result.headlines).toEqual(headlines);
    expect(result.usage).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('reorders headlines according to the ranking returned by Claude', async () => {
    const headlines = makeHeadlines(3);
    // Claude says: most important is 3, then 1, then 2
    mockCreate.mockResolvedValueOnce(makeRankingResponse([3, 1, 2]));

    const result = await rankHeadlines(headlines, 'Hungary', makeConfig());

    expect(result.headlines[0]).toEqual(headlines[2]); // index 3 → position 0
    expect(result.headlines[1]).toEqual(headlines[0]); // index 1 → position 1
    expect(result.headlines[2]).toEqual(headlines[1]); // index 2 → position 2
    expect(result.usage).not.toBeNull();
    expect(result.usage!.promptTokens).toBe(100);
    expect(result.usage!.completionTokens).toBe(20);
  });

  it('falls back to original order when no tool_use block is returned', async () => {
    const headlines = makeHeadlines(3);
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'oops' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await rankHeadlines(headlines, 'Hungary', makeConfig());
    expect(result.headlines).toEqual(headlines);
    expect(result.usage).toBeNull();
  });

  it('falls back when ranking array has wrong length', async () => {
    const headlines = makeHeadlines(3);
    mockCreate.mockResolvedValueOnce(makeRankingResponse([1, 2])); // only 2 of 3

    const result = await rankHeadlines(headlines, 'Hungary', makeConfig());
    expect(result.headlines).toEqual(headlines);
    expect(result.usage).toBeNull();
  });

  it('falls back when ranking contains a duplicate index', async () => {
    const headlines = makeHeadlines(3);
    mockCreate.mockResolvedValueOnce(makeRankingResponse([1, 1, 3]));

    const result = await rankHeadlines(headlines, 'Hungary', makeConfig());
    expect(result.headlines).toEqual(headlines);
    expect(result.usage).toBeNull();
  });

  it('falls back when ranking contains an out-of-range index', async () => {
    const headlines = makeHeadlines(3);
    mockCreate.mockResolvedValueOnce(makeRankingResponse([1, 2, 99]));

    const result = await rankHeadlines(headlines, 'Hungary', makeConfig());
    expect(result.headlines).toEqual(headlines);
    expect(result.usage).toBeNull();
  });

  it('falls back when ANTHROPIC_API_KEY is not set', async () => {
    process.env = { ...OLD_ENV };
    delete process.env['ANTHROPIC_API_KEY'];

    const headlines = makeHeadlines(3);
    const result = await rankHeadlines(headlines, 'Hungary', makeConfig());
    expect(result.headlines).toEqual(headlines);
    expect(result.usage).toBeNull();
  });

  it('falls back when the SDK throws', async () => {
    const headlines = makeHeadlines(3);
    mockCreate.mockRejectedValueOnce(new Error('network error'));

    const result = await rankHeadlines(headlines, 'Hungary', makeConfig());
    expect(result.headlines).toEqual(headlines);
    expect(result.usage).toBeNull();
  });
});
