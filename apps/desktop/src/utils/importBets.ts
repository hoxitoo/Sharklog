import * as XLSX from 'xlsx';
import type { Bet, BetStatus, Sport, BetType, Strategy, EsportsDiscipline } from '@sharklog/core';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Maps any recognizable column header to a canonical field name
const COL_ALIASES: Record<string, string> = {
  'дата': 'date', 'date': 'date', 'placedat': 'date', 'placed at': 'date', 'placed': 'date',
  'событие': 'event', 'event': 'event', 'матч': 'event', 'match': 'event',
  'hometeam': 'homeTeam', 'home team': 'homeTeam', 'home': 'homeTeam', 'хозяева': 'homeTeam',
  'awayteam': 'awayTeam', 'away team': 'awayTeam', 'away': 'awayTeam', 'гости': 'awayTeam',
  'выбор': 'pick', 'pick': 'pick', 'ставка на': 'pick', 'bet': 'pick', 'selection': 'pick',
  'коэф.': 'odds', 'коэф': 'odds', 'коэффициент': 'odds', 'odds': 'odds', 'кф': 'odds',
  'oddsdecimal': 'odds', 'odds decimal': 'odds', 'decimal odds': 'odds',
  'ставка': 'stake', 'stake': 'stake', 'сумма': 'stake', 'amount': 'stake',
  'статус': 'status', 'status': 'status',
  'результат': 'result', 'result': 'result',
  'букмекер': 'bookmaker', 'bookmaker': 'bookmaker', 'бк': 'bookmaker', 'bk': 'bookmaker',
  'стратегия': 'strategy', 'strategy': 'strategy',
  'спорт': 'sport', 'sport': 'sport', 'вид спорта': 'sport',
  'тип ставки': 'betType', 'тип': 'betType', 'bet type': 'betType', 'bettype': 'betType',
  'markettype': 'betType', 'market type': 'betType', 'market': 'betType',
  'заметка': 'notes', 'заметки': 'notes', 'notes': 'notes', 'note': 'notes', 'комментарий': 'notes',
  'дисциплина': 'discipline', 'discipline': 'discipline',
};

const STATUS_MAP: Record<string, BetStatus> = {
  'won': 'won', 'выигрыш': 'won', 'победа': 'won', 'выиграл': 'won', 'win': 'won', 'w': 'won', '✅': 'won',
  'lost': 'lost', 'loss': 'lost', 'проигрыш': 'lost', 'поражение': 'lost', 'проиграл': 'lost', 'lose': 'lost', 'l': 'lost', '❌': 'lost',
  'pending': 'pending', 'ожидание': 'pending', 'ожидает': 'pending', 'в ожидании': 'pending', 'p': 'pending',
  'refund': 'refund', 'возврат': 'refund', 'r': 'refund', 'возвр.': 'refund', 'возвр': 'refund',
  'выкуп': 'refund', 'cashout': 'refund', 'cash out': 'refund',
};

// Reverse-map human-readable Russian labels back to enum values
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
  '1x2': '1X2', '1X2': '1X2',
  'итоговая победа': '1X2', 'победитель матча': '1X2', 'победитель': '1X2', 'winner': '1X2',
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
  'dota 2': 'dota2', 'dota2': 'dota2', 'дота': 'dota2', 'dota': 'dota2',
  'cs2': 'csgo', 'csgo': 'csgo', 'cs:go': 'csgo', 'кс': 'csgo',
  'lol': 'lol', 'league of legends': 'lol',
  'valorant': 'valorant', 'вало': 'valorant',
  'pubg': 'pubg',
  'rainbow six': 'r6', 'r6': 'r6',
  'apex legends': 'apex', 'apex': 'apex',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Parses monetary amounts with either comma or dot as decimal/thousands separator.
// Handles: "5,000.00 ₽", "1 234,56 ₽", "403.00", "1.85"
function parseAmount(raw: string): number {
  const s = raw.replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) {
    return s.lastIndexOf('.') > s.lastIndexOf(',')
      ? parseFloat(s.replace(/,/g, ''))           // "1,234.56" → 1234.56
      : parseFloat(s.replace(/\./g, '').replace(',', '.')); // "1.234,56" → 1234.56
  }
  if (s.includes(',')) {
    const parts = s.split(',');
    const last = parts[parts.length - 1] ?? '';
    // If last segment has ≤2 digits it's a decimal comma ("1234,56"), else thousands ("1,234")
    return last.length <= 2
      ? parseFloat(s.replace(',', '.'))
      : parseFloat(s.replace(/,/g, ''));
  }
  return parseFloat(s);
}

// Scans up to the first 10 rows to find the header row (the one with most column aliases matched).
function findHeaderRowIndex(data: string[][]): number {
  const known = new Set(Object.keys(COL_ALIASES));
  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i] ?? [];
    const score = row.filter(cell => known.has(normalizeHeader(String(cell ?? '')))).length;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

function mapRow(raw: Record<string, string>, existingIds: Set<string>): Bet | null {
  const g = (key: string) => (raw[key] ?? '').trim();

  // Construct event from dedicated column or HomeTeam vs AwayTeam
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

  // Prefer "result" column (Win/Loss/Выкуп) over "status" column (may contain workflow state)
  const resultRaw = g('result').toLowerCase();
  const statusRaw = g('status').toLowerCase();
  const status: BetStatus = STATUS_MAP[resultRaw] ?? STATUS_MAP[statusRaw] ?? 'pending';

  const sportRaw = g('sport').toLowerCase();
  const sport: Sport = SPORT_MAP[sportRaw] ?? (sportRaw as Sport) ?? 'other';

  const betTypeRaw = g('betType').toLowerCase();
  const betType: BetType = BET_TYPE_MAP[betTypeRaw] ?? (betTypeRaw as BetType) ?? '1X2';

  const strategyRaw = g('strategy').toLowerCase();
  const strategy: Strategy = STRATEGY_MAP[strategyRaw] ?? (strategyRaw as Strategy) ?? 'other';

  const disciplineRaw = g('discipline').toLowerCase();
  const discipline = DISCIPLINE_MAP[disciplineRaw] as EsportsDiscipline | undefined;

  const now = new Date().toISOString();
  const id = uuid();
  existingIds.add(id);

  return {
    id,
    createdAt: now,
    updatedAt: now,
    date,
    time: '00:00',
    sport,
    bookmaker: g('bookmaker') || 'Другой',
    event,
    betType,
    pick: g('pick'),
    odds,
    stake: Math.round(stakeRubles * 100),
    status,
    strategy,
    schemaVersion: 2,
    ...(g('notes') ? { notes: g('notes') } : {}),
    ...(discipline ? { discipline } : {}),
  };
}

function rowsToObjects(headers: string[], rows: string[][]): Array<Record<string, string>> {
  const fieldMap: Record<number, string> = {};
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    const field = COL_ALIASES[norm];
    if (field) fieldMap[i] = field;
  });

  return rows
    .filter((r) => r.some((c) => c !== ''))
    .map((r) =>
      Object.fromEntries(
        Object.entries(fieldMap).map(([i, field]) => [field, r[Number(i)] ?? ''])
      )
    );
}

export interface ImportResult {
  bets: Bet[];
  skipped: number;
  total: number;
}

export function importFromCSV(content: string): ImportResult {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length < 2) return { bets: [], skipped: 0, total: 0 };

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        result.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  }

  const allRows = nonEmpty.map(parseCSVLine);
  const headerIdx = findHeaderRowIndex(allRows);
  const headers = allRows[headerIdx] ?? [];
  const rows = allRows.slice(headerIdx + 1);
  const objects = rowsToObjects(headers, rows);

  const ids = new Set<string>();
  const bets: Bet[] = [];
  let skipped = 0;
  for (const obj of objects) {
    const bet = mapRow(obj, ids);
    if (bet) bets.push(bet);
    else skipped++;
  }
  return { bets, skipped, total: objects.length };
}

export function importFromXLSX(buffer: ArrayBuffer): ImportResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) return { bets: [], skipped: 0, total: 0 };

  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];
  if (data.length < 2) return { bets: [], skipped: 0, total: 0 };

  const headerIdx = findHeaderRowIndex(data);
  const headers = (data[headerIdx] ?? []).map(String);
  const rows = data.slice(headerIdx + 1).map((r) => (r ?? []).map(String));
  const objects = rowsToObjects(headers, rows);

  const ids = new Set<string>();
  const bets: Bet[] = [];
  let skipped = 0;
  for (const obj of objects) {
    const bet = mapRow(obj, ids);
    if (bet) bets.push(bet);
    else skipped++;
  }
  return { bets, skipped, total: objects.length };
}
