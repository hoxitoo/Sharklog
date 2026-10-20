import { readFileSync } from 'fs';
import { join } from 'path';
import { SPORTS, ESPORTS_DISCIPLINES } from '@sharklog/core';
import { GLYPHS, type Shape } from '../components/icons/glyphs';
import { sportGlyph, disciplineGlyph } from '../components/icons/glyphNames';

/*
 * The author's icon set (docs/design/icons/adaptive), turned into shapes with
 * colour roles by build-glyphs.cjs. What would go wrong unseen: a sport or
 * discipline added to core without a glyph (it would quietly wear "other"), a
 * glyph that paints nothing (every shape `none`, or a stroke without a width),
 * and the emoji coming back beside the glyphs.
 */
describe('author glyphs', () => {
  it('give every sport and every esports discipline its own glyph', () => {
    const sports = Object.keys(SPORTS).map(sportGlyph);
    expect(new Set(sports).size).toBe(sports.length);
    const disciplines = Object.keys(ESPORTS_DISCIPLINES).map(disciplineGlyph);
    expect(new Set(disciplines).size).toBe(disciplines.length);
  });

  it('fall back to "other" for a value an old or hand-edited bet may carry', () => {
    expect(sportGlyph('mma')).toBe('sport_other');
    expect(sportGlyph('toString')).toBe('sport_other');
    expect(disciplineGlyph('starcraft')).toBe('esp_other');
  });

  it('draw something in every glyph, and every shape is complete', () => {
    for (const [name, shapes] of Object.entries(GLYPHS) as [string, readonly Shape[]][]) {
      const painted = shapes.some((s) => s.fill !== 'none' || (s.stroke && s.stroke !== 'none'));
      expect(`${name}: ${painted}`).toBe(`${name}: true`);
      for (const s of shapes) {
        const ok =
          (s.kind === 'path' ? /^M/.test(s.d ?? '') : true) &&
          (s.kind === 'circle' ? (s.r ?? 0) > 0 : true) &&
          (s.kind === 'ellipse' ? (s.rx ?? 0) > 0 && (s.ry ?? 0) > 0 : true) &&
          (s.stroke && s.stroke !== 'none' ? (s.strokeWidth ?? 0) > 0 : true);
        expect(`${name}: ${ok}`).toBe(`${name}: true`);
      }
    }
  });

  it('keep the silhouette in the body colour, so it follows the theme like text', () => {
    // The heart is the one exception: it is raspberry through and through, the
    // colour of the support card it sits on.
    for (const [name, shapes] of Object.entries(GLYPHS) as [string, readonly Shape[]][]) {
      if (name === 'support') continue;
      const body = shapes.some((s) => s.fill === 'body' || s.stroke === 'body');
      expect(`${name}: ${body}`).toBe(`${name}: true`);
    }
  });

  it('replace the sport emoji in the insights', () => {
    const src = readFileSync(join(__dirname, '..', 'screens', 'InsightsScreen', 'index.tsx'), 'utf8');
    expect(src).not.toMatch(/[⚽🏒🏀🎾🎮🏐⚾🏅]/u);
  });
});
