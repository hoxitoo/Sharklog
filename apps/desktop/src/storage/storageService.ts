// Abstracts data persistence: SQLite when running inside Tauri, localStorage in browser/dev mode.
// The store uses saveData / loadData; never calls localStorage or SQL directly.

const IS_TAURI = typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
const STORAGE_KEY = 'sharklog-data';

type KvRow = { value: string };

let dbPromise: Promise<unknown> | null = null;

async function getDb(): Promise<{
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
  select: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
}> {
  if (!dbPromise) {
    dbPromise = (async () => {
      // Dynamic import so browser mode never tries to resolve this module
      const { default: Database } = await import('@tauri-apps/plugin-sql');
      const db = await Database.load('sqlite:sharklog.db');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS kv (
          key   TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        )
      `);
      return db;
    })();
  }
  return dbPromise as Promise<{
    execute: (sql: string, params?: unknown[]) => Promise<unknown>;
    select: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  }>;
}

export async function loadData(): Promise<object | null> {
  if (!IS_TAURI) {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as object) : null;
  }
  const db = await getDb();
  const rows = await db.select<KvRow>('SELECT value FROM kv WHERE key = ?', [STORAGE_KEY]);
  if (!rows[0]) return null;
  return JSON.parse(rows[0].value) as object;
}

export async function saveData(data: object): Promise<void> {
  if (!IS_TAURI) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return;
  }
  const db = await getDb();
  await db.execute(
    'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)',
    [STORAGE_KEY, JSON.stringify(data)],
  );
}
