#!/usr/bin/env node
// Generates placeholder PNG assets for Expo (icon, splash, adaptive-icon)
// Uses only Node.js built-ins (zlib, fs, path) — no external deps.
'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ── PNG encoding helpers ──────────────────────────────────────────────────────

function u32be(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(data) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })());
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  return Buffer.concat([u32be(data.length), typeBytes, data, u32be(crc32(crcInput))]);
}

function makePng(width, height, rgbaPixelFn) {
  // IHDR
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB (3 channels)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  // Raw image data: for each row, filter byte (0) + RGB pixels
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.allocUnsafe(1 + width * 3);
    row[0] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rgbaPixelFn(x, y, width, height);
      row[1 + x * 3] = r;
      row[1 + x * 3 + 1] = g;
      row[1 + x * 3 + 2] = b;
    }
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

// Background: #080810  Accent: #22D3A0  Purple: #5B6AF0
const BG   = [0x08, 0x08, 0x10];
const TEAL = [0x22, 0xD3, 0xA0];
const PURP = [0x5B, 0x6A, 0xF0];
const GOLD = [0xF5, 0x9E, 0x0B];
const WHITE = [0xFF, 0xFF, 0xFF];

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function lerpColor(c1, c2, t) { return c1.map((v, i) => lerp(v, c2[i], t)); }

// Shark silhouette: draw a simple filled triangle pointing right (dorsal fin shape)
// plus a horizontal body ellipse
function isInShark(x, y, w, h) {
  const cx = w * 0.5, cy = h * 0.52;
  // Body: horizontal ellipse
  const bx = (x - cx) / (w * 0.32), by = (y - cy) / (h * 0.14);
  if (bx * bx + by * by < 1) return 'body';
  // Dorsal fin: triangle above body
  const fx = (x - cx * 1.05) / (w * 0.12), fy = (y - cy * 0.72) / (h * 0.18);
  if (fx > -1 && fx < 1 && fy > -1 && fy < 1 && fy < -0.8 + 1.8 * (1 - Math.abs(fx))) return 'fin';
  // Tail: two triangles to the left
  const tx = (x - cx * 0.36) / (w * 0.07), ty = (y - cy) / (h * 0.14);
  if (tx > -1 && tx < 1 && Math.abs(ty) < 1 + tx) return 'tail';
  return null;
}

// ── Asset generators ──────────────────────────────────────────────────────────

function iconPixel(x, y, w, h) {
  // Rounded background + shark
  const cx = w / 2, cy = h / 2;
  const r = w * 0.42;
  const dx = x - cx, dy = y - cy;
  // gradient background (top-left teal → bottom-right purple)
  const t = (x / w + y / h) / 2;
  const bgColor = lerpColor(PURP, [0x14, 0x14, 0x28], t);

  const inCircle = Math.sqrt(dx * dx + dy * dy) < r;
  if (!inCircle) return BG;

  const part = isInShark(x, y, w, h);
  if (part === 'body' || part === 'fin' || part === 'tail') return WHITE;

  // Small "S" hint — a 2-pixel accent dot above center
  const dotX = Math.abs(x - cx) < w * 0.04, dotY = Math.abs(y - cy * 0.35) < h * 0.04;
  if (dotX && dotY) return TEAL;

  return bgColor;
}

function splashPixel(x, y, w, h) {
  // Full dark background, centered icon-like logo
  const t = (x / w + y / h) / 2;
  const bgColor = lerpColor([0x08, 0x08, 0x10], [0x0e, 0x0e, 0x1c], t);

  // Draw centered shark in middle third
  const offX = x - w * 0.1, offY = y - h * 0.05;
  const part = isInShark(offX, offY, w * 0.8, h * 0.9);
  if (part === 'body' || part === 'fin' || part === 'tail') return WHITE;
  return bgColor;
}

function adaptivePixel(x, y, w, h) {
  // Android adaptive icon foreground: transparent-ish center with shark
  // safe zone = center 66%
  const bgColor = lerpColor(PURP, [0x14, 0x14, 0x28], (x / w + y / h) / 2);
  const part = isInShark(x, y, w, h);
  if (part === 'body' || part === 'fin' || part === 'tail') return WHITE;
  return bgColor;
}

// ── Write files ───────────────────────────────────────────────────────────────

const OUT = path.join(__dirname, '..', 'assets');

const assets = [
  { name: 'icon.png',          w: 1024, h: 1024, fn: iconPixel },
  { name: 'splash.png',        w: 1284, h: 2778, fn: splashPixel },
  { name: 'adaptive-icon.png', w: 1024, h: 1024, fn: adaptivePixel },
];

for (const { name, w, h, fn } of assets) {
  const outPath = path.join(OUT, name);
  const png = makePng(w, h, fn);
  fs.writeFileSync(outPath, png);
  console.log(`✓ ${name}  (${w}×${h}, ${(png.length / 1024).toFixed(1)} KB)`);
}
console.log('Done.');
