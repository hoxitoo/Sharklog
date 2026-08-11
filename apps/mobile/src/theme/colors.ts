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
  purpleText: '#7C88FF',  // same hue lifted to pass AA as text on dark surfaces
  purpleDim: '#5B6AF022',
  gold: '#F59E0B',        // pro badge / pending
  red: '#F4455A',
  violet: '#A78BFA',      // secondary stats
  pink: '#EC4899',

  textPrimary: '#EAEBF5',
  textSecondary: '#9296B4',
  textMuted: '#828AA8',   // 4.8:1 on bgElevated — the old #666B87 failed AA

  won: '#22D3A0',
  lost: '#F4455A',
  pending: '#F59E0B',
  refund: '#A78BFA',
} as const;

export type Colors = typeof colors;

/**
 * Hex + alpha (0..1) → 8-digit hex. Keeps tint maths readable at call sites.
 * Accepts `#RGB`, `#RRGGBB` and `#RRGGBBAA` (an existing alpha is replaced).
 */
export function alpha(hex: string, a: number): string {
  const clamped = Math.max(0, Math.min(1, a));
  const suffix = Math.round(clamped * 255).toString(16).padStart(2, '0');
  return '#' + expand(hex) + suffix;
}

/** Normalises any accepted hex form to 6 digits without the leading `#`. */
function expand(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length === 3) return h.split('').map(c => c + c).join('');
  return h.slice(0, 6);
}

/**
 * Opaque blend of `fg` over `bg`. React Native composites a translucent
 * background against the *page*, not against the card it sits in, so a wash
 * written as `alpha(accent, 0.07)` on top of the page came out darker than a
 * plain `bgCard` card. Mixing up-front keeps tinted cards lighter than neutral.
 */
export function mix(fg: string, bg: string, ratio: number): string {
  const f = expand(fg);
  const b = expand(bg);
  const out = [0, 2, 4].map(i => {
    const fv = parseInt(f.slice(i, i + 2), 16);
    const bv = parseInt(b.slice(i, i + 2), 16);
    return Math.round(bv + (fv - bv) * ratio).toString(16).padStart(2, '0');
  });
  return '#' + out.join('');
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
  // Opaque mix — see mix() for why this is not a translucent wash.
  return { backgroundColor: mix(a, colors.bgCard, 0.07), borderColor: alpha(a, 0.32) };
}
