import type { Bet, Bankroll, DiaryEntry, Team } from '@sharklog/core';
import {
  importBetsFromCSV, migrate, sanitizeBets, sanitizeBankroll, sanitizeDiary, sanitizeTeams, type ImportResult,
} from '@sharklog/core';

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
  /** Only the fields that checked out — merged over the phone's own bankroll. */
  bankroll?: Partial<Bankroll>;
  diary?: DiaryEntry[];
  teams?: Team[];
  /** Records left out because they were broken (sanitize.ts in core). */
  dropped: number;
}

export function importFromJSON(content: string): JSONBackup | null {
  try {
    // Through migrate(), not straight from JSON: a backup taken before a schema
    // fix must get the same correction a stored file gets on load. Restoring an
    // old backup used to reintroduce bugs the app had already migrated away.
    const json: unknown = JSON.parse(content);
    // Before migrate(): it fills in an empty list, and any JSON file at all
    // would then read as a backup of nothing.
    if (typeof json !== 'object' || json === null || !Array.isArray((json as Record<string, unknown>)['bets'])) return null;
    const parsed = migrate(json as Parameters<typeof migrate>[0]) as unknown as Record<string, unknown>;
    if (!Array.isArray(parsed['bets'])) return null;
    // A backup is outside data: every record is checked before the store sees
    // it. A handed-over file with one broken bet used to crash every screen
    // on every launch, with no way out short of clearing all data.
    const bets = sanitizeBets(parsed['bets']);
    const bankroll = sanitizeBankroll(parsed['bankroll']);
    const diary = Array.isArray(parsed['diary']) ? sanitizeDiary(parsed['diary']) : null;
    const teams = Array.isArray(parsed['teams']) ? sanitizeTeams(parsed['teams']) : null;
    const settings = parsed['settings'];
    return {
      bets: bets.items,
      ...(settings && typeof settings === 'object' && !Array.isArray(settings) ? { settings: settings as Record<string, unknown> } : {}),
      ...(Object.keys(bankroll.bankroll).length > 0 ? { bankroll: bankroll.bankroll } : {}),
      ...(diary ? { diary: diary.items } : {}),
      ...(teams ? { teams: teams.items } : {}),
      dropped: bets.dropped + bankroll.dropped + (diary?.dropped ?? 0) + (teams?.dropped ?? 0),
    };
  } catch {
    return null;
  }
}
