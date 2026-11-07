import type { Team, Sport, EsportsDiscipline } from '../types/bet';

/*
 * The team list both apps build from the events the user enters (autocomplete
 * in the bet form). The mobile and desktop stores each had a copy of these.
 */

/**
 * A clean team name never contains the express encoding (`|odds`, ` / ` between
 * legs). Drops entries an old name extractor stored from a whole express event
 * ("Yellow submarine|1.45 / Reconix"). Not the shape check — that is
 * `sanitizeTeams` (sanitize.ts), for data from outside.
 */
export function cleanTeamNames(teams: Team[]): Team[] {
  return teams.filter((t) => !t.name.includes('|') && !t.name.includes(' / '));
}

/**
 * Counts one more use of each name — the same name (any case), sport and
 * discipline is one team — and adds the names not seen yet. A new team takes
 * its id from `newId`: the apps generate ids differently (mobile has a fallback
 * for Hermes without `crypto`). Returns a new array; `existing` is not changed.
 */
export function upsertTeams(
  existing: Team[],
  names: string[],
  sport: Sport,
  discipline: EsportsDiscipline | undefined,
  newId: () => string,
  now: Date = new Date(),
): Team[] {
  const result = [...existing];
  const stamp = now.toISOString();
  for (const name of names) {
    const idx = result.findIndex(
      (t) => t.name.toLowerCase() === name.toLowerCase() && t.sport === sport && t.discipline === discipline,
    );
    if (idx >= 0) {
      result[idx] = { ...result[idx]!, usageCount: result[idx]!.usageCount + 1, lastUsed: stamp };
    } else {
      result.push({
        id: newId(), name, sport, ...(discipline !== undefined ? { discipline } : {}), usageCount: 1, lastUsed: stamp,
      });
    }
  }
  return result;
}
