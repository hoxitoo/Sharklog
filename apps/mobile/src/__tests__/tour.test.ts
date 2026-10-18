import { readFileSync } from 'fs';
import { join } from 'path';
import { tourLayout, dimPath, holeFor, ARROW_GAP, SIDE, type Box } from '../components/tour/geometry';
import { useTourStore, TOUR_STEPS, markTourPending, isTourPending } from '../components/tour/tour';

/*
 * The first-run tour. Geometry first — where the card and the arrow go is the
 * whole point, and it is plain arithmetic — then the step logic.
 */

const phone = { width: 390, height: 844 };
const CARD = 190;

const overlaps = (a: Box, top: number, height: number) =>
  !(top + height <= a.y || top >= a.y + a.height);

describe('tourLayout', () => {
  const menu: Box = { x: 22, y: 50, width: 40, height: 40 };          // top left
  const summary: Box = { x: 16, y: 200, width: 358, height: 120 };    // upper half
  const fab: Box = { x: 300, y: 740, width: 64, height: 64 };         // bottom right

  it('puts the card below a control in the upper half and above one at the bottom', () => {
    expect(tourLayout(menu, phone, CARD).placement).toBe('below');
    expect(tourLayout(summary, phone, CARD).placement).toBe('below');
    expect(tourLayout(fab, phone, CARD).placement).toBe('above');
  });

  it('never covers the control it explains, and stays on screen', () => {
    for (const target of [menu, summary, fab, { x: 16, y: 470, width: 358, height: 56 }]) {
      const l = tourLayout(target, phone, CARD);
      expect(overlaps(holeFor(target), l.cardTop, CARD)).toBe(false);
      expect(l.cardTop).toBeGreaterThanOrEqual(SIDE);
      expect(l.cardTop + CARD).toBeLessThanOrEqual(phone.height - SIDE);
    }
  });

  it('leaves the arrow room between the card and the control', () => {
    const l = tourLayout(summary, phone, CARD);
    const hole = holeFor(summary);
    expect(l.cardTop - (hole.y + hole.height)).toBeGreaterThanOrEqual(ARROW_GAP - 0.5);
  });

  it('ends the arrow at the control\'s edge, level with its centre', () => {
    const l = tourLayout(fab, phone, CARD);
    const hole = holeFor(fab);
    const end = l.shaft.split(' ').slice(-2).map(Number);
    expect(end[0]).toBeCloseTo(hole.x + hole.width / 2, 0);
    expect(end[1]).toBeCloseTo(hole.y - 6, 0);
    // The head ends where the shaft does.
    expect(l.head).toContain(`L ${end[0]} ${end[1]}`);
  });

  it('starts the arrow on the card, even for a control at the very edge', () => {
    const l = tourLayout(menu, phone, CARD);
    const [, sx, sy] = l.shaft.split(' ').map(Number);
    expect(sx).toBeGreaterThanOrEqual(SIDE);
    expect(sx).toBeLessThanOrEqual(phone.width - SIDE);
    expect(sy).toBeCloseTo(l.cardTop, 0);
  });

  it('centres a step with nothing to point at, without an arrow', () => {
    const l = tourLayout(null, phone, CARD);
    expect(l.placement).toBe('center');
    expect(l.shaft).toBe('');
    expect(l.cardTop).toBeCloseTo((phone.height - CARD) / 2, 0);
  });

  it('falls back to the side with more room on a short screen', () => {
    const short = { width: 320, height: 420 };
    const mid: Box = { x: 16, y: 150, width: 288, height: 60 };
    const l = tourLayout(mid, short, 260);
    expect(['below', 'above']).toContain(l.placement);
    expect(l.cardTop).toBeGreaterThanOrEqual(SIDE);
  });
});

describe('dimPath', () => {
  it('cuts a hole only when there is a control', () => {
    expect(dimPath(phone, null)).toBe('M 0 0 H 390 V 844 H 0 Z');
    const p = dimPath(phone, holeFor({ x: 10, y: 10, width: 50, height: 30 }));
    expect(p.match(/Z/g)).toHaveLength(2);
    expect(p).toContain('A ');
  });
});

describe('tour steps', () => {
  beforeEach(() => useTourStore.setState({ active: false, index: 0, steps: [] }));

  it('shows the trial step only during the trial', () => {
    useTourStore.getState().start({ inTrial: false });
    expect(useTourStore.getState().steps.some((s) => s.key === 'trial')).toBe(false);
    useTourStore.getState().start({ inTrial: true });
    expect(useTourStore.getState().steps.at(-1)?.key).toBe('trial');
  });

  it('walks to the end and closes itself; skip closes it at once', async () => {
    await markTourPending();
    useTourStore.getState().start({ inTrial: false });
    const n = useTourStore.getState().steps.length;
    for (let i = 0; i < n; i++) useTourStore.getState().next();
    expect(useTourStore.getState().active).toBe(false);
    expect(await isTourPending()).toBe(false);

    await markTourPending();
    useTourStore.getState().start({ inTrial: false });
    useTourStore.getState().finish();
    expect(useTourStore.getState().active).toBe(false);
    expect(await isTourPending()).toBe(false);
  });

  it('every step has its words in all four languages', () => {
    for (const lang of ['ru', 'en', 'kz', 'by']) {
      const d = JSON.parse(readFileSync(join(__dirname, '..', 'i18n', 'locales', `${lang}.json`), 'utf8'));
      for (const s of TOUR_STEPS) {
        expect(typeof d.tour[`${s.key}Title`]).toBe('string');
        expect(typeof d.tour[`${s.key}Body`]).toBe('string');
      }
      for (const k of ['skip', 'next', 'done', 'counter']) expect(typeof d.tour[k]).toBe('string');
    }
  });

  it('every step with a target has that target registered on a screen', () => {
    const src = ['screens/BetsScreen/index.tsx', 'navigation/DrawerNavigator.tsx']
      .map((f) => readFileSync(join(__dirname, '..', f), 'utf8')).join('\n');
    for (const s of TOUR_STEPS) {
      if (!s.target) continue;
      const registered = src.includes(`tourTarget('${s.target}')`) || src.includes(`menuTourTarget="${s.target}"`);
      expect(`${s.target}: ${registered}`).toBe(`${s.target}: true`);
    }
  });
});
