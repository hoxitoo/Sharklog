import type { Bet } from '@sharklog/core';

/**
 * The `n` bets entered last (by `createdAt`, newest first) in one pass — no
 * sort of the whole book for five rows. ISO timestamps compare as plain
 * strings; another shape (an old import) keeps `localeCompare`, as before.
 */
export function newestEntered(bets: readonly Bet[], n: number): Bet[] {
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const plain = bets.every((b) => iso.test(b.createdAt));
  const newer = (a: Bet, b: Bet) => (plain ? a.createdAt > b.createdAt : a.createdAt.localeCompare(b.createdAt) > 0);
  const top: Bet[] = [];
  for (const b of bets) {
    // Ties keep the earlier one first, as the stable sort did.
    let i = top.length;
    while (i > 0 && newer(b, top[i - 1]!)) i--;
    if (i < n) { top.splice(i, 0, b); if (top.length > n) top.pop(); }
  }
  return top;
}
