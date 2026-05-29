export const colors = {
  bg: '#080810',
  bgCard: '#0E0E1C',
  bgElevated: '#12121E',
  border: '#1C1C30',

  // Two-accent palette matching web prototype
  accent: '#22D3A0',      // teal — win/positive
  accentDim: '#22D3A022',
  purple: '#5B6AF0',      // purple — primary CTA / interactive
  purpleDim: '#5B6AF022',
  gold: '#F59E0B',        // pro badge / pending
  red: '#F4455A',
  violet: '#A78BFA',      // secondary stats

  textPrimary: '#E2E2EF',
  textSecondary: '#8888A8',
  textMuted: '#606078',

  won: '#22D3A0',
  lost: '#F4455A',
  pending: '#F59E0B',
  refund: '#A78BFA',
} as const;

export type Colors = typeof colors;
