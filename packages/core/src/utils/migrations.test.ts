import { describe, it, expect } from 'vitest';
import { migrate } from './migrations';
import { CURRENT_SCHEMA_VERSION } from '../constants/index';

describe('migrate', () => {
  it('returns a clean schema for an array input (legacy Bet[] export) instead of corrupting it', () => {
    const legacyBetsArray = [{ id: '1', status: 'won' }];
    const result = migrate(legacyBetsArray) as Record<string, unknown>;
    // Must NOT spread the array into numeric keys
    expect(result['0']).toBeUndefined();
    expect(Array.isArray(result)).toBe(false);
  });

  it('returns empty record for null/undefined/primitive input', () => {
    expect(migrate(null)).toBeTruthy();
    expect(migrate(undefined)).toBeTruthy();
    expect(migrate(42)).toBeTruthy();
  });

  it('upgrades a v1 object to the current version with reminderHour default', () => {
    const result = migrate({ version: 1, settings: {} }) as Record<string, unknown>;
    expect(result['version']).toBe(CURRENT_SCHEMA_VERSION);
    expect((result['settings'] as Record<string, unknown>)['reminderHour']).toBe(20);
  });

  it('passes a broken bet entry through instead of refusing the whole file', () => {
    // An old (v2) file or backup with one null bet: migration 3 read
    // null['betType'] and threw, and the whole thing was refused; sanitize
    // drops the one entry later.
    const good = { id: 'b', betType: 'express', odds: 2.337 };
    const result = migrate({ version: 2, bets: [null, 'junk', good] }) as { bets: unknown[] };
    expect(result.bets).toEqual([null, 'junk', { ...good, odds: 2.34 }]);
  });

  it('pads an imported "9:05" so a morning match sorts before "23:00", and touches nothing else', () => {
    const result = migrate({
      version: 3,
      bets: [{ id: 'a', time: '9:05' }, { id: 'b', time: '23:00' }, { id: 'c', time: 'вечер' }, { id: 'd' }, null],
    }) as { bets: Array<Record<string, unknown> | null>; version: number };
    expect(result.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.bets.map((b) => b?.['time'])).toEqual(['09:05', '23:00', 'вечер', undefined, undefined]);
  });
});
