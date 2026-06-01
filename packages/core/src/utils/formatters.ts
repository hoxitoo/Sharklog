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

/** Convert user-entered string rubles to kopecks integer */
export function parseMoneyInput(input: string): number {
  const cleaned = input.replace(/[^\d.,]/g, '').replace(',', '.');
  const rubles = parseFloat(cleaned);
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
