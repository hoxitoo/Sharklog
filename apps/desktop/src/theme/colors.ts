import type { CSSProperties } from 'react';

export const colors = {
  // Surface ladder — the previous steps sat ~4% apart in luminance, so cards
  // melted into the page. These are deliberately separable (mirrors mobile).
  bg: '#06070D',
  bgCard: '#131522',
  bgElevated: '#1C1F2E',
  bgSunken: '#0B0C14',
  border: '#282C3F',
  borderHover: '#3A3F57',

  accent: '#22D3A0',
  accentDim: 'rgba(34,211,160,0.13)',
  purple: '#5B6AF0',
  purpleDim: 'rgba(91,106,240,0.13)',
  gold: '#F59E0B',
  red: '#F4455A',
  violet: '#A78BFA',
  pink: '#EC4899',

  textPrimary: '#EAEBF5',
  textSecondary: '#9296B4',
  textMuted: '#666B87',

  won: '#22D3A0',
  lost: '#F4455A',
  pending: '#F59E0B',
  refund: '#A78BFA',
} as const;

/** Hex + alpha (0..1) → rgba() string. Keeps card tints readable at call sites. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Per-section card identity so neighbouring blocks don't read as one sheet. */
export type CardTone = 'neutral' | 'profit' | 'loss' | 'warn' | 'info' | 'violet' | 'pink';

const TONE: Record<CardTone, string> = {
  neutral: colors.border,
  profit: colors.accent,
  loss: colors.red,
  warn: colors.gold,
  info: colors.purple,
  violet: colors.violet,
  pink: colors.pink,
};

export function toneCard(tone: CardTone = 'neutral'): CSSProperties {
  const base: CSSProperties = {
    borderRadius: 18,
    border: '1px solid',
    boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
  };
  if (tone === 'neutral') {
    return { ...base, background: colors.bgCard, borderColor: colors.border };
  }
  return { ...base, background: alpha(TONE[tone], 0.07), borderColor: alpha(TONE[tone], 0.32) };
}
