import type { EsportsDiscipline, Sport } from '@sharklog/core';
import type { GlyphName } from './glyphs';

/*
 * Which glyph a stored sport or discipline gets. No React here, so it is under
 * test (`__tests__/glyphs.test.ts`); AppIcon re-exports it.
 */

const SPORT_GLYPHS: Record<Sport, GlyphName> = {
  football: 'sport_football', hockey: 'sport_hockey', basketball: 'sport_basketball',
  tennis: 'sport_tennis', esports: 'sport_esports', volleyball: 'sport_volleyball',
  baseball: 'sport_baseball', other: 'sport_other',
};

const DISCIPLINE_GLYPHS: Record<EsportsDiscipline, GlyphName> = {
  dota2: 'esp_dota2', csgo: 'esp_csgo', lol: 'esp_lol', valorant: 'esp_valorant',
  pubg: 'esp_pubg', r6: 'esp_r6', apex: 'esp_apex', other_esports: 'esp_other',
};

/**
 * The glyph for a stored sport. A value from an old or hand-edited bet falls
 * back to "other" rather than to nothing — the same rule as its label.
 */
export function sportGlyph(sport: string): GlyphName {
  return Object.prototype.hasOwnProperty.call(SPORT_GLYPHS, sport)
    ? SPORT_GLYPHS[sport as Sport]
    : 'sport_other';
}

export function disciplineGlyph(discipline: string): GlyphName {
  return Object.prototype.hasOwnProperty.call(DISCIPLINE_GLYPHS, discipline)
    ? DISCIPLINE_GLYPHS[discipline as EsportsDiscipline]
    : 'esp_other';
}
