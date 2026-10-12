import { StyleSheet } from 'react-native';
import { themeVersion } from './colors';

/**
 * `StyleSheet.create`, resolved lazily against the ACTIVE theme.
 *
 * A module-level `StyleSheet.create({ color: colors.textMuted })` runs once,
 * at import, and keeps the colour the app started with forever. This returns
 * an object with the same keys whose values are built from `factory()` on
 * first access and rebuilt whenever the theme changes — so call sites keep
 * writing `styles.card` and get the current theme's card.
 *
 * The per-access cost is one version compare; the sheet itself is rebuilt
 * once per switch.
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: () => T & StyleSheet.NamedStyles<any>,
): T {
  let sheet: T | null = null;
  let builtFor = -1;
  const current = (): T => {
    const v = themeVersion();
    if (sheet === null || builtFor !== v) {
      sheet = StyleSheet.create(factory());
      builtFor = v;
    }
    return sheet;
  };
  return new Proxy({} as T, {
    get: (_t, key) => (current() as Record<string | symbol, unknown>)[key],
    has: (_t, key) => key in (current() as object),
    ownKeys: () => Reflect.ownKeys(current() as object),
    getOwnPropertyDescriptor: (_t, key) => {
      const d = Object.getOwnPropertyDescriptor(current() as object, key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}
