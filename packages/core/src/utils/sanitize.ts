import type { Bet, BetStatus, Bankroll, BankrollTransaction, DiaryEntry, Team } from '../types/bet';
import { CURRENT_SCHEMA_VERSION } from '../constants/index';

/*
 * Data that did not come from the app's own writes — a JSON backup someone
 * handed over, a stored file damaged mid-write — is checked before any screen
 * sees it. Every screen assumes `bet.event` is a string and `bet.odds` a
 * number; one record with `event: null` crashed each screen that splits the
 * event into teams, on every launch, with no way out short of clearing all data.
 *
 * Either way only what would CRASH a screen is dropped (not a string where a
 * string is read, not a number where one is counted, a status the app does
 * not know). Older versions stored some values loosely — the CSV import kept a
 * date it could not read as it was, the old desktop import left an empty sport
 * — and the user's OWN backup carries them to a new phone: refusing them there
 * would lose bets the old phone shows fine. The two modes differ in mending:
 * - `import` (a backup file): dates in a recognisable form become YYYY-MM-DD,
 *   an empty sport / bet type / strategy becomes "other", a broken timestamp
 *   gets the day's start, a non-positive odds or negative stake is refused;
 * - `stored` (the app's own file at launch): nothing is touched at all.
 *
 * Either way a record without what makes it a record is DROPPED and counted,
 * so the caller can say how many; a broken OPTIONAL field is removed and the
 * record kept. Unknown sports, bet types and strategies stay — screens show
 * such values as stored.
 */

export type SanitizeMode = 'import' | 'stored';

const STATUSES: readonly BetStatus[] = ['pending', 'won', 'lost', 'refund', 'cashout'];
const TX_TYPES: readonly BankrollTransaction['type'][] = ['deposit', 'withdrawal', 'adjustment'];

export interface Sanitized<T> {
  items: T[];
  /** Records that could not be kept. */
  dropped: number;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isTimestamp = (v: unknown): v is string => str(v) && Number.isFinite(new Date(v).getTime());

function isCalendarDay(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * A day as YYYY-MM-DD, from the forms people and exports write it in:
 * `2026-10-01`, `2026-10-01T19:30…`, `1.10.2026`, `01/10/2026`. Null if it is
 * not a real calendar day (2026-02-30 is not).
 */
export function normalizeDay(v: unknown): string | null {
  if (!str(v)) return null;
  const s = v.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  if (!isCalendarDay(y, m, d)) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Copy only the optional fields whose type is right. */
function optional(src: Obj, out: Obj, fields: Record<string, (v: unknown) => boolean>): void {
  for (const [k, ok] of Object.entries(fields)) {
    if (src[k] !== undefined && ok(src[k])) out[k] = src[k];
  }
}

export function sanitizeBet(raw: unknown, mode: SanitizeMode = 'import'): Bet | null {
  if (!isObj(raw)) return null;
  const b = raw;
  const strict = mode === 'import';
  if (!str(b['id']) || b['id'] === '') return null;
  if (!STATUSES.includes(b['status'] as BetStatus)) return null;
  if (!num(b['odds']) || !num(b['stake'])) return null;
  if (strict && (b['odds'] <= 0 || b['stake'] < 0)) return null;
  if (!str(b['event'])) return null;
  for (const k of ['sport', 'betType', 'strategy'] as const) if (!str(b[k])) return null;
  if (!str(b['date'])) return null;
  const date = (strict ? normalizeDay(b['date']) : null) ?? b['date'];
  const orOther = (v: string) => (strict && v === '' ? 'other' : v);

  const fallbackTs = `${date}T00:00:00`;
  const okTs = strict ? isTimestamp : str;
  const time = str(b['time'])
    ? (strict && /^\d{1,2}:\d{2}/.test(b['time']) ? b['time'].slice(0, 5) : b['time'])
    // A missing time is no reason to lose a bet: "00:00" puts it at the start
    // of its day, which is where an unknown time belongs.
    : '00:00';
  const out: Obj = {
    id: b['id'],
    createdAt: okTs(b['createdAt']) ? b['createdAt'] : fallbackTs,
    updatedAt: okTs(b['updatedAt']) ? b['updatedAt'] : fallbackTs,
    date,
    time,
    sport: orOther(b['sport'] as string),
    bookmaker: str(b['bookmaker']) ? b['bookmaker'] : '',
    event: b['event'],
    betType: orOther(b['betType'] as string),
    pick: str(b['pick']) ? b['pick'] : '',
    odds: b['odds'],
    stake: b['stake'],
    status: b['status'],
    strategy: orOther(b['strategy'] as string),
    schemaVersion: num(b['schemaVersion']) ? b['schemaVersion'] : CURRENT_SCHEMA_VERSION,
  };
  optional(b, out, {
    closingOdds: (v) => num(v) && (!strict || v > 0),
    cashoutAmount: (v) => num(v) && (!strict || v >= 0),
    isFreebet: (v) => typeof v === 'boolean',
    notes: str, tournament: str, discipline: str,
    customSport: str, customBetType: str, customStrategy: str,
  });
  return out as unknown as Bet;
}

/**
 * Bets that can be shown. Of two records under one id — two make every edit
 * hit both, and React's list keys collide — the one edited LAST stays: the old
 * "add to current" restore put the backup's copies first, so the first copy
 * was often the stale pending one of a bet settled since.
 */
export function sanitizeBets(raw: unknown, mode: SanitizeMode = 'import'): Sanitized<Bet> {
  if (!Array.isArray(raw)) return { items: [], dropped: 0 };
  const at = new Map<string, number>();
  const items: Bet[] = [];
  let dropped = 0;
  for (const r of raw) {
    const bet = sanitizeBet(r, mode);
    if (!bet) { dropped++; continue; }
    const i = at.get(bet.id);
    if (i === undefined) {
      at.set(bet.id, items.length);
      items.push(bet);
      continue;
    }
    dropped++;
    if (Date.parse(bet.updatedAt) > Date.parse(items[i]!.updatedAt)) items[i] = bet;
  }
  return { items, dropped };
}

/** The same in both modes: an old negative withdrawal stays — dropping it would move the bank. */
export function sanitizeTransaction(raw: unknown): BankrollTransaction | null {
  if (!isObj(raw)) return null;
  const t = raw;
  if (!str(t['id']) || t['id'] === '') return null;
  if (!TX_TYPES.includes(t['type'] as BankrollTransaction['type'])) return null;
  if (!num(t['amount'])) return null;
  if (!str(t['date'])) return null;
  const out: Obj = { id: t['id'], type: t['type'], amount: t['amount'], date: t['date'] };
  optional(t, out, { note: str });
  return out as unknown as BankrollTransaction;
}

/**
 * The fields of a bankroll that check out, to merge over the current one —
 * never a whole object from the file.
 */
export function sanitizeBankroll(raw: unknown): { bankroll: Partial<Bankroll>; dropped: number } {
  if (!isObj(raw)) return { bankroll: {}, dropped: 0 };
  const out: Partial<Bankroll> = {};
  let dropped = 0;
  if (str(raw['id'])) out.id = raw['id'];
  if (str(raw['name'])) out.name = raw['name'];
  if (str(raw['currency'])) out.currency = raw['currency'];
  if (num(raw['unitPercent']) && raw['unitPercent'] > 0 && raw['unitPercent'] <= 100) out.unitPercent = raw['unitPercent'];
  if (str(raw['createdAt'])) out.createdAt = raw['createdAt'];
  if (Array.isArray(raw['transactions'])) {
    const seen = new Set<string>();
    const txs: BankrollTransaction[] = [];
    for (const r of raw['transactions']) {
      const tx = sanitizeTransaction(r);
      if (!tx || seen.has(tx.id)) { dropped++; continue; }
      seen.add(tx.id);
      txs.push(tx);
    }
    out.transactions = txs;
  }
  return { bankroll: out, dropped };
}

export function sanitizeDiary(raw: unknown, mode: SanitizeMode = 'import'): Sanitized<DiaryEntry> {
  if (!Array.isArray(raw)) return { items: [], dropped: 0 };
  const items: DiaryEntry[] = [];
  let dropped = 0;
  for (const r of raw) {
    const day = isObj(r) && str(r['date']) ? (mode === 'import' ? normalizeDay(r['date']) : null) ?? r['date'] : null;
    if (!isObj(r) || !str(r['id']) || !day || ![1, 2, 3, 4, 5].includes(r['mood'] as number)) { dropped++; continue; }
    const out: Obj = { id: r['id'], date: day, mood: r['mood'] };
    optional(r, out, { text: str });
    items.push(out as unknown as DiaryEntry);
  }
  return { items, dropped };
}

export function sanitizeTeams(raw: unknown): Sanitized<Team> {
  if (!Array.isArray(raw)) return { items: [], dropped: 0 };
  const items: Team[] = [];
  let dropped = 0;
  for (const r of raw) {
    if (!isObj(r) || !str(r['id']) || !str(r['name']) || r['name'] === '' || !str(r['sport'])) { dropped++; continue; }
    const out: Obj = {
      id: r['id'], name: r['name'], sport: r['sport'],
      usageCount: num(r['usageCount']) && r['usageCount'] >= 0 ? r['usageCount'] : 1,
      lastUsed: str(r['lastUsed']) ? r['lastUsed'] : new Date(0).toISOString(),
    };
    optional(r, out, { discipline: str });
    items.push(out as unknown as Team);
  }
  return { items, dropped };
}
