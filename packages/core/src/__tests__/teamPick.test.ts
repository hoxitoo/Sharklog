import { describe, it, expect } from 'vitest';
import { choiceAfterPick, choiceAfterClear, type SportChoice } from '../utils/teams';

/*
 * What picking a known team does to the bet form's sport and discipline.
 * Picking sets them (Spirit as a Dota 2 team → Киберспорт · Dota 2) — but not
 * over a choice already made: the user's (the picker, or the saved bet being
 * edited) or the other team field's. Without that, «Спартак» known only from
 * football, picked on a form switched to hockey, switched it back (review,
 * 2026-11-11).
 */
const fresh: SportChoice = { sport: 'football', discipline: 'csgo' };
const spiritDota = { sport: 'esports' as const, discipline: 'dota2' as const };
const spartakFootball = { sport: 'football' as const };
const akBarsHockey = { sport: 'hockey' as const };

describe('choiceAfterPick', () => {
  it('sets the sport and discipline on a form nobody has chosen for', () => {
    expect(choiceAfterPick(fresh, 'team1', spiritDota)).toEqual({
      sport: 'esports', discipline: 'dota2', sportFrom: 'team1', disciplineFrom: 'team1',
    });
    expect(choiceAfterPick(fresh, 'team1', akBarsHockey)).toEqual({ sport: 'hockey', discipline: 'csgo', sportFrom: 'team1' });
  });

  it('does not override the sport the user chose', () => {
    const chosen: SportChoice = { sport: 'hockey', discipline: 'csgo', sportFrom: 'user' };
    expect(choiceAfterPick(chosen, 'team1', spartakFootball)).toBe(chosen);
  });

  it('does not let the second team override the first', () => {
    const afterFirst = choiceAfterPick(fresh, 'team1', akBarsHockey);
    expect(choiceAfterPick(afterFirst, 'team2', spartakFootball).sport).toBe('hockey');
  });

  it('lets a pick in the same field again correct a wrong one', () => {
    const wrong = choiceAfterPick(fresh, 'team1', spartakFootball);
    expect(choiceAfterPick({ ...wrong, sport: 'football' }, 'team1', akBarsHockey).sport).toBe('hockey');
  });

  it('fills the discipline of a form the user switched to esports', () => {
    const esports: SportChoice = { sport: 'esports', discipline: 'csgo', sportFrom: 'user' };
    expect(choiceAfterPick(esports, 'team2', spiritDota)).toEqual({ ...esports, discipline: 'dota2', disciplineFrom: 'team2' });
    // …but not the discipline the user chose too.
    const both: SportChoice = { ...esports, disciplineFrom: 'user' };
    expect(choiceAfterPick(both, 'team2', spiritDota)).toBe(both);
  });

  it('does not set a discipline on a form that is not esports', () => {
    const hockey: SportChoice = { sport: 'hockey', discipline: 'csgo', sportFrom: 'user' };
    expect(choiceAfterPick(hockey, 'team1', spiritDota)).toBe(hockey);
  });

  it('keeps the rest of an accumulator leg', () => {
    const leg = { ...fresh, team1: 'Spirit', odds: '1.8' };
    expect(choiceAfterPick(leg, 'team1', spiritDota)).toMatchObject({ team1: 'Spirit', odds: '1.8', sport: 'esports' });
  });

  it('changes nothing for «Другое» or a team whose sport the bets do not say', () => {
    expect(choiceAfterPick(fresh, 'team1', { sport: 'other' })).toBe(fresh);
    expect(choiceAfterPick(fresh, 'team1', {})).toBe(fresh);
  });

  it('frees the sport a field set once that field is emptied — not the user\'s choice', () => {
    const picked = choiceAfterPick(fresh, 'team1', akBarsHockey);
    const cleared = choiceAfterClear(picked, 'team1');
    expect(cleared.sportFrom).toBeUndefined();
    expect(choiceAfterPick(cleared, 'team2', spartakFootball).sport).toBe('football');
    const chosen: SportChoice = { sport: 'hockey', discipline: 'csgo', sportFrom: 'user' };
    expect(choiceAfterClear(chosen, 'team1')).toBe(chosen);
  });
});
