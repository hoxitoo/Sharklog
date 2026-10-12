import { colors } from './colors';

/**
 * Series colours shared by every chart — one palette for the whole app, taken
 * from the active theme. Getters, so a chart drawn after a theme switch uses
 * the new theme; in the dark theme these are exactly the colours they always
 * were (teal / red / amber / violet / blue / pink).
 */
export const SERIES = {
  get win() { return colors.won; },             // win amount
  get loss() { return colors.lost; },           // loss amount
  get pnl() { return colors.pending; },         // cumulative P&L line (amber)
  get balance() { return colors.violet; },      // bank balance line
  get deposit() { return colors.purple; },      // deposit marker
  get withdrawal() { return colors.pink; },     // withdrawal marker
};
