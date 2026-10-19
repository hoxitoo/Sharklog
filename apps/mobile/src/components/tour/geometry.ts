/*
 * Where the tour's card goes and how its arrow runs — plain arithmetic, no
 * React Native, so it is under test (see __tests__/tour.test.ts).
 *
 * The card sits below the control when there is room and above it otherwise,
 * NEVER over it: an explanation that covers the thing it explains is the one
 * layout this must not produce. When neither side has room for the whole card
 * (a small phone with a large system font), the card takes the roomier side,
 * the arrow shortens, and the card is capped — its text scrolls — rather than
 * being pushed across the control.
 *
 * The arrow leaves the card's edge level with the control (clamped to the
 * card) and bows towards the middle of the screen, so it reads as drawn rather
 * than as a border.
 */

export interface Box { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }

export const HOLE_PAD = 6;
export const HOLE_RADIUS = 12;
/** Room the arrow gets between the card and the highlighted control. */
export const ARROW_GAP = 56;
/** The shortest arrow that still reads as one, when space is tight. */
export const MIN_GAP = 24;
export const SIDE = 16;
const HEAD = 12;
const HEAD_ANGLE = (25 * Math.PI) / 180;

export interface TourLayout {
  placement: 'below' | 'above' | 'center';
  /** Card's top edge, in overlay coordinates. */
  cardTop: number;
  /** Cap on the card's height; undefined when the whole card fits. */
  cardMaxHeight: number | undefined;
  hole: Box | null;
  /** SVG path of the arrow's shaft and of its head; empty when centred. */
  shaft: string;
  head: string;
}

export function holeFor(target: Box): Box {
  return {
    x: target.x - HOLE_PAD,
    y: target.y - HOLE_PAD,
    width: target.width + HOLE_PAD * 2,
    height: target.height + HOLE_PAD * 2,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

export function tourLayout(target: Box | null, screen: Size, cardHeight: number): TourLayout {
  if (!target) {
    return {
      placement: 'center',
      cardTop: Math.max(SIDE, (screen.height - cardHeight) / 2),
      cardMaxHeight: cardHeight > screen.height - SIDE * 2 ? screen.height - SIDE * 2 : undefined,
      hole: null, shaft: '', head: '',
    };
  }

  const hole = holeFor(target);
  const holeBottom = hole.y + hole.height;
  const spaceBelow = screen.height - SIDE - holeBottom;
  const spaceAbove = hole.y - SIDE;
  const need = cardHeight + ARROW_GAP;
  const fitsBelow = spaceBelow >= need;
  const fitsAbove = spaceAbove >= need;

  // Below by default (the eye moves down the page); above when below won't
  // fit or the control sits low anyway; otherwise the roomier side.
  const placement: 'below' | 'above' = fitsBelow && (!fitsAbove || hole.y + hole.height / 2 < screen.height * 0.55)
    ? 'below'
    : fitsAbove ? 'above'
    : spaceBelow >= spaceAbove ? 'below' : 'above';

  const space = placement === 'below' ? spaceBelow : spaceAbove;
  // The arrow gives up length before the card is allowed near the control.
  const gap = clamp(space - cardHeight, MIN_GAP, ARROW_GAP);
  const maxCard = Math.max(0, space - gap);
  const shown = Math.min(cardHeight, maxCard);
  const cardTop = placement === 'below' ? holeBottom + gap : hole.y - gap - shown;

  const cx = hole.x + hole.width / 2;
  const sx = clamp(cx, SIDE + 28, screen.width - SIDE - 28);
  const sy = placement === 'below' ? cardTop : cardTop + shown;
  const ex = cx;
  const ey = placement === 'below' ? holeBottom + Math.min(6, gap / 4) : hole.y - Math.min(6, gap / 4);
  // Bow towards the middle of the screen, less for a short arrow.
  const bow = (sx > screen.width / 2 ? -1 : 1) * Math.min(36, gap * 0.6);
  const qx = (sx + ex) / 2 + bow;
  const qy = (sy + ey) / 2;
  const angle = Math.atan2(ey - qy, ex - qx);
  const h1 = { x: ex - HEAD * Math.cos(angle - HEAD_ANGLE), y: ey - HEAD * Math.sin(angle - HEAD_ANGLE) };
  const h2 = { x: ex - HEAD * Math.cos(angle + HEAD_ANGLE), y: ey - HEAD * Math.sin(angle + HEAD_ANGLE) };

  return {
    placement,
    cardTop,
    cardMaxHeight: shown < cardHeight ? maxCard : undefined,
    hole,
    shaft: `M ${r1(sx)} ${r1(sy)} Q ${r1(qx)} ${r1(qy)} ${r1(ex)} ${r1(ey)}`,
    head: `M ${r1(h1.x)} ${r1(h1.y)} L ${r1(ex)} ${r1(ey)} L ${r1(h2.x)} ${r1(h2.y)}`,
  };
}

/** The dim layer with a rounded hole over the control (even-odd fill). */
export function dimPath(screen: Size, hole: Box | null): string {
  const outer = `M 0 0 H ${screen.width} V ${screen.height} H 0 Z`;
  if (!hole) return outer;
  const { x, y, width: w, height: h } = hole;
  const r = Math.min(HOLE_RADIUS, w / 2, h / 2);
  const inner = `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} `
    + `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} `
    + `V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  return `${outer} ${inner}`;
}
