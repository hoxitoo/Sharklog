export const colors = {
  // ── Surface ladder ────────────────────────────────────────────────────────
  // The old values (#080810 / #0E0E1C / #12121E) sat ~4% apart in luminance, so
  // every card melted into the page. These steps are deliberately separable.
  bg: '#06070D',          // page
  bgCard: '#131522',      // card
  bgElevated: '#1C1F2E',  // tile nested inside a card
  bgSunken: '#0B0C14',    // wells: inputs, chart plots, table stripes
  border: '#282C3F',      // default hairline — visible, not shouty
  borderStrong: '#3A3F57',

  // Two-accent palette matching web prototype
  accent: '#22D3A0',      // teal — win/positive
  accentDim: '#22D3A022',
  purple: '#5B6AF0',      // purple — primary CTA / interactive
  purpleDim: '#5B6AF022',
  gold: '#F59E0B',        // pro badge / pending
  red: '#F4455A',
  violet: '#A78BFA',      // secondary stats
  pink: '#EC4899',

  textPrimary: '#EAEBF5',
  textSecondary: '#9296B4',
  textMuted: '#666B87',

  won: '#22D3A0',
  lost: '#F4455A',
  pending: '#F59E0B',
  refund: '#A78BFA',
} as const;

export type Colors = typeof colors;

/** Hex + alpha (0..1) → 8-digit hex. Keeps tint maths readable at call sites. */
export function alpha(hex: string, a: number): string {
  const clamped = Math.max(0, Math.min(1, a));
  return hex + Math.round(clamped * 255).toString(16).padStart(2, '0');
}

/**
 * Card identity. Each section carries a tone so neighbouring cards read as
 * separate objects instead of one dark sheet: tinted surface + accent border +
 * a coloured rail on the heading.
 */
export type CardTone = 'neutral' | 'profit' | 'loss' | 'warn' | 'info' | 'violet' | 'pink';

export const TONE_ACCENT: Record<CardTone, string> = {
  neutral: colors.borderStrong,
  profit: colors.accent,
  loss: colors.red,
  warn: colors.gold,
  info: colors.purple,
  violet: colors.violet,
  pink: colors.pink,
};

export function toneSurface(tone: CardTone): { backgroundColor: string; borderColor: string } {
  if (tone === 'neutral') {
    return { backgroundColor: colors.bgCard, borderColor: colors.border };
  }
  const a = TONE_ACCENT[tone];
  // A low-alpha wash over the card keeps numbers legible while colouring the block.
  return { backgroundColor: alpha(a, 0.07), borderColor: alpha(a, 0.32) };
}
