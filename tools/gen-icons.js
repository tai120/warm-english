/* ============================================================
   生成 App 图标（暖橙背景 + 白色 W + 心形）
   运行：node tools/gen-icons.js
   纯 Node 实现，无需安装任何依赖
   ============================================================ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- PNG 编码（手工实现） ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; /* 8bit RGBA */
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- 绘制 ---------- */
const W_GLYPH = ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'X.X.X', '.X.X.'];
const HEART_GLYPH = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];

function inRoundRect(px, py, w, h, r) {
  const dx = Math.abs(px - w / 2), dy = Math.abs(py - h / 2);
  const cx = w / 2 - r, cy = h / 2 - r;
  const qx = Math.max(dx - cx, 0), qy = Math.max(dy - cy, 0);
  return Math.sqrt(qx * qx + qy * qy) + Math.min(Math.max(dx - cx, dy - cy), 0) - r <= 0;
}

function makeIcon(size) {
  const out = Buffer.alloc(size * size * 4);
  const SS = 3; /* 3x3 超采样抗锯齿 */
  const r = size * 0.225;
  const wCell = Math.max(1, Math.round(size / 16));
  const W = { g: W_GLYPH, cw: wCell, ch: wCell, w: 5 * wCell, h: 7 * wCell, x: (size - 5 * wCell) / 2, y: Math.round(size * 0.26) };
  const hCell = Math.max(1, Math.round(size / 30));
  const H = { g: HEART_GLYPH, cw: hCell, ch: hCell, w: 7 * hCell, h: 6 * hCell, x: (size - 7 * hCell) / 2, y: Math.round(size * 0.60) };
  function glyphAt(gl, x, y) {
    const gx = Math.floor((x - gl.x) / gl.cw), gy = Math.floor((y - gl.y) / gl.ch);
    if (gx < 0 || gy < 0 || gy >= gl.g.length || gx >= gl.g[0].length) return false;
    return gl.g[gy][gx] === 'X';
  }
  const c1 = [247, 178, 103], c2 = [232, 131, 58]; /* 上浅下深的暖橙渐变 */
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgA = 0, wA = 0, hA = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
        if (inRoundRect(px, py, size, size, r)) bgA++;
        if (glyphAt(W, px, py)) wA++;
        if (glyphAt(H, px, py)) hA++;
      }
      const n = SS * SS, t = y / size;
      const ba = bgA / n;
      let R = c1[0] + (c2[0] - c1[0]) * t;
      let G = c1[1] + (c2[1] - c1[1]) * t;
      let B = c1[2] + (c2[2] - c1[2]) * t;
      let A = ba;
      const wa = Math.max(wA, hA) / n;
      if (wa > 0) {
        R = R * (1 - wa) + 255 * wa;
        G = G * (1 - wa) + 255 * wa;
        B = B * (1 - wa) + 255 * wa;
        A = Math.max(A, wa);
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(R); out[o + 1] = Math.round(G); out[o + 2] = Math.round(B); out[o + 3] = Math.round(A * 255);
    }
  }
  return out;
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
[180, 192, 512].forEach(size => {
  const png = encodePNG(size, makeIcon(size));
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), png);
  console.log('已生成 icons/icon-' + size + '.png (' + png.length + ' 字节)');
});
