import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Bet } from '@sharklog/core';
import { SPORTS, BET_TYPES, STRATEGIES } from '@sharklog/core';

function escape(value: string | number): string {
  const str = String(value);
  // wrap in quotes if value contains semicolons, quotes, or newlines
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportBetsCSV(bets: Bet[]): Promise<void> {
  const headers = [
    'Дата', 'Время', 'Событие', 'Выбор', 'Коэф.', 'Ставка (₽)', 'Статус',
    'P&L (₽)', 'Спорт', 'Тип', 'Стратегия', 'Букмекер', 'Заметки',
  ];

  const rows = bets.map((b) => {
    const pnl =
      b.status === 'won' ? Math.round(b.stake * (b.odds - 1)) / 100
      : b.status === 'lost' ? -b.stake / 100
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
      b.notes ?? '',
    ].map(escape);
  });

  const csv = [headers.map(escape), ...rows]
    .map((row) => row.join(';'))
    .join('\n');

  const bom = '﻿'; // UTF-8 BOM for Excel compatibility
  const filename = `sharklog_${new Date().toISOString().split('T')[0]}.csv`;
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
