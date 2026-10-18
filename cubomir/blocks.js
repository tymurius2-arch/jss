// Кубомир — блоки, предметы, текстуры (рисуются кодом), иконки и рецепты.
'use strict';
(function () {
  const { mulberry32 } = window.CubeNoise;

  // ---------- Текстурный атлас 16×16 плиток по 16×16 пикселей ----------
  const TS = 16, AT = 16, AP = TS * AT;
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = AP;
  const actx = atlas.getContext('2d');
  const img = actx.createImageData(AP, AP);
  const D = img.data;
  const TILE = {};
  let tileCount = 0;
  const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

  function px(t, x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    const X = (t % AT) * TS + x, Y = ((t / AT) | 0) * TS + y;
    const i = (Y * AP + X) * 4;
    D[i] = cl(r); D[i + 1] = cl(g); D[i + 2] = cl(b); D[i + 3] = cl(a);
  }
  function get(t, x, y) {
    const X = (t % AT) * TS + x, Y = ((t / AT) | 0) * TS + y;
    const i = (Y * AP + X) * 4;
    return [D[i], D[i + 1], D[i + 2], D[i + 3]];
  }
  function fill(t, c, v, rnd, a = 255) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = 1 + (rnd() - 0.5) * v;
      px(t, x, y, c[0] * k, c[1] * k, c[2] * k, a);
    }
  }
  function speck(t, c, n, rnd, size = 1, v = 0.15) {
    for (let i = 0; i < n; i++) {
      const x = (rnd() * 16) | 0, y = (rnd() * 16) | 0;
      for (let j = 0; j < size; j++) {
        const k = 1 + (rnd() - 0.5) * v;
        px(t, x + ((rnd() * 3) | 0) - 1, y + ((rnd() * 3) | 0) - 1, c[0] * k, c[1] * k, c[2] * k);
      }
    }
  }
  function copyTile(dst, src) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = get(src, x, y); px(dst, x, y, c[0], c[1], c[2], c[3]); }
  }
  function tile(name, painter) {
    const t = tileCount++;
    TILE[name] = t;
    const seed = [...name].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 16777619)) >>> 0, 2166136261);
    painter(t, mulberry32(seed));
    return t;
  }
  function voronoiStones(t, base, rnd, mortar, cells = 9, vv = 0.25) {
    const pts = [];
    for (let i = 0; i < cells; i++) pts.push([rnd() * 16, rnd() * 16, 0.8 + rnd() * 0.4]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let d1 = 1e9, d2 = 1e9, k = 1;
      for (const p of pts) for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
        const dx = x - p[0] - ox, dy = y - p[1] - oy, d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) { d2 = d1; d1 = d; k = p[2]; } else if (d < d2) d2 = d;
      }
      const e = 1 + (rnd() - 0.5) * vv;
      if (d2 - d1 < 1.1) px(t, x, y, mortar[0] * e, mortar[1] * e, mortar[2] * e);
      else { const hl = d1 < 1.5 ? 1.1 : 1; px(t, x, y, base[0] * k * e * hl, base[1] * k * e * hl, base[2] * k * e * hl); }
    }
  }
  function bricks(t, base, mortar, rnd, rowH = 4, w = 8) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = (y / rowH) | 0, off = (row % 2) * (w / 2);
      const m = y % rowH === rowH - 1 || (x + off) % w === w - 1;
      const k = 1 + (rnd() - 0.5) * 0.18;
      const c = m ? mortar : base;
      px(t, x, y, c[0] * k, c[1] * k, c[2] * k);
    }
  }
  function ore(t, rnd, col, n = 6) {
    fill(t, [125, 125, 125], 0.22, rnd);
    for (let i = 0; i < n; i++) {
      const cx = 2 + rnd() * 12, cy = 2 + rnd() * 12;
      for (let j = 0; j < 4; j++) {
        const x = (cx + (rnd() - 0.5) * 3) | 0, y = (cy + (rnd() - 0.5) * 3) | 0;
        const k = 0.8 + rnd() * 0.4;
        px(t, x, y, col[0] * k, col[1] * k, col[2] * k);
      }
    }
  }
  function wool(t, c, rnd) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = 0.9 + 0.1 * Math.sin((x + y * 0.5) * 1.3) * Math.cos(y * 1.1 - x * 0.4) + (rnd() - 0.5) * 0.08;
      px(t, x, y, c[0] * k, c[1] * k, c[2] * k);
    }
  }
  function logSide(t, c, rnd) {
    for (let x = 0; x < 16; x++) {
      const kx = 0.85 + 0.25 * Math.abs(Math.sin(x * 1.7 + rnd()));
      for (let y = 0; y < 16; y++) { const k = kx * (1 + (rnd() - 0.5) * 0.15); px(t, x, y, c[0] * k, c[1] * k, c[2] * k); }
    }
  }
  function logTop(t, bark, inner, rnd) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const k = 1 + (rnd() - 0.5) * 0.1;
      if (d > 6.5) px(t, x, y, bark[0] * k, bark[1] * k, bark[2] * k);
      else { const r = (d | 0) % 2 ? 0.85 : 1; px(t, x, y, inner[0] * r * k, inner[1] * r * k, inner[2] * r * k); }
    }
  }
  function leaves(t, c, rnd, holes = 0.22) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (rnd() < holes) { px(t, x, y, 0, 0, 0, 0); continue; }
      const k = 0.7 + rnd() * 0.5;
      px(t, x, y, c[0] * k, c[1] * k, c[2] * k);
    }
  }
  function planks(t, c, rnd) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = (y / 4) | 0;
      const seam = y % 4 === 3 || ((x + row * 5) % 16 === 0 && y % 4 !== 3);
      const grain = 1 + 0.08 * Math.sin(x * 0.9 + row * 3) + (rnd() - 0.5) * 0.1;
      const k = seam ? 0.62 : grain;
      px(t, x, y, c[0] * k, c[1] * k, c[2] * k);
    }
  }
  function plant(t, rnd, stem, flower) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(t, x, y, 0, 0, 0, 0);
    if (!flower) {
      for (let i = 0; i < 9; i++) {
        const x0 = 1 + ((rnd() * 14) | 0), hgt = 5 + ((rnd() * 10) | 0), lean = (rnd() - 0.5) * 0.5;
        for (let j = 0; j < hgt; j++) { const k = 0.7 + j / hgt * 0.5; px(t, (x0 + lean * j) | 0, 15 - j, stem[0] * k, stem[1] * k, stem[2] * k); }
      }
    } else {
      for (let y = 7; y < 16; y++) px(t, 7 + (y > 11 ? 1 : 0), y, stem[0], stem[1], stem[2]);
      px(t, 6, 11, stem[0], stem[1], stem[2]); px(t, 9, 12, stem[0], stem[1], stem[2]);
      const pts = [[7, 3], [6, 4], [8, 4], [7, 5], [6, 5], [8, 5], [5, 4], [9, 4], [7, 2], [7, 6], [6, 3], [8, 3], [6, 6], [8, 6]];
      for (const [x, y] of pts) { const k = 0.85 + rnd() * 0.3; px(t, x, y, flower[0] * k, flower[1] * k, flower[2] * k); }
      px(t, 7, 4, 250, 230, 90);
    }
  }
  const MAPS = {
    pickaxe: ['................','...HHHHHHHH.....','..Hhhhhhhhhh....','..H......sHh....','........sS.Hh...','.......sS...Hh..','......sS.....H..','.....sS.......H.','....sS..........','...sS...........','..sS............','.sS.............','sS..............','................','................','................'],
    axe: ['................','.....HH.........','....HHHH........','...HHHHHs.......','...HhHHsS.......','....hHsS........','.....sS.........','....sS..........','...sS...........','..sS............','.sS.............','sS..............','................','................','................','................'],
    shovel: ['............HHH.','...........HHHHH','...........HhHHH','..........sHHHh.','.........sS.hh..','........sS......','.......sS.......','......sS........','.....sS.........','....sS..........','...sS...........','..sS............','.sS.............','sS..............','................','................'],
    sword: ['.............hHH','............hHHh','...........hHHh.','..........hHHh..','.........hHHh...','........hHHh....','.......hHHh.....','..ss..hHHh......','..sSShHHh.......','...sSHHh........','....sSh.........','...sSSs.........','..sSs.ss........','.sSs............','sSs.............','ss..............'],
  };
  function charMap(t, map, pal) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const ch = map[y][x], c = pal[ch];
      if (c) px(t, x, y, c[0], c[1], c[2], c[3] ?? 255); else px(t, x, y, 0, 0, 0, 0);
    }
  }
  function blank(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(t, x, y, 0, 0, 0, 0); }
  function disc(t, cx, cy, r, c, rnd, v = 0.2) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r) { const k = 1 + (rnd() - 0.5) * v - (d / r) * 0.15; px(t, x, y, c[0] * k, c[1] * k, c[2] * k); }
    }
  }

  const C = {
    grass: [95, 159, 53], dirt: [134, 96, 67], stone: [125, 125, 125], sand: [219, 207, 163],
    oak: [104, 83, 50], oakIn: [176, 143, 88], plank: [162, 130, 78], birch: [216, 215, 206], birchIn: [196, 178, 123],
    spruce: [58, 40, 24], spruceIn: [125, 94, 57], leaf: [58, 135, 38], bleaf: [104, 158, 74], sleaf: [40, 88, 52],
  };

  tile('grass_top', (t, r) => { fill(t, C.grass, 0.32, r); speck(t, [70, 130, 40], 14, r); });
  tile('dirt', (t, r) => { fill(t, C.dirt, 0.35, r); speck(t, [100, 70, 48], 12, r); speck(t, [160, 120, 90], 6, r); });
  tile('grass_side', (t, r) => {
    copyTile(t, TILE.dirt);
    for (let x = 0; x < 16; x++) { const h = 3 + ((r() * 3) | 0); for (let y = 0; y < h; y++) { const k = 1 + (r() - 0.5) * 0.3; px(t, x, y, C.grass[0] * k, C.grass[1] * k, C.grass[2] * k); } }
  });
  tile('stone', (t, r) => { fill(t, C.stone, 0.2, r); speck(t, [105, 105, 105], 18, r, 2); speck(t, [145, 145, 145], 8, r); });
  tile('cobble', (t, r) => voronoiStones(t, [130, 130, 130], r, [80, 80, 80]));
  tile('mossy', (t, r) => { voronoiStones(t, [125, 128, 120], r, [72, 78, 70]); speck(t, [70, 120, 50], 26, r, 2); });
  tile('sand', (t, r) => { fill(t, C.sand, 0.12, r); speck(t, [200, 185, 140], 10, r); });
  tile('water', (t, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const w = Math.sin((x + y * 0.6) * 0.8) * 0.5 + 0.5;
      const k = 0.85 + w * 0.2 + (r() - 0.5) * 0.06;
      px(t, x, y, 44 * k, 92 * k, 216 * k, 170);
    }
  });
  tile('lava', (t, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const w = Math.sin(x * 0.7 + Math.cos(y * 0.6) * 2) * 0.5 + 0.5;
      const k = 0.8 + w * 0.35 + (r() - 0.5) * 0.1;
      px(t, x, y, 255 * k, (110 + 80 * w) * k, 20 * k);
    }
  });
  tile('log_side', (t, r) => logSide(t, C.oak, r));
  tile('log_top', (t, r) => logTop(t, C.oak, C.oakIn, r));
  tile('birch_side', (t, r) => {
    fill(t, C.birch, 0.08, r);
    for (let i = 0; i < 9; i++) { const x = (r() * 14) | 0, y = (r() * 16) | 0, w = 1 + ((r() * 3) | 0); for (let j = 0; j < w; j++) px(t, x + j, y, 40, 40, 36); }
  });
  tile('birch_top', (t, r) => logTop(t, C.birch, C.birchIn, r));
  tile('spruce_side', (t, r) => logSide(t, C.spruce, r));
  tile('spruce_top', (t, r) => logTop(t, C.spruce, C.spruceIn, r));
  tile('leaves', (t, r) => leaves(t, C.leaf, r));
  tile('birch_leaves', (t, r) => leaves(t, C.bleaf, r));
  tile('spruce_leaves', (t, r) => leaves(t, C.sleaf, r, 0.15));
  tile('planks', (t, r) => planks(t, C.plank, r));
  tile('glass', (t, r) => {
    blank(t);
    for (let i = 0; i < 16; i++) { px(t, i, 0, 220, 240, 255, 230); px(t, i, 15, 200, 225, 245, 230); px(t, 0, i, 220, 240, 255, 230); px(t, 15, i, 200, 225, 245, 230); }
    for (let i = 0; i < 4; i++) { px(t, 3 + i, 6 - i, 240, 250, 255, 220); px(t, 9 + i, 12 - i, 240, 250, 255, 200); }
  });
  tile('coal_ore', (t, r) => ore(t, r, [30, 30, 30]));
  tile('iron_ore', (t, r) => ore(t, r, [216, 175, 147]));
  tile('gold_ore', (t, r) => ore(t, r, [250, 220, 60]));
  tile('diamond_ore', (t, r) => ore(t, r, [90, 235, 225]));
  tile('bedrock', (t, r) => { fill(t, [82, 82, 82], 0.9, r); });
  tile('snow', (t, r) => fill(t, [242, 250, 255], 0.06, r));
  tile('snow_side', (t, r) => {
    copyTile(t, TILE.dirt);
    for (let x = 0; x < 16; x++) { const h = 3 + ((r() * 3) | 0); for (let y = 0; y < h; y++) px(t, x, y, 240, 248, 255); }
  });
  tile('ice', (t, r) => {
    fill(t, [150, 190, 250], 0.08, r, 200);
    for (let i = 0; i < 5; i++) { const x = (r() * 12) | 0, y = (r() * 12) | 0; for (let j = 0; j < 4; j++) px(t, x + j, y + j, 220, 235, 255, 220); }
  });
  tile('cactus_side', (t, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = (x === 0 || x === 15) ? 0.6 : (x % 4 === 1 ? 0.8 : 1) * (1 + (r() - 0.5) * 0.12);
      px(t, x, y, 75 * k, 135 * k, 45 * k);
    }
    for (let i = 0; i < 10; i++) px(t, ((r() * 7) | 0) * 2 + 1, (r() * 16) | 0, 30, 30, 20);
  });
  tile('cactus_top', (t, r) => { fill(t, [85, 145, 55], 0.12, r); for (let i = 0; i < 16; i++) { px(t, i, 0, 50, 90, 30); px(t, i, 15, 50, 90, 30); px(t, 0, i, 50, 90, 30); px(t, 15, i, 50, 90, 30); } });
  tile('brick', (t, r) => bricks(t, [150, 74, 58], [180, 170, 160], r));
  tile('stonebrick', (t, r) => bricks(t, [122, 122, 122], [80, 80, 80], r, 8, 16));
  tile('torch', (t, r) => {
    blank(t);
    for (let y = 8; y < 16; y++) { px(t, 7, y, 120, 88, 50); px(t, 8, y, 95, 68, 38); }
    px(t, 7, 6, 255, 240, 120); px(t, 8, 6, 255, 210, 80); px(t, 7, 7, 255, 170, 40); px(t, 8, 7, 240, 120, 30);
  });
  tile('table_top', (t, r) => {
    planks(t, C.plank, r);
    for (let i = 0; i < 16; i++) { px(t, i, 0, 90, 66, 40); px(t, i, 15, 90, 66, 40); px(t, 0, i, 90, 66, 40); px(t, 15, i, 90, 66, 40); px(t, 7, i, 110, 82, 50); px(t, i, 7, 110, 82, 50); }
  });
  tile('table_side', (t, r) => {
    planks(t, C.plank, r);
    for (let i = 0; i < 16; i++) { px(t, i, 0, 90, 66, 40); px(t, i, 1, 90, 66, 40); }
    for (let y = 4; y < 12; y++) px(t, 4, y, 70, 70, 70);
    for (let x = 2; x < 7; x++) px(t, x, 4, 140, 140, 140);
    for (let y = 5; y < 13; y++) px(t, 11, y, 110, 80, 45);
    for (let x = 9; x < 14; x++) { px(t, x, 4, 160, 160, 160); px(t, x, 5, 130, 130, 130); }
  });
  tile('tallgrass', (t, r) => plant(t, r, [80, 150, 50]));
  tile('flower_red', (t, r) => plant(t, r, [60, 130, 40], [220, 30, 40]));
  tile('flower_yellow', (t, r) => plant(t, r, [60, 130, 40], [250, 220, 40]));
  tile('dead_bush', (t, r) => {
    blank(t);
    const br = (x, y, dx, dy, n) => { for (let i = 0; i < n; i++) px(t, (x + dx * i) | 0, (y + dy * i) | 0, 130, 90, 45); };
    br(8, 15, 0, -1, 6); br(8, 10, -0.7, -1, 6); br(8, 11, 0.8, -1, 6); br(5, 7, -0.5, -1, 3); br(11, 7, 0.6, -1, 4);
  });
  tile('sapling', (t, r) => {
    blank(t);
    for (let y = 9; y < 16; y++) px(t, 7, y, 110, 80, 45);
    for (let y = 2; y < 11; y++) for (let x = 3; x < 13; x++) if (Math.hypot(x - 7.5, (y - 6) * 1.2) < 4.6 && r() > 0.2) { const k = 0.7 + r() * 0.5; px(t, x, y, 60 * k, 140 * k, 40 * k); }
  });
  tile('gravel', (t, r) => {
    fill(t, [130, 124, 120], 0.2, r);
    for (let i = 0; i < 26; i++) { const c = r() < 0.5 ? [100, 95, 92] : [165, 155, 150]; const x = (r() * 16) | 0, y = (r() * 16) | 0; px(t, x, y, ...c); px(t, x + 1, y, ...c); px(t, x, y + 1, ...c); }
  });
  tile('sandstone_side', (t, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const band = y < 3 ? 1.05 : y > 12 ? 0.88 : (y % 4 === 0 ? 0.93 : 1);
      const k = band * (1 + (r() - 0.5) * 0.08); px(t, x, y, 216 * k, 202 * k, 155 * k);
    }
  });
  tile('sandstone_top', (t, r) => fill(t, [220, 206, 160], 0.08, r));
  tile('wool', (t, r) => wool(t, [234, 236, 236], r));
  tile('wool_red', (t, r) => wool(t, [161, 39, 34], r));
  tile('wool_blue', (t, r) => wool(t, [53, 57, 157], r));
  tile('wool_green', (t, r) => wool(t, [84, 109, 27], r));
  tile('wool_yellow', (t, r) => wool(t, [249, 198, 39], r));
  tile('wool_black', (t, r) => wool(t, [30, 30, 34], r));
  tile('tnt_side', (t, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = 1 + (r() - 0.5) * 0.1;
      if (y >= 5 && y <= 10) px(t, x, y, 235 * k, 235 * k, 235 * k);
      else px(t, x, y, (x % 4 === 0 ? 170 : 210) * k, 45 * k, 35 * k);
    }
    const L = ['###.#..#.###', '.#..##.#..#.', '.#..#.##..#.', '.#..#..#..#.'];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 12; x++) if (L[y][x] === '#') px(t, 2 + x, 6 + y, 20, 20, 20);
  });
  tile('tnt_top', (t, r) => { fill(t, [200, 50, 40], 0.12, r); disc(t, 7.5, 7.5, 2.2, [70, 70, 70], r); px(t, 7, 7, 230, 200, 150); });
  tile('tnt_bottom', (t, r) => fill(t, [190, 45, 35], 0.12, r));
  tile('bookshelf', (t, r) => {
    planks(t, C.plank, r);
    const cols = [[160, 40, 40], [40, 80, 160], [40, 130, 60], [190, 160, 60], [110, 50, 130], [200, 200, 190]];
    for (const yy of [1, 9]) {
      let x = 1;
      while (x < 15) { const w = 1 + ((r() * 2) | 0), c = cols[(r() * cols.length) | 0], h = 5 + ((r() * 2) | 0); for (let i = 0; i < w && x < 15; i++, x++) for (let y = 0; y < h; y++) px(t, x, yy + 6 - y, c[0], c[1], c[2]); x++; }
    }
  });
  tile('glowstone', (t, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const cell = ((x >> 2) * 7 + (y >> 2) * 13) % 5, k = 0.7 + cell * 0.08 + r() * 0.12;
      px(t, x, y, 255 * k, 205 * k, 110 * k);
    }
  });
  tile('furnace_side', (t, r) => { fill(t, [120, 120, 120], 0.2, r); for (let i = 0; i < 16; i++) { px(t, i, 0, 90, 90, 90); px(t, i, 15, 90, 90, 90); } });
  tile('furnace_top', (t, r) => { fill(t, [110, 110, 110], 0.18, r); });
  tile('furnace_front', (t, r) => {
    copyTile(t, TILE.furnace_side);
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) px(t, x, y, 25, 22, 20);
    for (let x = 5; x < 11; x++) { px(t, x, 12, 255, 140 + r() * 60, 30); px(t, x, 13, 230, 90, 20); }
    for (let x = 3; x < 13; x++) px(t, x, 3, 60, 60, 60);
  });
  tile('clay', (t, r) => fill(t, [160, 166, 179], 0.08, r));
  tile('pumpkin_side', (t, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = (x % 4 === 0 ? 0.78 : 1) * (1 + (r() - 0.5) * 0.08); px(t, x, y, 228 * k, 135 * k, 25 * k); }
  });
  tile('pumpkin_top', (t, r) => { fill(t, [210, 125, 25], 0.1, r); for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(t, x, y, 90, 70, 30); });
  const face = (t, lit) => {
    const eye = lit ? [255, 220, 90] : [40, 22, 8];
    for (const [ex, ey] of [[3, 4], [10, 4]]) for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (y >= 2 - x || true) px(t, ex + x, ey + y, ...eye);
    for (let x = 3; x < 13; x++) px(t, x, 10, ...eye);
    for (let x = 4; x < 12; x++) px(t, x, 11, ...eye);
    px(t, 5, 9, ...eye); px(t, 10, 9, ...eye); px(t, 7, 12, ...eye); px(t, 8, 12, ...eye);
  };
  tile('pumpkin_face', (t, r) => { copyTile(t, TILE.pumpkin_side); face(t, false); });
  tile('jack_face', (t, r) => { copyTile(t, TILE.pumpkin_side); face(t, true); });
  const metal = (t, r, c) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15, hi = x === 1 || y === 1;
      const k = (edge ? 0.75 : hi ? 1.12 : 1) * (1 + (r() - 0.5) * 0.06);
      px(t, x, y, c[0] * k, c[1] * k, c[2] * k);
    }
  };
  tile('iron_block', (t, r) => metal(t, r, [220, 220, 222]));
  tile('gold_block', (t, r) => metal(t, r, [250, 215, 60]));
  tile('diamond_block', (t, r) => metal(t, r, [100, 230, 225]));
  tile('obsidian', (t, r) => { fill(t, [22, 16, 34], 0.4, r); speck(t, [70, 45, 110], 10, r, 2); });
  tile('bed_top', (t, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = 1 + (r() - 0.5) * 0.08;
      if (y < 5) px(t, x, y, 235 * k, 235 * k, 235 * k); else px(t, x, y, 170 * k, 30 * k, 35 * k);
    }
  });
  tile('bed_side', (t, r) => {
    blank(t);
    for (let x = 0; x < 16; x++) {
      for (let y = 7; y < 11; y++) { const k = 1 + (r() - 0.5) * 0.08; px(t, x, y, 170 * k, 30 * k, 35 * k); }
      for (let y = 11; y < 13; y++) px(t, x, y, 150, 115, 70);
    }
    for (let y = 13; y < 16; y++) for (const x of [0, 1, 14, 15]) px(t, x, y, 120, 90, 55);
  });
  // ---- предметы ----
  tile('stick', (t, r) => { blank(t); for (let i = 0; i < 11; i++) { px(t, 3 + i, 13 - i, 120, 88, 50); px(t, 4 + i, 13 - i, 85, 60, 32); } });
  tile('coal', (t, r) => { blank(t); disc(t, 7.5, 8, 5, [40, 40, 42], r, 0.4); speck(t, [80, 80, 85], 0, r); px(t, 6, 6, 90, 90, 95); px(t, 9, 9, 80, 80, 85); });
  const ingot = (t, r, c) => {
    blank(t);
    for (let y = 6; y < 11; y++) for (let x = 2 + (10 - y); x < 14 - (y - 6) * 0.3; x++) {
      const k = (y === 6 ? 1.2 : y === 10 ? 0.7 : 1) * (1 + (r() - 0.5) * 0.05);
      px(t, x | 0, y, c[0] * k, c[1] * k, c[2] * k);
    }
  };
  tile('iron_ingot', (t, r) => ingot(t, r, [215, 215, 215]));
  tile('gold_ingot', (t, r) => ingot(t, r, [250, 210, 50]));
  tile('diamond', (t, r) => {
    blank(t);
    for (let y = 3; y < 14; y++) { const w = y < 7 ? (y - 3) * 1.3 + 2 : (13 - y) * 0.9 + 1; for (let x = Math.round(7.5 - w); x <= Math.round(7.5 + w); x++) { const k = 0.75 + ((x + y) % 3) * 0.15; px(t, x, y, 90 * k, 240 * k, 230 * k); } }
    px(t, 6, 5, 230, 255, 255); px(t, 5, 6, 230, 255, 255);
  });
  tile('flint', (t, r) => { blank(t); for (let y = 3; y < 13; y++) for (let x = 5 + ((13 - y) >> 2); x < 11 + (y >> 3); x++) { const k = 0.8 + r() * 0.3; px(t, x, y, 50 * k, 50 * k, 55 * k); } });
  tile('apple', (t, r) => {
    blank(t); disc(t, 7.5, 9, 5, [210, 30, 35], r, 0.15);
    px(t, 5, 7, 255, 160, 160); px(t, 6, 6, 255, 140, 140);
    px(t, 8, 3, 100, 70, 40); px(t, 8, 4, 100, 70, 40); px(t, 9, 3, 60, 150, 40); px(t, 10, 2, 60, 150, 40);
  });
  const meat = (t, r, c, fat) => {
    blank(t);
    for (let y = 4; y < 13; y++) for (let x = 3; x < 14; x++) if (Math.hypot((x - 8) / 5.5, (y - 8.5) / 4.2) < 1) { const k = 0.85 + r() * 0.25; px(t, x, y, c[0] * k, c[1] * k, c[2] * k); }
    for (let x = 5; x < 12; x++) px(t, x, 7 + (x % 3 === 0 ? 1 : 0), fat[0], fat[1], fat[2]);
  };
  tile('meat', (t, r) => meat(t, r, [230, 110, 120], [250, 210, 210]));
  tile('meat_cooked', (t, r) => meat(t, r, [150, 85, 45], [200, 150, 90]));
  tile('rotten', (t, r) => meat(t, r, [120, 110, 60], [90, 130, 60]));
  tile('gunpowder', (t, r) => { blank(t); for (let i = 0; i < 70; i++) { const a = r() * Math.PI, d = r() * 5.5; px(t, (7.5 + Math.cos(a) * d * 1.2) | 0, (13 - Math.sin(a) * d) | 0, 80 + r() * 60, 80 + r() * 60, 80 + r() * 60); } });
  const MATS = [
    { key: 'wood', h: [150, 115, 65], d: [100, 75, 40] },
    { key: 'stone', h: [140, 140, 140], d: [90, 90, 90] },
    { key: 'iron', h: [230, 230, 230], d: [150, 150, 150] },
    { key: 'gold', h: [255, 225, 70], d: [190, 150, 30] },
    { key: 'diamond', h: [100, 240, 230], d: [40, 160, 160] },
  ];
  const KINDS = ['pickaxe', 'axe', 'shovel', 'sword'];
  for (const k of KINDS) for (const m of MATS) tile(k + '_' + m.key, (t) => charMap(t, MAPS[k], { H: m.h, h: m.d, S: [120, 88, 50], s: [80, 58, 30] }));
  for (let s = 0; s < 8; s++) tile('crack' + s, (t, r) => {
    blank(t);
    const n = 2 + s * 2;
    for (let i = 0; i < n; i++) {
      let x = 7.5, y = 7.5; const a = r() * Math.PI * 2; const len = 3 + s * 0.8 + r() * 3;
      for (let j = 0; j < len; j++) { x += Math.cos(a + (r() - 0.5)); y += Math.sin(a + (r() - 0.5)); px(t, x | 0, y | 0, 20, 20, 20, 200); }
    }
  });

  actx.putImageData(img, 0, 0);

  // Средний цвет плитки — для частиц и мини-карты
  const tileAvg = [];
  for (let t = 0; t < tileCount; t++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = get(t, x, y); if (c[3] > 100) { r += c[0]; g += c[1]; b += c[2]; n++; } }
    tileAvg[t] = n ? [r / n, g / n, b / n] : [128, 128, 128];
  }

  // ---------- Блоки ----------
  const ID = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, PLANKS: 8, COBBLE: 9, GLASS: 10,
    COAL_ORE: 11, IRON_ORE: 12, GOLD_ORE: 13, DIAMOND_ORE: 14, BEDROCK: 15, SNOW_GRASS: 16, ICE: 17, CACTUS: 18,
    BIRCH_LOG: 19, BIRCH_LEAVES: 20, SPRUCE_LOG: 21, SPRUCE_LEAVES: 22, BRICK: 23, TORCH: 24, TABLE: 25,
    TALLGRASS: 26, FLOWER_RED: 27, FLOWER_YELLOW: 28, GRAVEL: 29, SANDSTONE: 30, WOOL: 31, TNT: 32, BOOKSHELF: 33,
    LAVA: 34, GLOWSTONE: 35, STONEBRICK: 36, FURNACE: 37, CLAY: 38, PUMPKIN: 39, IRON_BLOCK: 40, GOLD_BLOCK: 41,
    DIAMOND_BLOCK: 42, DEADBUSH: 43, OBSIDIAN: 44, WOOL_RED: 45, WOOL_BLUE: 46, WOOL_GREEN: 47, WOOL_YELLOW: 48,
    WOOL_BLACK: 49, SAPLING: 50, BED: 51, JACK: 52, SNOW: 53, MOSSY: 54,
    STICK: 256, COAL: 257, IRON: 258, GOLD: 259, DIAMOND: 260, FLINT: 261, APPLE: 262, MEAT: 263, MEAT_COOKED: 264,
    ROTTEN: 265, GUNPOWDER: 266,
  };
  const B = [];
  const T = TILE;
  function block(id, name, o) {
    const t = o.t || [o.tile, o.tile, o.tile];
    B[id] = Object.assign({
      id, name, opaque: true, full: true, solid: true, shape: 'cube', cutout: false, translucent: false, liquid: false,
      emit: 0, atten: 0, hardness: 1, tool: null, tier: 0, drop: id, gravity: false, height: 1, sound: 'stone',
      top: t[0], side: t[1], bottom: t[2], front: o.front ?? t[1], frontSides: o.frontSides || 0,
    }, o);
  }
  const plantOpts = { opaque: false, full: false, solid: false, shape: 'cross', cutout: true, hardness: 0, sound: 'grass', support: 'soil' };
  block(ID.GRASS, 'Трава', { t: [T.grass_top, T.grass_side, T.dirt], hardness: 0.6, tool: 'shovel', drop: ID.DIRT, sound: 'grass' });
  block(ID.DIRT, 'Земля', { tile: T.dirt, hardness: 0.5, tool: 'shovel', sound: 'gravel' });
  block(ID.STONE, 'Камень', { tile: T.stone, hardness: 1.5, tool: 'pickaxe', tier: 1, drop: ID.COBBLE });
  block(ID.SAND, 'Песок', { tile: T.sand, hardness: 0.5, tool: 'shovel', gravity: true, sound: 'sand' });
  block(ID.WATER, 'Вода', { tile: T.water, opaque: false, full: false, solid: false, liquid: true, translucent: true, atten: 1, hardness: -1, drop: 0, sound: 'water' });
  block(ID.LAVA, 'Лава', { tile: T.lava, opaque: false, full: false, solid: false, liquid: true, emit: 15, hardness: -1, drop: 0, sound: 'water' });
  block(ID.LOG, 'Дубовое бревно', { t: [T.log_top, T.log_side, T.log_top], hardness: 2, tool: 'axe', sound: 'wood' });
  block(ID.BIRCH_LOG, 'Берёзовое бревно', { t: [T.birch_top, T.birch_side, T.birch_top], hardness: 2, tool: 'axe', sound: 'wood' });
  block(ID.SPRUCE_LOG, 'Еловое бревно', { t: [T.spruce_top, T.spruce_side, T.spruce_top], hardness: 2, tool: 'axe', sound: 'wood' });
  const leafOpts = { opaque: false, full: true, cutout: true, atten: 1, hardness: 0.2, sound: 'grass', drop: 0 };
  block(ID.LEAVES, 'Листва дуба', Object.assign({ tile: T.leaves }, leafOpts));
  block(ID.BIRCH_LEAVES, 'Листва берёзы', Object.assign({ tile: T.birch_leaves }, leafOpts));
  block(ID.SPRUCE_LEAVES, 'Хвоя', Object.assign({ tile: T.spruce_leaves }, leafOpts));
  block(ID.PLANKS, 'Доски', { tile: T.planks, hardness: 2, tool: 'axe', sound: 'wood' });
  block(ID.COBBLE, 'Булыжник', { tile: T.cobble, hardness: 2, tool: 'pickaxe', tier: 1 });
  block(ID.MOSSY, 'Замшелый булыжник', { tile: T.mossy, hardness: 2, tool: 'pickaxe', tier: 1 });
  block(ID.GLASS, 'Стекло', { tile: T.glass, opaque: false, full: true, cutout: true, hardness: 0.3, drop: 0, sound: 'glass' });
  block(ID.COAL_ORE, 'Угольная руда', { tile: T.coal_ore, hardness: 3, tool: 'pickaxe', tier: 1, drop: ID.COAL });
  block(ID.IRON_ORE, 'Железная руда', { tile: T.iron_ore, hardness: 3, tool: 'pickaxe', tier: 2 });
  block(ID.GOLD_ORE, 'Золотая руда', { tile: T.gold_ore, hardness: 3, tool: 'pickaxe', tier: 3 });
  block(ID.DIAMOND_ORE, 'Алмазная руда', { tile: T.diamond_ore, hardness: 3, tool: 'pickaxe', tier: 3, drop: ID.DIAMOND });
  block(ID.BEDROCK, 'Бедрок', { tile: T.bedrock, hardness: -1 });
  block(ID.SNOW_GRASS, 'Заснеженная трава', { t: [T.snow, T.snow_side, T.dirt], hardness: 0.6, tool: 'shovel', drop: ID.DIRT, sound: 'snow' });
  block(ID.SNOW, 'Снег', { tile: T.snow, hardness: 0.2, tool: 'shovel', sound: 'snow' });
  block(ID.ICE, 'Лёд', { tile: T.ice, opaque: false, translucent: true, hardness: 0.5, tool: 'pickaxe', drop: 0, sound: 'glass' });
  block(ID.CACTUS, 'Кактус', { t: [T.cactus_top, T.cactus_side, T.cactus_top], opaque: false, full: true, hardness: 0.4, sound: 'wool', support: 'sand' });
  block(ID.BRICK, 'Кирпичи', { tile: T.brick, hardness: 2, tool: 'pickaxe', tier: 1 });
  block(ID.STONEBRICK, 'Каменные кирпичи', { tile: T.stonebrick, hardness: 1.5, tool: 'pickaxe', tier: 1 });
  block(ID.TORCH, 'Факел', { tile: T.torch, opaque: false, full: false, solid: false, shape: 'torch', cutout: true, emit: 14, hardness: 0, sound: 'wood', support: 'solid' });
  block(ID.TABLE, 'Верстак', { t: [T.table_top, T.table_side, T.planks], front: T.table_side, hardness: 2.5, tool: 'axe', sound: 'wood', use: 'table' });
  block(ID.TALLGRASS, 'Высокая трава', Object.assign({ tile: T.tallgrass, drop: 0, replace: true }, plantOpts));
  block(ID.FLOWER_RED, 'Мак', Object.assign({ tile: T.flower_red }, plantOpts));
  block(ID.FLOWER_YELLOW, 'Одуванчик', Object.assign({ tile: T.flower_yellow }, plantOpts));
  block(ID.DEADBUSH, 'Сухой куст', Object.assign({ tile: T.dead_bush, drop: ID.STICK, replace: true }, plantOpts, { support: 'sand' }));
  block(ID.SAPLING, 'Саженец', Object.assign({ tile: T.sapling }, plantOpts));
  block(ID.GRAVEL, 'Гравий', { tile: T.gravel, hardness: 0.6, tool: 'shovel', gravity: true, sound: 'gravel' });
  block(ID.SANDSTONE, 'Песчаник', { t: [T.sandstone_top, T.sandstone_side, T.sandstone_top], hardness: 0.8, tool: 'pickaxe', tier: 1 });
  block(ID.WOOL, 'Белая шерсть', { tile: T.wool, hardness: 0.8, sound: 'wool' });
  block(ID.WOOL_RED, 'Красная шерсть', { tile: T.wool_red, hardness: 0.8, sound: 'wool' });
  block(ID.WOOL_BLUE, 'Синяя шерсть', { tile: T.wool_blue, hardness: 0.8, sound: 'wool' });
  block(ID.WOOL_GREEN, 'Зелёная шерсть', { tile: T.wool_green, hardness: 0.8, sound: 'wool' });
  block(ID.WOOL_YELLOW, 'Жёлтая шерсть', { tile: T.wool_yellow, hardness: 0.8, sound: 'wool' });
  block(ID.WOOL_BLACK, 'Чёрная шерсть', { tile: T.wool_black, hardness: 0.8, sound: 'wool' });
  block(ID.TNT, 'Динамит', { t: [T.tnt_top, T.tnt_side, T.tnt_bottom], hardness: 0, sound: 'grass', use: 'tnt' });
  block(ID.BOOKSHELF, 'Книжная полка', { t: [T.planks, T.bookshelf, T.planks], hardness: 1.5, tool: 'axe', sound: 'wood' });
  block(ID.GLOWSTONE, 'Светокамень', { tile: T.glowstone, emit: 15, hardness: 0.3, sound: 'glass' });
  block(ID.FURNACE, 'Печь', { t: [T.furnace_top, T.furnace_side, T.furnace_top], front: T.furnace_front, frontSides: 1, hardness: 3.5, tool: 'pickaxe', tier: 1, use: 'furnace' });
  block(ID.CLAY, 'Глина', { tile: T.clay, hardness: 0.6, tool: 'shovel', sound: 'gravel' });
  block(ID.PUMPKIN, 'Тыква', { t: [T.pumpkin_top, T.pumpkin_side, T.pumpkin_top], front: T.pumpkin_face, hardness: 1, tool: 'axe', sound: 'wood' });
  block(ID.JACK, 'Светильник Джека', { t: [T.pumpkin_top, T.pumpkin_side, T.pumpkin_top], front: T.jack_face, emit: 15, hardness: 1, tool: 'axe', sound: 'wood' });
  block(ID.IRON_BLOCK, 'Железный блок', { tile: T.iron_block, hardness: 5, tool: 'pickaxe', tier: 2, sound: 'metal' });
  block(ID.GOLD_BLOCK, 'Золотой блок', { tile: T.gold_block, hardness: 3, tool: 'pickaxe', tier: 3, sound: 'metal' });
  block(ID.DIAMOND_BLOCK, 'Алмазный блок', { tile: T.diamond_block, hardness: 5, tool: 'pickaxe', tier: 3, sound: 'metal' });
  block(ID.OBSIDIAN, 'Обсидиан', { tile: T.obsidian, hardness: 25, tool: 'pickaxe', tier: 4, blast: true });
  block(ID.BED, 'Кровать', { t: [T.bed_top, T.bed_side, T.planks], opaque: false, full: false, height: 0.5625, hardness: 0.2, sound: 'wool', use: 'bed', cutout: true });
  B[ID.AIR] = { id: 0, name: 'Воздух', opaque: false, full: false, solid: false, shape: 'none', hardness: 0, drop: 0, atten: 0, emit: 0 };
  B[ID.BEDROCK].blast = true;
  B[ID.WATER].blast = true;
  B[ID.LAVA].blast = true;
  const NB = 256;
  for (let i = 0; i < NB; i++) if (!B[i]) B[i] = Object.assign({}, B[ID.STONE], { id: i, name: '???' });

  // Быстрые таблицы для мешера и света
  const OPAQUE = new Uint8Array(NB), AOC = new Uint8Array(NB), ATTEN = new Uint8Array(NB), EMIT = new Uint8Array(NB), SOLID = new Uint8Array(NB);
  for (let i = 0; i < NB; i++) {
    const b = B[i];
    OPAQUE[i] = b.opaque && b.full ? 1 : 0;
    AOC[i] = (b.full && (b.opaque || b.cutout) && b.id !== ID.GLASS) ? 1 : 0;
    ATTEN[i] = b.atten || 0;
    EMIT[i] = b.emit || 0;
    SOLID[i] = b.solid ? 1 : 0;
  }

  // ---------- Предметы ----------
  const ITEMS = [];
  for (let i = 1; i < NB; i++) if (B[i].name !== '???' && i !== ID.WATER && i !== ID.LAVA) ITEMS[i] = { id: i, name: B[i].name, block: true, stack: 64 };
  // В творческом каталоге вода и лава тоже есть
  ITEMS[ID.WATER] = { id: ID.WATER, name: 'Вода', block: true, stack: 64 };
  ITEMS[ID.LAVA] = { id: ID.LAVA, name: 'Лава', block: true, stack: 64 };
  function item(id, name, tileName, o = {}) { ITEMS[id] = Object.assign({ id, name, tile: TILE[tileName], stack: 64 }, o); }
  item(ID.STICK, 'Палка', 'stick', { fuel: 0.5 });
  item(ID.COAL, 'Уголь', 'coal', { fuel: 8 });
  item(ID.IRON, 'Железный слиток', 'iron_ingot');
  item(ID.GOLD, 'Золотой слиток', 'gold_ingot');
  item(ID.DIAMOND, 'Алмаз', 'diamond');
  item(ID.FLINT, 'Кремень', 'flint');
  item(ID.APPLE, 'Яблоко', 'apple', { food: 4 });
  item(ID.MEAT, 'Сырое мясо', 'meat', { food: 3 });
  item(ID.MEAT_COOKED, 'Жареное мясо', 'meat_cooked', { food: 8 });
  item(ID.ROTTEN, 'Гнилая плоть', 'rotten', { food: 3 });
  item(ID.GUNPOWDER, 'Порох', 'gunpowder');
  ITEMS[ID.LOG].fuel = ITEMS[ID.BIRCH_LOG].fuel = ITEMS[ID.SPRUCE_LOG].fuel = 2;
  ITEMS[ID.PLANKS].fuel = 1;
  const MAT_INFO = [
    { name: 'Деревянн', speed: 2, tier: 1, dur: 60, dmg: 0 },
    { name: 'Каменн', speed: 4, tier: 2, dur: 132, dmg: 1 },
    { name: 'Железн', speed: 6, tier: 3, dur: 251, dmg: 2 },
    { name: 'Золот', speed: 12, tier: 1, dur: 33, dmg: 0 },
    { name: 'Алмазн', speed: 8, tier: 4, dur: 1562, dmg: 3 },
  ];
  const KIND_INFO = [
    { key: 'pickaxe', name: 'кирка', end: 'ая', dmg: 2 },
    { key: 'axe', name: 'топор', end: 'ый', dmg: 3 },
    { key: 'shovel', name: 'лопата', end: 'ая', dmg: 1.5 },
    { key: 'sword', name: 'меч', end: 'ый', dmg: 4 },
  ];
  const TOOL = {};
  KIND_INFO.forEach((k, ki) => MAT_INFO.forEach((m, mi) => {
    const id = 270 + ki * 5 + mi;
    const end = m.name === 'Золот' ? (k.end === 'ая' ? 'ая' : 'ой') : (k.end === 'ая' ? 'ая' : (m.name === 'Деревянн' ? 'ый' : 'ый'));
    const adj = m.name + (m.name === 'Золот' ? (k.end === 'ая' ? 'ая' : 'ой') : end);
    item(id, adj + ' ' + k.name, k.key + '_' + MATS[mi].key, {
      stack: 1, tool: { kind: k.key, tier: m.tier, speed: m.speed, dur: m.dur, dmg: k.dmg + m.dmg },
      fuel: mi === 0 ? 1 : 0,
    });
    TOOL[k.key + '_' + MATS[mi].key] = id;
  }));

  // ---------- Рецепты ----------
  // st: hand — в инвентаре, table — у верстака, furnace — в печи (нужно топливо)
  const R = [];
  const rec = (out, n, ins, st = 'hand') => R.push({ out, n, in: ins, st });
  rec(ID.PLANKS, 4, [[ID.LOG, 1]]);
  rec(ID.PLANKS, 4, [[ID.BIRCH_LOG, 1]]);
  rec(ID.PLANKS, 4, [[ID.SPRUCE_LOG, 1]]);
  rec(ID.STICK, 4, [[ID.PLANKS, 2]]);
  rec(ID.TABLE, 1, [[ID.PLANKS, 4]]);
  rec(ID.TORCH, 4, [[ID.STICK, 1], [ID.COAL, 1]]);
  rec(ID.SANDSTONE, 1, [[ID.SAND, 4]]);
  rec(ID.WOOL_RED, 1, [[ID.WOOL, 1], [ID.FLOWER_RED, 1]]);
  rec(ID.WOOL_YELLOW, 1, [[ID.WOOL, 1], [ID.FLOWER_YELLOW, 1]]);
  rec(ID.WOOL_GREEN, 1, [[ID.WOOL, 1], [ID.LEAVES, 2]]);
  rec(ID.WOOL_BLACK, 1, [[ID.WOOL, 1], [ID.COAL, 1]]);
  rec(ID.WOOL_BLUE, 1, [[ID.WOOL, 1], [ID.DIAMOND, 1]]);
  const mats = [[ID.PLANKS, 'wood'], [ID.COBBLE, 'stone'], [ID.IRON, 'iron'], [ID.GOLD, 'gold'], [ID.DIAMOND, 'diamond']];
  for (const [m, k] of mats) {
    rec(TOOL['pickaxe_' + k], 1, [[m, 3], [ID.STICK, 2]], 'table');
    rec(TOOL['axe_' + k], 1, [[m, 3], [ID.STICK, 2]], 'table');
    rec(TOOL['shovel_' + k], 1, [[m, 1], [ID.STICK, 2]], 'table');
    rec(TOOL['sword_' + k], 1, [[m, 2], [ID.STICK, 1]], 'table');
  }
  rec(ID.FURNACE, 1, [[ID.COBBLE, 8]], 'table');
  rec(ID.STONEBRICK, 4, [[ID.STONE, 4]], 'table');
  rec(ID.TNT, 1, [[ID.GUNPOWDER, 5], [ID.SAND, 4]], 'table');
  rec(ID.BOOKSHELF, 1, [[ID.PLANKS, 6], [ID.WOOL, 1]], 'table');
  rec(ID.BED, 1, [[ID.WOOL, 3], [ID.PLANKS, 3]], 'table');
  rec(ID.JACK, 1, [[ID.PUMPKIN, 1], [ID.TORCH, 1]], 'table');
  rec(ID.GLOWSTONE, 1, [[ID.GOLD, 1], [ID.TORCH, 4]], 'table');
  rec(ID.IRON_BLOCK, 1, [[ID.IRON, 9]], 'table');
  rec(ID.GOLD_BLOCK, 1, [[ID.GOLD, 9]], 'table');
  rec(ID.DIAMOND_BLOCK, 1, [[ID.DIAMOND, 9]], 'table');
  rec(ID.IRON, 9, [[ID.IRON_BLOCK, 1]], 'table');
  rec(ID.GOLD, 9, [[ID.GOLD_BLOCK, 1]], 'table');
  rec(ID.DIAMOND, 9, [[ID.DIAMOND_BLOCK, 1]], 'table');
  rec(ID.MOSSY, 1, [[ID.COBBLE, 1], [ID.LEAVES, 1]], 'table');
  rec(ID.GLASS, 1, [[ID.SAND, 1]], 'furnace');
  rec(ID.STONE, 1, [[ID.COBBLE, 1]], 'furnace');
  rec(ID.IRON, 1, [[ID.IRON_ORE, 1]], 'furnace');
  rec(ID.GOLD, 1, [[ID.GOLD_ORE, 1]], 'furnace');
  rec(ID.MEAT_COOKED, 1, [[ID.MEAT, 1]], 'furnace');
  rec(ID.BRICK, 1, [[ID.CLAY, 1]], 'furnace');
  rec(ID.COAL, 1, [[ID.LOG, 1]], 'furnace');
  rec(ID.OBSIDIAN, 1, [[ID.LAVA, 1]], 'furnace');

  // ---------- Иконки ----------
  const ICON = [];
  function iconFor(id) {
    if (ICON[id]) return ICON[id];
    const it = ITEMS[id];
    if (!it) return '';
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const tileXY = (t) => [(t % AT) * TS, ((t / AT) | 0) * TS];
    const b = it.block ? B[id] : null;
    if (b && b.shape === 'cube') {
      const sh = b.height < 1 ? b.height : 1;
      const face = (t, tr, dark) => {
        const [sx, sy] = tileXY(t);
        g.setTransform(...tr);
        g.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
        if (dark) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, 16, 16); g.globalCompositeOperation = 'source-over'; }
      };
      const lift = (1 - sh) * 22;
      face(b.front !== b.side ? b.front : b.side, [1.3125, 0.6875, 0, 1.375 * sh, 3, 13 + lift], 0.22);
      face(b.side, [1.3125, -0.6875, 0, 1.375 * sh, 24, 24 + lift], 0.42);
      face(b.top, [1.3125, -0.6875, 1.3125, 0.6875, 3, 13 + lift], 0);
    } else {
      const t = b ? b.top : it.tile;
      const [sx, sy] = tileXY(t);
      g.drawImage(atlas, sx, sy, 16, 16, 0, 0, 48, 48);
    }
    return (ICON[id] = c.toDataURL());
  }

  // Мелкие пиксельные значки для HUD: сердце, еда, пузырь (full/half/empty)
  function pixelIcon(map, pal) {
    const c = document.createElement('canvas');
    c.width = c.height = 9;
    const g = c.getContext('2d');
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const p = pal[map[y][x]]; if (p) { g.fillStyle = p; g.fillRect(x, y, 1, 1); } }
    return c.toDataURL();
  }
  const HEART = ['.##...##.', '#hh#.#hh#', '#hrr#rrr#', '#rrrrrrr#', '#rrrrrrr#', '.#rrrrr#.', '..#rrr#..', '...#r#...', '....#....'];
  const HEART_HALF = HEART.map(r => r.split('').map((ch, x) => (x > 4 && (ch === 'r' || ch === 'h')) ? 'e' : ch).join(''));
  const HEART_EMPTY = HEART.map(r => r.replace(/[rh]/g, 'e'));
  const FOOD = ['......##.', '.....#ww#', '....#ww#.', '..##mm#..', '.#mmmm#..', '#mmmmm#..', '#mmmm#...', '#mmm#....', '.###.....'];
  const FOOD_HALF = FOOD.map(r => r.split('').map((ch, x) => (x < 4 && ch === 'm') ? 'e' : ch).join(''));
  const FOOD_EMPTY = FOOD.map(r => r.replace(/m/g, 'e'));
  const BUBBLE = ['..#####..', '.#bbbbb#.', '#bwbbbbb#', '#bwbbbbb#', '#bbbbbbb#', '#bbbbbbb#', '#bbbbbbb#', '.#bbbbb#.', '..#####..'];
  const HUDI = {
    heart: pixelIcon(HEART, { '#': '#1a0000', r: '#e3232c', h: '#ff9da0', e: '#3a1414' }),
    heartHalf: pixelIcon(HEART_HALF, { '#': '#1a0000', r: '#e3232c', h: '#ff9da0', e: '#3a1414' }),
    heartEmpty: pixelIcon(HEART_EMPTY, { '#': '#1a0000', e: '#3a1414' }),
    food: pixelIcon(FOOD, { '#': '#2a1606', m: '#b8642b', w: '#f2e6cf', e: '#3a2616' }),
    foodHalf: pixelIcon(FOOD_HALF, { '#': '#2a1606', m: '#b8642b', w: '#f2e6cf', e: '#3a2616' }),
    foodEmpty: pixelIcon(FOOD_EMPTY, { '#': '#2a1606', w: '#7a6a5a', e: '#3a2616' }),
    bubble: pixelIcon(BUBBLE, { '#': '#0d2a6a', b: '#4fa3ff', w: '#e8f6ff' }),
  };

  window.CubeData = {
    atlas, TILE, tileAvg, ID, B, NB, ITEMS, TOOL, RECIPES: R, OPAQUE, AOC, ATTEN, EMIT, SOLID,
    iconFor, HUDI, MAT_INFO, KIND_INFO,
  };
})();
