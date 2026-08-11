import { colors, alpha, mix, toneSurface, TONE_ACCENT, type CardTone } from '../theme/colors';

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

describe('theme/colors', () => {
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

  // A translucent tint composites over the *page*, not over the card, so the
  // old alpha() wash made toned cards darker than neutral ones.
  it('every toned card sits lighter than the neutral card', () => {
    const neutral = luminance(colors.bgCard);
    for (const tone of TONES.filter((t) => t !== 'neutral')) {
      expect(luminance(toneSurface(tone).backgroundColor)).toBeGreaterThan(neutral);
    }
  });

  it('every card separates from the page', () => {
    for (const tone of TONES) {
      expect(contrast(toneSurface(tone).backgroundColor, colors.bg)).toBeGreaterThan(1.1);
    }
  });

  it('body text meets AA on every surface', () => {
    for (const text of [colors.textPrimary, colors.textSecondary, colors.textMuted]) {
      for (const surface of [colors.bg, colors.bgCard, colors.bgElevated]) {
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('purpleText is legible where purple would not be', () => {
    expect(contrast(colors.purple, colors.bgElevated)).toBeLessThan(4.5);
    expect(contrast(colors.purpleText, colors.bgElevated)).toBeGreaterThanOrEqual(4.5);
  });

  it('every tone has an accent', () => {
    for (const tone of TONES) expect(TONE_ACCENT[tone]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
