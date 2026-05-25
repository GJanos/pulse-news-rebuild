import { isDuplicateTopic, calcAvgTopicSpread } from '../../lib/topicUtils';

describe('isDuplicateTopic', () => {
  it('returns false for an empty seen list', () => {
    expect(isDuplicateTopic('UK raises interest rates', [])).toBe(false);
  });

  it('returns true for a title with 40%+ Jaccard overlap', () => {
    const seen = [{ title: 'Bank of England raises interest rates again' }];
    expect(isDuplicateTopic('Bank raises interest rates decision', seen)).toBe(true);
  });

  it('returns false for clearly distinct topics', () => {
    const seen = [{ title: 'Bank of England raises interest rates again' }];
    expect(isDuplicateTopic('Prime Minister visits Germany for trade talks', seen)).toBe(false);
  });
});

describe('calcAvgTopicSpread', () => {
  it('returns 1 for a single headline', () => {
    expect(calcAvgTopicSpread([{ title: 'UK raises interest rates' }])).toBe(1);
  });

  it('returns lower spread for near-duplicate titles', () => {
    const spread = calcAvgTopicSpread([
      { title: 'Bank raises interest rates today' },
      { title: 'Bank raises interest rates decision' },
    ]);
    expect(spread).toBeLessThan(0.5);
  });

  it('returns near-1 for completely distinct titles', () => {
    const spread = calcAvgTopicSpread([
      { title: 'Earthquake strikes Japan coast' },
      { title: 'Parliament votes budget legislation' },
    ]);
    expect(spread).toBeGreaterThan(0.7);
  });
});
