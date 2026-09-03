/**
 * Shape and rhythm.
 *
 * The audit counted 18 distinct `borderRadius` values across 161 sites — the
 * same object rendered at 10, 14, 16 and 18 depending on which screen drew it.
 * Radius is how the eye tells one kind of surface from another, so four radii
 * for one kind of surface is not variety, it is noise.
 */
export const RADIUS = {
  xs: 4,    // chips, badges, tiny fills
  sm: 8,    // inputs, buttons, list rows
  md: 12,   // tiles nested inside a card
  lg: 18,   // the card itself
  sheet: 24, // a bottom sheet's top corners — bigger than a card on purpose
  /**
   * Fully round: circles, pills, the FAB.
   *
   * Both platforms clamp a radius to half the edge, so one value covers every
   * size. Use it for anything whose roundness is the point — a switch knob at
   * `borderRadius: 8` on a 20pt square is a squircle, not a knob. Never use it
   * on a wide surface that should only have soft corners: two adjacent radii of
   * 999 on a full-width sheet scale to ~195 each and dome the top edge.
   */
  pill: 999,
} as const;

/**
 * Spacing on a 4px grid.
 *
 * `padding: 14` was the single most common value in the app — that is not a
 * grid at all, and it is why so much of the layout felt "almost aligned".
 *
 * The grid governs structural space. Values of 1–3px are optical nudges, not
 * structure — `marginTop: 2` under a value sits it against its label — and
 * rounding them to 4 would visibly loosen groupings that are already tuned.
 * They stay, and `designTokens.test.ts` allows them by that rule.
 *
 * The tokens stop at 32 because that is where named steps stop being useful.
 * Larger clearances are still on the grid and still allowed as literals — but
 * they must be a multiple of 4, and one-off clearances that exist to clear
 * another element should be derived from it rather than typed (see
 * `FAB_CLEARANCE`), or they drift the moment that element moves.
 */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * The floating "+" button, and the room a scroll list must leave for it.
 *
 * Lives here rather than next to the FAB because the bet list needs it too,
 * and importing it from the navigator would close a cycle — the navigator
 * imports the screen. Derived rather than typed: the literal 96 that used to
 * sit in the list style was silently flattened to 32 by a spacing sweep, and
 * the last bet card ended up underneath the button.
 */
export const FAB_SIZE = 58;
export const FAB_BOTTOM = 20;
export const FAB_CLEARANCE = FAB_BOTTOM + FAB_SIZE + SPACE.lg;

/**
 * Minimum tap size, in dp.
 *
 * Both Apple's and Google's guidance land on ~44dp. The app's interactive rows
 * ran to about 33dp (a period chip at `paddingVertical: 8` around 13px text),
 * which is a miss you feel rather than see — reach for a filter, get nothing.
 * Prefer `minHeight: TOUCH` where the layout can afford it, `hitSlop` where a
 * dense row cannot.
 */
export const TOUCH = 44;

/**
 * Grows a control's touch area to `TOUCH` without changing how it looks.
 *
 * For anything whose size is deliberate — a square stepper button, a status
 * chip in a dense row, the round FAB — `minHeight` is the wrong tool: it would
 * stretch the shape. This pads the tappable region instead, and takes the
 * control's real size so the result is actually 44 rather than a guessed 8.
 */
export function hitSlopFor(
  size: number | { width: number; height: number },
  opts?: { maxHorizontal?: number },
) {
  const width = typeof size === 'number' ? size : size.width;
  const height = typeof size === 'number' ? size : size.height;
  const vertical = Math.max(0, Math.round((TOUCH - height) / 2));
  let horizontal = Math.max(0, Math.round((TOUCH - width) / 2));
  // Neighbours in a row must not both claim the space between them: both
  // platforms hit-test siblings back to front, so an overlap silently hands
  // the tap to the one on the right. Half the gap is the most either can take.
  if (opts?.maxHorizontal != null) horizontal = Math.min(horizontal, opts.maxHorizontal);
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}
