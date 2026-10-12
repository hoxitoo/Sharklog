import { calcBankShares } from '@sharklog/core';
import type { Bet, BankrollTransaction } from '@sharklog/core';

/*
 * The bank share of every bet, computed once per store write and shared by all
 * cards. A card reads its own number through a store selector
 * (`useBetsStore((s) => bankSharesFor(s.bets, s.bankroll.transactions).get(id))`):
 * the first card after a write pays for the whole list, the rest hit this cache,
 * and only a card whose number actually changed re-renders.
 *
 * Passing the map down through the list instead would change `renderItem` on
 * every write and re-render every visible card — the exact cost the bet list
 * was already freed of.
 */

let lastBets: Bet[] | null = null;
let lastTxs: BankrollTransaction[] | null = null;
let lastShares = new Map<string, number>();

export function bankSharesFor(bets: Bet[], transactions: BankrollTransaction[]): Map<string, number> {
  if (bets !== lastBets || transactions !== lastTxs) {
    lastShares = calcBankShares(bets, transactions);
    lastBets = bets;
    lastTxs = transactions;
  }
  return lastShares;
}

/**
 * Two decimals under 1% — a 0.04% bet must not read as "+0.0%". Null for a
 * share that rounds to nothing. The precision is chosen AFTER rounding, so
 * 0.996 reads "+1.0%" like 1.0 does, not "+1.00%".
 */
export function formatBankShare(pct: number): string | null {
  const fine = Number(pct.toFixed(2));
  if (fine === 0) return null;
  const digits = Math.abs(fine) < 1 ? 2 : 1;
  const rounded = Number(pct.toFixed(digits));
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}%`;
}
