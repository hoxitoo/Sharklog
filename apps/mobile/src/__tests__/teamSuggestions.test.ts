import { readFileSync } from 'fs';
import { join } from 'path';
import type { TFunction } from 'i18next';
import { teamSportLabel } from '../utils/labels';

/*
 * The bet form's team suggestions come from the bets as they are
 * (teamsFromBets, core — tested there), not from the stored team list: that
 * list only ever added, so a team whose bet was moved from football to hockey
 * stayed offered under football (report from a phone). And picking a known
 * team sets the form's sport and discipline (sportOfTeam) — in every team
 * field, the accumulator's legs included.
 */
const src = readFileSync(join(__dirname, '../screens/AddBetScreen/index.tsx'), 'utf8');

describe('team suggestions on the bet form', () => {
  it('are built from the bets, not the stored team list', () => {
    expect(src).toContain('teamsFromBets(');
    expect(src).not.toMatch(/useBetsStore\(\(s\) => s\.teams\)/);
  });

  it('set the sport and discipline when a team is picked — in all four team fields', () => {
    expect(src.match(/onPickTeam=\{/g)?.length).toBe(4);
    // Through choiceAfterPick (teamPick.test.ts) — never over a choice already made.
    expect(src.match(/choiceAfterPick\(/g)?.length).toBe(2);
    expect(src).not.toContain('sportOfTeam(');
  });

  it('count a sport chosen in a picker, or from the saved bet, as the user\'s', () => {
    expect(src).toContain("useRef<PickSource | undefined>(source ? 'user' : undefined)");
    expect(src.match(/sportFrom(?:\.current = |: )'user'/g)?.length).toBeGreaterThanOrEqual(3);
    expect(src.match(/disciplineFrom(?:\.current = |: )'user'/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('the sport on a team suggestion', () => {
  const t = ((key: string) => `«${key}»`) as unknown as TFunction;

  it('is shown for every team whose sport is known — the form\'s own sport too', () => {
    // «Трактор» on a hockey form had no badge under «Navi · CS2» and read as
    // a team of unknown sport (report from a phone).
    expect(teamSportLabel(t, { sport: 'hockey' })).toBe('«sports.hockey»');
    expect(teamSportLabel(t, { sport: 'esports', discipline: 'csgo' })).toBe('CS2');
    expect(teamSportLabel(t, { sport: 'esports' })).toBe('«sports.esports»');
    expect(src).toContain('const badge = teamSportLabel(t, team);');
    expect(src).not.toMatch(/team\.sport !== sport \?/);
  });

  it('is nothing only when the bets do not say the sport (a later leg of an accumulator)', () => {
    expect(teamSportLabel(t, {})).toBeNull();
  });
});
