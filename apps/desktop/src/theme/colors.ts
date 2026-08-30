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

/** Normalises `#RGB` / `#RRGGBB` to six digits. Non-hex input is rejected loudly. */
function hex6(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length === 3) return h.split('').map((c) => c + c).join('');
  if (h.length >= 6) return h.slice(0, 6);
  throw new Error(`Not a hex colour: ${hex}`);
}

/** Hex + alpha (0..1) → rgba(). Only for hex tokens — accentDim is already rgba. */
export function alpha(hex: string, a: number): string {
  const h = hex6(hex);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Opaque blend of `fg` over `bg`. A translucent tint composites against
 * whatever is behind the element, not against the card colour, so a wash lands
 * darker than the surface it is meant to lift.
 */
export function mix(fg: string, bg: string, ratio: number): string {
  const f = hex6(fg);
  const b = hex6(bg);
  const out = [0, 2, 4].map((i) => {
    const fv = parseInt(f.slice(i, i + 2), 16);
    const bv = parseInt(b.slice(i, i + 2), 16);
    return Math.round(bv + (fv - bv) * ratio).toString(16).padStart(2, '0');
  });
  return `#${out.join('')}`;
}
