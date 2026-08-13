import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { Bet } from '@sharklog/core';
import { buildBetsCSV, toYmd } from '@sharklog/core';

export async function exportBetsCSV(bets: Bet[]): Promise<void> {
  const bom = '﻿'; // UTF-8 BOM for Excel compatibility
  const filename = `sharklog_${toYmd(new Date())}.csv`;
  const uri = FileSystem.documentDirectory + filename;

  await FileSystem.writeAsStringAsync(uri, bom + buildBetsCSV(bets), {
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
