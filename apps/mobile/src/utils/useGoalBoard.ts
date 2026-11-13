import { useMemo } from 'react';
import { calcGoalProgress, goalsFor, mainGoal, toYmd, FREE_LIMITS, type Goal, type GoalProgress } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';

export interface GoalBoard {
  /** Every goal's progress, archived ones too. */
  progress: Map<string, GoalProgress>;
  /** Reached now (`achieved`) — done: folded at the bottom, no slot, never the main goal. */
  reached: (g: Goal) => boolean;
  /** Active goals open on this plan, reached ones included; `locked` — the rest (Free). */
  open: Goal[];
  locked: Goal[];
  /** The main goal: the first open one still to reach (with every goal reached — the first). */
  main: Goal | undefined;
  /** Free has no slot left for one more goal still to reach (adding, restoring from the archive). */
  full: boolean;
}

/**
 * The goals as every goal screen sees them: the list, one goal's screen, the
 * bets screen's header button and the goal form. One computation, so the
 * button and the list never disagree about which goal is the main one, which
 * are open on Free, or whether there is a slot left.
 */
export function useGoalBoard(): GoalBoard {
  const goals = useBetsStore((s) => s.goals);
  const bets = useBetsStore((s) => s.bets);
  const transactions = useBetsStore((s) => s.bankroll.transactions);
  const isPro = useBetsStore((s) => s.settings.isPro);
  // The day is in the key: a month's loss cap must reset at midnight even when
  // no bet was saved since (the bets screen stays mounted for hours).
  const today = toYmd(new Date());
  return useMemo(() => {
    const progress = new Map(goals.map((g) => [g.id, calcGoalProgress(g, bets, transactions)] as const));
    const reached = (g: Goal) => progress.get(g.id)?.achieved ?? false;
    const { open, locked, taken } = goalsFor(goals, isPro, FREE_LIMITS.MAX_GOALS, reached);
    return { progress, reached, open, locked, main: mainGoal(open, reached), full: !isPro && taken >= FREE_LIMITS.MAX_GOALS };
  }, [goals, bets, transactions, isPro, today]); // `today`: re-run after midnight
}
