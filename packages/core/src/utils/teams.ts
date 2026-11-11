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

/** A team the bet form can suggest. No `sport` when the bets do not say which (later legs of an accumulator). */
export interface TeamSuggestion {
  id: string;
  name: string;
  sport?: Sport;
  discipline?: EsportsDiscipline;
  usageCount: number;
  lastUsed: string;
}

const fromBetsCache = new WeakMap<readonly Bet[], TeamSuggestion[]>();

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
 * accumulator, the first leg's teams carry the bet's sport — the one stored —
 * and the other legs' teams carry none: their sports are not stored, and filed
 * under the first leg's sport a hockey team in leg two would be "football", and
 * picking it would switch the form. Such a team is still suggested (a user of
 * accumulators lost most suggestions without it), with no badge, unless it is
 * already known with a sport. Cached per bets array.
 */
export function teamsFromBets(bets: readonly Bet[]): TeamSuggestion[] {
  const hit = fromBetsCache.get(bets);
  if (hit) return hit;
  const byKey = new Map<string, TeamSuggestion>();
  const add = (raw: string, sport: Sport | undefined, discipline: EsportsDiscipline | undefined, when: string) => {
    const name = raw.trim();
    const key = `${sport ?? '?'}|${discipline ?? ''}|${name.toLowerCase()}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, {
        id: key, name, ...(sport !== undefined ? { sport } : {}), ...(discipline !== undefined ? { discipline } : {}),
        usageCount: 1, lastUsed: when,
      });
    } else {
      // The spelling of the latest bet: a typo fixed later is the one offered.
      const later = when > seen.lastUsed;
      byKey.set(key, { ...seen, usageCount: seen.usageCount + 1, ...(later ? { name, lastUsed: when } : {}) });
    }
  };
  for (const bet of bets) {
    const discipline = bet.sport === 'esports' ? bet.discipline : undefined;
    const when = typeof bet.updatedAt === 'string' ? bet.updatedAt : '';
    const legs = bet.betType === 'express' ? bet.event.split(' / ') : [bet.event];
    legs.forEach((leg, i) => {
      for (const name of parseEventTeams(leg)) {
        if (i === 0) add(name, bet.sport, discipline, when);
        else add(name, undefined, undefined, when);
      }
    });
  }
  const known = new Set<string>();
  for (const t of byKey.values()) if (t.sport !== undefined) known.add(t.name.toLowerCase());
  const out = [...byKey.values()].filter((t) => t.sport !== undefined || !known.has(t.name.toLowerCase()));
  fromBetsCache.set(bets, out);
  return out;
}

/**
 * What picking a known team sets on the bet form: its sport, and for esports
 * its discipline — Spirit as a Dota 2 team sets Киберспорт · Dota 2. Nothing
 * for «Другое» (which sport it was is free text the list does not keep) or for
 * a team whose sport the bets do not say.
 */
export function sportOfTeam(team: { sport?: Sport; discipline?: EsportsDiscipline }): { sport: Sport; discipline?: EsportsDiscipline } | null {
  if (team.sport === undefined || team.sport === 'other') return null;
  return team.sport === 'esports' && team.discipline ? { sport: 'esports', discipline: team.discipline } : { sport: team.sport };
}
