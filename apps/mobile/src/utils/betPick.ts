import { BET_TYPES, PICK, type BetType } from '@sharklog/core';

/*
 * The bet form's pick, both ways: what it STORES from its fields, and how it
 * reads a stored pick back into those fields when a bet is edited or copied.
 * The two live together so a round trip can be tested — the screen itself has
 * a React Native runtime jest does not load. Stored picks are a data format
 * (`PICK` in core, always Russian), see `core/__tests__/pickTokens.test.ts`.
 */

export interface PickFields {
  betType: BetType;
  pick1x2: 'home' | 'draw' | 'away';
  team1: string;
  team2: string;
  handicapSide: 'home' | 'away';
  pickValue: string;
  bothScoreYes: boolean;
  customBetType: string;
}

/** The stored pick for a single bet. */
export function composePick(d: PickFields): string {
  const pv = d.pickValue.trim();
  if (d.betType === '1X2') {
    return d.pick1x2 === 'home' ? (d.team1.trim() || PICK.HOME)
         : d.pick1x2 === 'away' ? (d.team2.trim() || PICK.AWAY)
         : PICK.DRAW;
  }
  if (d.betType === 'handicap') {
    const side = d.handicapSide === 'home' ? PICK.HANDICAP_HOME : PICK.HANDICAP_AWAY;
    return pv ? `${side} (${pv})` : side;
  }
  if (d.betType === 'total_over') return pv ? `${PICK.OVER} ${pv}` : PICK.OVER;
  if (d.betType === 'total_under') return pv ? `${PICK.UNDER} ${pv}` : PICK.UNDER;
  if (d.betType === 'both_score') return d.bothScoreYes ? PICK.YES : PICK.NO;
  if (d.betType === 'exact_score') return pv || '—';
  if (d.betType === 'other' && d.customBetType.trim()) return d.customBetType.trim();
  // A type with no finer pick saves its core (Russian) name, which pickLabel()
  // translates for display. Never the translated name here.
  return BET_TYPES[d.betType] ?? '—';
}

/** A stored pick without its leading token: "ТБ 2.5" → "2.5". */
function afterToken(pick: string, token: string): string {
  return (pick.startsWith(token) ? pick.slice(token.length) : pick).trim();
}

/**
 * The line of a stored handicap exactly as it was typed: "Ф1 (-6.5)" → "-6.5".
 * NOT the first number in the string — that is the "1" of "Ф1" (the "2" of
 * "Ф2"), and editing a handicap bet put 1 in the field and saved "Ф1 (1)".
 */
function handicapLine(pick: string): string {
  const s = pick.trim();
  const token = [PICK.HANDICAP_HOME, PICK.HANDICAP_AWAY].find((tk) => s.startsWith(tk));
  if (token) {
    const rest = s.slice(token.length).trim();
    const inner = /^\((.*)\)$/.exec(rest);
    return (inner ? inner[1]! : rest).trim();
  }
  // Not the form's own format (an import, a hand-typed pick): the last
  // bracketed group, else the last number.
  const group = /\(([^()]*)\)\s*$/.exec(s);
  if (group) return group[1]!.trim();
  const numbers = s.match(/[+\-−]?\d+(?:[.,]\d+)?/g);
  return numbers ? numbers[numbers.length - 1]! : '';
}

/** A stored pick back into the form's fields. */
export function parseEditPick(betType: BetType, pick: string): {
  handicapSide: 'home' | 'away';
  pickValue: string;
  bothScoreYes: boolean;
} {
  if (betType === 'handicap') {
    const side: 'home' | 'away' = pick.trim().startsWith(PICK.HANDICAP_AWAY) ? 'away' : 'home';
    return { handicapSide: side, pickValue: handicapLine(pick), bothScoreYes: true };
  }
  if (betType === 'total_over') {
    return { handicapSide: 'home', pickValue: afterToken(pick, PICK.OVER), bothScoreYes: true };
  }
  if (betType === 'total_under') {
    return { handicapSide: 'home', pickValue: afterToken(pick, PICK.UNDER), bothScoreYes: true };
  }
  if (betType === 'exact_score') {
    return { handicapSide: 'home', pickValue: pick, bothScoreYes: true };
  }
  if (betType === 'both_score') {
    return { handicapSide: 'home', pickValue: '', bothScoreYes: pick !== PICK.NO };
  }
  return { handicapSide: 'home', pickValue: '', bothScoreYes: true };
}
