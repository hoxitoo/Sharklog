import { TEXT_LIMITS } from '@sharklog/core';

/**
 * The `maxLength` a text field gets (`AppTextInput`): its own, or TEXT_LIMITS
 * (the longer one for a multi-line field) — but never below the text it
 * already holds. A note saved before the limit existed can be longer, and
 * React Native does not take such a value well: iOS refuses every edit of it,
 * even a backspace (`RCTTextInputComponentView.mm`: the allowed length goes
 * negative), and Android shows it cut and saves the cut text back on the
 * first keystroke (`ReactEditText` runs the length filter on the value it is
 * given). So the field may shrink to the limit, and only not grow past it.
 */
export function fieldCap(own: number | undefined, multiline: boolean | undefined, value: string | undefined): number {
  const limit = own ?? (multiline ? TEXT_LIMITS.NOTE : TEXT_LIMITS.FIELD);
  return Math.max(limit, value?.length ?? 0);
}
