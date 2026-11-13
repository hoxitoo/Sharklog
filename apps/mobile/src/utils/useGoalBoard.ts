import { useMemo } from 'react';
import { goalBoard, toYmd, FREE_LIMITS, type GoalBoard } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';

/**
 * The goals as the goal screens see them — the list, one goal's screen and
 * the bets screen's header button: core's goalBoard (one rule — main goal,
 * open and locked on Free, a slot left), memoized on the store. The goal form
 * checks a save with goalFitsPlan instead.
 */
export function useGoalBoard(): GoalBoard {
  const goals = useBetsStore((s) => s.goals);
  const bets = useBetsStore((s) => s.bets);
  const transactions = useBetsStore((s) => s.bankroll.transactions);
  const isPro = useBetsStore((s) => s.settings.isPro);
  // The day is in the key: the first render after midnight resets a month's
  // loss cap even when no bet was saved since (the bets screen stays mounted
  // for hours) — the next render, not midnight itself: nothing re-renders then.
  const today = toYmd(new Date());
  return useMemo(
    () => goalBoard(goals, bets, transactions, isPro, FREE_LIMITS.MAX_GOALS),
    [goals, bets, transactions, isPro, today], // `today`: re-run after midnight
  );
}
