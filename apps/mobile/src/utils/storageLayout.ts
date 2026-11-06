/*
 * How the store lies on disk. Pure — no React Native — so it is under test.
 *
 * Why the bets are in pieces: on Android, AsyncStorage keeps every value as
 * one row of a SQLite table (Room), and Android reads a row whole through a
 * 2 MB CursorWindow. A larger value is WRITTEN fine and then cannot be READ:
 * "Row too big to fit into CursorWindow". Everything used to live under one
 * key, at about 525 KB per 1 000 bets — so somewhere past 4 000 bets the app
 * would have saved its data and never opened it again. Split into pieces of at
 * most CHUNK_CHARS characters, no value comes near the limit at any size of
 * history: 10 000 bets are about 14 pieces.
 *
 * Layout:
 *   @sharklog/data       — everything but the bets, plus `betChunks: n`
 *   @sharklog/bets:0..n-1 — the bets, newest first, as JSON arrays
 * A record with `bets` inside and no `betChunks` is the old single-key
 * layout; it is read as before and written back in pieces on the next save.
 */

export const STORAGE_KEY = '@sharklog/data';
export const BETS_CHUNK_PREFIX = '@sharklog/bets:';

/**
 * Characters per piece. SQLite keeps text as UTF-8, where a Cyrillic letter
 * takes two bytes: 400 000 characters stay under 800 KB even if every one of
 * them were Cyrillic — well inside the 2 MB window.
 */
export const CHUNK_CHARS = 400_000;

export const chunkKey = (i: number): string => `${BETS_CHUNK_PREFIX}${i}`;

/** The index of a bets piece's key, or null for any other key. */
export function chunkIndex(key: string): number | null {
  if (!key.startsWith(BETS_CHUNK_PREFIX)) return null;
  const n = Number(key.slice(BETS_CHUNK_PREFIX.length));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * The bets as JSON arrays of at most `limit` characters each, in order. A
 * single bet longer than the limit gets a piece of its own. Parsing the pieces
 * and concatenating them gives back exactly the array that went in.
 */
export function splitBets(bets: readonly unknown[], limit: number = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let parts: string[] = [];
  let size = 2; // the brackets
  for (const bet of bets) {
    const json = JSON.stringify(bet);
    if (parts.length > 0 && size + json.length + 1 > limit) {
      chunks.push(`[${parts.join(',')}]`);
      parts = [];
      size = 2;
    }
    parts.push(json);
    size += json.length + 1;
  }
  if (parts.length > 0) chunks.push(`[${parts.join(',')}]`);
  return chunks;
}

/**
 * Everything one save writes: the bets pieces first, the main record last —
 * it is the record that names how many pieces to read. On Android the whole
 * map goes in one transaction, so a reader never sees a record that names
 * pieces from another save.
 */
export function storageEntries(
  data: { bets: readonly unknown[] } & Record<string, unknown>,
  limit: number = CHUNK_CHARS,
): { entries: Record<string, string>; chunks: number } {
  const { bets, ...rest } = data;
  const pieces = splitBets(bets, limit);
  const entries: Record<string, string> = {};
  pieces.forEach((piece, i) => { entries[chunkKey(i)] = piece; });
  entries[STORAGE_KEY] = JSON.stringify({ ...rest, betChunks: pieces.length });
  return { entries, chunks: pieces.length };
}

/** How many bets pieces a parsed main record names; null for the old layout. */
export function namedChunks(parsed: unknown): number | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const n = (parsed as Record<string, unknown>)['betChunks'];
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : null;
}
