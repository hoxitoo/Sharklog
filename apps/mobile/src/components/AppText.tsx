import React, { useMemo } from 'react';
import {
  Text as RNText, TextInput as RNTextInput, StyleSheet,
  type TextProps, type TextInputProps, type TextStyle,
} from 'react-native';
import { FONTS, sansFor, monoFor } from '../theme/typography';

/**
 * `Text` with the app's typeface applied.
 *
 * The bundle already blocks the splash on six DM Sans / DM Mono files, but
 * almost nothing referenced them, so the whole interface rendered in Roboto or
 * SF — we paid the startup cost of a typeface we never showed. React 19 removed
 * `defaultProps` on function components, so the usual global-default trick is
 * gone; screens import this instead, aliased as `Text`, and their JSX is
 * untouched.
 *
 * Two things happen here that a plain default could not do:
 *
 *  - **The weight chooses the file.** A custom family on Android is one face,
 *    so a bare `fontWeight: '700'` would render regular. The weight is resolved
 *    to the matching DM Sans cut and then dropped, because leaving it set makes
 *    Android fake-bold on top of an already-bold face.
 *  - **Mono is weight-aware too.** A style that spreads `numeric` gets the
 *    right DM Mono cut for its weight rather than always the regular one.
 *
 * An explicit `fontFamily` in the incoming style always wins.
 */
export function AppText({ style, ...rest }: TextProps) {
  const resolved = useMemo(() => resolveFont(style), [style]);
  return <RNText {...rest} style={[base.text, style, resolved]} />;
}

/**
 * `TextInput` with the same treatment — inputs render in the app font too.
 *
 * `ref` is declared explicitly. React 19 does hand it to function components as
 * an ordinary prop, so a rest spread happens to forward it, but the types do not
 * say so; a silently null ref would break the focus jump between the team
 * fields on the add-bet form with nothing to see in a type-check.
 */
export function AppTextInput({ style, ref, ...rest }: TextInputProps & {
  ref?: React.Ref<RNTextInput>;
}) {
  const resolved = useMemo(() => resolveFont(style), [style]);
  return <RNTextInput {...rest} ref={ref} style={[base.text, style, resolved]} />;
}

/**
 * Turns the flattened style's `fontWeight` into a concrete font file.
 * Returns the family plus `fontWeight: undefined` so the platform is never
 * asked to bolden a face that is already the bold one.
 */
function resolveFont(style: TextProps['style']): TextStyle {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const family = flat?.fontFamily;
  const weight = flat?.fontWeight;

  // Callers that name a face directly keep it; only the weight-to-file mapping
  // is applied, so `numeric` (mono) plus `fontWeight: '700'` gets mono medium.
  if (family) {
    const isMono = family === FONTS.mono || family === FONTS.monoMedium;
    return { fontFamily: isMono ? monoFor(weight) : family, fontWeight: undefined };
  }
  return { fontFamily: sansFor(weight), fontWeight: undefined };
}

const base = StyleSheet.create({
  text: {
    // Harmless where the face has no tabular figures, and it lines up digits
    // everywhere it does — money that is not on the mono style still benefits.
    fontVariant: ['tabular-nums'],
  },
});
