/*
 * How the store lies on disk. Pure — no React Native — so it is under test.
 *
 * WHY PIECES. On Android, AsyncStorage keeps a value as one row of a SQLite
 * table (Room), and Android reads a row whole through a 2 MB CursorWindow: a
 * larger value is WRITTEN fine and then cannot be READ ("Row too big to fit
 * into CursorWindow"). Everything used to sit under one key, about 525 KB per
 * 1 000 bets — past ~4 000 bets the app would have saved its data and never
 * opened it again. The bets now go in pieces of at most CHUNK_CHARS characters,
 * so no value comes near the limit: 10 000 bets are about 14 pieces.
 *
 * WHY GENERATIONS. A save must survive being killed at any moment, on both
 * platforms. Android writes a multi-set in one transaction; iOS does not: it
 * writes a long value to its own file at once and lists NEW keys in its
 * manifest only at the end of the call (RNCAsyncStorage.mm, _writeEntry /
 * _writeManifest). Overwriting pieces in place would therefore show a reader
 * half a save. So a save never overwrites a piece:
 *   1. the new pieces go under NEW keys — `@sharklog/bets:<gen>:<i>`;
 *   2. then the main record, naming that generation, its piece count and its
 *      bet count;
 *   3. only then are the pieces of every other generation removed.
 * Killed before step 2, the old record still names the old pieces, which are
 * all there; killed after it, the new ones are. Nothing is ever deleted at
 * load — only a save that has just written its record clears the others.
 *
 * Every piece also says what it is — `{"g":gen,"i":index,"n":count,"bets":[…]}`
 * — so the bets can be rebuilt from the pieces alone when the record is lost
 * or unreadable, or was overwritten by an older build that knows no pieces.
 *
 * WHY THE RECORD IS PADDED. iOS keeps values of up to 1 024 characters inline
 * in its manifest and longer ones in files, and when a key goes from a file
 * back to inline it deletes the file BEFORE it saves the manifest — a kill in
 * between and the key reads as missing. Without the bets, the main record of
 * a light user sits right around that line; padding keeps it a file always.
 */

export const STORAGE_KEY = '@sharklog/data';
export const PIECE_PREFIX = '@sharklog/bets:';

/**
 * Characters per piece. SQLite keeps text as UTF-8, at most three bytes for a
 * character the app stores: 400 000 characters stay under 1.2 MB — inside the
 * 2 MB window whatever the text.
 */
export const CHUNK_CHARS = 400_000;

/** The main record is padded to at least this many characters (see above). */
export const MIN_RECORD_CHARS = 1_100;

export const pieceKey = (gen: number, index: number): string => `${PIECE_PREFIX}${gen}:${index}`;

/** The generation and index a piece key names, or null for any other key. */
export function parsePieceKey(key: string): { gen: number; index: number } | null {
  if (!key.startsWith(PIECE_PREFIX)) return null;
  const m = /^(\d+):(\d+)$/.exec(key.slice(PIECE_PREFIX.length));
  if (!m) return null;
  return { gen: Number(m[1]), index: Number(m[2]) };
}

/** Bets as groups of JSON texts, each group's array at most `limit` characters. */
function groupBets(bets: readonly unknown[], limit: number): string[][] {
  const groups: string[][] = [];
  let parts: string[] = [];
  let size = 2; // the brackets
  for (const bet of bets) {
    // A hole would make `JSON.stringify` return undefined and the piece
    // unparsable; the whole-array stringify this replaces wrote null.
    const json = JSON.stringify(bet) ?? 'null';
    if (parts.length > 0 && size + json.length + 1 > limit) {
      groups.push(parts);
      parts = [];
      size = 2;
    }
    parts.push(json);
    size += json.length + 1;
  }
  if (parts.length > 0) groups.push(parts);
  return groups;
}

/**
 * Everything one save writes, in two steps: `pieces` (new keys, written
 * first) and `record` (the main record, written after them).
 */
export function buildSave(
  data: { bets: readonly unknown[] } & Record<string, unknown>,
  gen: number,
  limit: number = CHUNK_CHARS,
): { pieces: Record<string, string>; record: string; chunks: number } {
  const { bets, ...rest } = data;
  const groups = groupBets(bets, limit);
  const n = groups.length;
  const pieces: Record<string, string> = {};
  groups.forEach((parts, i) => {
    pieces[pieceKey(gen, i)] = `{"g":${gen},"i":${i},"n":${n},"bets":[${parts.join(',')}]}`;
  });
  const meta = { ...rest, betsGen: gen, betChunks: n, betCount: bets.length };
  let record = JSON.stringify(meta);
  if (record.length < MIN_RECORD_CHARS) {
    record = JSON.stringify({ ...meta, pad: ' '.repeat(MIN_RECORD_CHARS - record.length) });
  }
  return { pieces, record, chunks: n };
}

/** What a main record says about its pieces; null for the old single-key layout. */
export function recordPieces(parsed: unknown): { gen: number; chunks: number; count: number } | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const r = parsed as Record<string, unknown>;
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
  if (!ok(r['betsGen']) || !ok(r['betChunks']) || !ok(r['betCount'])) return null;
  return { gen: r['betsGen'], chunks: r['betChunks'], count: r['betCount'] };
}

/** One parsed piece, or null when the text is not a whole piece. */
export function parsePiece(text: string | null): { g: number; i: number; n: number; bets: unknown[] } | null {
  if (text === null) return null;
  try {
    const p = JSON.parse(text) as Record<string, unknown>;
    const ok = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
    if (!ok(p['g']) || !ok(p['i']) || !ok(p['n']) || !Array.isArray(p['bets'])) return null;
    return { g: p['g'], i: p['i'], n: p['n'], bets: p['bets'] };
  } catch {
    return null;
  }
}

/**
 * The bets of one generation from its pieces' texts (in index order). `whole`
 * is false when a piece is missing, unparsable, from another generation or out
 * of place, or the count does not match `count` (when given).
 */
export function assembleGeneration(
  gen: number,
  texts: readonly (string | null)[],
  count?: number,
): { bets: unknown[]; whole: boolean } {
  const bets: unknown[] = [];
  let whole = true;
  texts.forEach((text, i) => {
    const p = parsePiece(text);
    if (!p || p.g !== gen || p.i !== i || p.n !== texts.length) { whole = false; return; }
    for (const b of p.bets) bets.push(b);
  });
  if (count !== undefined && bets.length !== count) whole = false;
  return { bets, whole };
}

/** Generations present on disk, newest first, with the indices of their pieces. */
export function generationsOnDisk(keys: readonly string[]): Array<{ gen: number; indices: number[] }> {
  const by = new Map<number, number[]>();
  for (const k of keys) {
    const p = parsePieceKey(k);
    if (p) by.set(p.gen, [...(by.get(p.gen) ?? []), p.index]);
  }
  return [...by.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([gen, indices]) => ({ gen, indices: indices.sort((a, b) => a - b) }));
}
