import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { uuid } from '../utils/uuid';

/*
 * Ids: one generator, and it must not depend on `crypto`, which Hermes may not
 * provide. Analytics called crypto.randomUUID() directly; the throw was
 * swallowed by its catch, so with a PostHog key set every event would have
 * been dropped without a word.
 */
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid', () => {
  it('makes v4 ids, with crypto and without it', () => {
    expect(uuid()).toMatch(V4);
    const saved = (globalThis as { crypto?: unknown }).crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      expect(uuid()).toMatch(V4);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: saved, configurable: true });
    }
  });

  it('is the only way the app makes one — no crypto.randomUUID()', () => {
    const SRC = join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '__tests__' || e.name === 'node_modules') continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name)) files.push(p);
      }
    };
    walk(SRC);
    const hits = files.filter((f) => /crypto\.randomUUID\s*\(/.test(
      readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''),
    ));
    expect(hits.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});
