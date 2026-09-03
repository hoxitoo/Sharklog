import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { SIZE, GLYPH } from '../theme/typography';
import {
  SPACE, TOUCH, hitSlopFor, FAB_CLEARANCE, FAB_BOTTOM, FAB_SIZE,
} from '../theme/layout';

/**
 * The lint rule for the design system.
 *
 * The type ladder splintered into 20 sizes once already, and it did so for one
 * reason: nothing stopped a new screen from inventing `fontSize: 17`. A scale
 * with no enforcement is a suggestion. There is no eslint config in this repo
 * (`npm run lint` names a binary that was never installed), but CI does run
 * jest — so the rule lives where it will actually run.
 *
 * If you need a size the scale does not have, the answer is to argue for
 * changing the scale, not to slip past it.
 */

const SRC = join(__dirname, '..');
const SKIP = new Set(['__tests__', 'node_modules']);

function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const FILES = sources(SRC);

/** `file:line  offending text` for every match, so a failure names the site. */
function offenders(re: RegExp): string[] {
  const hits: string[] = [];
  for (const file of FILES) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const m = line.match(re);
      if (m) hits.push(`${file.slice(SRC.length + 1)}:${i + 1}  ${m[0]}`);
    });
  }
  return hits;
}

describe('design tokens', () => {
  it('has no raw numeric fontSize anywhere in src', () => {
    // theme/typography.ts is where the numbers are allowed to live.
    const hits = offenders(/fontSize:\s*\d/).filter((h) => !h.startsWith('theme/typography.ts'));
    expect(hits).toEqual([]);
  });

  it('keeps the text scale at seven steps that stay apart', () => {
    const steps = Object.values(SIZE);
    expect(steps).toHaveLength(7);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps); // ascending
    // Two sizes within 1px of each other read as a mistake, not a hierarchy.
    steps.slice(1).forEach((s, i) => expect(s - steps[i]!).toBeGreaterThanOrEqual(2));
  });

  it('has no raw numeric borderRadius', () => {
    const hits = offenders(/border(?:Top|Bottom)?(?:Left|Right)?Radius:\s*\d/)
      .filter((h) => !h.startsWith('theme/layout.ts'));
    expect(hits).toEqual([]);
  });

  it('keeps structural spacing on the grid', () => {
    // The rule is the grid, not the token list. 1–3px are optical nudges and
    // stay literal on purpose; above the named steps a literal is fine as long
    // as it is a multiple of 4. Demanding a token there is what flattened a
    // 96px FAB clearance to 32 and buried the last bet card.
    const KEYS = 'padding|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingHorizontal'
      + '|paddingVertical|margin|marginTop|marginBottom|marginLeft|marginRight'
      + '|marginHorizontal|marginVertical|gap|rowGap|columnGap';
    const hits = offenders(new RegExp(`\\b(?:${KEYS}):\\s*(\\d+)`))
      .filter((h) => !h.startsWith('theme/layout.ts'))
      .filter((h) => {
        const px = Number(h.split(':').pop());
        return px >= 4 && px % 4 !== 0;
      });
    expect(hits).toEqual([]);
  });

  it('builds the spacing scale on a 4px grid', () => {
    for (const v of Object.values(SPACE)) expect(v % 4).toBe(0);
  });

  it('pads a small control up to the full 44dp target', () => {
    // A 28px chip needs 8 on each side; the helper must not guess.
    expect(28 + hitSlopFor(28).top + hitSlopFor(28).bottom).toBeGreaterThanOrEqual(TOUCH);
    expect(36 + hitSlopFor(36).left + hitSlopFor(36).right).toBeGreaterThanOrEqual(TOUCH);
    // Already big enough: no padding, no shifted layout.
    expect(hitSlopFor(60)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('never lets neighbours in a row claim the same pixels', () => {
    // The W/L/R/C chips: 36 wide, 28 tall, 8 apart. Padding all four sides from
    // the height alone gave 8 sideways across a 4px gap, so each chip reached
    // inside the next one — and a hit-test walks siblings back to front, so the
    // right edge of "W" recorded the bet as lost.
    const slop = hitSlopFor({ width: 36, height: 28 }, { maxHorizontal: 4 });
    expect(slop.left).toBe(4);
    expect(slop.right).toBe(4);
    expect(36 + slop.left + slop.right).toBe(TOUCH);   // exactly meets, never overlaps
    expect(28 + slop.top + slop.bottom).toBe(TOUCH);
  });

  it('leaves the bet list enough room to clear the FAB', () => {
    // A literal 96 here was flattened to 32 by a spacing sweep and the last bet
    // card ended up under the button. Derived from the button, it cannot drift.
    expect(FAB_CLEARANCE).toBeGreaterThanOrEqual(FAB_BOTTOM + FAB_SIZE);
  });

  it('never distributes a row with space-around', () => {
    // The trap behind two real bugs on device. `space-around` on cells sized to
    // their own content looks fine until the content grows: the leftover space
    // goes to zero and the columns touch. On Bankroll three money values ran
    // together; on Discipline three labels became one word — "Серия
    // пораженийСтавок сегодняПоражений за неделю".
    //
    // A stat row is columns: give the cells `flex: 1` and the row a `gap`, and
    // the spacing cannot be eaten by the text.
    expect(offenders(/justifyContent:\s*'space-around'/)).toEqual([]);
  });

  it('sizes glyphs off the same ramp, so the two axes cannot drift', () => {
    const ramp = new Set<number>(Object.values(SIZE));
    for (const [name, px] of Object.entries(GLYPH)) {
      // `hero` is illustration — an empty-state mark, deliberately off the ramp.
      if (name === 'hero') continue;
      expect(ramp.has(px)).toBe(true);
    }
  });
});
