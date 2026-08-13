import type { Bet, BetStatus, Sport, BetType, Strategy, EsportsDiscipline } from '../types/bet';
import { SPORTS, BET_TYPES, STRATEGIES, ESPORTS_DISCIPLINES, CURRENT_SCHEMA_VERSION } from '../constants/index';
import { betPnl } from './stats';
import { toYmd } from './daily';

// Mobile and desktop each grew their own copy of this parser and drifted: one
// learned "турнир"/"время"/"фрибет", the other learned "кф"/"btts"/"✅", one
// stripped the BOM and detected `;`, the other did neither — so a CSV exported
// on the phone would not import on the PC. One implementation, both apps.

// ── Column recognition ───────────────────────────────────────────────────────

const COL_ALIASES: Record<string, string> = {
  'дата': 'date', 'date': 'date', 'placedat': 'date', 'placed at': 'date', 'placed': 'date',
  'время': 'time', 'time': 'time',
  'событие': 'event', 'event': 'event', 'матч': 'event', 'match': 'event',
  'hometeam': 'homeTeam', 'home team': 'homeTeam', 'home': 'homeTeam', 'хозяева': 'homeTeam',
  'awayteam': 'awayTeam', 'away team': 'awayTeam', 'away': 'awayTeam', 'гости': 'awayTeam',
  'выбор': 'pick', 'pick': 'pick', 'ставка на': 'pick', 'bet': 'pick', 'selection': 'pick',
  'коэф.': 'odds', 'коэф': 'odds', 'коэффициент': 'odds', 'odds': 'odds', 'кф': 'odds',
  'oddsdecimal': 'odds', 'odds decimal': 'odds', 'decimal odds': 'odds',
  'ставка (₽)': 'stake', 'ставка': 'stake', 'stake': 'stake', 'сумма': 'stake', 'amount': 'stake',
  'статус': 'status', 'status': 'status',
  'результат': 'result', 'result': 'result',
  'букмекер': 'bookmaker', 'bookmaker': 'bookmaker', 'бк': 'bookmaker', 'bk': 'bookmaker',
  'стратегия': 'strategy', 'strategy': 'strategy',
  'спорт': 'sport', 'sport': 'sport', 'вид спорта': 'sport',
  'тип ставки': 'betType', 'тип': 'betType', 'bet type': 'betType', 'bettype': 'betType',
  'markettype': 'betType', 'market type': 'betType', 'market': 'betType',
  'заметки': 'notes', 'заметка': 'notes', 'notes': 'notes', 'note': 'notes', 'комментарий': 'notes',
  'турнир': 'tournament', 'лига': 'tournament', 'tournament': 'tournament', 'league': 'tournament',
  'дисциплина': 'discipline', 'discipline': 'discipline',
  'фрибет': 'freebet', 'freebet': 'freebet', 'free bet': 'freebet',
};

const STATUS_MAP: Record<string, BetStatus> = {
  'won': 'won', 'выигрыш': 'won', 'победа': 'won', 'выиграл': 'won', 'win': 'won', 'w': 'won', '✅': 'won',
  'lost': 'lost', 'loss': 'lost', 'lose': 'lost', 'проигрыш': 'lost', 'поражение': 'lost', 'проиграл': 'lost', 'l': 'lost', '❌': 'lost',
  'pending': 'pending', 'ожидание': 'pending', 'ожидает': 'pending', 'в ожидании': 'pending', 'p': 'pending',
  'refund': 'refund', 'возврат': 'refund', 'возвр.': 'refund', 'возвр': 'refund', 'r': 'refund',
  'cashout': 'cashout', 'выкуп': 'cashout', 'cash out': 'cashout', 'c': 'cashout',
};

const SPORT_MAP: Record<string, Sport> = {
  'футбол': 'football', 'football': 'football',
  'хоккей': 'hockey', 'hockey': 'hockey',
  'баскетбол': 'basketball', 'basketball': 'basketball',
  'теннис': 'tennis', 'tennis': 'tennis',
  'киберспорт': 'esports', 'esports': 'esports', 'cybersport': 'esports',
  'волейбол': 'volleyball', 'volleyball': 'volleyball',
  'бейсбол': 'baseball', 'baseball': 'baseball',
  'другое': 'other', 'other': 'other',
};

const BET_TYPE_MAP: Record<string, BetType> = {
  '1x2': '1X2', 'итоговая победа': '1X2', 'победитель матча': '1X2', 'победитель': '1X2', 'winner': '1X2',
  'тотал тб': 'total_over', 'total_over': 'total_over', 'тб': 'total_over', 'over': 'total_over',
  'тотал тм': 'total_under', 'total_under': 'total_under', 'тм': 'total_under', 'under': 'total_under',
  'фора': 'handicap', 'handicap': 'handicap', 'гандикап': 'handicap',
  'обе забьют': 'both_score', 'both_score': 'both_score', 'btts': 'both_score',
  'точный счёт': 'exact_score', 'exact_score': 'exact_score',
  'экспресс': 'express', 'express': 'express',
  'угловые': 'corners', 'corners': 'corners',
  'другое': 'other', 'other': 'other',
};

const STRATEGY_MAP: Record<string, Strategy> = {
  'value': 'value', 'вэлью': 'value',
  'stats': 'stats', 'statistics': 'stats', 'статистика': 'stats',
  'form': 'form', 'форма': 'form',
  'intuition': 'intuition', 'интуиция': 'intuition',
  'system': 'system', 'система': 'system',
  'other': 'other', 'другое': 'other',
};

const DISCIPLINE_MAP: Record<string, EsportsDiscipline> = {
  'dota 2': 'dota2', 'dota2': 'dota2', 'dota': 'dota2', 'дота': 'dota2',
  'cs2': 'csgo', 'csgo': 'csgo', 'cs:go': 'csgo', 'кс': 'csgo',
  'lol': 'lol', 'league of legends': 'lol',
  'valorant': 'valorant', 'вало': 'valorant',
  'pubg': 'pubg',
  'r6': 'r6', 'rainbow six': 'r6',
  'apex': 'apex', 'apex legends': 'apex',
  'другая дисциплина': 'other_esports', 'other_esports': 'other_esports',
};

const TRUTHY = ['да', 'yes', 'true', '1', '+', 'freebet', 'фрибет'];

function normalizeHeader(h: string): string {
  return h.replace(/^﻿/, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Amounts written any way a bookmaker or spreadsheet writes them: "5,000.00 ₽", "1 234,56", "1.85". */
export function parseAmount(raw: string): number {
  const s = raw.replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) {
    return s.lastIndexOf('.') > s.lastIndexOf(',')
      ? parseFloat(s.replace(/,/g, ''))          // "1,234.56" → 1234.56
      : parseFloat(s.replace(/\./g, '').replace(',', '.')); // "1.234,56" → 1234.56
  }
  if (s.includes(',')) {
    const parts = s.split(',');
    const last = parts[parts.length - 1] ?? '';
    // ≤2 trailing digits is a decimal comma ("1234,56"), otherwise thousands ("1,234")
    return last.length <= 2 ? parseFloat(s.replace(',', '.')) : parseFloat(s.replace(/,/g, ''));
  }
  return parseFloat(s);
}

function detectSeparator(line: string): string {
  const tabs = (line.match(/\t/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  if (tabs > semis && tabs > commas) return '\t';
  return semis >= commas ? ';' : ',';
}

function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === sep && !inQuote) {
      result.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

/** Header row = the one in the first 10 rows matching the most known columns. */
function findHeaderRowIndex(rows: string[][]): number {
  const known = new Set(Object.keys(COL_ALIASES));
  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const score = (rows[i] ?? []).filter((c) => known.has(normalizeHeader(String(c ?? '')))).length;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

function rowsToObjects(headers: string[], rows: string[][]): Array<Record<string, string>> {
  const fieldMap: Record<number, string> = {};
  headers.forEach((h, i) => {
    const field = COL_ALIASES[normalizeHeader(String(h ?? ''))];
    if (field) fieldMap[i] = field;
  });
  return rows
    .filter((r) => r.some((c) => c !== ''))
    .map((r) => Object.fromEntries(
      Object.entries(fieldMap).map(([i, field]) => [field, String(r[Number(i)] ?? '')]),
    ));
}

function mapRow(raw: Record<string, string>, newId: () => string): Bet | null {
  const g = (key: string) => (raw[key] ?? '').trim();

  // Event comes from its own column, or from HomeTeam / AwayTeam pairs.
  const homeTeam = g('homeTeam');
  const awayTeam = g('awayTeam');
  let event = g('event');
  if (!event && (homeTeam || awayTeam)) event = [homeTeam, awayTeam].filter(Boolean).join(' vs ');
  if (!event) return null;

  const dateRaw = g('date');
  let date = dateRaw;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateRaw)) {
    const [d, m, y] = dateRaw.split('.');
    date = `${y}-${m}-${d}`;
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateRaw)) {
    const [d, m, y] = dateRaw.split('/');
    date = `${y}-${m}-${d}`;
  }
  if (!date) date = toYmd(new Date());

  const odds = parseAmount(g('odds'));
  if (isNaN(odds) || odds <= 1) return null;

  const stakeUnits = parseAmount(g('stake'));
  if (isNaN(stakeUnits) || stakeUnits <= 0) return null;

  // "result" wins over "status": some exports put workflow state in the latter.
  const status: BetStatus =
    STATUS_MAP[g('result').toLowerCase()] ?? STATUS_MAP[g('status').toLowerCase()] ?? 'pending';

  // Unknown values fall back to a valid enum member — casting the raw string
  // through would render as a blank cell everywhere in the app.
  const sport: Sport = SPORT_MAP[g('sport').toLowerCase()] ?? 'other';
  const betType: BetType = BET_TYPE_MAP[g('betType').toLowerCase()] ?? '1X2';
  const strategy: Strategy = STRATEGY_MAP[g('strategy').toLowerCase()] ?? 'other';
  const discipline = DISCIPLINE_MAP[g('discipline').toLowerCase()];

  const time = /^\d{1,2}:\d{2}/.test(g('time')) ? g('time').slice(0, 5) : '00:00';
  const now = new Date().toISOString();

  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    date,
    time,
    sport,
    bookmaker: g('bookmaker') || 'Другой',
    event,
    betType,
    pick: g('pick') || '—',
    odds,
    stake: Math.round(stakeUnits * 100),
    status,
    strategy,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...(g('notes') ? { notes: g('notes') } : {}),
    ...(g('tournament') ? { tournament: g('tournament') } : {}),
    ...(discipline ? { discipline } : {}),
    ...(TRUTHY.includes(g('freebet').toLowerCase()) ? { isFreebet: true } : {}),
  };
}

export interface ImportResult {
  bets: Bet[];
  skipped: number;
  total: number;
}

/** Table already split into cells (XLSX sheets, clipboard grids). */
export function importBetsFromRows(rows: string[][], newId: () => string): ImportResult {
  const headerIdx = findHeaderRowIndex(rows);
  const objects = rowsToObjects(rows[headerIdx] ?? [], rows.slice(headerIdx + 1));

  const bets: Bet[] = [];
  let skipped = 0;
  for (const obj of objects) {
    const bet = mapRow(obj, newId);
    if (bet) bets.push(bet);
    else skipped++;
  }
  return { bets, skipped, total: objects.length };
}

/** Raw CSV/TSV text — BOM, line endings and separator are all detected. */
export function importBetsFromCSV(content: string, newId: () => string): ImportResult {
  const text = content.replace(/^﻿/, '');
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { bets: [], skipped: 0, total: 0 };

  const sep = detectSeparator(lines[0]!);
  return importBetsFromRows(lines.map((l) => parseCSVLine(l, sep)), newId);
}

// ── Export ───────────────────────────────────────────────────────────────────

export const CSV_HEADERS = [
  'Дата', 'Время', 'Событие', 'Выбор', 'Коэф.', 'Ставка (₽)', 'Статус',
  'P&L (₽)', 'Спорт', 'Тип', 'Стратегия', 'Букмекер', 'Турнир', 'Дисциплина',
  'Фрибет', 'Заметки',
] as const;

function escapeCell(value: string | number, sep: string): string {
  let str = String(value);
  // CSV/formula injection: a text cell starting with = + - @ (or a control char)
  // is executed as a formula by Excel/Sheets. Numbers are passed as `number`, so
  // signed amounts stay intact.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (str.includes(sep) || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * One CSV writer for both apps, so an export from the phone imports on the PC.
 * Returns the body only — the BOM and the file write belong to the caller.
 */
export function buildBetsCSV(bets: Bet[], sep = ';'): string {
  const rows = bets.map((b) => [
    b.date,
    b.time,
    b.event,
    b.pick,
    b.odds,
    b.stake / 100,
    b.status,
    // Refunds are 0, cashouts are what was actually returned, a lost freebet
    // costs nothing — the one place this must not be re-derived by hand.
    betPnl(b) / 100,
    SPORTS[b.sport] ?? b.sport,
    BET_TYPES[b.betType] ?? b.betType,
    STRATEGIES[b.strategy] ?? b.strategy,
    b.bookmaker,
    b.tournament ?? '',
    b.discipline ? (ESPORTS_DISCIPLINES[b.discipline] ?? b.discipline) : '',
    b.isFreebet ? 'Да' : '',
    b.notes ?? '',
  ]);

  return [[...CSV_HEADERS], ...rows]
    .map((row) => row.map((cell) => escapeCell(cell, sep)).join(sep))
    .join('\n');
}
