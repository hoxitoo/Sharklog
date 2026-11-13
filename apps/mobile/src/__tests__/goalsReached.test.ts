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
  it('fold to a line that opens the goal on its own screen — below the locked ones', () => {
    expect(list).toMatch(/reached\.map\(\(g\) => \(\s*<TouchableOpacity[\s\S]*?navigation\.navigate\('Goal', \{ goalId: g\.id \}\)/);
    expect(list).toMatch(/going\.map\(\(g\) => \(\s*<GoalCard/);
    expect(nav).toMatch(/name="Goal"\s+component=\{GoalScreen\}/);
    // Drawn under «Достигнутые», a locked goal still to reach read as reached.
    expect(list.indexOf('{locked.map(')).toBeLessThan(list.indexOf("t('goals.reachedSection')"));
  });

  it('say when they were reached, in how many days, and — in Pro — the bets\' result per day', () => {
    expect(card).toContain("t('goals.achievedOn'");
    expect(card).toContain("t('goals.reachedIn'");
    expect(card).toMatch(/perDay !== null \? \(\s*isPro \? \(/);
    expect(detail).toMatch(/<GoalCard[\s\S]*?\bchart\b/);
  });

  it('are not offered as the main goal', () => {
    expect(card).toContain('!main && !p.achieved');
  });

  it('come from one board on the list, the goal screen and the header button (core goalBoard, tested there)', () => {
    for (const src of [list, detail, pill]) expect(src).toContain('useGoalBoard()');
    expect(board).toContain('goalBoard(goals, bets, transactions, isPro, FREE_LIMITS.MAX_GOALS)');
    expect(list).toMatch(/function addGoal\(\) \{\s*if \(full\)/);
  });

  it('are checked as SAVED in the goal form, which then goes back to the list in one move', () => {
    expect(edit).toContain('goalFitsPlan(goal, st.goals, st.bets, st.bankroll.transactions, st.settings.isPro, FREE_LIMITS.MAX_GOALS)');
    expect(edit).toMatch(/if \(existing && !fits\(goal\)\)/);
    expect(edit).toMatch(/if \(!fits\(back\)\)/);
    // Opened from a goal's screen, goBack after delete or archive showed that
    // screen empty, then it went back again by itself.
    expect(edit.match(/navigation\.navigate\('Goals'\)/g)?.length).toBe(2);
  });

  it('close their own screen once the goal is gone — only while that screen is on top', () => {
    expect(detail).toContain('const focused = useIsFocused();');
    expect(detail).toMatch(/if \(!goal && focused\) navigation\.goBack\(\);/);
  });
});
