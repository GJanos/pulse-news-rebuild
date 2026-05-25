import { callPerplexity } from '../../lib/perplexityClient';

const mockLog = { debug: jest.fn(), info: jest.fn(), warn: jest.fn() };

function makeFetchResponse(
  status: number,
  body: object | string,
  ok = status >= 200 && status < 300,
): Response {
  return {
    ok,
    status,
    statusText: String(status),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

const validCompletion = {
  choices: [{ message: { content: '{}' } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: { total_cost: 0.001 } },
  search_results: [],
  citations: [],
};

describe('callPerplexity — success', () => {
  it('returns parsed JSON on a 200 response', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(200, validCompletion));

    const result = await callPerplexity('https://api.example.com', 'key', {}, mockLog);
    expect(result.usage.total_tokens).toBe(15);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('sends Authorization header with the API key', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(200, validCompletion));

    await callPerplexity('https://api.example.com', 'my-secret-key', {}, mockLog);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-secret-key');
  });
});

describe('callPerplexity — retry on 429 / 5xx', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('retries once on 429 then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(makeFetchResponse(429, 'rate limited', false))
      .mockResolvedValueOnce(makeFetchResponse(200, validCompletion));

    const promise = callPerplexity('https://api.example.com', 'key', {}, mockLog);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.usage.total_tokens).toBe(15);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('429'));
  });

  it('retries once on 500 then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(makeFetchResponse(500, 'server error', false))
      .mockResolvedValueOnce(makeFetchResponse(200, validCompletion));

    const promise = callPerplexity('https://api.example.com', 'key', {}, mockLog);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.usage.total_tokens).toBe(15);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('callPerplexity — error handling', () => {
  it('throws on 401 without retrying', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(401, 'unauthorized', false));

    await expect(callPerplexity('https://api.example.com', 'key', {}, mockLog)).rejects.toThrow(
      '401',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting retries on persistent 500', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue(makeFetchResponse(500, 'server error', false));

    const promise = callPerplexity('https://api.example.com', 'key', {}, mockLog);
    // Attach rejection handler before advancing timers to avoid unhandled-rejection warning
    const assertion = expect(promise).rejects.toThrow('500');
    await jest.runAllTimersAsync();
    await assertion;
    jest.useRealTimers();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// True E2E — only runs when PERPLEXITY_API_KEY is present in the environment.
// Run manually: PERPLEXITY_API_KEY=<key> npx jest perplexityClient
// ---------------------------------------------------------------------------

const E2E_KEY = process.env['PERPLEXITY_API_KEY'];
const describeE2E = E2E_KEY ? describe : describe.skip;

describeE2E('callPerplexity — live API (E2E, skipped in CI)', () => {
  it('returns a valid completion from the Perplexity sonar API', async () => {
    const payload = {
      model: 'sonar',
      messages: [{ role: 'user', content: 'Say "pong" and nothing else.' }],
      max_tokens: 10,
    };

    const result = await callPerplexity(
      'https://api.perplexity.ai/chat/completions',
      E2E_KEY!,
      payload,
      mockLog,
    );

    expect(result.choices).toHaveLength(1);
    expect(result.usage.total_tokens).toBeGreaterThan(0);
  }, 30_000);
});
