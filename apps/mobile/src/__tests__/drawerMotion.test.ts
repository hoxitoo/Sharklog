import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * The drawer slides in on the native driver, and React's copy of its layout
 * only catches up when the animation reports finished. Until then a menu item
 * measures itself at the starting (off-screen) offset, sees the finger outside
 * itself at the first jitter, and cancels the press. So the animation has to
 * finish when the motion visibly does. A spring looked done after ~250 ms and
 * ran ~700 ms more — the menu was dead for most of a second after opening.
 */
const SRC = readFileSync(join(__dirname, '..', 'navigation', 'DrawerNavigator.tsx'), 'utf8');

describe('drawer slide-in', () => {
  it('is not a spring', () => {
    expect(SRC).not.toMatch(/Animated\.spring\(/);
  });

  it('is short enough to be over before the next tap', () => {
    const ms = Number(/const OPEN_MS = (\d+);/.exec(SRC)?.[1]);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(300);
  });

  it('uses that duration for the slide itself', () => {
    expect(SRC).toMatch(/Animated\.timing\(translateX, \{\s*toValue: 0,\s*duration: OPEN_MS,/);
  });
});

describe('Android back in the drawer', () => {
  it('steps aside while a stacked screen is on top', () => {
    // RN asks the newest listener first, and the drawer's re-registers on every
    // screen switch — so without this check it answered Back for Support,
    // Bankroll or the bet form, flipping the hidden screen instead of closing.
    const handler = SRC.slice(SRC.indexOf("addEventListener('hardwareBackPress'"));
    const firstLine = handler.split('\n').find((l) => /^\s*if \(/.test(l));
    expect(firstLine).toMatch(/if \(!navigation\.isFocused\(\)\) return false;/);
  });
});
