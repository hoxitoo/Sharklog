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
 * WHY A BASE. When the session loaded a record of the OLD layout (bets inside,
 * no generation — the first launch after the update, or after an older build
 * rewrote the record), its pieces also carry `"b"`: a hash of that record's
 * text. Such a record next to pieces is ambiguous: either an older build wrote
 * it after those pieces' save (their bets are not in it — keep both), or the
 * save that wrote those pieces was killed before its own record landed (it
 * did not happen — keep the record alone; merging would bring back the bets
 * that save deleted, and mix a «Replace» restore into the bets it replaced).
 * Same text, same hash: the second case.
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
 * The generation whose record last landed, written after that record by every
 * save. Two jobs:
 *  - a short value that changes on each save, so iOS must write its manifest
 *    before the save counts as landed. A save that only rewrites an existing
 *    file never writes it, and a manifest write that failed earlier in the
 *    session (a record moving into its own file) would otherwise stay unsaved
 *    while every later save reported success;
 *  - for a load that finds an old-layout record: a generation whose record
 *    DID land is never skipped as a killed save — an older build overwrote it
 *    ("Why a base": two downgrades with an unchanged record would otherwise
 *    read as a killed save and lose every bet in the pieces).
 */
export const LANDED_KEY = '@sharklog/data_landed';

/** iOS keeps values up to this many characters inline in its manifest, longer ones in files. */
export const IOS_INLINE_CHARS = 1_024;

/**
 * Whether a record write that FAILED may still end up on disk. On iOS a record
 * not yet in its own file can reach the file while its manifest entry does
 * not, and a later manifest write makes that file the live record — so its
 * pieces must stay. Android writes a value in one SQLite transaction: failed
 * means not there, and keeping its pieces would only take the space a nearly
 * full phone is short of. Unknown platform: assume it may (a kept generation
 * costs space; a removed live one, the bets). `process.env.EXPO_OS` is
 * replaced with the platform at build time (babel-preset-expo, define-plugin).
 */
export function failedRecordMayLand(os: string | undefined = process.env['EXPO_OS']): boolean {
  return os !== 'android';
}

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

/**
 * A short fingerprint of a text (FNV-1a, 32 bits, over UTF-16 units) — to tell
 * whether the record on disk is the one a session loaded (see "Why a base").
 * Not a security measure: nothing here defends against a forged file.
 */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
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
 * first) and `record` (the main record, written after them). `base` — the
 * hash of the old-layout record the session loaded, if it loaded one.
 */
export function buildSave(
  data: { bets: readonly unknown[] } & Record<string, unknown>,
  gen: number,
  limit: number = CHUNK_CHARS,
  base: string | null = null,
): { pieces: Record<string, string>; record: string; chunks: number } {
  const { bets, ...rest } = data;
  const groups = groupBets(bets, limit);
  const n = groups.length;
  const b = base === null ? '' : `"b":${JSON.stringify(base)},`;
  const pieces: Record<string, string> = {};
  groups.forEach((parts, i) => {
    pieces[pieceKey(gen, i)] = `{"g":${gen},"i":${i},"n":${n},${b}"bets":[${parts.join(',')}]}`;
  });
  return { pieces, record: buildRecord(rest, gen, n, bets.length), chunks: n };
}

/**
 * The main record alone: everything but the bets, and the generation whose
 * pieces hold them. A save whose bets are the very array an earlier landed
 * save wrote (a setting, a diary line, a deposit) writes only this — the
 * pieces on disk already hold those bets (persist in betsStore). Padded past
 * the iOS inline limit, as every record this build writes.
 */
export function buildRecord(rest: Record<string, unknown>, gen: number, chunks: number, count: number): string {
  const meta = { ...rest, betsGen: gen, betChunks: chunks, betCount: count };
  const record = JSON.stringify(meta);
  if (record.length >= MIN_RECORD_CHARS) return record;
  return JSON.stringify({ ...meta, pad: ' '.repeat(MIN_RECORD_CHARS - record.length) });
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
export function parsePiece(
  text: string | null,
): { g: number; i: number; n: number; b: string | null; bets: unknown[] } | null {
  if (text === null) return null;
  try {
    const p = JSON.parse(text) as Record<string, unknown>;
    if (typeof p !== 'object' || p === null) return null;
    const ok = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
    if (!ok(p['g']) || !ok(p['i']) || !ok(p['n']) || !Array.isArray(p['bets'])) return null;
    const b = typeof p['b'] === 'string' ? p['b'] : null;
    return { g: p['g'], i: p['i'], n: p['n'], b, bets: p['bets'] };
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
