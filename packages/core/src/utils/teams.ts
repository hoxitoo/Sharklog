import type { Bet, Team, Sport, EsportsDiscipline } from '../types/bet';
import { parseEventTeams } from './stats';

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

const fromBetsCache = new WeakMap<readonly Bet[], Team[]>();

/**
 * The team list as the bets have it NOW — what the bet form suggests. Every
 * team an event names, under the sport (and, for esports, the discipline) of
 * the bet it is in, with how many bets name it and when one last changed.
 *
 * Not the stored list (`upsertTeams`): that one only ever adds. A bet entered
 * under football by mistake and moved to hockey left the team under both, and
 * the form kept offering it with a «Футбол» badge (report from a phone). Here a
 * bet moved to another sport moves its teams, a deleted bet takes them away.
 *
 * A discipline only on an esports bet: one moved from esports to football keeps
 * its old discipline (the form omits the key and updateBet merges). Of an
 * accumulator, only the first leg's teams: the bet stores that leg's sport, and
 * the other legs' sports are not stored at all — a hockey team in leg two would
 * be filed under the first leg's football, and picking it would switch the form
 * to the wrong sport. Cached per bets array (four team fields ask at once).
 */
export function teamsFromBets(bets: readonly Bet[]): Team[] {
  const hit = fromBetsCache.get(bets);
  if (hit) return hit;
  const byKey = new Map<string, Team>();
  for (const bet of bets) {
    const event = bet.betType === 'express' ? bet.event.split(' / ')[0] ?? '' : bet.event;
    const discipline = bet.sport === 'esports' ? bet.discipline : undefined;
    const when = typeof bet.updatedAt === 'string' ? bet.updatedAt : '';
    for (const raw of parseEventTeams(event)) {
      const name = raw.trim();
      const key = `${bet.sport}|${discipline ?? ''}|${name.toLowerCase()}`;
      const seen = byKey.get(key);
      if (!seen) {
        byKey.set(key, {
          id: key, name, sport: bet.sport, ...(discipline !== undefined ? { discipline } : {}), usageCount: 1, lastUsed: when,
        });
      } else {
        // The spelling of the latest bet: a typo fixed later is the one offered.
        const later = when > seen.lastUsed;
        byKey.set(key, { ...seen, usageCount: seen.usageCount + 1, ...(later ? { name, lastUsed: when } : {}) });
      }
    }
  }
  const out = [...byKey.values()];
  fromBetsCache.set(bets, out);
  return out;
}

/**
 * What picking a known team sets on the bet form: its sport, and for esports
 * its discipline — Spirit as a Dota 2 team sets Киберспорт · Dota 2. Nothing
 * for «Другое»: which sport it was is the free text the team list does not keep.
 */
export function sportOfTeam(team: Pick<Team, 'sport' | 'discipline'>): { sport: Sport; discipline?: EsportsDiscipline } | null {
  if (team.sport === 'other') return null;
  return team.sport === 'esports' && team.discipline ? { sport: 'esports', discipline: team.discipline } : { sport: team.sport };
}
