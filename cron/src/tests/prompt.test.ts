import {
  buildFetchSystemPrompt,
  buildFetchUserPrompt,
  buildRankingSystemPrompt,
  buildRankingUserPrompt,
  buildGlobalSystemPrompt,
  buildGlobalUserPrompt,
} from '../prompt';

describe('buildFetchSystemPrompt', () => {
  it('includes the summarySentences count', () => {
    const prompt = buildFetchSystemPrompt(3, 2);
    expect(prompt).toContain('3 sentence');
  });

  it('includes the detailSentences count', () => {
    const prompt = buildFetchSystemPrompt(2, 4);
    expect(prompt).toContain('4 sentences');
  });
});

describe('buildFetchUserPrompt', () => {
  it('includes region and count', () => {
    const prompt = buildFetchUserPrompt('United Kingdom', 5, []);
    expect(prompt).toContain('United Kingdom');
    expect(prompt).toContain('5');
  });

  it('includes preferred outlets when sources are provided', () => {
    const prompt = buildFetchUserPrompt('Germany', 5, ['Der Spiegel', 'FAZ']);
    expect(prompt).toContain('Der Spiegel');
    expect(prompt).toContain('FAZ');
  });

  it('omits outlet hint when sources list is empty', () => {
    const prompt = buildFetchUserPrompt('France', 5, []);
    expect(prompt).not.toContain('Preferred outlets');
  });
});

describe('buildRankingSystemPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = buildRankingSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('contains ranking guidance keywords', () => {
    const prompt = buildRankingSystemPrompt();
    expect(prompt).toContain('rank');
    expect(prompt).toContain('duplicate');
  });
});

describe('buildRankingUserPrompt', () => {
  const headlines = [
    { title: 'Budget announced', summary: 'The chancellor announced the budget.' },
    { title: 'Election called', summary: 'Prime minister calls snap election.' },
  ];

  it('includes the region', () => {
    const prompt = buildRankingUserPrompt('United Kingdom', headlines);
    expect(prompt).toContain('United Kingdom');
  });

  it('includes all headline titles', () => {
    const prompt = buildRankingUserPrompt('Germany', headlines);
    expect(prompt).toContain('Budget announced');
    expect(prompt).toContain('Election called');
  });

  it('includes the correct count', () => {
    const prompt = buildRankingUserPrompt('France', headlines);
    expect(prompt).toContain('2');
  });
});

describe('buildGlobalSystemPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = buildGlobalSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('describes global importance criteria', () => {
    const prompt = buildGlobalSystemPrompt();
    expect(prompt).toContain('global');
  });
});

describe('buildGlobalUserPrompt', () => {
  const candidates = [
    {
      region: 'United Kingdom',
      title: 'Budget announced',
      summary: 'Chancellor announces budget.',
    },
    { region: 'Germany', title: 'Election called', summary: 'Snap election called.' },
  ];

  it('includes all regions in the output', () => {
    const prompt = buildGlobalUserPrompt(candidates, 1);
    expect(prompt).toContain('United Kingdom');
    expect(prompt).toContain('Germany');
  });

  it('includes the requested count', () => {
    const prompt = buildGlobalUserPrompt(candidates, 1);
    expect(prompt).toContain('1');
  });

  it('includes all candidate titles', () => {
    const prompt = buildGlobalUserPrompt(candidates, 2);
    expect(prompt).toContain('Budget announced');
    expect(prompt).toContain('Election called');
  });
});
