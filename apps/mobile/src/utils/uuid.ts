/**
 * A v4 UUID — the ONE generator in the app (six copies of it used to live in
 * the screens and the store). `crypto` may be unavailable on Hermes/Android —
 * then Math.random. Typed by what it uses, not by the DOM's `Crypto`: that
 * type came only with a test library the app no longer installs.
 */
export function uuid(): string {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
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
