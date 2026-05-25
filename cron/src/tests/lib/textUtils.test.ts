import { stripCitations, summaryHasUrl } from '../../lib/textUtils';

describe('stripCitations', () => {
  it('removes [1], [12], [1][2] markers and collapses whitespace', () => {
    expect(stripCitations('Hello [1] world [12][3].')).toBe('Hello world .');
    expect(stripCitations('No  extra   spaces [1].')).toBe('No extra spaces .');
  });

  it('returns unchanged string when no citations present', () => {
    expect(stripCitations('plain text')).toBe('plain text');
  });
});

describe('summaryHasUrl', () => {
  it('returns true when summary contains http(s) link', () => {
    expect(summaryHasUrl('Read more at https://example.com/article')).toBe(true);
    expect(summaryHasUrl('Visit http://news.site/story')).toBe(true);
  });

  it('returns false when no URL present', () => {
    expect(summaryHasUrl('Just a plain summary with no link.')).toBe(false);
  });
});
