import { formatOddsAs, parseOdds, type OddsFormat } from '@sharklog/core';

/*
 * Odds fields in the user's format. The bet keeps decimal odds; the field
 * shows and reads the chosen format. No React Native runtime here, so the
 * round trips are under test (`oddsField.test.ts`).
 */

/** The text an odds field opens with for a stored (decimal) price. */
export function oddsFieldText(decimal: number, format: OddsFormat): string {
  // Decimal as stored, to the last digit typed: 2.375 stays 2.375.
  return format === 'decimal' ? String(decimal) : formatOddsAs(decimal, format);
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

/**
 * An accumulator leg's decimal price, as it will be stored ("event|1.91"):
 * two decimals for a converted quote, so the total built from the legs is the
 * total an edit rebuilds from what was stored. A decimal leg stays as typed.
 */
export function legOdds(text: string, format: OddsFormat): number {
  const d = parseOdds(text, format);
  if (d == null) return 0;
  return format === 'decimal' ? d : Math.round(d * 100) / 100;
}

/** The leg's field text from its stored decimal ("1.91" → "-110"). */
export function legFieldText(stored: string, format: OddsFormat): string {
  const d = Number(stored);
  return format === 'decimal' || !(d > 1) ? stored : formatOddsAs(d, format);
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
  if (format === 'decimal') return undefined;
  const f = (d: number) => formatOddsAs(d, format);
  return (min, max) => (min <= 1 ? `< ${f(max)}` : max === Infinity ? `> ${f(min)}` : `${f(min)} – ${f(max)}`);
}
