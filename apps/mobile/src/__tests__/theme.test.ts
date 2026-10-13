import { alpha, mix, toneSurface, TONE_ACCENT, applyTheme, colors, type CardTone } from '../theme/colors';
import { PALETTES, THEME_IDS, THEME_META, type Palette } from '../theme/palettes';

const TONES: CardTone[] = ['neutral', 'profit', 'loss', 'warn', 'info', 'violet', 'pink'];

/** Relative luminance (WCAG) of a 6-digit hex. */
function luminance(hex: string): number {
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

afterAll(() => applyTheme('dark'));

describe('theme/colors helpers', () => {
  it('alpha() accepts 3-, 6- and 8-digit hex', () => {
    expect(alpha('#22D3A0', 0.5)).toBe('#22D3A080');
    expect(alpha('#abc', 1)).toBe('#aabbccff');
    expect(alpha('#22D3A0FF', 0)).toBe('#22D3A000');
  });

  it('mix() blends towards the foreground', () => {
    expect(mix('#ffffff', '#000000', 0)).toBe('#000000');
    expect(mix('#ffffff', '#000000', 1)).toBe('#ffffff');
    expect(mix('#ffffff', '#000000', 0.5)).toBe('#808080');
  });
});

describe('palettes', () => {
  const keys = Object.keys(PALETTES.dark).sort();

  it.each(THEME_IDS)('%s has exactly the keys of the dark palette', (id) => {
    expect(Object.keys(PALETTES[id]).sort()).toEqual(keys);
  });

  it.each(THEME_IDS)('%s is plain hex, so `color + "22"` still works', (id) => {
    for (const [k, v] of Object.entries(PALETTES[id])) {
      expect(`${k}=${v}`).toMatch(k.endsWith('Dim') ? /=#[0-9A-F]{8}$/ : /=#[0-9A-F]{6}$/);
    }
  });
});

// The same rules for every theme — each one is applied for real, so the
// helpers (toneSurface, TONE_ACCENT) are checked against the active palette.
describe.each(THEME_IDS)('%s theme', (id) => {
  const p: Palette = PALETTES[id];
  beforeAll(() => applyTheme(id));

  it('is the active palette once applied', () => {
    expect(colors.bg).toBe(p.bg);
    expect(TONE_ACCENT.profit).toBe(p.accent);
  });

  it('body text meets AA on every surface', () => {
    for (const text of [p.textPrimary, p.textSecondary, p.textMuted]) {
      for (const surface of [p.bg, p.bgCard, p.bgElevated]) {
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('signal colours read as text on a card', () => {
    // P&L amounts, statuses, links, the PRO badge — all printed on cards.
    const short = (['won', 'lost', 'pending', 'refund', 'accent', 'purpleText', 'gold', 'violet', 'raspberry'] as const)
      .filter((k) => contrast(p[k], p.bgCard) < 4.5);
    expect(short).toEqual([]);
  });

  it('carries a white label on its primary button', () => {
    // Button labels on `purple` are written '#fff' all over the app. The dark
    // brand purple sits at 4.41 — no theme may go below it.
    expect(contrast('#FFFFFF', p.purple)).toBeGreaterThanOrEqual(4.4);
  });

  it('labels its filled accent and gold controls legibly', () => {
    expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onGold, p.gold)).toBeGreaterThanOrEqual(4.5);
  });

  it('labels its red fill (swipe-to-delete, the wheel\'s close button)', () => {
    // White on the dark brand red is 3.59 and has always been; a label in
    // bold next to an icon. No theme may go below it, and a new one meets AA:
    // white on olive's or navy's soft red was 2.5.
    expect(contrast(p.onLost, p.lost)).toBeGreaterThanOrEqual(id === 'dark' ? 3.55 : 4.5);
  });

  it('draws its deposit marker visibly and apart from the other series', () => {
    // A dot on a chart: graphics need 3:1. It must not share a colour with the
    // P&L line, the bank line or the withdrawal marker it sits among.
    expect(contrast(p.deposit, p.bgCard)).toBeGreaterThanOrEqual(3);
    expect(contrast(p.deposit, p.bgElevated)).toBeGreaterThanOrEqual(3);
    expect([p.pending, p.violet, p.pink, p.won, p.lost]).not.toContain(p.deposit);
  });

  it('reads raspberry on its own tinted card (Support in the menu)', () => {
    expect(contrast(p.raspberry, mix(p.raspberry, p.bgCard, 0.08))).toBeGreaterThanOrEqual(4.5);
  });

  it('separates every card from the page', () => {
    for (const tone of TONES) {
      expect(contrast(toneSurface(tone).backgroundColor, p.bg)).toBeGreaterThan(1.1);
    }
  });

  it('keeps toned cards on the right side of the neutral card', () => {
    // A translucent tint composites over the PAGE, not over the card, which
    // once made toned cards darker than neutral ones on the dark theme. On a
    // light theme a tint can only darken white — what matters there is that
    // it stays a card, which the test above holds.
    if (!THEME_META[id].dark) return;
    const neutral = luminance(p.bgCard);
    for (const tone of TONES.filter((t) => t !== 'neutral')) {
      expect(luminance(toneSurface(tone).backgroundColor)).toBeGreaterThan(neutral);
    }
  });

  it('gives every tone an accent', () => {
    for (const tone of TONES) expect(TONE_ACCENT[tone]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
