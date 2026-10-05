import type { TFunction } from 'i18next';
import type { Sport, BetType, Strategy, EsportsDiscipline } from '@sharklog/core';
import { ESPORTS_DISCIPLINES, BET_TYPES, PICK, TX_NOTE } from '@sharklog/core';

/*
 * Display names for the enums core keeps Russian labels for.
 *
 * `SPORTS`, `BET_TYPES` and `STRATEGIES` in core are Russian strings, and a
 * screen that printed them directly showed "Киберспорт · Фора" on an English
 * card — invisible to the hardcoded-Russian ratchet, because the Russian lives
 * in core, not in the screen. Screens go through these instead; the guard in
 * `__tests__/i18n.test.ts` keeps it that way.
 */

export const sportLabel = (t: TFunction, s: Sport): string => t(`sports.${s}`);
export const betTypeLabel = (t: TFunction, b: BetType): string => t(`betTypes.${b}`);
export const strategyLabel = (t: TFunction, s: Strategy): string => t(`strategies.${s}`);

/** Game titles are proper names and stay as they are; only "other" is words. */
export function disciplineLabel(t: TFunction, d: EsportsDiscipline): string {
  return d === 'other_esports' ? t('disciplines.other') : ESPORTS_DISCIPLINES[d];
}

/** Stored pick token → its display key. Longest-first is not needed: no token is a prefix of another. */
const PICK_KEYS: Array<[string, string]> = [
  [PICK.HOME, 'picks.home'], [PICK.AWAY, 'picks.away'], [PICK.DRAW, 'picks.draw'],
  [PICK.HANDICAP_HOME, 'picks.handicapHome'], [PICK.HANDICAP_AWAY, 'picks.handicapAway'],
  [PICK.OVER, 'picks.over'], [PICK.UNDER, 'picks.under'],
  [PICK.YES, 'picks.yes'], [PICK.NO, 'picks.no'], [PICK.EXPRESS, 'picks.express'],
];

/**
 * A stored pick, as the current language should SHOW it.
 *
 * The stored value stays Russian (`PICK` in core explains why). Only known
 * tokens are swapped, and only as a whole word — "Ф2 (-6.5)" becomes
 * "H2 (-6.5)", while a team called "Пари НН" is left alone. An express keeps
 * its legs: each " / "-separated part is mapped on its own. A pick that is a
 * bet type's name (the form stores one when a type has no finer pick) is
 * shown under that type's translated name.
 */
export function pickLabel(t: TFunction, pick: string): string {
  return pick.split(' / ').map((part) => {
    for (const [token, key] of PICK_KEYS) {
      if (part === token) return t(key);
      if (part.startsWith(`${token} `)) return `${t(key)}${part.slice(token.length)}`;
    }
    const type = (Object.keys(BET_TYPES) as BetType[]).find((k) => BET_TYPES[k] === part);
    return type ? betTypeLabel(t, type) : part;
  }).join(' / ');
}

/**
 * A transaction note as the current language should show it. The two notes
 * the app writes by itself (`TX_NOTE`) are translated; anything the user typed
 * is shown exactly as typed.
 */
export function txNoteLabel(t: TFunction, note: string): string {
  if (note === TX_NOTE.ADJUSTMENT) return t('bankroll.noteAdjustment');
  if (note === TX_NOTE.INITIAL_DEPOSIT) return t('bankroll.noteInitialDeposit');
  return note;
}
