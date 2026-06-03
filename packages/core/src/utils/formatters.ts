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
 *  Handles: "1000", "1 000", "1000,50", "1,85" (decimal comma), "1,000" (thousands comma). */
export function parseMoneyInput(input: string): number {
  const s = input.replace(/[^\d.,]/g, '');
  if (!s) return 0;
  let rubles: number;
  if (s.includes(',') && s.includes('.')) {
    // Both separators: whichever comes last is the decimal separator
    rubles = s.lastIndexOf('.') > s.lastIndexOf(',')
      ? parseFloat(s.replace(/,/g, ''))                   // "1,234.56" → 1234.56
      : parseFloat(s.replace(/\./g, '').replace(',', '.')); // "1.234,56" → 1234.56
  } else if (s.includes(',')) {
    const parts = s.split(',');
    const last = parts[parts.length - 1] ?? '';
    // ≤2 digits after comma → decimal ("1000,50" → 1000.50); 3 → thousands ("1,000" → 1000)
    rubles = last.length <= 2
      ? parseFloat(s.replace(',', '.'))
      : parseFloat(s.replace(/,/g, ''));
  } else {
    rubles = parseFloat(s);
  }
  if (isNaN(rubles)) return 0;
  return Math.round(rubles * 100);
}

export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}
