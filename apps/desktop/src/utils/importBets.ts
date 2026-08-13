import * as XLSX from '@e965/xlsx';
import { importBetsFromCSV, importBetsFromRows, type ImportResult } from '@sharklog/core';

export type { ImportResult };

const uuid = () => crypto.randomUUID();

export function importFromCSV(content: string): ImportResult {
  return importBetsFromCSV(content, uuid);
}

export function importFromXLSX(buffer: ArrayBuffer): ImportResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) return { bets: [], skipped: 0, total: 0 };

  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];
  if (data.length < 2) return { bets: [], skipped: 0, total: 0 };

  return importBetsFromRows(data.map((r) => (r ?? []).map((c) => String(c ?? ''))), uuid);
}
