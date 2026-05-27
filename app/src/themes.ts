import type { AestheticId, ThemeId } from './types';

type FamilyKey = 'serif' | 'sans' | 'mono';
type FontWeight = 400 | 500 | 600 | 700;

interface RoleSpec {
  family: FamilyKey;
  weight: FontWeight;
}

export interface Aesthetic {
  id: AestheticId;
  label: string;
  roles: {
    title: RoleSpec;
    body: RoleSpec;
    ui: RoleSpec;
    eyebrow: RoleSpec;
    number: RoleSpec;
  };
  titleSize: number;
  titleLh: number;
  titleLetter: number;
  bodySize: number;
  bodyLh: number;
  eyebrowSize: number;
  eyebrowLetter: number;
  numberSize: number;
  rule: 'hairline' | 'thicker';
}

export interface Theme {
  id: ThemeId;
  bg: string;
  surface: string;
  text: string;
  textDim: string;
  textFaint: string;
  rule: string;
  ruleStrong: string;
  accent: string;
  accentSoft: string;
  chip: string;
  chipText: string;
  barStyle: 'light' | 'dark';
}

export const AESTHETICS: Record<AestheticId, Aesthetic> = {
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    roles: {
      title: { family: 'serif', weight: 600 },
      body: { family: 'serif', weight: 400 },
      ui: { family: 'sans', weight: 500 },
      eyebrow: { family: 'sans', weight: 600 },
      number: { family: 'sans', weight: 500 },
    },
    titleSize: 21,
    titleLh: 26,
    titleLetter: -0.2,
    bodySize: 15.5,
    bodyLh: 24,
    eyebrowSize: 10.5,
    eyebrowLetter: 1.5,
    numberSize: 11.5,
    rule: 'hairline',
  },
  clinical: {
    id: 'clinical',
    label: 'Clinical',
    roles: {
      title: { family: 'sans', weight: 600 },
      body: { family: 'sans', weight: 400 },
      ui: { family: 'sans', weight: 500 },
      eyebrow: { family: 'sans', weight: 600 },
      number: { family: 'mono', weight: 500 },
    },
    titleSize: 19,
    titleLh: 25,
    titleLetter: -0.3,
    bodySize: 14.5,
    bodyLh: 23,
    eyebrowSize: 10,
    eyebrowLetter: 1.2,
    numberSize: 11,
    rule: 'hairline',
  },
  brutalist: {
    id: 'brutalist',
    label: 'Brutalist',
    roles: {
      title: { family: 'mono', weight: 600 },
      body: { family: 'mono', weight: 400 },
      ui: { family: 'mono', weight: 500 },
      eyebrow: { family: 'mono', weight: 500 },
      number: { family: 'mono', weight: 500 },
    },
    titleSize: 15,
    titleLh: 21,
    titleLetter: -0.1,
    bodySize: 13,
    bodyLh: 21,
    eyebrowSize: 10,
    eyebrowLetter: 0.6,
    numberSize: 11,
    rule: 'thicker',
  },
};

export const THEMES: Record<ThemeId, Theme> = {
  light: {
    id: 'light',
    bg: '#fafaf7',
    surface: '#ffffff',
    text: '#16140f',
    textDim: '#5e5a52',
    textFaint: '#9a9389',
    rule: 'rgba(20,18,14,0.10)',
    ruleStrong: 'rgba(20,18,14,0.22)',
    accent: '#b8451c',
    accentSoft: 'rgba(184,69,28,0.10)',
    chip: 'rgba(20,18,14,0.045)',
    chipText: '#3a3730',
    barStyle: 'dark',
  },
  sepia: {
    id: 'sepia',
    bg: '#f3ebd9',
    surface: '#f8f1de',
    text: '#2b2014',
    textDim: '#6e5a40',
    textFaint: '#9c8a6e',
    rule: 'rgba(43,32,20,0.13)',
    ruleStrong: 'rgba(43,32,20,0.25)',
    accent: '#8a3a16',
    accentSoft: 'rgba(138,58,22,0.10)',
    chip: 'rgba(43,32,20,0.06)',
    chipText: '#4a3a26',
    barStyle: 'dark',
  },
  dark: {
    id: 'dark',
    bg: '#111110',
    surface: '#1a1a18',
    text: '#eeeae1',
    textDim: '#9e9a92',
    textFaint: '#6b6760',
    rule: 'rgba(238,234,225,0.10)',
    ruleStrong: 'rgba(238,234,225,0.22)',
    accent: '#e87a4e',
    accentSoft: 'rgba(232,122,78,0.14)',
    chip: 'rgba(238,234,225,0.06)',
    chipText: '#d2cdc2',
    barStyle: 'light',
  },
};

const FAMILY_MAP: Record<FamilyKey, string> = {
  serif: 'SourceSerif4',
  sans: 'Inter',
  mono: 'JetBrainsMono',
};

const WEIGHT_SUFFIX: Record<FontWeight, string> = {
  400: '_400Regular',
  500: '_500Medium',
  600: '_600SemiBold',
  700: '_700Bold',
};

export type RoleName = keyof Aesthetic['roles'];

/**
 * Resolve a role on a given aesthetic to a concrete font-family name.
 *   font(aes, 'title')        -> "SourceSerif4_600SemiBold"
 *   font(aes, 'eyebrow', 700) -> "Inter_700Bold"
 */
export function font(aes: Aesthetic, role: RoleName, weightOverride?: FontWeight): string {
  const r = aes.roles[role];
  const family = FAMILY_MAP[r.family];
  const weight: FontWeight = weightOverride ?? r.weight;
  return family + WEIGHT_SUFFIX[weight];
}
