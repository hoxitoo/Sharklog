import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * A reached goal is done (request from a phone, 2026-11-11): on the goals
 * screen it folds to one line at the bottom, and a tap opens it whole on its
 * own screen — when it was reached, in how many days, the bets' result per
 * day (core: reachedOn / reachedInDays / pnlPerDayToReach, tested there). The
 * main goal is the first one still to reach — the list and the header button
 * pick it the same way (mainGoal with the reached test, over the OPEN goals).
 */
const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const list = read('screens/GoalsScreen/index.tsx');
const card = read('screens/GoalsScreen/GoalCard.tsx');
const detail = read('screens/GoalScreen/index.tsx');
const pill = read('components/GoalPill.tsx');
const nav = read('navigation/RootNavigator.tsx');
const edit = read('screens/GoalEditScreen/index.tsx');
const board = read('utils/useGoalBoard.ts');

describe('reached goals', () => {
  it('fold to a line that opens the goal on its own screen', () => {
    expect(list).toMatch(/reached\.map\(\(g\) => \(\s*<TouchableOpacity[\s\S]*?navigation\.navigate\('Goal', \{ goalId: g\.id \}\)/);
    expect(list).toMatch(/going\.map\(\(g\) => \(\s*<GoalCard/);
    expect(nav).toMatch(/name="Goal"\s+component=\{GoalScreen\}/);
  });

  it('say when they were reached, in how many days, and the bets\' result per day', () => {
    expect(card).toContain("t('goals.achievedOn'");
    expect(card).toContain("t('goals.reachedIn'");
    expect(card).toContain('p.pnlPerDayToReach');
    expect(detail).toMatch(/<GoalCard[\s\S]*?\bchart\b/);
  });

  it('are never offered as the main goal', () => {
    expect(card).toContain('!main && !p.achieved');
  });

  it('leave the main goal to the first one still to reach — on the list and on the header button alike', () => {
    // One computation for every goal screen (useGoalBoard), not a copy each.
    for (const src of [list, detail, pill, edit]) expect(src).toContain('useGoalBoard()');
    expect(board).toMatch(/goalsFor\(goals, isPro, FREE_LIMITS\.MAX_GOALS, reached\)/);
    expect(board).toContain('main: mainGoal(open, reached)');
  });

  it('take no slot: Free adds or restores a goal beside a reached one (owner, 2026-11-13)', () => {
    expect(board).toContain('full: !isPro && taken >= FREE_LIMITS.MAX_GOALS');
    expect(list).toMatch(/function addGoal\(\) \{\s*if \(full\)/);
    expect(edit).toContain('if (board.full && !board.reached(existing))');
  });
});
