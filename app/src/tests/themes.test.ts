import { font, AESTHETICS, THEMES } from '../themes';

describe('font()', () => {
  it('editorial title → SourceSerif4_600SemiBold', () => {
    expect(font(AESTHETICS.editorial, 'title')).toBe('SourceSerif4_600SemiBold');
  });

  it('editorial body → SourceSerif4_400Regular', () => {
    expect(font(AESTHETICS.editorial, 'body')).toBe('SourceSerif4_400Regular');
  });

  it('editorial ui → Inter_500Medium', () => {
    expect(font(AESTHETICS.editorial, 'ui')).toBe('Inter_500Medium');
  });

  it('editorial eyebrow → Inter_600SemiBold', () => {
    expect(font(AESTHETICS.editorial, 'eyebrow')).toBe('Inter_600SemiBold');
  });

  it('editorial number → Inter_500Medium', () => {
    expect(font(AESTHETICS.editorial, 'number')).toBe('Inter_500Medium');
  });

  it('weightOverride overrides the role default', () => {
    expect(font(AESTHETICS.editorial, 'title', 700)).toBe('SourceSerif4_700Bold');
    expect(font(AESTHETICS.editorial, 'body', 600)).toBe('SourceSerif4_600SemiBold');
  });

  it('clinical title → Inter_600SemiBold', () => {
    expect(font(AESTHETICS.clinical, 'title')).toBe('Inter_600SemiBold');
  });

  it('brutalist title → JetBrainsMono_600SemiBold', () => {
    expect(font(AESTHETICS.brutalist, 'title')).toBe('JetBrainsMono_600SemiBold');
  });

  it('all aesthetics × all roles return valid font name pattern', () => {
    const roles = ['title', 'body', 'ui', 'eyebrow', 'number'] as const;
    const pattern =
      /^(SourceSerif4|Inter|JetBrainsMono)_(400Regular|500Medium|600SemiBold|700Bold)$/;
    for (const aes of Object.values(AESTHETICS)) {
      for (const role of roles) {
        expect(font(aes, role)).toMatch(pattern);
      }
    }
  });
});

describe('THEMES', () => {
  const requiredKeys = [
    'id',
    'bg',
    'surface',
    'text',
    'textDim',
    'textFaint',
    'rule',
    'ruleStrong',
    'accent',
    'accentSoft',
    'chip',
    'chipText',
    'barStyle',
  ] as const;

  it('all three themes have all required color keys', () => {
    for (const theme of Object.values(THEMES)) {
      for (const key of requiredKeys) {
        expect(theme).toHaveProperty(key);
      }
    }
  });

  it('barStyle is either light or dark', () => {
    for (const theme of Object.values(THEMES)) {
      expect(['light', 'dark']).toContain(theme.barStyle);
    }
  });
});
