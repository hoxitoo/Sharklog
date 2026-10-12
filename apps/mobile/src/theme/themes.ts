/*
 * Colour themes. Only `dark` exists today; the other two are placeholders the
 * Settings picker shows as "soon".
 *
 * `swatch` is just enough to draw the picker's preview tile. Making a theme
 * real means a full palette here (every key of `colors`) and moving the app off
 * the static `colors` object — see "Темы" in docs/ROADMAP.md for the size of
 * that job.
 */

export type ThemeId = 'dark' | 'light' | 'oldschool';

export interface ThemePreview {
  id: ThemeId;
  /** Shipped and selectable. */
  available: boolean;
  swatch: { bg: string; card: string; accent: string; text: string };
}

export const THEMES: ThemePreview[] = [
  { id: 'dark', available: true, swatch: { bg: '#06070D', card: '#131522', accent: '#5B6AF0', text: '#EAEBF5' } },
  { id: 'light', available: false, swatch: { bg: '#F4F5FA', card: '#FFFFFF', accent: '#5B6AF0', text: '#1A1C2B' } },
  // Burgundy ground, olive accent, warm paper text — a ledger, not a terminal.
  { id: 'oldschool', available: false, swatch: { bg: '#3B1219', card: '#5A1E2A', accent: '#8A9A4B', text: '#EFE6D2' } },
];
