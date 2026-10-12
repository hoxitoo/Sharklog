/*
 * Every colour theme, as data. `colors` (theme/colors.ts) holds the ACTIVE one;
 * `applyTheme` swaps its values in place. Each palette has exactly the same
 * keys, and `__tests__/theme.test.ts` holds every one of them to the same
 * contrast rules — text on every surface, signal colours as text on a card,
 * the white label on the primary button, the Support card's raspberry.
 *
 * Values are 6-digit hex (8 for the *Dim tints): code still appends alpha as
 * a string (`colors.lost + '15'`), which only works on 6 digits.
 */

import type { AppTheme } from '@sharklog/core';

/** The stored setting's values, so a palette can never be missing for one. */
export type ThemeId = AppTheme;

export interface Palette {
  // Surface ladder: page → card → tile inside a card; wells for inputs/charts.
  bg: string;
  bgCard: string;
  bgElevated: string;
  bgSunken: string;
  border: string;
  borderStrong: string;

  accent: string;      // positive / win
  accentDim: string;
  purple: string;      // primary CTA and active states (the name stays: it is the role)
  purpleText: string;  // the same role as TEXT — lifted to pass AA on the surfaces
  purpleDim: string;
  gold: string;        // PRO badge
  red: string;
  violet: string;
  pink: string;
  raspberry: string;   // "Support the author" in the menu

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  won: string;
  lost: string;
  pending: string;
  refund: string;      // also cashout

  // Text that sits ON a filled accent / gold control (checkbox tick, "Upgrade").
  // White on purple is not a token: every palette must carry white on its
  // primary, and the test says so.
  onAccent: string;
  onGold: string;
}

export const PALETTES: Record<ThemeId, Palette> = {
  // The original. Every other palette is held to its rules.
  dark: {
    bg: '#06070D',
    bgCard: '#131522',
    bgElevated: '#1C1F2E',
    bgSunken: '#0B0C14',
    border: '#282C3F',
    borderStrong: '#3A3F57',
    accent: '#22D3A0',
    accentDim: '#22D3A022',
    purple: '#5B6AF0',
    purpleText: '#7C88FF',
    purpleDim: '#5B6AF022',
    gold: '#F59E0B',
    red: '#F4455A',
    violet: '#A78BFA',
    pink: '#EC4899',
    raspberry: '#F0457F',
    textPrimary: '#EAEBF5',
    textSecondary: '#9296B4',
    textMuted: '#828AA8',
    won: '#22D3A0',
    lost: '#F4455A',
    pending: '#F59E0B',
    refund: '#A78BFA',
    onAccent: '#000000',
    onGold: '#000000',
  },

  // White cards on a cool grey page. Signal colours are the dark-theme hues
  // taken down until they read as text on white: the bright teal win would be
  // 1.9:1 there.
  light: {
    bg: '#E2E5ED',
    bgCard: '#FFFFFF',
    bgElevated: '#F3F4F9',
    bgSunken: '#EEF0F6',
    border: '#D7DBE6',
    borderStrong: '#BCC2D3',
    accent: '#047857',
    accentDim: '#04785722',
    purple: '#4F5BD5',
    purpleText: '#3F4BC4',
    purpleDim: '#4F5BD522',
    gold: '#A35A00',
    red: '#C8283E',
    violet: '#6D4BC9',
    pink: '#B8246E',
    raspberry: '#B61F5A',
    textPrimary: '#161826',
    textSecondary: '#4A4F66',
    textMuted: '#5E647C',
    won: '#047857',
    lost: '#C8283E',
    pending: '#A35A00',
    refund: '#6D4BC9',
    onAccent: '#FFFFFF',
    onGold: '#FFFFFF',
  },

  // "Quiet luxury": chocolate ground, milk text, beige secondary, olive as the
  // primary. Loss is terracotta, not red — red on warm brown reads as a stain.
  olive: {
    bg: '#1C1915',
    bgCard: '#2A2520',
    bgElevated: '#36302A',
    bgSunken: '#15120F',
    border: '#463E35',
    borderStrong: '#5C5246',
    accent: '#A9C47A',
    accentDim: '#A9C47A22',
    purple: '#626B46',
    purpleText: '#C3CC92',
    purpleDim: '#626B4633',
    gold: '#D9B26A',
    red: '#E58A6E',
    violet: '#C2AEDA',
    pink: '#E59AB0',
    raspberry: '#EC7C9C',
    textPrimary: '#EEE9DF',
    textSecondary: '#C7B49A',
    textMuted: '#AE9F88',
    won: '#A9C47A',
    lost: '#E58A6E',
    pending: '#D9B26A',
    refund: '#C2AEDA',
    onAccent: '#1C1915',
    onGold: '#1C1915',
  },

  // "Elegant contrast": navy ground, milk text, olive as the primary, gold as
  // the active/link colour.
  navy: {
    bg: '#0E1621',
    bgCard: '#182434',
    bgElevated: '#213046',
    bgSunken: '#0A1018',
    border: '#2C3D54',
    borderStrong: '#41566F',
    accent: '#7FD1AE',
    accentDim: '#7FD1AE22',
    purple: '#6A7040',
    purpleText: '#D4B47E',
    purpleDim: '#6A704033',
    gold: '#D4B47E',
    red: '#F08A8A',
    violet: '#B9A8E3',
    pink: '#E89AC0',
    raspberry: '#F07FA1',
    textPrimary: '#EEEAE2',
    textSecondary: '#B4BCC8',
    textMuted: '#97A2B2',
    won: '#7FD1AE',
    lost: '#F08A8A',
    pending: '#D4B47E',
    refund: '#B9A8E3',
    onAccent: '#0E1621',
    onGold: '#0E1621',
  },
};

/** What the system chrome around the app needs to know. */
export const THEME_META: Record<ThemeId, { dark: boolean }> = {
  dark: { dark: true },
  light: { dark: false },
  olive: { dark: true },
  navy: { dark: true },
};

export const THEME_IDS = Object.keys(PALETTES) as ThemeId[];

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && v in PALETTES;
}
