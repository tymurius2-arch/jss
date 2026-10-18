// Кубомир — мир: генерация, чанки, свет (небо + факелы), построение мешей, луч выбора блока.
'use strict';
(function () {
  const { Simplex, hash2, hash3, hashStr } = window.CubeNoise;
  const { ID, B, OPAQUE, AOC, ATTEN, EMIT } = window.CubeData;

  const WH = 112, SEA = 48, CS = 16;
  const M = 10, RS = CS + 2 * M, RH = WH + 2, OX = RH * RS, OZ = RH, RSIZE = RS * RS * RH;
  const BIOME = { OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, DESERT: 4, TAIGA: 5, PEAKS: 6, FROZEN: 7, BIRCH: 8 };
  const BIOME_NAMES = ['Океан', 'Пляж', 'Равнины', 'Лес', 'Пустыня', 'Тайга', 'Горы', 'Ледяной океан', 'Березняк'];

  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  class Chunk {
    constructor(cx, cz) {
      this.cx = cx; this.cz = cz;
      this.data = new Uint8Array(CS * CS * WH);
      this.sky = new Uint8Array(CS * CS * WH);
      this.blk = new Uint8Array(CS * CS * WH);
      this.top = 0;
      this.mapB = new Uint8Array(256);
      this.mapH = new Uint8Array(256);
      this.biomes = new Uint8Array(256);
      this.dirty = true; this.meshed = false; this.lit = false;
      this.meshO = null; this.meshW = null;
    }
  }

  // ---------- Буфер вершин ----------
  class MB {
    constructor() { this.cap = 1 << 14; this.p = new Float32Array(this.cap * 3); this.u = new Float32Array(this.cap * 2); this.d = new Float32Array(this.cap * 3); this.n = 0; this.icap = 1 << 15; this.i = new Uint32Array(this.icap); this.ni = 0; }
    reset() { this.n = 0; this.ni = 0; }
    grow() {
      this.cap *= 2;
      const p = new Float32Array(this.cap * 3); p.set(this.p); this.p = p;
      const u = new Float32Array(this.cap * 2); u.set(this.u); this.u = u;
      const d = new Float32Array(this.cap * 3); d.set(this.d); this.d = d;
    }
    v(x, y, z, u, v, a, s, b) {
      if (this.n >= this.cap) this.grow();
      const n = this.n++, p3 = n * 3, p2 = n * 2;
      this.p[p3] = x; this.p[p3 + 1] = y; this.p[p3 + 2] = z;
      this.u[p2] = u; this.u[p2 + 1] = v;
      this.d[p3] = a; this.d[p3 + 1] = s; this.d[p3 + 2] = b;
      return n;
    }
    tri(a, b, c) {
      if (this.ni + 3 > this.icap) { this.icap *= 2; const i = new Uint32Array(this.icap); i.set(this.i); this.i = i; }
      this.i[this.ni++] = a; this.i[this.ni++] = b; this.i[this.ni++] = c;
    }
    out() {
      if (!this.ni) return null;
      return { p: this.p.slice(0, this.n * 3), u: this.u.slice(0, this.n * 2), d: this.d.slice(0, this.n * 3), i: this.i.slice(0, this.ni) };
    }
  }

  // Грани: +X, -X, +Y, -Y, +Z, -Z. Начало, ось u, ось v (u×v = нормаль)
  const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const FO = [[1, 0, 1], [0, 0, 0], [0, 1, 1], [0, 0, 0], [0, 0, 1], [1, 0, 0]];
  const FU = [[0, 0, -1], [0, 0, 1], [1, 0, 0], [1, 0, 0], [1, 0, 0], [-1, 0, 0]];
  const FV = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
  const SHADE = [0.8, 0.8, 1.0, 0.5, 0.65, 0.65];
  const ri = (v) => v[0] * OX + v[1] + v[2] * OZ;
  const FOFF = FN.map(ri), FDU = FU.map(ri), FDV = FV.map(ri);
  const KA = [0, 1, 1, 0], KB = [0, 0, 1, 1];
  const AOV = [0.45, 0.65, 0.83, 1.0];
  const EPS = 0.0008;

  const R = new Uint8Array(RSIZE), SL = new Uint8Array(RSIZE), BL = new Uint8Array(RSIZE);
  const QS = 1 << 21, QM = QS - 1, Q = new Int32Array(QS);
  const OB = new MB(), WB = new MB();

  function bfs(L, head, tail) {
    while (head !== tail) {
      const i = Q[head]; head = (head + 1) & QM;
      const l = L[i];
      if (l <= 1) continue;
      const rx = (i / OX) | 0, rem = i - rx * OX, rz = (rem / RH) | 0, ry = rem - rz * RH;
      let n, b, nl;
      if (rx > 0) { n = i - OX; b = R[n]; if (!OPAQUE[b]) { nl = l - 1 - ATTEN[b]; if (nl > L[n]) { L[n] = nl; Q[tail] = n; tail = (tail + 1) & QM; } } }
      if (rx < RS - 1) { n = i + OX; b = R[n]; if (!OPAQUE[b]) { nl = l - 1 - ATTEN[b]; if (nl > L[n]) { L[n] = nl; Q[tail] = n; tail = (tail + 1) & QM; } } }
      if (rz > 0) { n = i - OZ; b = R[n]; if (!OPAQUE[b]) { nl = l - 1 - ATTEN[b]; if (nl > L[n]) { L[n] = nl; Q[tail] = n; tail = (tail + 1) & QM; } } }
      if (rz < RS - 1) { n = i + OZ; b = R[n]; if (!OPAQUE[b]) { nl = l - 1 - ATTEN[b]; if (nl > L[n]) { L[n] = nl; Q[tail] = n; tail = (tail + 1) & QM; } } }
      if (ry > 1) { n = i - 1; b = R[n]; if (!OPAQUE[b]) { nl = l - 1 - ATTEN[b]; if (nl > L[n]) { L[n] = nl; Q[tail] = n; tail = (tail + 1) & QM; } } }
      if (ry < RH - 2) { n = i + 1; b = R[n]; if (!OPAQUE[b]) { nl = l - 1 - ATTEN[b]; if (nl > L[n]) { L[n] = nl; Q[tail] = n; tail = (tail + 1) & QM; } } }
    }
  }

  class World {
    constructor(seedStr, type = 'normal') {
      this.seedStr = String(seedStr);
      this.seed = hashStr(seedStr);
      this.type = type;
      this.n = [];
      for (let i = 0; i < 12; i++) this.n.push(new Simplex((this.seed + i * 1013904223) >>> 0));
      this.chunks = new Map();
      this.edits = new Map();
      this._h = 0; this._b = 0;
    }
    static key(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }
    getChunk(cx, cz) { return this.chunks.get((cx + 32768) * 65536 + (cz + 32768)); }
    getBlock(x, y, z) {
      if (y < 0) return ID.BEDROCK;
      if (y >= WH) return 0;
      const ch = this.chunks.get(((x >> 4) + 32768) * 65536 + ((z >> 4) + 32768));
      if (!ch) return 0;
      return ch.data[(((x & 15) << 4) | (z & 15)) * WH + y];
    }
    isLoaded(x, z) { return !!this.getChunk(x >> 4, z >> 4); }
    lightAt(x, y, z) {
      if (y >= WH) return [15, 0];
      if (y < 0) return [0, 0];
      const ch = this.getChunk(x >> 4, z >> 4);
      if (!ch || !ch.lit) return [15, 0];
      const i = (((x & 15) << 4) | (z & 15)) * WH + y;
      return [ch.sky[i], ch.blk[i]];
    }
    setBlock(x, y, z, b, record = true) {
      if (y < 0 || y >= WH) return null;
      const ch = this.getChunk(x >> 4, z >> 4);
      if (!ch) return null;
      const lx = x & 15, lz = z & 15, idx = ((lx << 4) | lz) * WH + y;
      ch.data[idx] = b;
      if (b && y > ch.top) ch.top = y;
      if (record) {
        const k = World.key(ch.cx, ch.cz);
        let m = this.edits.get(k);
        if (!m) this.edits.set(k, (m = new Map()));
        m.set(idx, b);
      }
      this.updateMapColumn(ch, lx, lz);
      return ch;
    }
    updateMapColumn(ch, lx, lz) {
      const base = ((lx << 4) | lz) * WH;
      for (let y = Math.min(WH - 1, ch.top); y >= 0; y--) {
        const b = ch.data[base + y];
        if (b && b !== ID.TORCH) { ch.mapB[lx * 16 + lz] = b; ch.mapH[lx * 16 + lz] = y; return; }
      }
      ch.mapB[lx * 16 + lz] = 0; ch.mapH[lx * 16 + lz] = 0;
    }

    // ---------- Рельеф и биомы ----------
    column(x, z) {
      const n = this.n, t = this.type;
      if (t === 'flat') { this._h = 40; this._b = BIOME.PLAINS; return; }
      const c = n[0].fbm2(x / 800, z / 800, 4);
      const d = n[2].fbm2(x / 90, z / 90, 3);
      const rr = 1 - Math.abs(n[3].fbm2(x / 420, z / 420, 4));
      const e = n[1].noise2(x / 500, z / 500);
      let h;
      if (t === 'islands') {
        const isl = smooth(0.25, 0.75, n[4].fbm2(x / 170, z / 170, 3) * 0.5 + 0.5 + c * 0.3);
        h = SEA - 16 + d * 5 + isl * (24 + rr * 18);
      } else {
        const amp = t === 'amplified' ? 1.9 : 1;
        h = SEA + 2 + c * 45 * (t === 'amplified' ? 1.3 : 1) + d * 6 * amp;
        const m = smooth(0.62, 0.95, rr) * smooth(-0.35, 0.35, e);
        h += m * 52 * amp;
      }
      h = Math.round(Math.max(4, Math.min(WH - 14, h)));
      const temp = n[5].noise2(x / 1100, z / 1100) + n[6].noise2(x / 90, z / 90) * 0.05 - Math.max(0, h - SEA - 20) / 80;
      const hum = n[7].noise2(x / 900 + 50, z / 900);
      let b;
      if (h < SEA - 1) b = temp < -0.3 ? BIOME.FROZEN : BIOME.OCEAN;
      else if (h <= SEA + 1 && temp > -0.3) b = BIOME.BEACH;
      else if (h > SEA + 38) b = BIOME.PEAKS;
      else if (temp > 0.25 && hum < 0.15) b = BIOME.DESERT;
      else if (temp < -0.25) b = BIOME.TAIGA;
      else if (hum > 0.3) b = temp < 0.05 ? BIOME.BIRCH : BIOME.FOREST;
      else if (hum > 0.12) b = BIOME.FOREST;
      else b = BIOME.PLAINS;
      this._h = h; this._b = b;
    }
    biomeAt(x, z) { this.column(x, z); return this._b; }

    genChunk(cx, cz) {
      const ch = new Chunk(cx, cz);
      const d = ch.data, x0 = cx * CS, z0 = cz * CS, seed = this.seed, n = this.n;
      const flat = this.type === 'flat';
      const heights = new Int16Array(256);
      // Шум пещер — на сетке с шагом 4, дальше трилинейная интерполяция
      const GY = WH / 4 + 1, GS = 5 * GY * 5;
      const ga = new Float32Array(GS), gb = new Float32Array(GS), gc = new Float32Array(GS);
      if (!flat) {
        for (let gx = 0; gx < 5; gx++) for (let gz = 0; gz < 5; gz++) for (let gy = 0; gy < GY; gy++) {
          const wx = x0 + gx * 4, wy = gy * 4, wz = z0 + gz * 4, gi = (gx * 5 + gz) * GY + gy;
          ga[gi] = n[8].noise3(wx / 48, wy / 28, wz / 48);
          gb[gi] = n[9].noise3(wx / 48, wy / 28, wz / 48);
          gc[gi] = n[10].noise3(wx / 70, wy / 36, wz / 70);
        }
      }
      for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
        const x = x0 + lx, z = z0 + lz;
        this.column(x, z);
        const h = this._h, bio = this._b;
        heights[lx * 16 + lz] = h;
        ch.biomes[lx * 16 + lz] = bio;
        const base = ((lx << 4) | lz) * WH;
        let top = ID.GRASS, fill = ID.DIRT, depth = 3, deep = ID.STONE;
        if (bio === BIOME.TAIGA) top = ID.SNOW_GRASS;
        else if (bio === BIOME.DESERT) { top = ID.SAND; fill = ID.SAND; depth = 4; deep = ID.SANDSTONE; }
        else if (bio === BIOME.BEACH) { top = ID.SAND; fill = ID.SAND; depth = 3; }
        else if (bio === BIOME.OCEAN || bio === BIOME.FROZEN) {
          const fl = n[2].noise2(x / 30, z / 30);
          top = h > SEA - 7 ? ID.SAND : fl > 0.35 ? ID.CLAY : fl < -0.3 ? ID.GRAVEL : ID.SAND;
          fill = top === ID.CLAY ? ID.CLAY : ID.SAND; depth = 2;
        } else if (bio === BIOME.PEAKS) { top = h > SEA + 50 ? ID.SNOW : h > SEA + 44 ? ID.STONE : ID.GRASS; fill = top === ID.GRASS ? ID.DIRT : ID.STONE; depth = 2; }
        for (let y = 0; y <= h; y++) {
          let b;
          if (y === 0) b = ID.BEDROCK;
          else if (y <= 3 && hash3(x, y, z, seed) < [0, 0.6, 0.35, 0.15][y]) b = ID.BEDROCK;
          else if (y === h) b = top;
          else if (y > h - depth - 1) b = fill;
          else if (deep === ID.SANDSTONE && y > h - depth - 5) b = ID.SANDSTONE;
          else b = ID.STONE;
          d[base + y] = b;
        }
        if (!flat) for (let y = h + 1; y <= SEA; y++) d[base + y] = (bio === BIOME.FROZEN && y === SEA) ? ID.ICE : ID.WATER;
        // Пещеры
        if (!flat) {
          const under = h < SEA;
          const ymax = under ? h - 6 : h;
          const gx = lx >> 2, fx = (lx & 3) / 4, gz = lz >> 2, fz = (lz & 3) / 4;
          for (let y = 1; y <= ymax; y++) {
            const cur = d[base + y];
            if (cur === ID.BEDROCK || cur === ID.WATER) continue;
            const gy = y >> 2, fy = (y & 3) / 4;
            const i000 = (gx * 5 + gz) * GY + gy, i100 = i000 + 5 * GY, i010 = i000 + GY, i110 = i100 + GY;
            const L = (g) => {
              const a0 = g[i000] + (g[i000 + 1] - g[i000]) * fy, a1 = g[i100] + (g[i100 + 1] - g[i100]) * fy;
              const b0 = g[i010] + (g[i010 + 1] - g[i010]) * fy, b1 = g[i110] + (g[i110 + 1] - g[i110]) * fy;
              const c0 = a0 + (a1 - a0) * fx, c1 = b0 + (b1 - b0) * fx;
              return c0 + (c1 - c0) * fz;
            };
            const a = L(ga), bb = L(gb);
            let carve = a * a + bb * bb < 0.0042;
            if (!carve && y < h - 7 && y > 4) carve = L(gc) > 0.6;
            if (carve) {
              if (y === h && (cur === ID.SAND || cur === ID.GRAVEL)) continue;
              d[base + y] = y <= 9 ? ID.LAVA : 0;
              if (y + 1 <= h && (d[base + y + 1] === ID.SAND || d[base + y + 1] === ID.GRAVEL)) d[base + y + 1] = ID.SANDSTONE;
            }
          }
        }
        // Руды
        if (!flat) for (let y = 1; y < h - 2; y++) {
          if (d[base + y] !== ID.STONE) continue;
          const rc = hash3(x >> 1, y >> 1, z >> 1, seed + 77);
          if (rc > 0.04) continue;
          if (hash3(x, y, z, seed + 5) > 0.55) continue;
          if (rc < 0.02 && y < 100) d[base + y] = ID.COAL_ORE;
          else if (rc < 0.031 && y < 64) d[base + y] = ID.IRON_ORE;
          else if (rc < 0.035 && y < 32) d[base + y] = ID.GOLD_ORE;
          else if (rc < 0.0385 && y < 18) d[base + y] = ID.DIAMOND_ORE;
          else if (rc >= 0.0385 && y < 60) d[base + y] = ID.GRAVEL;
        }
      }
      // Деревья (в том числе с соседних колонок — кроны заходят в чанк)
      if (!flat) {
        for (let wx = x0 - 3; wx < x0 + 19; wx++) for (let wz = z0 - 3; wz < z0 + 19; wz++) {
          const r = hash2(wx, wz, seed + 101);
          if (r > 0.05) continue;
          this.column(wx, wz);
          const h = this._h, bio = this._b;
          if (h <= SEA || h > WH - 16) continue;
          let chance = 0, kind = 'oak';
          switch (bio) {
            case BIOME.FOREST: chance = 0.045; kind = hash2(wx, wz, seed + 7) < 0.2 ? 'birch' : 'oak'; break;
            case BIOME.BIRCH: chance = 0.04; kind = 'birch'; break;
            case BIOME.TAIGA: chance = 0.03; kind = 'spruce'; break;
            case BIOME.PLAINS: chance = 0.004; break;
            case BIOME.PEAKS: chance = h < SEA + 44 ? 0.01 : 0; kind = 'spruce'; break;
            case BIOME.DESERT: chance = 0.008; kind = 'cactus'; break;
          }
          if (r >= chance) continue;
          const inside = wx >= x0 && wx < x0 + 16 && wz >= z0 && wz < z0 + 16;
          if (inside) {
            const tb = d[(((wx - x0) << 4) | (wz - z0)) * WH + h];
            if (kind === 'cactus' ? tb !== ID.SAND : (tb !== ID.GRASS && tb !== ID.SNOW_GRASS && tb !== ID.DIRT)) continue;
          }
          this.placeTree(ch, wx, h, wz, kind, hash2(wx, wz, seed + 9));
        }
        // Трава, цветы, тыквы, сухие кусты
        for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
          const h = heights[lx * 16 + lz];
          if (h >= WH - 2) continue;
          const base = ((lx << 4) | lz) * WH;
          if (d[base + h + 1] !== 0) continue;
          const tb = d[base + h], bio = ch.biomes[lx * 16 + lz];
          const r = hash2(x0 + lx, z0 + lz, seed + 202);
          if (tb === ID.GRASS) {
            if (bio === BIOME.PLAINS) {
              if (r < 0.14) d[base + h + 1] = ID.TALLGRASS;
              else if (r < 0.155) d[base + h + 1] = ID.FLOWER_RED;
              else if (r < 0.17) d[base + h + 1] = ID.FLOWER_YELLOW;
              else if (r < 0.1715) d[base + h + 1] = ID.PUMPKIN;
            } else if (r < 0.07) d[base + h + 1] = ID.TALLGRASS;
            else if (r < 0.08) d[base + h + 1] = r < 0.075 ? ID.FLOWER_RED : ID.FLOWER_YELLOW;
          } else if (tb === ID.SAND && bio === BIOME.DESERT && r < 0.012) d[base + h + 1] = ID.DEADBUSH;
        }
      }
      // Правки игрока
      const m = this.edits.get(World.key(cx, cz));
      if (m) for (const [i, b] of m) d[i] = b;
      let top = 0;
      for (let c = 0; c < 256; c++) { const base = c * WH; for (let y = WH - 1; y > top; y--) if (d[base + y]) { top = y; break; } }
      ch.top = top;
      for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) this.updateMapColumn(ch, lx, lz);
      this.chunks.set(World.key(cx, cz), ch);
      return ch;
    }

    placeTree(ch, wx, h, wz, kind, r) {
      const x0 = ch.cx * CS, z0 = ch.cz * CS, d = ch.data;
      const set = (x, y, z, b, force) => {
        const lx = x - x0, lz = z - z0;
        if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y >= WH) return;
        const i = ((lx << 4) | lz) * WH + y;
        const cur = d[i];
        if (cur === 0 || cur === ID.TALLGRASS || (force && (cur === ID.LEAVES || cur === ID.BIRCH_LEAVES || cur === ID.SPRUCE_LEAVES))) d[i] = b;
      };
      if (kind === 'cactus') {
        const th = 1 + ((r * 3) | 0);
        for (let y = 1; y <= th; y++) set(wx, h + y, wz, ID.CACTUS, true);
        return;
      }
      if (kind === 'spruce') {
        const th = 6 + ((r * 5) | 0), topY = h + th;
        for (let y = topY + 1; y >= h + 3; y--) {
          const i = topY + 1 - y;
          let rad = i === 0 ? 0 : Math.min(3, Math.ceil(i / 2.4));
          if (i > 1 && i % 2 === 0) rad = Math.max(1, rad - 1);
          for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
            if (Math.abs(dx) + Math.abs(dz) > rad + (rad > 1 ? 1 : 0)) continue;
            set(wx + dx, y, wz + dz, ID.SPRUCE_LEAVES);
          }
        }
        for (let y = 1; y <= th; y++) set(wx, h + y, wz, ID.SPRUCE_LOG, true);
        return;
      }
      const log = kind === 'birch' ? ID.BIRCH_LOG : ID.LOG, leaf = kind === 'birch' ? ID.BIRCH_LEAVES : ID.LEAVES;
      const th = (kind === 'birch' ? 5 : 4) + ((r * 3) | 0), topY = h + th;
      for (let y = topY - 2; y <= topY + 1; y++) {
        const rad = y >= topY ? 1 : 2;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && (y === topY + 1 || hash3(wx + dx, y, wz + dz, this.seed) < 0.5)) continue;
          set(wx + dx, y, wz + dz, leaf);
        }
      }
      for (let y = 1; y <= th; y++) set(wx, h + y, wz, log, true);
    }

    // Дерево из саженца (в уже загруженном мире)
    growTree(x, y, z, kind) {
      const changed = [];
      const put = (px, py, pz, b, force) => {
        const cur = this.getBlock(px, py, pz);
        if (cur === 0 || cur === ID.TALLGRASS || cur === ID.SAPLING || (force && B[cur].cutout && B[cur].full)) { this.setBlock(px, py, pz, b); changed.push([px, py, pz]); }
      };
      const th = 4 + ((Math.random() * 3) | 0), topY = y - 1 + th;
      const leaf = kind === 'birch' ? ID.BIRCH_LEAVES : ID.LEAVES, log = kind === 'birch' ? ID.BIRCH_LOG : ID.LOG;
      for (let yy = topY - 2; yy <= topY + 1; yy++) {
        const rad = yy >= topY ? 1 : 2;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && (yy === topY + 1 || Math.random() < 0.5)) continue;
          put(x + dx, yy, z + dz, leaf);
        }
      }
      for (let i = 0; i < th; i++) put(x, y + i, z, log, true);
      return changed;
    }

    findSpawn() {
      for (let r = 0; r < 2000; r += 16) {
        const steps = Math.max(1, Math.floor(r / 4));
        for (let s = 0; s < steps; s++) {
          const a = (s / steps) * Math.PI * 2;
          const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
          this.column(x, z);
          if (this._h > SEA + 1 && this._b !== BIOME.PEAKS && this._b !== BIOME.OCEAN) return { x: x + 0.5, y: this._h + 1, z: z + 0.5 };
        }
      }
      return { x: 0.5, y: SEA + 12, z: 0.5 };
    }

    // ---------- Свет и меш ----------
    fillRegion(cx, cz) {
      let rtop = 0;
      const near = [];
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) near.push(this.getChunk(cx + i, cz + j));
      for (let rx = 0; rx < RS; rx++) {
        const wx = cx * CS - M + rx, ccx = (wx >> 4) - cx + 1, lx = wx & 15;
        for (let rz = 0; rz < RS; rz++) {
          const wz = cz * CS - M + rz, ccz = (wz >> 4) - cz + 1, lz = wz & 15;
          const ch = near[ccx * 3 + ccz];
          const base = (rx * RS + rz) * RH;
          R[base] = ID.BEDROCK; R[base + RH - 1] = 0;
          if (ch) {
            const s = ((lx << 4) | lz) * WH;
            R.set(ch.data.subarray(s, s + WH), base + 1);
            if (ch.top > rtop) rtop = ch.top;
          } else R.fill(ID.STONE, base + 1, base + 1 + WH);
        }
      }
      return rtop;
    }

    computeLight(rtop) {
      const ymax = Math.min(RH - 2, rtop + 3);
      SL.fill(0); BL.fill(0);
      for (let c = 0; c < RS * RS; c++) {
        const base = c * RH;
        SL[base + RH - 1] = 15;
        let lvl = 15;
        for (let ry = RH - 2; ry >= 1; ry--) {
          const b = R[base + ry];
          if (OPAQUE[b]) break;
          lvl -= ATTEN[b];
          if (lvl <= 0) break;
          SL[base + ry] = lvl;
        }
      }
      let tail = 0;
      for (let rx = 0; rx < RS; rx++) for (let rz = 0; rz < RS; rz++) {
        const base = (rx * RS + rz) * RH;
        for (let ry = 1; ry <= ymax; ry++) {
          const i = base + ry, l = SL[i];
          if (l < 2) continue;
          const need = l - 1;
          if ((rx > 0 && SL[i - OX] < need && !OPAQUE[R[i - OX]]) || (rx < RS - 1 && SL[i + OX] < need && !OPAQUE[R[i + OX]]) ||
              (rz > 0 && SL[i - OZ] < need && !OPAQUE[R[i - OZ]]) || (rz < RS - 1 && SL[i + OZ] < need && !OPAQUE[R[i + OZ]]) ||
              (SL[i - 1] < need && !OPAQUE[R[i - 1]])) { Q[tail] = i; tail = (tail + 1) & QM; }
        }
      }
      bfs(SL, 0, tail);
      tail = 0;
      for (let rx = 0; rx < RS; rx++) for (let rz = 0; rz < RS; rz++) {
        const base = (rx * RS + rz) * RH;
        for (let ry = 1; ry <= ymax; ry++) { const e = EMIT[R[base + ry]]; if (e) { BL[base + ry] = e; Q[tail] = base + ry; tail = (tail + 1) & QM; } }
      }
      if (tail) bfs(BL, 0, tail);
    }

    meshChunk(ch) {
      const rtop = this.fillRegion(ch.cx, ch.cz);
      this.computeLight(rtop);
      for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
        const base = ((lx + M) * RS + (lz + M)) * RH + 1, dst = ((lx << 4) | lz) * WH;
        ch.sky.set(SL.subarray(base, base + WH), dst);
        ch.blk.set(BL.subarray(base, base + WH), dst);
      }
      ch.lit = true;
      OB.reset(); WB.reset();
      const top = Math.min(WH - 1, ch.top + 1);
      for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
        const col = ((lx + M) * RS + (lz + M)) * RH + 1;
        for (let y = 0; y <= top; y++) {
          const i = col + y, b = R[i];
          if (!b) continue;
          const def = B[b];
          if (def.shape === 'cross') { this.addCross(OB, lx, y, lz, def.top, i); continue; }
          if (def.shape === 'torch') { this.addTorch(OB, lx, y, lz, def.top, i); continue; }
          const liquid = def.liquid;
          const h = liquid ? (R[i + 1] === b ? 1 : 0.875) : def.height;
          const mb = def.translucent ? WB : OB;
          for (let f = 0; f < 6; f++) {
            const nb = R[i + FOFF[f]];
            if (nb === b && h === 1) continue;
            if (nb === b && liquid) continue;
            if (OPAQUE[nb] && !(f === 2 && h < 1)) continue;
            if (liquid && B[nb].liquid) continue;
            let t;
            if (f === 2) t = def.top; else if (f === 3) t = def.bottom;
            else if (f === 4 || def.frontSides) t = def.front; else t = def.side;
            this.addFace(mb, lx, y, lz, f, t, h, i, liquid);
          }
        }
      }
      return { o: OB.out(), w: WB.out() };
    }

    addFace(mb, lx, y, lz, f, tile, h, i, noAO) {
      const F = i + FOFF[f], du = FDU[f], dv = FDV[f];
      const o = FO[f], u = FU[f], v = FV[f], shade = SHADE[f];
      const tx = tile % 16, ty = (tile / 16) | 0;
      const side = v[1] !== 0;
      const s0 = OPAQUE[R[F]];
      let ao0 = 0, ao1 = 0, ao2 = 0, ao3 = 0;
      const idx = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const a = KA[k], bb = KB[k];
        let px = o[0] + a * u[0] + bb * v[0], py = o[1] + a * u[1] + bb * v[1], pz = o[2] + a * u[2] + bb * v[2];
        py *= h;
        const tu = (tx + (a ? 1 - EPS : EPS)) / 16;
        let vv = side ? bb * h : bb;
        vv = Math.min(1 - EPS, Math.max(EPS, vv));
        const tv = 1 - (ty + 1 - vv) / 16;
        const s1 = F + (a ? du : -du), s2 = F + (bb ? dv : -dv), c = s1 + (bb ? dv : -dv);
        let ao = 3;
        const o1 = AOC[R[s1]], o2 = AOC[R[s2]];
        if (!noAO) { const o3 = AOC[R[c]]; ao = (o1 && o2) ? 0 : 3 - o1 - o2 - o3; }
        let sk = s0 ? 0 : SL[F], bl = s0 ? 0 : BL[F], cnt = s0 ? 0 : 1;
        if (!OPAQUE[R[s1]]) { sk += SL[s1]; bl += BL[s1]; cnt++; }
        if (!OPAQUE[R[s2]]) { sk += SL[s2]; bl += BL[s2]; cnt++; }
        if (!(o1 && o2) && !OPAQUE[R[c]]) { sk += SL[c]; bl += BL[c]; cnt++; }
        if (cnt) { sk /= cnt; bl /= cnt; }
        idx[k] = mb.v(lx + px, y + py, lz + pz, tu, tv, shade * AOV[ao], sk / 15, bl / 15);
        if (k === 0) ao0 = ao; else if (k === 1) ao1 = ao; else if (k === 2) ao2 = ao; else ao3 = ao;
      }
      if (ao0 + ao2 < ao1 + ao3) { mb.tri(idx[1], idx[2], idx[3]); mb.tri(idx[1], idx[3], idx[0]); }
      else { mb.tri(idx[0], idx[1], idx[2]); mb.tri(idx[0], idx[2], idx[3]); }
    }

    addCross(mb, lx, y, lz, tile, i) {
      const sk = SL[i] / 15, bl = BL[i] / 15;
      const tx = tile % 16, ty = (tile / 16) | 0;
      const u0 = (tx + EPS) / 16, u1 = (tx + 1 - EPS) / 16, v0 = 1 - (ty + 1 - EPS) / 16, v1 = 1 - (ty + EPS) / 16;
      const A = 0.15, Bq = 0.85, H = 0.95;
      const planes = [[A, A, Bq, Bq], [A, Bq, Bq, A]];
      for (const [x1, z1, x2, z2] of planes) {
        const a = mb.v(lx + x1, y, lz + z1, u0, v0, 0.95, sk, bl);
        const b = mb.v(lx + x2, y, lz + z2, u1, v0, 0.95, sk, bl);
        const c = mb.v(lx + x2, y + H, lz + z2, u1, v1, 0.95, sk, bl);
        const d = mb.v(lx + x1, y + H, lz + z1, u0, v1, 0.95, sk, bl);
        mb.tri(a, b, c); mb.tri(a, c, d); mb.tri(a, c, b); mb.tri(a, d, c);
      }
    }

    addTorch(mb, lx, y, lz, tile, i) {
      const sk = SL[i] / 15;
      const tx = tile % 16, ty = (tile / 16) | 0;
      const x0 = 7 / 16, x1 = 9 / 16, y1 = 10 / 16;
      for (let f = 0; f < 5; f++) {
        if (f === 3) continue;
        const o = FO[f], u = FU[f], v = FV[f], shade = SHADE[f];
        const ids = [];
        for (let k = 0; k < 4; k++) {
          const a = KA[k], bb = KB[k];
          const ux = o[0] + a * u[0] + bb * v[0], uy = o[1] + a * u[1] + bb * v[1], uz = o[2] + a * u[2] + bb * v[2];
          const px = x0 + ux * (x1 - x0), py = uy * y1, pz = x0 + uz * (x1 - x0);
          let tu, tv;
          if (f === 2) { tu = (tx + (7 + a * 2) / 16) / 16; tv = 1 - (ty + (6 + bb * 2) / 16) / 16; }
          else { tu = (tx + (7 + a * 2) / 16) / 16; tv = 1 - (ty + 1 - bb * y1) / 16; }
          ids.push(mb.v(lx + px, y + py, lz + pz, tu, tv, shade, sk, 1));
        }
        mb.tri(ids[0], ids[1], ids[2]); mb.tri(ids[0], ids[2], ids[3]);
      }
    }

    // Луч выбора блока (алгоритм Amanatides–Woo)
    raycast(ox, oy, oz, dx, dy, dz, maxD, test) {
      let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
      const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
      const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
      let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : Infinity;
      let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : Infinity;
      let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : Infinity;
      let nx = 0, ny = 0, nz = 0, t = 0;
      for (let it = 0; it < 256; it++) {
        const b = this.getBlock(x, y, z);
        if (b > 0 && test(b, x, y, z)) return { x, y, z, nx, ny, nz, b, t };
        if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
        else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
        else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
        if (t > maxD) return null;
      }
      return null;
    }

    serializeEdits() {
      const o = {};
      for (const [k, m] of this.edits) {
        if (!m.size) continue;
        const a = [];
        for (const [i, b] of m) a.push(i.toString(36) + '.' + b.toString(36));
        o[k] = a.join(',');
      }
      return o;
    }
    loadEdits(o) {
      this.edits.clear();
      if (!o) return;
      for (const k of Object.keys(o)) {
        const m = new Map();
        for (const part of o[k].split(',')) { const [i, b] = part.split('.'); m.set(parseInt(i, 36), parseInt(b, 36)); }
        this.edits.set(+k, m);
      }
    }
  }

  window.CubeWorld = { World, Chunk, WH, SEA, CS, M, BIOME, BIOME_NAMES };
})();
