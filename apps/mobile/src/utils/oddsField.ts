import { formatOddsAs, parseOdds, rangeFormat, type OddsFormat } from '@sharklog/core';

/*
 * Odds fields in the user's format. The bet keeps decimal odds; the field
 * shows and reads the chosen format. No React Native runtime here, so the
 * round trips are under test (`oddsField.test.ts`).
 */

/** The text an odds field opens with for a stored (decimal) price. */
export function oddsFieldText(decimal: number, format: OddsFormat): string {
  // Decimal as typed — 2.375 stays 2.375 — capped at 4 places: a price typed
  // as American "-110" is 1.9090909091, not a number to retype.
  return format === 'decimal' ? String(Number(decimal.toFixed(4))) : formatOddsAs(decimal, format);
}

/**
 * The decimal price in an odds field; null when it is not a price. A field
 * still showing what it opened with gives back the stored price untouched:
 * a stored 1.91 shows as "-110", which reads back as 1.909…, and saving an
 * edit that never touched the odds would quietly change them.
 */
export function readOddsField(text: string, format: OddsFormat, original?: number): number | null {
  if (original != null && text === oddsFieldText(original, format)) return original;
  return parseOdds(text, format);
}

/** The leg's field text from its stored decimal ("1.91" → "-110"). */
export function legFieldText(stored: string, format: OddsFormat): string {
  const d = Number(stored);
  return format === 'decimal' || !(d > 1) ? stored : formatOddsAs(d, format);
}

/**
 * An accumulator leg's decimal price; 0 when it is not one. A leg still
 * showing what it opened with is its STORED price: a stored 2.50 opens in
 * Malay as "-0.67", which reads back as 2.4925 — every edit or copy of the
 * accumulator moved the leg to 2.49 and the total from 4.50 to 4.48. A typed
 * leg is kept as precise as it was typed ("event|1.952"): stored at two
 * decimals, it rebuilt a different total than the one saved.
 */
export function readLegField(text: string, format: OddsFormat, stored?: string): number {
  if (stored != null && text === legFieldText(stored, format)) {
    const d = Number(stored);
    return d > 1 ? d : 0;
  }
  return parseOdds(text, format) ?? 0;
}

/** The price on a card: "× 2.03" in decimal; a bare quote in any other format ("+103"). */
export function oddsBadge(decimal: number, format: OddsFormat): string {
  return format === 'decimal' ? `× ${formatOddsAs(decimal)}` : formatOddsAs(decimal, format);
}

/** One price in the user's format, for placeholders and examples. */
export const oddsExample = (format: OddsFormat, decimal = 1.85) => formatOddsAs(decimal, format);

/**
 * Names for the analytics odds buckets in the user's format ("-200 – -125");
 * undefined in decimal, where core's own labels stand. The buckets themselves
 * stay decimal: a format changes the words, not which bets fall where.
 */
export function oddsRangeLabel(format: OddsFormat): ((min: number, max: number) => string) | undefined {
  // Malay ranges read backwards across even money: they stay decimal (rangeFormat).
  const shown = rangeFormat(format);
  if (shown === 'decimal') return undefined;
  const f = (d: number) => formatOddsAs(d, shown);
  return (min, max) => (min <= 1 ? `< ${f(max)}` : max === Infinity ? `> ${f(min)}` : `${f(min)} – ${f(max)}`);
}
