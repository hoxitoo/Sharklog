/** Distinct, high-contrast series colors shared by every chart (dark background). */
export const SERIES = {
  win: '#22D3A0',       // teal   — win amount
  loss: '#F4455A',      // red    — loss amount
  pnl: '#F59E0B',       // amber  — cumulative P&L line
  balance: '#A78BFA',   // violet — bank balance line
  deposit: '#5B6AF0',   // blue   — deposit marker
  withdrawal: '#EC4899',// pink   — withdrawal marker
} as const;
