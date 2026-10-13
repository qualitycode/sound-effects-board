// Generates build/icon.png (1024x1024) with no dependencies. electron-builder converts it to .icns.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 1024;
const pixels = Buffer.alloc(SIZE * SIZE * 4);

// Signed distance to a rounded rectangle centred at (cx, cy).
function roundedRect(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r);
  const dy = Math.abs(y - cy) - (hh - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

const coverage = (d) => Math.min(1, Math.max(0, 0.5 - d));
const bars = [0.28, 0.55, 0.85, 0.55, 0.28].map((h, i) => ({ cx: 312 + i * 100, hh: (h * 520) / 2 }));

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const o = (y * SIZE + x) * 4;
    const bg = coverage(roundedRect(x, y, 512, 512, 412, 412, 185));
    if (bg === 0) continue;
    const t = (x + y) / (2 * SIZE);
    let r = 108 + (255 - 108) * t;
    let g = 99 + (92 - 99) * t;
    let b = 255 + (138 - 255) * t;
    for (const bar of bars) {
      const a = coverage(roundedRect(x, y, bar.cx, 512, 34, bar.hh, 34));
      r += (255 - r) * a;
      g += (255 - g) * a;
      b += (255 - b) * a;
    }
    pixels[o] = r;
    pixels[o + 1] = g;
    pixels[o + 2] = b;
    pixels[o + 3] = Math.round(bg * 255);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', 'build', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('wrote', out);
