import type { StorageSchema } from '../types/bet.js';
import { CURRENT_SCHEMA_VERSION } from '../constants/index.js';

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
};

export function migrate(raw: unknown): StorageSchema {
  let data = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const fromVersion = typeof data['version'] === 'number' ? data['version'] : 0;

  for (let v = fromVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const fn = migrations[v];
    if (fn) data = fn(data);
  }

  return data as unknown as StorageSchema;
}
