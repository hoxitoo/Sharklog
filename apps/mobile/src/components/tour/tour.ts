import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { View } from 'react-native';

/*
 * The first-run tour of the Bets screen: one step at a time, an arrow from a
 * card of text to the control it explains, with "skip" on every step.
 *
 * Steps point at controls by id. A screen registers a control with
 * `tourTarget(id)` as its ref; the overlay measures it when its step comes up.
 * A step whose control is not on screen is skipped, not shown pointing at
 * nothing — the tour survives a screen that changes under it.
 *
 * It runs once, right after onboarding (a new user is the only one it is for),
 * and again whenever the user asks for it in Settings.
 */

export type TourTargetId = 'menu' | 'summary' | 'search' | 'filters' | 'advFilter' | 'fab';

export interface TourStep {
  key: string;
  /** The control the arrow points at; none = a centred card with no arrow. */
  target?: TourTargetId;
  /** Shown only while the 7-day trial runs. */
  onlyInTrial?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  { key: 'menu', target: 'menu' },
  { key: 'summary', target: 'summary' },
  { key: 'search', target: 'search' },
  { key: 'filters', target: 'filters' },
  { key: 'advFilter', target: 'advFilter' },
  { key: 'fab', target: 'fab' },
  // The card has nothing to point at on a first run — there are no bets yet.
  { key: 'card' },
  { key: 'trial', onlyInTrial: true },
];

const PENDING_KEY = '@sharklog/tour_pending';
/**
 * Also kept in memory: onboarding finishing and the main screen mounting
 * happen in the same tick, and the storage write may not have landed when the
 * screen asks.
 */
let pendingNow = false;
/** The old single-bubble tip on the Bets screen; the tour says it all and more. */
const BETS_TIP_KEY = '@sharklog/tip_bets_seen';

interface TourState {
  steps: TourStep[];
  index: number;
  active: boolean;
  start: (opts: { inTrial: boolean }) => void;
  next: () => void;
  finish: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  steps: [],
  index: 0,
  active: false,
  start: ({ inTrial }) => {
    set({ steps: TOUR_STEPS.filter((s) => !s.onlyInTrial || inTrial), index: 0, active: true });
  },
  next: () => {
    const { index, steps } = get();
    if (index + 1 >= steps.length) get().finish();
    else set({ index: index + 1 });
  },
  finish: () => {
    pendingNow = false;
    set({ active: false, index: 0 });
    AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
  },
}));

/** Onboarding just finished: the tour runs on the first look at the app. */
export async function markTourPending(): Promise<void> {
  pendingNow = true;
  try {
    await Promise.all([AsyncStorage.setItem(PENDING_KEY, '1'), AsyncStorage.setItem(BETS_TIP_KEY, '1')]);
  } catch {
    // A tour that never runs is no harm; a crash here would be.
  }
}

/**
 * Whether the tour is owed. Stays owed until it is finished or skipped, so an
 * app killed in the middle shows it again on the next launch.
 */
export async function isTourPending(): Promise<boolean> {
  if (pendingNow) return true;
  try {
    return (await AsyncStorage.getItem(PENDING_KEY)) === '1';
  } catch {
    return false;
  }
}

// ── Targets ─────────────────────────────────────────────────────────────────

export interface TourRect { x: number; y: number; width: number; height: number }

const nodes = new Map<TourTargetId, View>();
const refs = new Map<TourTargetId, (node: View | null) => void>();

/**
 * A ref for the control a step points at. Stable per id: a fresh callback on
 * every render would make React detach and re-attach it each time.
 */
export function tourTarget(id: TourTargetId): (node: View | null) => void {
  let ref = refs.get(id);
  if (!ref) {
    ref = (node) => {
      if (node) nodes.set(id, node);
      else nodes.delete(id);
    };
    refs.set(id, ref);
  }
  return ref;
}

/** The control's box in window coordinates, or null when it is not on screen. */
export function measureTarget(id: TourTargetId): Promise<TourRect | null> {
  const node = nodes.get(id);
  if (!node || typeof node.measureInWindow !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}
