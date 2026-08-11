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
  purpleText: '#7C88FF',  // same hue lifted to pass AA as text on dark surfaces
  purpleDim: 'rgba(91,106,240,0.13)',
  gold: '#F59E0B',
  red: '#F4455A',
  violet: '#A78BFA',
  pink: '#EC4899',

  textPrimary: '#EAEBF5',
  textSecondary: '#9296B4',
  textMuted: '#828AA8',   // 4.8:1 on bgElevated — the old #666B87 failed AA

  won: '#22D3A0',
  lost: '#F4455A',
  pending: '#F59E0B',
  refund: '#A78BFA',
} as const;
