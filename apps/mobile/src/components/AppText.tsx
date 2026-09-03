import React from 'react';
import {
  Text as RNText, TextInput as RNTextInput, StyleSheet,
  type TextProps, type TextInputProps, type TextStyle,
} from 'react-native';
import { resolveFont } from '../theme/typography';

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
 *
 * One thing to know when nesting: a resolved family is written onto every
 * `Text`, so a nested `<Text>` that carries only a colour no longer inherits
 * its parent's weight — it must state its own.
 */
export function AppText({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={[base.text, style, fontFor(style)]} />;
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
  return <RNTextInput {...rest} ref={ref} style={[base.text, style, fontFor(style)]} />;
}

/** Flattens whatever style shape the caller passed, then asks the theme. */
function fontFor(style: TextProps['style']): TextStyle {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  return resolveFont(flat?.fontFamily, flat?.fontWeight);
}

const base = StyleSheet.create({
  text: {
    // Harmless where the face has no tabular figures, and it lines up digits
    // everywhere it does — money that is not on the mono style still benefits.
    fontVariant: ['tabular-nums'],
  },
});
