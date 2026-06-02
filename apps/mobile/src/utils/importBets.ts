import type { Bet, BetStatus, Sport, BetType, Strategy, EsportsDiscipline } from '@sharklog/core';
import { CURRENT_SCHEMA_VERSION } from '@sharklog/core';

function uuid(): string {
  const c = (globalThis as any).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);
    buf[6] = (buf[6]! & 0x0f) | 0x40;
    buf[8] = (buf[8]! & 0x3f) | 0x80;
    let s = '';
    for (let i = 0; i < 16; i++) {
      if (i === 4 || i === 6 || i === 8 || i === 10) s += '-';
      s += buf[i]!.toString(16).padStart(2, '0');
    }
    return s;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const COL_ALIASES: Record<string, string> = {
  'дата': 'date', 'date': 'date',
  'событие': 'event', 'event': 'event', 'матч': 'event', 'match': 'event',
  'hometeam': 'homeTeam', 'home': 'homeTeam', 'хозяева': 'homeTeam',
  'awayteam': 'awayTeam', 'away': 'awayTeam', 'гости': 'awayTeam',
  'выбор': 'pick', 'pick': 'pick', 'bet': 'pick', 'selection': 'pick',
  'коэф.': 'odds', 'коэф': 'odds', 'коэффициент': 'odds', 'odds': 'odds',
  'ставка (₽)': 'stake', 'ставка': 'stake', 'stake': 'stake', 'сумма': 'stake', 'amount': 'stake',
  'статус': 'status', 'status': 'status',
  'результат': 'result', 'result': 'result',
  'букмекер': 'bookmaker', 'bookmaker': 'bookmaker', 'бк': 'bookmaker',
  'стратегия': 'strategy', 'strategy': 'strategy',
  'спорт': 'sport', 'sport': 'sport',
  'тип ставки': 'betType', 'тип': 'betType', 'bet type': 'betType', 'bettype': 'betType',
  'заметки': 'notes', 'заметка': 'notes', 'notes': 'notes',
  'турнир': 'tournament', 'лига': 'tournament', 'tournament': 'tournament',
  'время': 'time', 'time': 'time',
};

const STATUS_MAP: Record<string, BetStatus> = {
  'won': 'won', 'выигрыш': 'won', 'победа': 'won', 'win': 'won', 'w': 'won',
  'lost': 'lost', 'loss': 'lost', 'проигрыш': 'lost', 'поражение': 'lost', 'l': 'lost',
  'pending': 'pending', 'ожидание': 'pending', 'ожидает': 'pending', 'p': 'pending',
  'refund': 'refund', 'возврат': 'refund', 'r': 'refund',
  'cashout': 'cashout', 'выкуп': 'cashout', 'cash out': 'cashout', 'c': 'cashout',
};

const SPORT_MAP: Record<string, Sport> = {
  'футбол': 'football', 'football': 'football',
  'хоккей': 'hockey', 'hockey': 'hockey',
  'баскетбол': 'basketball', 'basketball': 'basketball',
  'теннис': 'tennis', 'tennis': 'tennis',
  'киберспорт': 'esports', 'esports': 'esports',
  'волейбол': 'volleyball', 'volleyball': 'volleyball',
  'бейсбол': 'baseball', 'baseball': 'baseball',
  'другое': 'other', 'other': 'other',
};

const BET_TYPE_MAP: Record<string, BetType> = {
  '1x2': '1X2', '1X2': '1X2', 'победитель': '1X2', 'winner': '1X2',
  'тотал тб': 'total_over', 'total_over': 'total_over', 'тб': 'total_over', 'over': 'total_over',
  'тотал тм': 'total_under', 'total_under': 'total_under', 'тм': 'total_under', 'under': 'total_under',
  'фора': 'handicap', 'handicap': 'handicap', 'гандикап': 'handicap',
  'обе забьют': 'both_score', 'both_score': 'both_score',
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
  'dota 2': 'dota2', 'dota2': 'dota2', 'дота': 'dota2',
  'cs2': 'csgo', 'csgo': 'csgo', 'кс': 'csgo',
  'lol': 'lol', 'valorant': 'valorant',
  'pubg': 'pubg', 'r6': 'r6', 'apex': 'apex',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, ' ');
}

function parseAmount(raw: string): number {
  const s = raw.replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) {
    return s.lastIndexOf('.') > s.lastIndexOf(',')
      ? parseFloat(s.replace(/,/g, ''))
      : parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  if (s.includes(',')) {
    const parts = s.split(',');
    const last = parts[parts.length - 1] ?? '';
    return last.length <= 2 ? parseFloat(s.replace(',', '.')) : parseFloat(s.replace(/,/g, ''));
  }
  return parseFloat(s);
}

function detectSeparator(line: string): string {
  const semis = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
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

function findHeaderRowIndex(rows: string[][]): number {
  const known = new Set(Object.keys(COL_ALIASES));
  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const score = (rows[i] ?? []).filter(c => known.has(normalizeHeader(String(c)))).length;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

function rowsToObjects(headers: string[], rows: string[][]): Array<Record<string, string>> {
  const fieldMap: Record<number, string> = {};
  headers.forEach((h, i) => {
    const field = COL_ALIASES[normalizeHeader(h)];
    if (field) fieldMap[i] = field;
  });
  return rows
    .filter(r => r.some(c => c !== ''))
    .map(r => Object.fromEntries(
      Object.entries(fieldMap).map(([i, field]) => [field, r[Number(i)] ?? ''])
    ));
}

function mapRow(raw: Record<string, string>): Bet | null {
  const g = (key: string) => (raw[key] ?? '').trim();

  const homeTeam = g('homeTeam');
  const awayTeam = g('awayTeam');
  let event = g('event');
  if (!event && (homeTeam || awayTeam)) {
    event = [homeTeam, awayTeam].filter(Boolean).join(' vs ');
  }
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
  if (!date) date = new Date().toISOString().split('T')[0] ?? '';

  const odds = parseAmount(g('odds'));
  if (isNaN(odds) || odds <= 1) return null;

  const stakeRubles = parseAmount(g('stake'));
  if (isNaN(stakeRubles) || stakeRubles <= 0) return null;

  const resultRaw = g('result').toLowerCase();
  const statusRaw = g('status').toLowerCase();
  const status: BetStatus = STATUS_MAP[resultRaw] ?? STATUS_MAP[statusRaw] ?? 'pending';

  const sportRaw = g('sport').toLowerCase();
  const sport: Sport = SPORT_MAP[sportRaw] ?? 'other';

  const betTypeRaw = g('betType').toLowerCase();
  const betType: BetType = BET_TYPE_MAP[betTypeRaw] ?? '1X2';

  const strategyRaw = g('strategy').toLowerCase();
  const strategy: Strategy = STRATEGY_MAP[strategyRaw] ?? 'other';

  const disciplineRaw = g('discipline')?.toLowerCase() ?? '';
  const discipline = DISCIPLINE_MAP[disciplineRaw] as EsportsDiscipline | undefined;

  const now = new Date().toISOString();
  return {
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    date,
    time: g('time') || '00:00',
    sport,
    bookmaker: g('bookmaker') || 'Другой',
    event,
    betType,
    pick: g('pick') || '—',
    odds,
    stake: Math.round(stakeRubles * 100),
    status,
    strategy,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...(g('notes') ? { notes: g('notes') } : {}),
    ...(g('tournament') ? { tournament: g('tournament') } : {}),
    ...(discipline ? { discipline } : {}),
  };
}

export interface ImportResult {
  bets: Bet[];
  skipped: number;
  total: number;
}

export function importFromCSV(content: string): ImportResult {
  // Strip UTF-8 BOM if present
  const text = content.replace(/^﻿/, '');
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length < 2) return { bets: [], skipped: 0, total: 0 };

  const sep = detectSeparator(nonEmpty[0]!);
  const allRows = nonEmpty.map(l => parseCSVLine(l, sep));
  const headerIdx = findHeaderRowIndex(allRows);
  const headers = allRows[headerIdx] ?? [];
  const rows = allRows.slice(headerIdx + 1);
  const objects = rowsToObjects(headers, rows);

  const bets: Bet[] = [];
  let skipped = 0;
  for (const obj of objects) {
    const bet = mapRow(obj);
    if (bet) bets.push(bet);
    else skipped++;
  }
  return { bets, skipped, total: objects.length };
}

export interface JSONBackup {
  bets: Bet[];
  settings?: Record<string, unknown>;
  bankroll?: Record<string, unknown>;
  diary?: unknown[];
  teams?: unknown[];
}

export function importFromJSON(content: string): JSONBackup | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (!Array.isArray(parsed['bets'])) return null;
    return {
      bets: parsed['bets'] as Bet[],
      ...(parsed['settings'] ? { settings: parsed['settings'] as Record<string, unknown> } : {}),
      ...(parsed['bankroll'] ? { bankroll: parsed['bankroll'] as Record<string, unknown> } : {}),
      ...(parsed['diary'] ? { diary: parsed['diary'] as unknown[] } : {}),
      ...(parsed['teams'] ? { teams: parsed['teams'] as unknown[] } : {}),
    };
  } catch {
    return null;
  }
}
