import {
  isArticleUrl,
  urlSlug,
  isValidHeadlineUrl,
  isFakePlaceholder,
  isModelUrlPlausible,
  matchUrl,
} from '../../lib/urlUtils';

describe('isArticleUrl', () => {
  it('returns false for youtube.com', () => {
    expect(isArticleUrl('https://youtube.com/watch?v=abc')).toBe(false);
  });

  it('returns true for a news article URL', () => {
    expect(isArticleUrl('https://reuters.com/world/uk/story-slug-2024-01-01/')).toBe(true);
  });
});

describe('urlSlug', () => {
  it('returns last path segment', () => {
    expect(urlSlug('https://example.com/news/some-article-slug')).toBe('some-article-slug');
  });

  it('returns empty string for invalid URL', () => {
    expect(urlSlug('not-a-url')).toBe('');
  });
});

describe('isValidHeadlineUrl', () => {
  it('rejects homepage (path = /)', () => {
    expect(isValidHeadlineUrl('https://reuters.com/')).toBe(false);
  });

  it('rejects topic/tag/category pages', () => {
    expect(isValidHeadlineUrl('https://example.com/topic/politics')).toBe(false);
    expect(isValidHeadlineUrl('https://example.com/category/world')).toBe(false);
    expect(isValidHeadlineUrl('https://example.com/tag/economy')).toBe(false);
  });

  it('accepts a well-formed article URL', () => {
    expect(
      isValidHeadlineUrl('https://reuters.com/world/uk/uk-prime-minister-visits-2024-01-15/'),
    ).toBe(true);
  });

  it('rejects social domain URLs', () => {
    expect(isValidHeadlineUrl('https://twitter.com/user/status/123')).toBe(false);
    expect(isValidHeadlineUrl('https://facebook.com/post/456')).toBe(false);
  });
});

describe('isFakePlaceholder', () => {
  it('returns true for placeholder-style titles', () => {
    expect(isFakePlaceholder('No news available')).toBe(true);
    expect(isFakePlaceholder('No stories found')).toBe(true);
    expect(isFakePlaceholder('none')).toBe(true);
    expect(isFakePlaceholder('Information not available')).toBe(true);
  });

  it('returns false for a real headline title', () => {
    expect(isFakePlaceholder('UK raises interest rates to 5.25%')).toBe(false);
  });
});

describe('isModelUrlPlausible', () => {
  it('returns true when path has fewer than 3 long words', () => {
    expect(isModelUrlPlausible('Some Title', 'https://example.com/ab')).toBe(true);
  });

  it('returns true when at least one path word matches title', () => {
    expect(
      isModelUrlPlausible(
        'Ukraine ceasefire talks collapse',
        'https://example.com/ukraine-ceasefire-diplomacy-2024',
      ),
    ).toBe(true);
  });

  it('returns false when path words have no overlap with title', () => {
    expect(
      isModelUrlPlausible(
        'Brexit trade deal signed',
        'https://example.com/technology-gadgets-review-roundup',
      ),
    ).toBe(false);
  });
});

describe('matchUrl', () => {
  const results = [
    {
      title: 'UK Prime Minister announces new budget plan',
      url: 'https://reuters.com/world/uk/budget-2024/',
      snippet: 'The prime minister budget announcement',
    },
    {
      title: 'Sports round-up',
      url: 'https://example.com/sports/roundup/',
      snippet: 'Football scores',
    },
    {
      title: 'UK budget plan details revealed',
      url: 'https://bbc.co.uk/news/uk-budget-plan-details',
      snippet: 'budget plan prime minister details',
    },
  ];

  it('returns the best-scoring search result URL', () => {
    const { url, score } = matchUrl(
      'UK Prime Minister budget plan announcement',
      results,
      new Set(),
    );
    expect(url).not.toBeNull();
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it('returns null when no result meets the threshold', () => {
    const { url } = matchUrl('Completely unrelated topic xyz', results, new Set());
    expect(url).toBeNull();
  });

  it('skips already-used URLs', () => {
    const used = new Set([
      'https://reuters.com/world/uk/budget-2024/',
      'https://bbc.co.uk/news/uk-budget-plan-details',
    ]);
    const { url } = matchUrl('UK Prime Minister budget plan announcement', results, used);
    expect(url).toBeNull();
  });
});
