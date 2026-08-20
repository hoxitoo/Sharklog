/** Convert kopecks to display string, e.g. 150000 → "1 500 ₽" */
export function formatMoney(kopecks: number, currency = '₽', maxDecimals = 2): string {
  const rubles = kopecks / 100;
  return (
    new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals,
    }).format(rubles) +
    ' ' +
    currency
  );
}

/** Convert user-entered string rubles to kopecks integer.
 *  Handles: "1000", "1 000", "1000,50", "1,85" (decimal comma), "1,000" (thousands comma),
 *  multi-group "1 000 000" / "1.000.000" / "1,234,567.89", and leading "-" (negative). */
export function parseMoneyInput(input: string): number {
  const neg = /^\s*-/.test(input);
  const s = input.replace(/[^\d.,]/g, '');
  if (!s) return 0;
  const dots = s.split('.').length - 1;
  const commas = s.split(',').length - 1;
  let rubles: number;
  if (dots + commas >= 2) {
    // Grouped number: the rightmost separator is the decimal point only when it
    // leaves 1–2 trailing digits; otherwise every separator is a thousands group.
    const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
    const frac = s.slice(lastSep + 1);
    const intDigits = s.slice(0, lastSep).replace(/[.,]/g, '');
    rubles = frac.length >= 1 && frac.length <= 2
      ? parseFloat(`${intDigits}.${frac}`)
      : parseFloat(intDigits + frac);
  } else if (commas === 1 && dots === 0) {
    const parts = s.split(',');
    const last = parts[parts.length - 1] ?? '';
    // ≤2 digits after comma → decimal ("1000,50" → 1000.50); 3 → thousands ("1,000" → 1000)
    rubles = last.length <= 2
      ? parseFloat(s.replace(',', '.'))
      : parseFloat(s.replace(/,/g, ''));
  } else {
    // single dot or no separator
    rubles = parseFloat(s);
  }
  if (isNaN(rubles)) return 0;
  return Math.round(rubles * 100) * (neg ? -1 : 1);
}

export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

export function formatPercent(value: number): string {
  // Round first so values that round to 0 don't display a misleading "-0.0%".
  const rounded = Math.round(value * 10) / 10 || 0; // `|| 0` normalizes -0 → 0
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}%`;
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

/**
 * Total coefficient of an accumulator, rounded to 2 decimals.
 *
 * Bookmakers show the combined coefficient at 2 decimals and settle on that
 * rounded number: 1.23 × 1.90 = 2.337, Fonbet displays 2.34 and pays
 * 3 700 × 2.34 = 8 658 ₽. Keeping the raw product meant the app showed "× 2.34"
 * but computed the payout from 2.337 — 11 ₽ less on that one bet, and a drift
 * against the real balance that grew with every accumulator.
 */
export function combineExpressOdds(legOdds: number[]): number {
  const product = legOdds.reduce((p, o) => (o > 1 ? p * o : p), 1);
  return Math.round(product * 100) / 100;
}
