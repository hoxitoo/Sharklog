import { useCallback } from 'react';
import { Platform, type KeyboardTypeOptions } from 'react-native';
import { formatOddsAs, isOddsFormat, rangeFormat, type OddsFormat } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';

/** The user's odds format; missing or unknown is decimal, as before the setting. */
export function useOddsFormat(): OddsFormat {
  const f = useBetsStore((s) => s.settings.oddsFormat);
  return isOddsFormat(f) ? f : 'decimal';
}

/** `formatOddsAs` bound to the user's format. Stable for a given format. */
export function useFormatOdds(): (decimal: number) => string {
  const format = useOddsFormat();
  return useCallback((decimal: number) => formatOddsAs(decimal, format), [format]);
}

/**
 * For the ends of a RANGE ("1.30 – 1.70"): the user's format, except Malay,
 * whose quotes jump sign at even money and would read backwards (rangeFormat).
 */
export function useFormatOddsRange(): (decimal: number) => string {
  const format = rangeFormat(useOddsFormat());
  return useCallback((decimal: number) => formatOddsAs(decimal, format), [format]);
}

/**
 * The keyboard an odds field needs. Checked in React Native's source, not
 * assumed: iOS "numeric" is the decimal pad, with no minus — American, Malay
 * and Indonesian quotes need the punctuation keyboard there. Android
 * "numeric" is signed and decimal, but no number keyboard has "/", so a
 * fractional quote gets the default one.
 */
export function oddsKeyboard(format: OddsFormat): KeyboardTypeOptions {
  if (format === 'decimal' || format === 'hongkong') return 'decimal-pad';
  if (Platform.OS === 'ios') return 'numbers-and-punctuation';
  return format === 'fractional' ? 'default' : 'numeric';
}
