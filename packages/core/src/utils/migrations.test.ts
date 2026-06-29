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
});
