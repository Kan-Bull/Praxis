const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Generate a gradient "P" badge icon matching the Praxis UI header badge.
 * - Blue-to-purple 135deg gradient (#3b82f6 → #8b5cf6)
 * - Rounded corners with anti-aliased edges
 * - Bold white "P" letter
 * - RGBA with transparency outside rounded corners
 */
function createGradientPIcon(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function crc32(buf) {
    let crc = 0xffffffff;
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, crc]);
  }

  // Gradient endpoints: #3b82f6 (top-left) → #8b5cf6 (bottom-right)
  const c1 = { r: 59, g: 130, b: 246 };
  const c2 = { r: 139, g: 92, b: 246 };

  // Rounded corner radius (~22% matches the CSS 8px/32px ratio)
  const radius = Math.max(1, Math.round(size * 0.22));

  // Anti-aliased alpha for rounded corners
  function cornerAlpha(x, y) {
    let cx, cy;
    if (x < radius && y < radius) {
      cx = radius - 1;
      cy = radius - 1;
    } else if (x >= size - radius && y < radius) {
      cx = size - radius;
      cy = radius - 1;
    } else if (x < radius && y >= size - radius) {
      cx = radius - 1;
      cy = size - radius;
    } else if (x >= size - radius && y >= size - radius) {
      cx = size - radius;
      cy = size - radius;
    } else {
      return 255;
    }

    const dist = Math.hypot(x - cx, y - cy);
    if (dist <= radius - 0.5) return 255;
    if (dist >= radius + 0.5) return 0;
    return Math.round(255 * (radius + 0.5 - dist));
  }

  // Bold geometric "P" letter (proportional coordinates)
  function isP(x, y) {
    const nx = x / size;
    const ny = y / size;

    // Stem: left vertical bar, full height
    if (nx >= 0.28 && nx < 0.42 && ny >= 0.20 && ny < 0.80) return true;
    // Bowl top bar
    if (nx >= 0.28 && nx < 0.64 && ny >= 0.20 && ny < 0.31) return true;
    // Bowl right bar
    if (nx >= 0.55 && nx < 0.67 && ny >= 0.20 && ny < 0.54) return true;
    // Bowl bottom bar
    if (nx >= 0.28 && nx < 0.64 && ny >= 0.44 && ny < 0.54) return true;

    return false;
  }

  // IHDR: color type 6 = RGBA
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // 8-bit RGBA

  const rowLen = 1 + size * 4;
  const raw = Buffer.alloc(rowLen * size);

  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // No filter
    for (let x = 0; x < size; x++) {
      const offset = y * rowLen + 1 + x * 4;
      const alpha = cornerAlpha(x, y);

      if (alpha === 0) {
        // Fully transparent (outside rounded corners)
        raw[offset] = 0;
        raw[offset + 1] = 0;
        raw[offset + 2] = 0;
        raw[offset + 3] = 0;
      } else if (isP(x, y)) {
        // White "P" letter
        raw[offset] = 255;
        raw[offset + 1] = 255;
        raw[offset + 2] = 255;
        raw[offset + 3] = alpha;
      } else {
        // 135deg gradient (top-left blue → bottom-right purple)
        const t = (x + y) / (2 * (size - 1));
        raw[offset] = Math.round(c1.r + (c2.r - c1.r) * t);
        raw[offset + 1] = Math.round(c1.g + (c2.g - c1.g) * t);
        raw[offset + 2] = Math.round(c1.b + (c2.b - c1.b) * t);
        raw[offset + 3] = alpha;
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend),
  ]);
}

const dir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(dir, { recursive: true });

[16, 32, 48, 128].forEach((size) => {
  const png = createGradientPIcon(size);
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), png);
  console.log(`Created icon-${size}.png (${png.length} bytes)`);
});
