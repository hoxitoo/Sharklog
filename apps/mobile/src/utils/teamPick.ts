import { sportOfTeam } from '@sharklog/core';
import type { Sport, EsportsDiscipline } from '@sharklog/core';

/** Who set the bet form's sport: the user (a picker, or the saved bet being edited), or a team picked in one of the two fields. */
export type PickSource = 'user' | 'team1' | 'team2';

/** The form's sport and discipline, and who set each. A leg of an accumulator has its own. */
export interface SportChoice {
  sport: Sport;
  discipline: EsportsDiscipline;
  sportFrom?: PickSource | undefined;
  disciplineFrom?: PickSource | undefined;
}

const mayPick = (from: PickSource | undefined, field: 'team1' | 'team2') => from === undefined || from === field;

/**
 * The form after a known team is picked from the suggestions: its sport, and
 * for esports its discipline (sportOfTeam — Spirit as a Dota 2 team sets
 * Киберспорт · Dota 2), unless the user chose it or the OTHER team field did.
 * Without that, «Спартак» known only from football, picked on a form already
 * switched to hockey, switched it back to football, and a second team known
 * under another sport overrode the first. A pick in the same field again does
 * set it — that is how a wrong pick is corrected. The discipline is decided on
 * its own: a form the user switched to esports still takes Dota 2 from Spirit.
 */
export function choiceAfterPick<T extends SportChoice>(
  cur: T, field: 'team1' | 'team2', team: { sport?: Sport; discipline?: EsportsDiscipline },
): T {
  const s = sportOfTeam(team);
  if (!s) return cur;
  const takeSport = mayPick(cur.sportFrom, field);
  const sport = takeSport ? s.sport : cur.sport;
  const discipline = s.discipline !== undefined && sport === 'esports' && mayPick(cur.disciplineFrom, field)
    ? s.discipline : undefined;
  if (!takeSport && discipline === undefined) return cur;
  return {
    ...cur,
    ...(takeSport ? { sport, sportFrom: field } : {}),
    ...(discipline !== undefined ? { discipline, disciplineFrom: field } : {}),
  };
}
