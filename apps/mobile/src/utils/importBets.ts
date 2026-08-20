import type { Bet } from '@sharklog/core';
import { importBetsFromCSV, migrate, type ImportResult } from '@sharklog/core';

export type { ImportResult };

/** crypto may be unavailable on Hermes/Android — fall back to Math.random. */
function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
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

export function importFromCSV(content: string): ImportResult {
  return importBetsFromCSV(content, uuid);
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
    // Through migrate(), not straight from JSON: a backup taken before a schema
    // fix must get the same correction a stored file gets on load. Restoring an
    // old backup used to reintroduce bugs the app had already migrated away.
    const parsed = migrate(JSON.parse(content)) as unknown as Record<string, unknown>;
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
