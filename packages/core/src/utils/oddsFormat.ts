import type { OddsFormat } from '../types/bet';

/*
 * Odds formats. A bet's `odds` is ALWAYS decimal — the payout per unit staked,
 * stake included — and every calculation (P&L, Kelly, implied probability, the
 * accumulator total) reads that one number. A format is only how the price is
 * typed and shown:
 *
 *   decimal     2.50     1.50     payout per 1, stake included
 *   fractional  3/2      1/2      profit / stake (UK)
 *   american    +150     -200     + profit on 100 staked; - stake needed to win 100
 *   hongkong    1.50     0.50     profit per 1 (decimal − 1)
 *   malay       -0.67    0.50     ≤ 2.00: profit per 1; above: −1 / profit
 *   indo        +1.50    -2.00    ≥ 2.00: profit per 1; below: −1 / profit
 *
 * A typed price is converted exactly and kept unrounded: "-110" is 1.90909…,
 * and 110 staked must return exactly 210, as the bookmaker pays it.
 */

export const ODDS_FORMATS: readonly OddsFormat[] = ['decimal', 'fractional', 'american', 'hongkong', 'malay', 'indo'];

export function isOddsFormat(v: unknown): v is OddsFormat {
  return typeof v === 'string' && (ODDS_FORMATS as readonly string[]).includes(v);
}

/** What people actually type: a decimal comma, a typographic minus, spaces. */
function clean(input: string): string {
  return input.trim().replace(/\s+/g, '').replace(/,/g, '.').replace(/[−–—]/g, '-');
}

/** A plain signed number, or NaN — `Number('1.85abc')` is NaN, unlike parseFloat. */
function num(s: string): number {
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
}

/** Decimal odds from a price typed in `format`; null when it is not a price. */
export function parseOdds(input: string, format: OddsFormat = 'decimal'): number | null {
  const s = clean(input);
  if (!s) return null;
  let d: number;
  switch (format) {
    case 'fractional': {
      if (/^(evs|evens)$/i.test(s)) { d = 2; break; }
      const m = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(s);
      if (!m) return null;
      const top = Number(m[1]);
      const bottom = m[2] != null ? Number(m[2]) : 1;
      if (!(top > 0) || !(bottom > 0)) return null;
      d = 1 + top / bottom;
      break;
    }
    case 'american': {
      const n = num(s);
      // Between -100 and +100 there are no American prices.
      if (!(Math.abs(n) >= 100)) return null;
      d = n > 0 ? 1 + n / 100 : 1 + 100 / -n;
      break;
    }
    case 'hongkong': {
      const n = num(s);
      if (!(n > 0)) return null;
      d = 1 + n;
      break;
    }
    case 'malay': {
      const n = num(s);
      if (!(n !== 0 && n >= -1 && n <= 1)) return null;
      d = n > 0 ? 1 + n : 1 + 1 / -n;
      break;
    }
    case 'indo': {
      const n = num(s);
      if (!(Math.abs(n) >= 1)) return null;
      d = n > 0 ? 1 + n : 1 + 1 / -n;
      break;
    }
    default: {
      const n = num(s);
      if (!(n > 1)) return null;
      d = n;
    }
  }
  return Number.isFinite(d) && d > 1 ? d : null;
}

/**
 * `x` as a fraction with a denominator of at most `maxDen`, by continued
 * fractions: exact for every price a bookmaker quotes (5/2, 10/11, 103/100),
 * the nearest such fraction for anything else.
 */
function toFraction(x: number, maxDen = 100): [number, number] {
  let hPrev = 0, kPrev = 1, h = 1, k = 0, b = x;
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(b);
    const hNext = a * h + hPrev;
    const kNext = a * k + kPrev;
    if (kNext > maxDen) break;
    hPrev = h; kPrev = k; h = hNext; k = kNext;
    const f = b - a;
    if (f < 1e-9 || Math.abs(h / k - x) < 1e-9) break;
    b = 1 / f;
  }
  // Below 1/100 of profit the nearest fraction would be 0/1.
  if (h === 0) return [1, Math.round(1 / x)];
  return [h, k];
}

const fixed = (n: number) => n.toFixed(2);

/** Decimal odds shown in `format`. */
export function formatOddsAs(decimal: number, format: OddsFormat = 'decimal'): string {
  if (!Number.isFinite(decimal) || decimal <= 1) return '—';
  const profit = decimal - 1;
  switch (format) {
    case 'fractional': {
      const [top, bottom] = toFraction(profit);
      return `${top}/${bottom}`;
    }
    case 'american':
      return decimal >= 2 ? `+${Math.round(profit * 100)}` : `-${Math.round(100 / profit)}`;
    case 'hongkong':
      return fixed(profit);
    case 'malay':
      return decimal <= 2 ? fixed(profit) : fixed(-1 / profit);
    case 'indo':
      return decimal >= 2 ? `+${fixed(profit)}` : fixed(-1 / profit);
    default:
      return fixed(decimal);
  }
}
