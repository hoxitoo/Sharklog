import { PALETTES, isThemeId, type Palette, type ThemeId } from './palettes';

/**
 * The ACTIVE palette. Mutated in place by `applyTheme`, so every
 * `colors.textMuted` read at render time sees the current theme — that is what
 * lets 900 call sites stay as they are.
 *
 * The rule that makes it work: nothing may read `colors` at MODULE LOAD and
 * keep the result. Styles go through `themedStyles` (theme/themed.ts), shared
 * style objects through getters, and `__tests__/themeLive.test.ts` fails on any
 * module-level read it finds.
 */
export const colors: Palette = { ...PALETTES.dark };

export type Colors = Palette;

let activeTheme: ThemeId = 'dark';
let version = 0;

/** Swap the active palette. Unknown or missing ids mean the default (dark). */
export function applyTheme(id: string | undefined): void {
  const next: ThemeId = isThemeId(id) ? id : 'dark';
  if (next === activeTheme) return;
  Object.assign(colors, PALETTES[next]);
  activeTheme = next;
  version += 1;
}

export function currentTheme(): ThemeId {
  return activeTheme;
}

/** Bumped on every switch; lazy style caches compare against it. */
export function themeVersion(): number {
  return version;
}

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

// Getters, not values: read at module load they would freeze on the palette
// the app started with.
export const TONE_ACCENT: Record<CardTone, string> = {
  get neutral() { return colors.borderStrong; },
  get profit() { return colors.accent; },
  get loss() { return colors.red; },
  get warn() { return colors.gold; },
  get info() { return colors.purple; },
  get violet() { return colors.violet; },
  get pink() { return colors.pink; },
};

export function toneSurface(tone: CardTone): { backgroundColor: string; borderColor: string } {
  if (tone === 'neutral') {
    return { backgroundColor: colors.bgCard, borderColor: colors.border };
  }
  const a = TONE_ACCENT[tone];
  // Opaque mix — see mix() for why this is not a translucent wash.
  return { backgroundColor: mix(a, colors.bgCard, 0.07), borderColor: alpha(a, 0.32) };
}
