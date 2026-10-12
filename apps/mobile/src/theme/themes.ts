/*
 * Colour themes. Only `dark` exists today; the others are placeholders the
 * Settings picker shows as "soon".
 *
 * `swatch` is just enough to paint the picker's circle: the theme's ground and
 * its accent, split diagonally. Making a theme real means a full palette here
 * (every key of `colors`) and moving the app off the static `colors` object —
 * see "Темы" in docs/ROADMAP.md for the size of that job.
 */

export type ThemeId = 'dark' | 'light' | 'olive' | 'navy';

export interface ThemePreview {
  id: ThemeId;
  /** Shipped and selectable. */
  available: boolean;
  swatch: { base: string; accent: string };
}

export const THEMES: ThemePreview[] = [
  { id: 'dark', available: true, swatch: { base: '#131522', accent: '#5B6AF0' } },
  { id: 'light', available: false, swatch: { base: '#F4F5FA', accent: '#5B6AF0' } },
  // "Quiet luxury": olive, milk, beige, chocolate (#626B46 #EEE9DF #C7B49A #352F2A).
  { id: 'olive', available: false, swatch: { base: '#626B46', accent: '#EEE9DF' } },
  // "Elegant contrast": olive, navy, gold, milk (#6A7040 #2B4058 #C5A16D #EEEAE2).
  { id: 'navy', available: false, swatch: { base: '#2B4058', accent: '#C5A16D' } },
];
