import type { StorageSchema } from '../types/bet';
import { CURRENT_SCHEMA_VERSION } from '../constants/index';

type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

const migrations: Record<number, MigrationFn> = {
  // v0 → v1: initial schema, no-op
  1: (data) => ({ ...data, version: 1 }),
  // v1 → v2: add reminderHour to settings
  2: (data) => {
    const settings = (typeof data['settings'] === 'object' && data['settings'] !== null)
      ? (data['settings'] as Record<string, unknown>)
      : {};
    return { ...data, settings: { reminderHour: 20, ...settings }, version: 2 };
  },
  // v2 → v3: accumulators were stored at 3 decimals (the raw product of the
  // legs) while the bookmaker rounds the combined coefficient to 2 and settles
  // on that. Every such bet was therefore booked at the wrong payout. Round the
  // stored odds so history matches what was actually paid.
  3: (data) => {
    const bets = Array.isArray(data['bets']) ? (data['bets'] as Array<Record<string, unknown>>) : [];
    return {
      ...data,
      bets: bets.map((b) => {
        if (b['betType'] !== 'express' || typeof b['odds'] !== 'number') return b;
        const rounded = Math.round(b['odds'] * 100) / 100;
        return rounded === b['odds'] ? b : { ...b, odds: rounded };
      }),
      version: 3,
    };
  },
};

export function migrate(raw: unknown): StorageSchema {
  // Reject arrays and non-objects: an old `Bet[]`-only export is `typeof 'object'`
  // but spreading it would corrupt the schema (numeric keys, no `bets` array).
  let data = (typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const fromVersion = typeof data['version'] === 'number' ? data['version'] : 0;

  for (let v = fromVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const fn = migrations[v];
    if (fn) data = fn(data);
  }

  return data as unknown as StorageSchema;
}
