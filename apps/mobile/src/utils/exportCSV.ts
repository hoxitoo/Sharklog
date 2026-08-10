import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { Bet } from '@sharklog/core';
import { SPORTS, BET_TYPES, STRATEGIES, ESPORTS_DISCIPLINES, toYmd } from '@sharklog/core';

function escape(value: string | number): string {
  let str = String(value);
  // CSV/formula injection: a text cell starting with = + - @ (or control chars) is
  // executed as a formula by Excel/Sheets. Neutralize with a leading apostrophe.
  // Numbers are passed as `number` (not string) so signed values stay intact.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // wrap in quotes if value contains semicolons, quotes, or newlines
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportBetsCSV(bets: Bet[]): Promise<void> {
  const headers = [
    'Дата', 'Время', 'Событие', 'Выбор', 'Коэф.', 'Ставка (₽)', 'Статус',
    'P&L (₽)', 'Спорт', 'Тип', 'Стратегия', 'Букмекер', 'Турнир', 'Дисциплина',
    'Фрибет', 'Заметки',
  ];

  const rows = bets.map((b) => {
    const pnl =
      b.status === 'won' ? Math.round(b.stake * (b.odds - 1)) / 100
      : b.status === 'lost' ? (b.isFreebet ? 0 : -b.stake / 100)
      : b.status === 'cashout' && b.cashoutAmount != null ? (b.cashoutAmount - b.stake) / 100
      : 0;

    return [
      b.date,
      b.time,
      b.event,
      b.pick,
      b.odds,
      b.stake / 100,
      b.status,
      pnl,
      SPORTS[b.sport] ?? b.sport,
      BET_TYPES[b.betType] ?? b.betType,
      STRATEGIES[b.strategy] ?? b.strategy,
      b.bookmaker,
      b.tournament ?? '',
      b.discipline ? (ESPORTS_DISCIPLINES[b.discipline] ?? b.discipline) : '',
      b.isFreebet ? 'Да' : '',
      b.notes ?? '',
    ].map(escape);
  });

  const csv = [headers.map(escape), ...rows]
    .map((row) => row.join(';'))
    .join('\n');

  const bom = '﻿'; // UTF-8 BOM for Excel compatibility
  const filename = `sharklog_${toYmd(new Date())}.csv`;
  const uri = FileSystem.documentDirectory + filename;

  await FileSystem.writeAsStringAsync(uri, bom + csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Экспорт ставок',
      UTI: 'public.comma-separated-values-text',
    });
  }
}
