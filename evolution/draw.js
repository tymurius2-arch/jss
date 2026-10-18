"use strict";
// Рисование существ. Всё рисуется вокруг (0,0), голова смотрит вправо (+x), вид сверху.
// r — «радиус» существа на экране, t — время (для анимации), mv — насколько быстро движется (0..1).
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function hsl(c, dl = 0, a = 1, ds = 0) {
  return `hsla(${c[0]},${clamp(c[1] + ds, 0, 100)}%,${clamp(c[2] + dl, 0, 100)}%,${a})`;
}
function shade(g, x, y, r, c, a = 1, hi = 16, lo = -14) {
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r * 1.05);
  gr.addColorStop(0, hsl(c, hi, a)); gr.addColorStop(1, hsl(c, lo, a));
  return gr;
}
function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); }
function line(g, pts, w, color) {
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke();
}
function eye(g, x, y, er, look = 0.3) {
  g.fillStyle = "#fff"; circ(g, x, y, er); g.fill();
  g.fillStyle = "#061016"; circ(g, x + er * look, y, er * 0.6); g.fill();
  g.fillStyle = "rgba(255,255,255,.8)"; circ(g, x + er * 0.1, y - er * 0.35, er * 0.22); g.fill();
}
function eyes(g, x, sep, er) { eye(g, x, -sep, er); eye(g, x, sep, er); }
// Тянущийся «хвост» из точек с волной: от (x0,0) назад на длину len
function wavy(g, x0, y0, len, amp, ph, w0, w1, color, n = 10) {
  g.fillStyle = color; g.strokeStyle = color; g.lineCap = "round";
  let px = x0, py = y0;
  for (let i = 1; i <= n; i++) {
    const k = i / n, x = x0 - len * k, y = y0 + Math.sin(ph - k * 3) * amp * k;
    g.lineWidth = w0 + (w1 - w0) * k;
    g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
    px = x; py = y;
  }
  return [px, py];
}

function drawCreature(g, n, r, t, mv = 0.5) {
  g.save();
  switch (n.body) {
    case "cell": drawCell(g, n, r, t, mv); break;
    case "bacteria": drawBacteria(g, n, r, t, mv); break;
    case "colony": drawColony(g, n, r, t, mv); break;
    case "sponge": drawSponge(g, n, r, t); break;
    case "coral": drawCoral(g, n, r, t); break;
    case "plant": drawPlant(g, n, r, t); break;
    case "jelly": drawJelly(g, n, r, t, mv); break;
    case "worm": drawWorm(g, n, r, t, mv); break;
    case "star": drawStar(g, n, r, t); break;
    case "arthro": drawArthro(g, n, r, t, mv); break;
    case "snail": drawSnail(g, n, r, t, mv); break;
    case "octo": drawOcto(g, n, r, t, mv); break;
    case "fish": drawFish(g, n, r, t, mv); break;
    case "quad": drawQuad(g, n, r, t, mv); break;
    case "bird": drawBird(g, n, r, t, mv); break;
    case "ape": case "biped": drawHominid(g, n, r, t, mv); break;
  }
  g.restore();
}

// ---------- Микромир ----------
function drawCell(g, n, r, t, mv) {
  const f = n.f, c = n.c;
  const wob = f.blob ? 0.22 : 0.06, ox = f.oval ? 1.35 : 1;
  // жгутики
  for (let i = 0; i < (f.flag || 0); i++) {
    const oy = f.flag > 1 ? (i ? 1 : -1) * r * 0.3 : 0;
    const dir = f.flag > 1 ? 1 : -1; // у хламидомонады жгутики спереди
    g.save(); if (dir > 0) g.scale(-1, 1);
    wavy(g, -r * 0.9 * ox, oy, r * 1.7, r * 0.35, t * 14 + i, r * 0.09, r * 0.03, hsl(c, 15, 0.85), 14);
    g.restore();
  }
  if (f.shell) { // фораминифера — спиральные камеры
    for (let i = 7; i >= 0; i--) {
      const a = i * 0.9, d = r * 0.12 * i, cr = r * (0.18 + i * 0.07);
      g.fillStyle = shade(g, Math.cos(a) * d, Math.sin(a) * d, cr, c); circ(g, Math.cos(a) * d, Math.sin(a) * d, cr); g.fill();
      g.strokeStyle = hsl(c, -20, 0.6); g.lineWidth = r * 0.04; g.stroke();
    }
    g.strokeStyle = hsl(c, 20, 0.6); g.lineWidth = r * 0.03;
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + t * 0.3; line(g, [Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, Math.cos(a) * r * 1.5, Math.sin(a + 0.1) * r * 1.5], r * 0.025, hsl(c, 20, 0.5)); }
    return;
  }
  if (f.glass) { // диатомея — стеклянная коробочка
    g.fillStyle = shade(g, 0, 0, r, c, 0.9); ell(g, 0, 0, r * 1.25, r * 0.6); g.fill();
    g.strokeStyle = hsl(c, 25, 0.9); g.lineWidth = r * 0.05; g.stroke();
    g.strokeStyle = hsl(c, -15, 0.5); g.lineWidth = r * 0.03;
    for (let i = -5; i <= 5; i++) line(g, [i * r * 0.2, -r * 0.55 * Math.sqrt(1 - (i / 6.2) ** 2), i * r * 0.2, r * 0.55 * Math.sqrt(1 - (i / 6.2) ** 2)], r * 0.03, hsl(c, -15, 0.5));
    g.fillStyle = hsl([90, 60, 40], 0, 0.6); circ(g, 0, 0, r * 0.25); g.fill();
    return;
  }
  // тело
  g.beginPath();
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const a = i / N * TAU;
    const k = 1 + wob * Math.sin(a * 3 + t * 2) + wob * 0.6 * Math.sin(a * 5 - t * 3) + (f.blob ? 0.15 * Math.sin(a * 2 - t) : 0);
    const x = Math.cos(a) * r * k * ox, y = Math.sin(a) * r * k;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  g.fillStyle = shade(g, 0, 0, r * ox, c, 0.82); g.fill();
  g.strokeStyle = hsl(c, 22, 0.9); g.lineWidth = r * 0.08; g.stroke();
  if (f.cilia) {
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * TAU, w = Math.sin(t * 12 + i * 0.8) * 0.25;
      const x = Math.cos(a) * r * ox * 1.02, y = Math.sin(a) * r * 1.02;
      line(g, [x, y, x + Math.cos(a + w) * r * 0.22, y + Math.sin(a + w) * r * 0.22], r * 0.035, hsl(c, 25, 0.8));
    }
  }
  if (f.collar) {
    for (let i = -5; i <= 5; i++) {
      const a = i * 0.12;
      line(g, [Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.4 + Math.sin(t * 6 + i) * r * 0.04], r * 0.04, hsl(c, 20, 0.75));
    }
  }
  // органеллы
  for (let i = 0; i < 6; i++) {
    const a = i * 2.1 + t * 0.2, d = r * (0.35 + (i % 3) * 0.15);
    g.fillStyle = f.chloro ? "hsla(115,70%,38%,.85)" : hsl(c, -20, 0.55);
    ell(g, Math.cos(a) * d * ox, Math.sin(a) * d, r * 0.13, r * 0.08, a); g.fill();
  }
  if (f.nucleus) {
    g.fillStyle = shade(g, -r * 0.15, 0, r * 0.32, [c[0] + 30, c[1], c[2] - 18], 0.95); circ(g, -r * 0.15, 0, r * 0.32); g.fill();
    g.fillStyle = hsl(c, -35, 0.8); circ(g, -r * 0.1, -r * 0.05, r * 0.1); g.fill();
  }
  // «глазок» — пятнышко спереди
  g.fillStyle = f.chloro ? "rgba(255,80,60,.9)" : "rgba(10,30,40,.55)"; circ(g, r * 0.62 * ox, -r * 0.12, r * 0.09); g.fill();
}

function drawBacteria(g, n, r, t, mv) {
  const f = n.f, c = n.c, L = r * (f.slim ? 1.4 : 1.15), H = r * (f.slim ? 0.45 : 0.62);
  if (f.flag) wavy(g, -L * 0.95, 0, r * 1.8, r * 0.3, t * 16, r * 0.07, r * 0.02, hsl(c, 15, 0.85), 14);
  if (f.spikes) for (let i = 0; i < 20; i++) {
    const a = i / 20 * TAU; line(g, [Math.cos(a) * L * 0.9, Math.sin(a) * H * 0.9, Math.cos(a) * (L + r * 0.25), Math.sin(a) * (H + r * 0.25)], r * 0.05, hsl(c, 10, 0.8));
  }
  g.fillStyle = shade(g, 0, 0, L, c, 0.88);
  g.beginPath(); g.roundRect(-L, -H, L * 2, H * 2, H); g.fill();
  g.strokeStyle = hsl(c, 22, 0.9); g.lineWidth = r * 0.07; g.stroke();
  if (f.chloro) for (let i = -2; i <= 2; i++) line(g, [-L * 0.7, i * H * 0.3, L * 0.7, i * H * 0.3], r * 0.05, "hsla(130,70%,28%,.6)");
  else wavy(g, L * 0.55, 0, L * 1.1, H * 0.4, t * 2, r * 0.06, r * 0.06, hsl(c, -25, 0.6), 10);
}

function drawColony(g, n, r, t, mv) {
  const f = n.f, c = n.c;
  if (f.sphere) {
    g.fillStyle = shade(g, 0, 0, r * 1.1, c, 0.35); circ(g, 0, 0, r * 1.1); g.fill();
    g.strokeStyle = hsl(c, 20, 0.7); g.lineWidth = r * 0.05; g.stroke();
    for (let i = 0; i < 46; i++) {
      const a = i * 2.39996 + t * 0.15, d = r * 1.02 * Math.sqrt((i + 0.5) / 46);
      g.fillStyle = hsl(c, 10, 0.95); circ(g, Math.cos(a) * d, Math.sin(a) * d, r * 0.06); g.fill();
    }
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + t * 0.3; g.fillStyle = hsl(c, -10, 0.85);
      circ(g, Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.22); g.fill();
    }
    return;
  }
  if (f.slime) {
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7, d = r * (0.3 + (i % 3) * 0.3), rr = r * (0.45 - (i % 3) * 0.08);
      const x = Math.cos(a + Math.sin(t + i) * 0.1) * d, y = Math.sin(a) * d * 0.9;
      g.fillStyle = shade(g, x, y, rr, c, 0.9); circ(g, x, y, rr * (1 + 0.08 * Math.sin(t * 2 + i))); g.fill();
    }
    g.strokeStyle = hsl(c, 20, 0.6); g.lineWidth = r * 0.05;
    for (let i = 0; i < 6; i++) wavy(g, 0, 0, r * 1.2, r * 0.3, t + i, r * 0.07, r * 0.02, hsl(c, -10, 0.7), 8);
    return;
  }
  const cells = [[0, 0]];
  for (let i = 0; i < 6; i++) cells.push([Math.cos(i / 6 * TAU) * r * 0.6, Math.sin(i / 6 * TAU) * r * 0.6]);
  cells.forEach(([x, y], i) => {
    const rr = r * 0.36 * (1 + 0.07 * Math.sin(t * 3 + i));
    if (i) wavy(g, x * 1.5, y * 1.5, r * 0.4, r * 0.1, t * 10 + i, r * 0.04, r * 0.01, hsl(c, 20, 0.7), 6);
    g.fillStyle = shade(g, x, y, rr, c, 0.88); circ(g, x, y, rr); g.fill();
    g.strokeStyle = hsl(c, 22, 0.9); g.lineWidth = r * 0.05; g.stroke();
    g.fillStyle = hsl(c, -25, 0.7); circ(g, x, y, rr * 0.35); g.fill();
  });
}

// ---------- Сидячие ----------
function drawSponge(g, n, r, t) {
  const c = n.c;
  g.beginPath();
  for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU, k = 1 + 0.12 * Math.sin(a * 5) + 0.05 * Math.sin(a * 9); i ? g.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k) : g.moveTo(r * k, 0); }
  g.closePath(); g.fillStyle = shade(g, 0, 0, r, c); g.fill();
  for (let i = 0; i < 22; i++) { const a = i * 2.4, d = r * 0.8 * Math.sqrt(i / 22); g.fillStyle = hsl(c, -25, 0.8); circ(g, Math.cos(a) * d, Math.sin(a) * d, r * 0.05); g.fill(); }
  g.fillStyle = hsl(c, -35); circ(g, 0, 0, r * 0.33 * (1 + 0.05 * Math.sin(t * 2))); g.fill();
}
function drawCoral(g, n, r, t) {
  const c = n.c;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + 0.3;
    const x1 = Math.cos(a) * r, y1 = Math.sin(a) * r;
    line(g, [0, 0, x1, y1], r * 0.22, hsl(c, -8));
    for (const s of [-0.5, 0.5]) {
      const x2 = x1 + Math.cos(a + s) * r * 0.45, y2 = y1 + Math.sin(a + s) * r * 0.45;
      line(g, [x1, y1, x2, y2], r * 0.15, hsl(c, 0));
      for (let k = 0; k < 5; k++) { const pa = k / 5 * TAU + t * 2; line(g, [x2, y2, x2 + Math.cos(pa) * r * 0.12, y2 + Math.sin(pa) * r * 0.12], r * 0.03, hsl(c, 30, 0.9)); }
      g.fillStyle = hsl(c, 25); circ(g, x2, y2, r * 0.08); g.fill();
    }
  }
  g.fillStyle = shade(g, 0, 0, r * 0.3, c); circ(g, 0, 0, r * 0.3); g.fill();
}
function drawPlant(g, n, r, t) {
  const c = n.c, f = n.f;
  if (f.moss) {
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4, d = r * 0.85 * Math.sqrt((i + 0.5) / 16), x = Math.cos(a) * d, y = Math.sin(a) * d;
      for (let k = 0; k < 6; k++) { const b = k / 6 * TAU + Math.sin(t + i) * 0.1; line(g, [x, y, x + Math.cos(b) * r * 0.22, y + Math.sin(b) * r * 0.22], r * 0.07, hsl(c, (k % 2) * 10)); }
      g.fillStyle = hsl(c, 20); circ(g, x, y, r * 0.06); g.fill();
    }
    return;
  }
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + (i - 2.5) * 0.35 + Math.sin(t * 1.3 + i) * 0.12;
    g.fillStyle = shade(g, Math.cos(a) * r, Math.sin(a) * r, r * 0.9, [c[0] + i * 3, c[1], c[2] + (i % 2) * 6], 0.95);
    ell(g, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 1.0, r * 0.22, a); g.fill();
    line(g, [0, 0, Math.cos(a) * r * 1.8, Math.sin(a) * r * 1.8], r * 0.03, hsl(c, 15, 0.6));
  }
  g.fillStyle = shade(g, 0, 0, r * 0.35, [c[0], c[1], c[2] - 8]); circ(g, 0, 0, r * 0.35); g.fill();
  for (let i = 0; i < 3; i++) { g.fillStyle = hsl(c, 15); circ(g, r * 0.15 * Math.cos(i * 2), r * 0.15 * Math.sin(i * 2), r * 0.12); g.fill(); }
}

// ---------- Медузы ----------
function drawJelly(g, n, r, t, mv) {
  const f = n.f, c = n.c, pulse = 1 + 0.1 * Math.sin(t * 4);
  const len = f.float ? 3 : 1.9;
  for (let i = 0; i < 9; i++) {
    const oy = (i - 4) * r * 0.16;
    wavy(g, -r * 0.4, oy, r * len * (0.8 + (i % 3) * 0.15), r * 0.25, t * 4 + i * 0.7, r * 0.06, r * 0.015, hsl(f.float ? [230, 70, 70] : c, 10, 0.65), 12);
  }
  if (f.float) {
    g.fillStyle = shade(g, 0, 0, r, c, 0.7); ell(g, 0, 0, r * 1.1, r * 0.55); g.fill();
    g.strokeStyle = "hsla(320,70%,70%,.9)"; g.lineWidth = r * 0.12; line(g, [-r * 0.8, 0, r * 0.8, Math.sin(t * 2) * r * 0.05], r * 0.12, "hsla(320,70%,72%,.9)");
    return;
  }
  g.fillStyle = shade(g, 0, 0, r * pulse, c, 0.5, 22, -6);
  if (f.box) { g.beginPath(); g.roundRect(-r * pulse, -r * pulse, r * 2 * pulse, r * 2 * pulse, r * 0.4); g.fill(); }
  else { circ(g, 0, 0, r * pulse); g.fill(); }
  g.strokeStyle = hsl(c, 25, 0.8); g.lineWidth = r * 0.06; g.stroke();
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + 0.78; g.strokeStyle = hsl(c, -12, 0.75); g.lineWidth = r * 0.07;
    circ(g, Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, r * 0.2); g.stroke();
  }
}

// ---------- Черви и змеи ----------
function drawWorm(g, n, r, t, mv) {
  const f = n.f, c = n.c, segs = f.segs || 8;
  const sp = r * (f.snake ? 0.3 : f.eel ? 0.3 : 0.4);
  const base = r * (f.snake ? 0.32 : f.cucumber ? 0.55 : f.flat ? 0.45 : 0.38);
  const speed = f.snake || f.eel ? 7 : 5;
  const amp = r * (f.snake || f.eel ? 0.4 : 0.2) * (0.4 + 0.6 * mv);
  const P = [];
  for (let i = 0; i < segs; i++) {
    const k = i / segs;
    P.push([r * 0.7 - i * sp, Math.sin(t * speed - i * 0.6) * amp * (0.3 + k)]);
  }
  if (f.legs) for (let i = 1; i < segs; i++) {
    const [x, y] = P[i], s = Math.sin(t * 16 + i) * r * 0.12;
    for (const sd of [-1, 1]) line(g, [x, y + sd * base * 0.5, x + s, y + sd * (base + r * 0.25)], r * 0.05, hsl(c, -10));
  }
  if (f.bristle) for (let i = 1; i < segs; i++) {
    const [x, y] = P[i]; for (const sd of [-1, 1]) line(g, [x, y, x - r * 0.05, y + sd * (base + r * 0.15)], r * 0.025, hsl(c, 25, 0.7));
  }
  for (let i = segs - 1; i >= 0; i--) {
    const [x, y] = P[i], k = i / segs;
    let rad = base * (1 - k * (f.snake || f.eel ? 0.75 : 0.45));
    if (f.snake && i === 0) rad *= 1.15;
    const col = f.band && (i === 3 || i === 4) ? [c[0], c[1], c[2] + 12] : c;
    g.fillStyle = shade(g, x, y, rad, col);
    if (f.flat) ell(g, x, y, rad * 0.9, rad * 1.25); else circ(g, x, y, rad);
    g.fill();
    if (f.snake && i % 2 === 0 && i) { g.fillStyle = hsl(c, -18); ell(g, x, y, rad * 0.45, rad * 0.35, Math.PI / 4); g.fill(); }
    if (f.cucumber) for (let k2 = 0; k2 < 4; k2++) { g.fillStyle = hsl(c, 15); circ(g, x + Math.cos(k2 * 1.7 + i) * rad * 0.6, y + Math.sin(k2 * 1.7 + i) * rad * 0.6, rad * 0.12); g.fill(); }
    if (!f.snake && !f.flat && !f.cucumber) { g.strokeStyle = hsl(c, -15, 0.35); g.lineWidth = r * 0.03; circ(g, x, y, rad); g.stroke(); }
  }
  const [hx, hy] = P[0];
  if (f.snake) {
    if (Math.sin(t * 3) > 0.5) line(g, [hx + base, hy, hx + base * 1.8, hy, hx + base * 2.1, hy - base * 0.3, hx + base * 1.8, hy, hx + base * 2.1, hy + base * 0.3], r * 0.04, "#e33");
    g.save(); g.translate(hx, hy); eyes(g, base * 0.4, base * 0.55, r * 0.08); g.restore();
  } else if (f.eyes) { g.save(); g.translate(hx, hy); eyes(g, base * 0.2, base * 0.45, r * 0.09); g.restore(); }
  else if (f.eel) { g.save(); g.translate(hx, hy); eyes(g, base * 0.2, base * 0.6, r * 0.07); g.restore(); }
  if (f.sucker) { g.strokeStyle = hsl(c, -25); g.lineWidth = r * 0.06; circ(g, hx + base * 0.7, hy, base * 0.4); g.stroke(); }
}

function drawStar(g, n, r, t) {
  const c = n.c, f = n.f, rot = t * 0.15;
  if (f.urchin) {
    for (let i = 0; i < 44; i++) { const a = i / 44 * TAU + rot, w = Math.sin(t * 2 + i) * 0.08; line(g, [Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, Math.cos(a + w) * r * 1.1, Math.sin(a + w) * r * 1.1], r * 0.05, hsl(c, 10)); }
    g.fillStyle = shade(g, 0, 0, r * 0.6, c); circ(g, 0, 0, r * 0.6); g.fill();
    return;
  }
  g.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = i / 10 * TAU + rot, rr = i % 2 ? r * 0.42 : r * 1.1 * (1 + 0.04 * Math.sin(t * 2 + i));
    i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath(); g.lineJoin = "round"; g.fillStyle = shade(g, 0, 0, r, c); g.fill();
  g.strokeStyle = hsl(c, -12); g.lineWidth = r * 0.12; g.stroke();
  for (let i = 0; i < 5; i++) for (let k = 1; k < 4; k++) {
    const a = i / 5 * TAU + rot; g.fillStyle = hsl(c, 22); circ(g, Math.cos(a) * r * 0.25 * k, Math.sin(a) * r * 0.25 * k, r * 0.06); g.fill();
  }
}

// ---------- Членистоногие ----------
function drawArthro(g, n, r, t, mv) {
  const f = n.f, c = n.c, sh = f.shape, walk = t * (12 + mv * 8), sw = 0.3 + 0.7 * mv;
  const legPair = (x, y0, len, ph, w = r * 0.06, back = 0) => {
    for (const sd of [-1, 1]) {
      const s = Math.sin(walk + ph + (sd > 0 ? Math.PI : 0)) * r * 0.18 * sw;
      line(g, [x, sd * y0, x + s + back * 0.4, sd * (y0 + len * 0.6), x + s * 1.3 + back, sd * (y0 + len)], w, hsl(c, -15));
    }
  };
  const claws = (x, big = 1) => {
    for (const sd of [-1, 1]) {
      const s = Math.sin(t * 3 + sd) * 0.1;
      line(g, [x, sd * r * 0.3, x + r * 0.45 * big, sd * r * (0.55 + s)], r * 0.1, hsl(c, -5));
      g.fillStyle = shade(g, x + r * 0.75 * big, sd * r * 0.55, r * 0.3 * big, c);
      ell(g, x + r * 0.7 * big, sd * r * 0.55, r * 0.32 * big, r * 0.17 * big, sd * 0.2); g.fill();
      line(g, [x + r * 0.85 * big, sd * r * 0.48, x + r * 1.15 * big, sd * r * (0.45 - s * 0.6)], r * 0.08, hsl(c, -10));
    }
  };
  const antennae = (x, len, elbow) => { for (const sd of [-1, 1]) { const s = Math.sin(t * 4 + sd) * 0.15; line(g, elbow ? [x, sd * r * 0.08, x + len * 0.4, sd * r * 0.3, x + len, sd * r * (0.25 + s)] : [x, sd * r * 0.08, x + len * 0.6, sd * r * (0.3 + s), x + len, sd * r * (0.55 + s)], r * 0.035, hsl(c, -20)); } };
  const wings = (cnt, colA, len = 1, wide = 0.32) => {
    const flap = f.fly ? 0.55 + 0.45 * Math.abs(Math.sin(t * 30)) : 1;
    for (let i = 0; i < cnt; i++) for (const sd of [-1, 1]) {
      const x = cnt === 4 ? (i < 2 ? r * 0.15 : -r * 0.2) : 0;
      g.fillStyle = colA; ell(g, x, sd * r * len * 0.6 * flap, r * wide, r * len * 0.62 * flap, sd * (i % 2 ? 0.25 : -0.1)); g.fill();
      g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = r * 0.02; g.stroke();
    }
  };

  if (sh === "tri") {
    for (let i = 0; i < 8; i++) legPair(r * 0.5 - i * r * 0.15, r * 0.5, r * 0.2, i, r * 0.035);
    g.fillStyle = shade(g, 0, 0, r * 0.8, c); ell(g, 0, 0, r * 0.85, r * 0.6); g.fill();
    g.fillStyle = shade(g, 0, 0, r * 0.4, c, 1, 25, -5); ell(g, -r * 0.05, 0, r * 0.75, r * 0.18); g.fill();
    g.strokeStyle = hsl(c, -20, 0.6); g.lineWidth = r * 0.03;
    for (let i = -4; i <= 3; i++) { g.beginPath(); g.moveTo(i * r * 0.15, -r * 0.55); g.quadraticCurveTo(i * r * 0.15 - r * 0.05, 0, i * r * 0.15, r * 0.55); g.stroke(); }
    g.fillStyle = shade(g, r * 0.5, 0, r * 0.4, c); ell(g, r * 0.55, 0, r * 0.32, r * 0.55); g.fill();
    eyes(g, r * 0.6, r * 0.3, r * 0.08);
    return;
  }
  if (sh === "shrimp") {
    for (let i = 0; i < f.legs / 2; i++) legPair(r * 0.3 - i * r * 0.15, r * 0.2, r * 0.3, i, r * 0.04);
    if (f.claws) claws(r * 0.4, 0.9);
    antennae(r * 0.6, r * (f.ant || 1.5), false);
    for (let i = 5; i >= 0; i--) {
      const x = r * 0.4 - i * r * 0.27, rad = r * (0.32 - i * 0.03), y = Math.sin(t * 5 - i * 0.5) * r * 0.04;
      g.fillStyle = shade(g, x, y, rad, c); ell(g, x, y, rad * 0.8, rad); g.fill();
      g.strokeStyle = hsl(c, -15, 0.5); g.lineWidth = r * 0.03; g.stroke();
    }
    for (const sd of [-1, 0, 1]) { g.fillStyle = hsl(c, 8, 0.9); ell(g, -r * 1.25, sd * r * 0.14, r * 0.2, r * 0.08, sd * 0.5); g.fill(); }
    g.fillStyle = shade(g, r * 0.55, 0, r * 0.3, c); ell(g, r * 0.55, 0, r * 0.3, r * 0.24); g.fill();
    eyes(g, r * 0.75, r * 0.18, r * 0.07);
    return;
  }
  if (sh === "crab") {
    for (let i = 0; i < 4; i++) legPair(r * 0.2 - i * r * 0.18, r * 0.6, r * 0.55, i, r * 0.07, -r * 0.1 * i);
    claws(r * 0.35, 1);
    g.fillStyle = shade(g, 0, 0, r * 0.8, c); ell(g, 0, 0, r * 0.55, r * 0.75); g.fill();
    g.strokeStyle = hsl(c, -15, 0.5); g.lineWidth = r * 0.04; g.stroke();
    for (const sd of [-1, 1]) { line(g, [r * 0.45, sd * r * 0.2, r * 0.65, sd * r * 0.25], r * 0.05, hsl(c, -10)); eye(g, r * 0.68, sd * r * 0.25, r * 0.08); }
    return;
  }
  if (sh === "scorp") {
    for (let i = 0; i < 4; i++) legPair(r * 0.25 - i * r * 0.16, r * 0.25, r * 0.45, i, r * 0.05, -r * 0.08 * i);
    claws(r * 0.4, 0.85);
    // брюшко и хвост
    for (let i = 0; i < 5; i++) { const x = -r * 0.1 - i * r * 0.22; g.fillStyle = shade(g, x, 0, r * 0.3, c); ell(g, x, 0, r * 0.16, r * (0.3 - i * 0.02)); g.fill(); }
    if (f.sting) {
      let px = -r * 1.1, py = 0;
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + i * 0.45 + Math.sin(t * 2) * 0.1, nx = px + Math.cos(a) * r * 0.2, ny = py + Math.sin(a) * r * 0.2;
        g.fillStyle = shade(g, nx, ny, r * 0.12, c); circ(g, nx, ny, r * (0.13 - i * 0.01)); g.fill(); px = nx; py = ny;
      }
      g.fillStyle = "hsl(10,70%,35%)"; circ(g, px + r * 0.08, py, r * 0.1); g.fill();
    } else { g.fillStyle = shade(g, -r * 1.2, 0, r * 0.2, c); ell(g, -r * 1.25, 0, r * 0.25, r * 0.2); g.fill(); }
    g.fillStyle = shade(g, r * 0.25, 0, r * 0.35, c); ell(g, r * 0.25, 0, r * 0.3, r * 0.3); g.fill();
    eyes(g, r * 0.42, r * 0.1, r * 0.05);
    return;
  }
  if (sh === "spider") {
    for (let i = 0; i < 4; i++) {
      for (const sd of [-1, 1]) {
        const a = (i - 1.5) * 0.45, s = Math.sin(walk + i * 1.7 + (sd > 0 ? Math.PI : 0)) * 0.15 * sw;
        const kx = Math.cos(a + s) * r * 0.65 + r * 0.15, ky = sd * (r * 0.55 + Math.abs(Math.sin(a)) * r * 0.1);
        line(g, [r * 0.15, 0, kx, ky, kx + Math.cos(a + s) * r * 0.5 + (i < 2 ? r * 0.2 : -r * 0.2), ky + sd * r * 0.35], r * 0.06, hsl(c, -5));
      }
    }
    g.fillStyle = shade(g, -r * 0.35, 0, r * 0.55, c); circ(g, -r * 0.35, 0, r * 0.5); g.fill();
    g.fillStyle = "hsla(0,70%,45%,.8)"; ell(g, -r * 0.4, 0, r * 0.15, r * 0.1); g.fill();
    g.fillStyle = shade(g, r * 0.2, 0, r * 0.3, c); circ(g, r * 0.2, 0, r * 0.27); g.fill();
    for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { g.fillStyle = "#111"; circ(g, r * (0.35 + (i % 2) * 0.08), sd * r * (0.05 + i * 0.03), r * 0.035); g.fill(); }
    return;
  }
  if (sh === "butterfly") {
    const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 9));
    for (const sd of [-1, 1]) {
      g.fillStyle = shade(g, r * 0.1, sd * r * 0.6, r * 0.8, c); ell(g, r * 0.15, sd * r * 0.65 * flap, r * 0.45, r * 0.65 * flap, sd * -0.3); g.fill();
      g.fillStyle = shade(g, -r * 0.3, sd * r * 0.5, r * 0.5, [c[0] + 40, c[1], c[2]]); ell(g, -r * 0.3, sd * r * 0.5 * flap, r * 0.35, r * 0.45 * flap, sd * 0.4); g.fill();
      g.fillStyle = "rgba(255,255,255,.85)"; circ(g, r * 0.2, sd * r * 0.8 * flap, r * 0.1); g.fill();
      g.fillStyle = "rgba(20,10,30,.8)"; circ(g, -r * 0.3, sd * r * 0.55 * flap, r * 0.08); g.fill();
    }
    g.fillStyle = "#2a1d14"; ell(g, 0, 0, r * 0.6, r * 0.09); g.fill();
    for (const sd of [-1, 1]) { line(g, [r * 0.5, 0, r * 0.95, sd * r * 0.3], r * 0.03, "#2a1d14"); circ(g, r * 0.95, sd * r * 0.3, r * 0.05); g.fill(); }
    return;
  }
  // обычное насекомое: голова, грудь, брюшко
  const ant = sh === "ant", bee = sh === "bee", beetle = sh === "beetle", dragon = sh === "dragon";
  for (let i = 0; i < 3; i++) legPair(r * (0.15 - i * 0.12), r * 0.15, r * (ant ? 0.5 : 0.4), i * 2.1, r * 0.04, (i - 1) * r * 0.25);
  if (f.ant) antennae(r * 0.55, r * 0.55 * f.ant, ant);
  const abX = dragon ? -r * 0.85 : -r * 0.42, abRx = dragon ? r * 0.85 : ant ? r * 0.38 : r * 0.5, abRy = dragon ? r * 0.1 : ant ? r * 0.3 : f.flat ? r * 0.45 : r * 0.38;
  g.fillStyle = shade(g, abX, 0, abRx, c); ell(g, abX, 0, abRx, abRy); g.fill();
  if (bee) { g.fillStyle = "rgba(20,15,10,.85)"; for (let i = 0; i < 3; i++) { ell(g, abX - r * 0.3 + i * r * 0.22, 0, r * 0.06, abRy * 0.95); g.fill(); } }
  if (dragon) for (let i = 0; i < 8; i++) { g.fillStyle = hsl(c, -18); circ(g, abX - abRx + i * r * 0.22, 0, r * 0.05); g.fill(); }
  if (beetle) {
    g.fillStyle = shade(g, -r * 0.2, 0, r * 0.7, c, 1, 30, -10); ell(g, -r * 0.2, 0, r * 0.62, r * 0.45); g.fill();
    line(g, [r * 0.4, 0, -r * 0.8, 0], r * 0.03, hsl(c, -25));
    for (const sd of [-1, 1]) line(g, [r * 0.5, sd * r * 0.12, r * 0.85, sd * r * 0.3, r * 1.05, sd * r * 0.1], r * 0.08, hsl(c, -5));
  }
  g.fillStyle = shade(g, r * 0.1, 0, r * 0.28, c); ell(g, r * 0.1, 0, ant ? r * 0.18 : r * 0.25, ant ? r * 0.16 : r * 0.24); g.fill();
  if (f.wings) wings(f.wings, dragon ? "rgba(200,240,255,.4)" : "rgba(230,240,255,.45)", dragon ? 1.3 : 0.75, dragon ? 0.2 : 0.3);
  g.fillStyle = shade(g, r * 0.45, 0, r * 0.25, c); circ(g, r * 0.45, 0, ant ? r * 0.25 : r * 0.2); g.fill();
  if (dragon) { for (const sd of [-1, 1]) { g.fillStyle = "hsla(160,70%,45%,.9)"; circ(g, r * 0.5, sd * r * 0.14, r * 0.13); g.fill(); } }
  else eyes(g, r * 0.55, r * 0.12, r * 0.06);
}

// ---------- Моллюски ----------
function spiralShell(g, x, y, R, c, t) {
  g.fillStyle = shade(g, x, y, R, c); circ(g, x, y, R); g.fill();
  g.strokeStyle = hsl(c, -25, 0.8); g.lineWidth = R * 0.09; g.beginPath();
  for (let a = 0; a < 14; a += 0.15) { const rr = R * 0.95 * a / 14, px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; a ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke();
}
function drawSnail(g, n, r, t, mv) {
  const f = n.f, c = n.c;
  if (f.limpet) {
    g.fillStyle = shade(g, 0, 0, r, c); ell(g, 0, 0, r * 1.0, r * 0.8); g.fill();
    g.strokeStyle = hsl(c, -18, 0.6); g.lineWidth = r * 0.04;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; line(g, [Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.12, Math.cos(a) * r, Math.sin(a) * r * 0.8], r * 0.04, hsl(c, -18, 0.6)); }
    for (const sd of [-1, 1]) line(g, [r * 0.8, sd * r * 0.2, r * 1.25, sd * r * (0.35 + Math.sin(t * 3) * 0.05)], r * 0.06, hsl([c[0], 20, 70]));
    return;
  }
  if (f.nautilus) {
    for (let i = 0; i < 12; i++) { const a = (i - 5.5) * 0.12; wavy(g, r * 0.6, 0, -r * (0.7 + (i % 3) * 0.1), r * 0.12, t * 4 + i, r * 0.06, r * 0.03, hsl([20, 40, 70]), 6); g.rotate(0); }
    spiralShell(g, -r * 0.1, 0, r * 0.9, c, t);
    g.strokeStyle = "hsla(15,70%,40%,.8)"; g.lineWidth = r * 0.1;
    for (let i = 0; i < 6; i++) { const a = i * 0.9; g.beginPath(); g.arc(-r * 0.1, 0, r * (0.3 + i * 0.1), a, a + 0.6); g.stroke(); }
    eyes(g, r * 0.65, r * 0.35, r * 0.08);
    return;
  }
  const stretch = 1 + Math.sin(t * 3) * 0.05 * mv;
  g.fillStyle = shade(g, r * 0.2, 0, r * 0.9, [c[0] + 10, 25, 65]); ell(g, r * 0.2 * stretch, 0, r * 1.05 * stretch, r * 0.38); g.fill();
  for (const sd of [-1, 1]) {
    const ex = r * 1.4, ey = sd * r * (0.35 + Math.sin(t * 2 + sd) * 0.05);
    line(g, [r * 1.0, sd * r * 0.1, ex, ey], r * 0.07, hsl([c[0] + 10, 25, 60]));
    g.fillStyle = "#1a1a1a"; circ(g, ex, ey, r * 0.07); g.fill();
  }
  spiralShell(g, -r * 0.15, 0, r * 0.68, c, t);
}

function drawOcto(g, n, r, t, mv) {
  const f = n.f, c = n.c;
  if (f.squid) {
    for (let i = 0; i < 10; i++) {
      const oy = (i - 4.5) * r * 0.07, long = i === 2 || i === 7;
      wavy(g, -r * 0.3, oy, r * (long ? 2.2 : 1.3), r * 0.25, t * 4 + i, r * 0.1, r * 0.025, hsl(c, -5), 10);
    }
    eyes(g, -r * 0.2, r * 0.3, r * 0.14);
    g.fillStyle = shade(g, r * 0.4, 0, r * 0.8, c); ell(g, r * 0.5, 0, r * 0.85, r * 0.3); g.fill();
    for (const sd of [-1, 1]) { g.fillStyle = hsl(c, -5); g.beginPath(); g.moveTo(r * 1.3, 0); g.lineTo(r * 0.9, sd * r * 0.45); g.lineTo(r * 0.75, 0); g.fill(); }
    return;
  }
  for (let i = 0; i < 8; i++) {
    const a = Math.PI + (i - 3.5) * 0.28 + Math.sin(t * 2 + i) * 0.1;
    g.save(); g.rotate(a - Math.PI);
    const [ex, ey] = wavy(g, -r * 0.15, 0, r * (1.4 + 0.2 * Math.sin(i)), r * 0.35, t * 5 + i * 0.8, r * 0.2, r * 0.035, hsl(c, -4), 12);
    g.restore();
  }
  g.fillStyle = shade(g, r * 0.3, 0, r * 0.65, c); ell(g, r * 0.3, 0, r * 0.65, r * 0.52); g.fill();
  for (let i = 0; i < 5; i++) { g.fillStyle = hsl(c, 12, 0.7); circ(g, r * (0.1 + i * 0.12), Math.sin(i * 2) * r * 0.2, r * 0.05); g.fill(); }
  eyes(g, -r * 0.05, r * 0.38, r * 0.12);
}

// ---------- Рыбы и киты ----------
function drawFish(g, n, r, t, mv) {
  const f = n.f, c = n.c, wig = Math.sin(t * (7 + mv * 6)) * (0.15 + 0.25 * mv);
  if (f.ray) {
    const u = Math.sin(t * 4) * 0.12;
    wavy(g, -r * 0.5, 0, r * 1.4, r * 0.2, t * 4, r * 0.08, r * 0.02, hsl(c, -10), 10);
    g.fillStyle = shade(g, 0, 0, r * 1.1, c);
    g.beginPath(); g.moveTo(r * 0.75, 0);
    g.quadraticCurveTo(r * 0.2, -r * 0.9, -r * 0.1, -r * (1.15 + u)); g.quadraticCurveTo(-r * 0.4, -r * 0.4, -r * 0.6, 0);
    g.quadraticCurveTo(-r * 0.4, r * 0.4, -r * 0.1, r * (1.15 - u)); g.quadraticCurveTo(r * 0.2, r * 0.9, r * 0.75, 0); g.fill();
    for (let i = 0; i < 8; i++) { g.fillStyle = hsl(c, 18, 0.7); circ(g, Math.cos(i * 2.3) * r * 0.4 - r * 0.05, Math.sin(i * 2.3) * r * 0.55, r * 0.05); g.fill(); }
    eyes(g, r * 0.35, r * 0.2, r * 0.07);
    return;
  }
  if (f.seahorse) {
    let px = r * 0.1, py = 0;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + i * 0.5 + Math.sin(t * 2) * 0.1, nx = px + Math.cos(a) * r * 0.22, ny = py + Math.sin(a) * r * 0.22;
      g.fillStyle = shade(g, nx, ny, r * 0.2, c); circ(g, nx, ny, r * (0.28 - i * 0.025)); g.fill(); px = nx; py = ny;
    }
    g.fillStyle = shade(g, r * 0.3, 0, r * 0.3, c); ell(g, r * 0.35, 0, r * 0.32, r * 0.25); g.fill();
    line(g, [r * 0.55, 0, r * 0.95, 0], r * 0.12, hsl(c, -5));
    g.fillStyle = "rgba(255,255,255,.35)"; ell(g, -r * 0.1, 0, r * 0.25, r * 0.08 * (1 + Math.sin(t * 20) * 0.4)); g.fill();
    eyes(g, r * 0.4, r * 0.15, r * 0.07);
    return;
  }
  const L = r * (f.len || 1) * 0.95, Wd = r * (f.shark ? 0.32 : f.thin ? 0.16 : f.fluke ? 0.33 : f.angler ? 0.6 : 0.38);
  // хвост
  g.save(); g.translate(-L * 0.85, 0); g.rotate(wig);
  g.fillStyle = hsl(c, -10);
  if (f.fluke) { g.beginPath(); g.moveTo(r * 0.1, 0); g.quadraticCurveTo(-r * 0.25, -r * 0.2, -r * 0.35, -r * 0.6); g.quadraticCurveTo(-r * 0.15, 0, -r * 0.35, r * 0.6); g.quadraticCurveTo(-r * 0.25, r * 0.2, r * 0.1, 0); g.fill(); }
  else if (f.tail === "none") { line(g, [0, 0, -r * 0.4, 0], Wd * 0.5, hsla2(c)); }
  else if (f.tail === "round" || f.lobe) { ell(g, -r * 0.25, 0, r * 0.35, r * 0.28); g.fill(); }
  else if (f.shark) { g.beginPath(); g.moveTo(r * 0.1, 0); g.lineTo(-r * 0.55, -r * 0.4); g.lineTo(-r * 0.3, 0); g.lineTo(-r * 0.45, r * 0.25); g.closePath(); g.fill(); }
  else { const k = f.tail === "fork" ? 0.55 : 0.4; g.beginPath(); g.moveTo(r * 0.1, 0); g.lineTo(-r * 0.5, -r * k); g.lineTo(-r * 0.3, 0); g.lineTo(-r * 0.5, r * k); g.closePath(); g.fill(); }
  g.restore();
  // плавники
  if (!f.nofins && !f.thin) {
    const fl = Math.sin(t * 6) * 0.2;
    for (const sd of [-1, 1]) {
      g.fillStyle = hsl(c, -6, 0.9);
      if (f.lobe) { ell(g, L * 0.25, sd * Wd * 1.1, r * 0.2, r * 0.1, sd * (0.6 + fl)); g.fill(); ell(g, -L * 0.35, sd * Wd * 0.95, r * 0.16, r * 0.08, sd * (0.7 - fl)); g.fill(); }
      else if (f.shark) { g.beginPath(); g.moveTo(L * 0.25, sd * Wd * 0.7); g.lineTo(-L * 0.15, sd * Wd * 2.6); g.lineTo(-L * 0.05, sd * Wd * 0.7); g.fill(); }
      else if (f.fluke) { ell(g, L * 0.3, sd * Wd * 1.2, r * 0.25, r * 0.09, sd * (0.7 + fl)); g.fill(); }
      else { ell(g, L * 0.25, sd * Wd * 1.05, r * 0.2, r * 0.08, sd * (0.6 + fl)); g.fill(); }
    }
  }
  // тело
  g.fillStyle = shade(g, 0, 0, L, c);
  if (f.shark || f.beakish) { g.beginPath(); g.moveTo(L * 1.2, 0); g.quadraticCurveTo(L * 0.6, -Wd * 1.3, -L, -Wd * 0.3); g.lineTo(-L, Wd * 0.3); g.quadraticCurveTo(L * 0.6, Wd * 1.3, L * 1.2, 0); g.fill(); }
  else { ell(g, 0, 0, L, Wd); g.fill(); }
  g.save(); g.beginPath(); g.ellipse(0, 0, L * 1.2, Wd, 0, 0, TAU); g.clip();
  if (f.clown) for (const x of [0.45, -0.1, -0.6]) { g.fillStyle = "#fff"; g.fillRect(x * L - r * 0.08, -Wd, r * 0.16, Wd * 2); g.fillStyle = "#111"; g.fillRect(x * L - r * 0.1, -Wd, r * 0.025, Wd * 2); g.fillRect(x * L + r * 0.08, -Wd, r * 0.025, Wd * 2); }
  if (f.stripes) for (const x of [0.3, 0, -0.3, -0.6]) { g.fillStyle = hsl(c, -22, 0.6); g.fillRect(x * L - r * 0.05, -Wd, r * 0.1, Wd * 2); }
  if (f.spots || f.mottled) for (let i = 0; i < 12; i++) { g.fillStyle = hsl(c, f.mottled ? 12 : 25, 0.5); circ(g, (Math.cos(i * 2.3) * 0.7) * L, Math.sin(i * 1.7) * Wd * 0.7, r * 0.05); g.fill(); }
  if (f.orca) { g.fillStyle = "#f4f6f8"; ell(g, L * 0.55, -Wd * 0.75, r * 0.18, r * 0.08, 0.2); g.fill(); ell(g, L * 0.55, Wd * 0.75, r * 0.18, r * 0.08, -0.2); g.fill(); g.fillStyle = "rgba(200,210,220,.6)"; ell(g, -L * 0.3, 0, r * 0.25, Wd * 0.4); g.fill(); }
  if (f.piranha) { g.fillStyle = "hsla(0,80%,50%,.6)"; ell(g, L * 0.2, Wd * 0.9, L * 0.7, Wd * 0.35); g.fill(); ell(g, L * 0.2, -Wd * 0.9, L * 0.7, Wd * 0.35); g.fill(); }
  if (f.armor) { g.fillStyle = hsl(c, 18, 0.85); ell(g, L * 0.55, 0, L * 0.55, Wd); g.fill(); g.strokeStyle = hsl(c, -20, 0.6); g.lineWidth = r * 0.03; for (let i = 0; i < 3; i++) line(g, [L * (0.2 + i * 0.25), -Wd, L * (0.2 + i * 0.25), Wd], r * 0.03, hsl(c, -20, 0.6)); }
  g.restore();
  if (f.shark || f.fluke && !f.orca && !f.mottled) { g.fillStyle = hsl(c, -15); ell(g, -L * 0.05, 0, L * 0.25, Wd * 0.18); g.fill(); }
  if (f.orca) { g.fillStyle = "#000"; ell(g, -L * 0.05, 0, L * 0.3, Wd * 0.2); g.fill(); }
  if (f.angler) {
    const bx = L * 1.3, by = Math.sin(t * 2) * r * 0.2;
    line(g, [L * 0.4, 0, L * 0.9, -r * 0.2, bx, by], r * 0.04, hsl(c, 10));
    const gl = g.createRadialGradient(bx, by, 0, bx, by, r * 0.5); gl.addColorStop(0, "rgba(220,255,200,.9)"); gl.addColorStop(1, "rgba(220,255,200,0)");
    g.fillStyle = gl; circ(g, bx, by, r * 0.5); g.fill();
    g.fillStyle = "#f4fff0"; circ(g, bx, by, r * 0.1); g.fill();
    g.strokeStyle = "#eee"; g.lineWidth = r * 0.03; for (let i = -3; i <= 3; i++) line(g, [L * 0.9, i * r * 0.08, L * 0.8, i * r * 0.08], r * 0.03, "#eee");
  }
  if (!f.thin && !f.nofins || f.fluke) eyes(g, L * 0.62, Wd * 0.62, r * (f.fluke ? 0.06 : 0.09));
  else { g.fillStyle = "rgba(0,0,0,.4)"; circ(g, L * 0.7, 0, r * 0.05); g.fill(); }
}
function hsla2(c) { return hsl(c, -10); }

// ---------- Четвероногие ----------
function drawTail(g, n, r, t, mv, x0) {
  const f = n.f, c = n.c, len = (f.tail || 0) * r;
  if (len <= 0 && !f.puff) return;
  const tc = f.tailc || c;
  if (f.puff) { g.fillStyle = "#fff"; circ(g, x0 - r * 0.05, 0, r * 0.16); g.fill(); return; }
  if (f.paddle) { g.fillStyle = hsl(c, -20); ell(g, x0 - len * 0.55, 0, len * 0.55, r * 0.2); g.fill(); g.strokeStyle = hsl(c, -30, 0.5); g.lineWidth = r * 0.02; for (let i = 0; i < 4; i++) line(g, [x0 - len * (0.2 + i * 0.2), -r * 0.15, x0 - len * (0.2 + i * 0.2), r * 0.15], r * 0.02, hsl(c, -30, 0.5)); return; }
  if (f.curl) {
    g.strokeStyle = hsl(tc, -5); g.lineWidth = r * 0.07; g.beginPath();
    for (let a = 0; a < 9; a += 0.3) { const rr = r * 0.2 * (1 - a / 10), px = x0 - r * 0.25 + Math.cos(a) * rr, py = Math.sin(a) * rr; a ? g.lineTo(px, py) : g.moveTo(x0, 0); }
    g.stroke(); return;
  }
  const w0 = r * (f.tailW ?? (f.sprawl ? 0.22 : 0.1)), w1 = f.bushy ? w0 * 0.6 : r * 0.03;
  const amp = r * (f.sprawl ? 0.35 : 0.25) * (0.4 + 0.6 * mv), ph = t * (f.sprawl ? 6 : 5);
  if (f.bushy) {
    const N = 7;
    for (let i = 0; i <= N; i++) {
      const k = i / N, x = x0 - len * k, y = Math.sin(ph - k * 3) * amp * k;
      g.fillStyle = f.tailTip && i === N ? "#fff" : hsl(tc, -3 + k * 6);
      circ(g, x, y, w0 * (0.6 + Math.sin(k * Math.PI) * 0.8)); g.fill();
    }
    return;
  }
  if (f.rings) {
    for (let i = 0; i <= 12; i++) { const k = i / 12, x = x0 - len * k, y = Math.sin(ph - k * 3) * amp * k; g.fillStyle = i % 2 ? "#eee" : "#222"; circ(g, x, y, w0 * 0.9); g.fill(); }
    return;
  }
  wavy(g, x0, 0, len, amp, ph, w0, w1, hsl(tc, -4), 12);
}

function drawQuad(g, n, r, t, mv) {
  const f = n.f;
  let c = n.c;
  if (f.rainbow) c = [(c[0] + t * 20) % 360, c[1], c[2]];
  const L = f.len || 1.2, Wd = f.wid || 0.5, H = f.head || 0.42;
  const rx = r * L * 0.62, ry = r * Wd;
  const sw = 0.25 + 0.75 * mv, step = t * (f.hop ? 7 : 9 + mv * 4);
  const dark = hsl(c, -18);
  // хвост
  drawTail(g, n, r, t, mv, -rx * 0.88);
  // лапы
  if (f.flippers) {
    const fl = Math.sin(t * 4) * 0.3;
    for (const sd of [-1, 1]) {
      g.fillStyle = dark; ell(g, rx * 0.35, sd * (ry + r * 0.15), r * 0.35, r * 0.12, sd * (0.7 + fl)); g.fill();
      ell(g, -rx * 0.75, sd * ry * 0.6, r * 0.25, r * 0.09, sd * (2.4 - fl)); g.fill();
    }
  } else if (f.biped) {
    for (const sd of [-1, 1]) {
      const s = Math.sin(step + (sd > 0 ? Math.PI : 0)) * r * 0.35 * sw;
      line(g, [-rx * 0.05, sd * ry * 0.6, -rx * 0.05 + s, sd * (ry + r * 0.12)], r * 0.2, dark);
      g.fillStyle = dark; ell(g, -rx * 0.05 + s + r * 0.08, sd * (ry + r * 0.12), r * 0.16, r * 0.1); g.fill();
      line(g, [rx * 0.6, sd * ry * 0.6, rx * 0.8, sd * (ry * 0.75)], r * 0.07, dark);
    }
  } else {
    const hips = [[rx * 0.55, -1, 0], [rx * 0.55, 1, Math.PI], [-rx * 0.55, -1, Math.PI], [-rx * 0.55, 1, 0]];
    for (const [hx, sd, ph] of hips) {
      const s = Math.sin(step + (f.hop ? 0 : ph)) * r * 0.22 * sw;
      if (f.sprawl) {
        const ky = sd * (ry + r * 0.3), fy = sd * (ry + r * 0.35);
        line(g, [hx, sd * ry * 0.5, hx + s * 0.4, ky, hx + s + r * 0.12 * Math.sign(hx), fy], r * 0.13, dark);
        g.fillStyle = dark; for (let k = -1; k <= 1; k++) { circ(g, hx + s + r * 0.12 * Math.sign(hx) + k * r * 0.07, fy + sd * r * 0.07, r * 0.04); g.fill(); }
      } else {
        const big = f.bigpaws && hx > 0 ? 1.8 : 1;
        g.fillStyle = dark; ell(g, hx + s, sd * (ry * 0.88 + r * 0.06 * big), r * 0.16 * big, r * 0.12 * big); g.fill();
        if (f.bigpaws && hx > 0) { g.fillStyle = "#e9c9b8"; ell(g, hx + s + r * 0.1, sd * (ry * 0.88 + r * 0.1), r * 0.14, r * 0.14); g.fill(); }
      }
    }
  }
  // тело
  if (f.shell) {
    g.fillStyle = shade(g, 0, 0, rx, c, 1, 18, -16); ell(g, 0, 0, rx * 1.05, ry); g.fill();
    g.strokeStyle = hsl(c, -25, 0.8); g.lineWidth = r * 0.04;
    for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) {
      const cx = i * rx * 0.55, cy = k * ry * 0.55;
      if (Math.abs(i) + Math.abs(k) === 2) continue;
      g.beginPath(); for (let s = 0; s <= 6; s++) { const a = s / 6 * TAU; g.lineTo(cx + Math.cos(a) * r * 0.22, cy + Math.sin(a) * r * 0.22); } g.stroke();
    }
    g.strokeStyle = hsl(c, 15, 0.7); g.lineWidth = r * 0.05; ell(g, 0, 0, rx * 1.05, ry); g.stroke();
  } else {
    g.fillStyle = shade(g, 0, 0, Math.max(rx, ry), c); ell(g, 0, 0, rx, ry); g.fill();
    g.save(); ell(g, 0, 0, rx, ry); g.clip();
    if (f.stripes) { g.strokeStyle = hsl(c, -35, 0.85); g.lineWidth = r * 0.07; for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * rx * 0.22, -ry); g.quadraticCurveTo(i * rx * 0.22 + r * 0.1, 0, i * rx * 0.22, ry); g.stroke(); } }
    if (f.spots) for (let i = 0; i < 16; i++) { g.fillStyle = f.spotc ? hsl(f.spotc) : hsl(c, -30, 0.8); circ(g, Math.cos(i * 2.39) * rx * 0.8 * Math.sqrt(i / 16), Math.sin(i * 2.39) * ry * 0.85 * Math.sqrt(i / 16), r * (f.spotc ? 0.09 : 0.065)); g.fill(); }
    if (f.patches) for (let i = 0; i < 5; i++) { g.fillStyle = "#1c1c1c"; ell(g, Math.cos(i * 2.2) * rx * 0.6, Math.sin(i * 2.9) * ry * 0.6, r * 0.25, r * 0.18, i); g.fill(); }
    if (f.panda) { g.fillStyle = "#151515"; g.fillRect(rx * 0.1, -ry, rx * 0.45, ry * 2); }
    if (f.fur || f.feathers) { g.strokeStyle = hsl(c, -15, 0.5); g.lineWidth = r * 0.03; for (let i = 0; i < 30; i++) { const x = Math.cos(i * 2.4) * rx * 0.85 * Math.sqrt(i / 30), y = Math.sin(i * 2.4) * ry * 0.85 * Math.sqrt(i / 30); line(g, [x, y, x - r * 0.12, y + r * 0.03], r * 0.03, hsl(c, f.feathers ? 15 : -15, 0.6)); } }
    g.restore();
    if (f.scutes) for (let i = -3; i <= 3; i++) for (const sd of [-1, 1]) { g.fillStyle = hsl(c, -15); circ(g, i * rx * 0.25, sd * ry * 0.25, r * 0.06); g.fill(); }
    if (f.hump) { g.fillStyle = shade(g, -rx * 0.1, 0, r * 0.4, c, 1, 22, -5); circ(g, -rx * 0.1, 0, r * 0.38); g.fill(); }
    if (f.spikes) for (let i = 0; i < 40; i++) { const x = Math.cos(i * 2.4) * rx * 0.9 * Math.sqrt(i / 40), y = Math.sin(i * 2.4) * ry * 0.9 * Math.sqrt(i / 40); line(g, [x, y, x - r * 0.25, y * 1.15], r * 0.045, i % 2 ? "#3b2c22" : "#d8c8b0"); }
    if (f.plates) for (let i = -3; i <= 3; i++) { const x = i * rx * 0.28, s = r * (0.28 - Math.abs(i) * 0.04); g.fillStyle = i % 2 ? "hsl(20,60%,45%)" : "hsl(30,60%,50%)"; g.beginPath(); g.moveTo(x + s, 0); g.lineTo(x, (i % 2 ? -1 : 1) * s * 0.8); g.lineTo(x - s, 0); g.closePath(); g.fill(); }
    if (f.plates) for (const sd of [-1, 1]) line(g, [-rx - (f.tail || 0) * r * 0.6, 0, -rx - (f.tail || 0) * r * 0.8, sd * r * 0.3], r * 0.06, "#ddd");
    if (f.sail) { g.fillStyle = "hsla(5,60%,45%,.85)"; ell(g, 0, 0, rx * 0.9, r * 0.1); g.fill(); for (let i = -5; i <= 5; i++) line(g, [i * rx * 0.16, -r * 0.12, i * rx * 0.16, r * 0.12], r * 0.03, "#3a1c12"); }
    if (f.mane === "strip") line(g, [-rx * 0.2, 0, rx * 0.9 + (f.neck || 0) * r, 0], r * 0.12, "hsl(25,30%,15%)");
  }
  // шея и голова
  const neck = (f.neck || 0) * r, hx = rx * 0.82 + neck + H * r * 0.35;
  if (neck) {
    line(g, [rx * 0.6, 0, hx - H * r * 0.3, 0], r * Math.max(0.16, H * 0.75), hsl(c, -2));
    if (f.spots) for (let i = 0; i < 6; i++) { g.fillStyle = hsl(c, -30, 0.8); circ(g, rx * 0.7 + i * neck / 6, (i % 2 - 0.5) * r * 0.08, r * 0.05); g.fill(); }
  }
  if (f.collar) line(g, [rx * 0.8, -ry * 0.55, rx * 0.8, ry * 0.55], r * 0.08, "#d33");
  if (f.mane === 1) { g.fillStyle = shade(g, hx - H * r * 0.2, 0, H * r * 1.3, [30, 55, 32]); circ(g, hx - H * r * 0.15, 0, H * r * 1.35); g.fill(); }
  if (f.frill) { g.fillStyle = shade(g, hx - H * r * 0.4, 0, r * 0.7, c, 1, 10, -18); g.beginPath(); g.ellipse(hx - H * r * 0.4, 0, r * 0.35, r * 0.75, 0, Math.PI * 0.5, Math.PI * 1.5); g.fill(); g.strokeStyle = "hsl(30,50%,60%)"; g.lineWidth = r * 0.05; g.stroke(); }
  const hrx = H * r * 0.75, hry = H * r * 0.62;
  // уши (сзади головы — рисуем до головы)
  const ex = hx - hrx * 0.35, ey = hry * 0.75;
  switch (f.ears) {
    case "pointy": for (const sd of [-1, 1]) { g.fillStyle = dark; g.beginPath(); g.moveTo(ex + hrx * 0.3, sd * ey * 0.5); g.lineTo(ex - hrx * 0.5, sd * (ey + r * 0.12)); g.lineTo(ex - hrx * 0.1, sd * ey * 0.3); g.fill(); } break;
    case "round": case "small": for (const sd of [-1, 1]) { g.fillStyle = dark; circ(g, ex, sd * ey, r * (f.ears === "small" ? 0.07 : 0.11)); g.fill(); } break;
    case "big": for (const sd of [-1, 1]) { g.fillStyle = f.trunk ? hsl(c, -8) : "hsl(350,40%,75%)"; ell(g, ex - (f.trunk ? r * 0.1 : 0), sd * (ey + r * (f.trunk ? 0.25 : 0.05)), r * (f.trunk ? 0.3 : 0.15), r * (f.trunk ? 0.4 : 0.15)); g.fill(); g.strokeStyle = dark; g.lineWidth = r * 0.03; g.stroke(); } break;
    case "long": for (const sd of [-1, 1]) { g.fillStyle = hsl(c, -6); ell(g, ex - r * 0.3, sd * ey * 0.5, r * 0.35, r * 0.09, sd * -0.15); g.fill(); g.fillStyle = "hsla(350,50%,75%,.8)"; ell(g, ex - r * 0.3, sd * ey * 0.5, r * 0.25, r * 0.04, sd * -0.15); g.fill(); } break;
    case "floppy": for (const sd of [-1, 1]) { g.fillStyle = dark; ell(g, ex + hrx * 0.1, sd * (ey + r * 0.06), r * 0.18, r * 0.09, sd * 0.4); g.fill(); } break;
    case "fluffy": for (const sd of [-1, 1]) { g.fillStyle = "hsl(0,0%,80%)"; circ(g, ex, sd * (ey + r * 0.05), r * 0.2); g.fill(); g.fillStyle = "hsl(0,0%,92%)"; circ(g, ex, sd * (ey + r * 0.05), r * 0.12); g.fill(); } break;
    case "tuft": for (const sd of [-1, 1]) { g.fillStyle = dark; g.beginPath(); g.moveTo(ex + hrx * 0.2, sd * ey * 0.5); g.lineTo(ex - hrx * 0.6, sd * (ey + r * 0.15)); g.lineTo(ex - hrx * 0.1, sd * ey * 0.2); g.fill(); } break;
  }
  if (f.gills) for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) line(g, [hx - hrx * 0.3, sd * hry * 0.7, hx - hrx * 0.8 - k * r * 0.05, sd * (hry + r * 0.25 - k * r * 0.08)], r * 0.06, "hsl(345,70%,65%)");
  g.fillStyle = shade(g, hx, 0, hrx, c); ell(g, hx, 0, hrx, hry); g.fill();
  if (f.panda) { g.fillStyle = "#151515"; for (const sd of [-1, 1]) { ell(g, hx + hrx * 0.35, sd * hry * 0.4, r * 0.1, r * 0.07, sd * 0.5); g.fill(); } }
  if (f.cheeks) for (const sd of [-1, 1]) { g.fillStyle = hsl(c, 12); circ(g, hx + hrx * 0.1, sd * hry * 0.85, r * 0.16); g.fill(); }
  if (f.face) { g.fillStyle = "hsla(20,40%,70%,.9)"; ell(g, hx + hrx * 0.4, 0, hrx * 0.55, hry * 0.7); g.fill(); }
  // морда
  let tip = hx + hrx;
  const sn = (f.snout || 0) * r;
  if (f.bill) { g.fillStyle = "hsl(30,15%,22%)"; ell(g, hx + hrx + r * 0.25, 0, r * 0.35, hry * 0.8); g.fill(); tip += r * 0.55; }
  else if (sn > 0) {
    g.fillStyle = shade(g, hx + hrx + sn * 0.4, 0, sn + r * 0.1, c, 1, 20, -8);
    ell(g, hx + hrx * 0.8 + sn * 0.5, 0, sn * 0.6 + r * 0.06, hry * (f.snout > 0.4 ? 0.45 : 0.55)); g.fill();
    tip = hx + hrx * 0.8 + sn * 1.05 + r * 0.05;
    if (f.teeth) for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) { g.fillStyle = "#f5f1e6"; circ(g, hx + hrx * 0.7 + i * sn * 0.18, sd * hry * 0.42, r * 0.025); g.fill(); }
  }
  if (f.nose === "pig") { g.fillStyle = "hsl(350,50%,72%)"; ell(g, tip, 0, r * 0.07, r * 0.12); g.fill(); g.fillStyle = "#6b3a3a"; for (const sd of [-1, 1]) { circ(g, tip, sd * r * 0.04, r * 0.025); g.fill(); } }
  else if (f.nose === "big") { g.fillStyle = "#222"; ell(g, tip - r * 0.04, 0, r * 0.09, r * 0.12); g.fill(); }
  else if (!f.bill && !f.sprawl && !f.trunk) { g.fillStyle = "#1a1210"; circ(g, tip - r * 0.02, 0, r * 0.05); g.fill(); }
  if (f.whiskers) for (const sd of [-1, 1]) for (let k = -1; k <= 1; k++) line(g, [tip - r * 0.05, sd * r * 0.05, tip + r * 0.1, sd * (r * 0.28 + k * r * 0.06)], r * 0.012, "rgba(255,255,255,.7)");
  // рога, бивни, хобот
  if (f.horns === "cow") for (const sd of [-1, 1]) line(g, [hx - hrx * 0.2, sd * hry * 0.6, hx - hrx * 0.1, sd * (hry + r * 0.15), hx + hrx * 0.25, sd * (hry + r * 0.2)], r * 0.06, "#e8dcc0");
  if (f.horns === "antler") for (const sd of [-1, 1]) { line(g, [hx - hrx * 0.3, sd * hry * 0.4, hx - hrx * 0.9, sd * (hry + r * 0.4), hx - hrx * 1.5, sd * (hry + r * 0.55)], r * 0.05, "#c9a77a"); line(g, [hx - hrx * 0.9, sd * (hry + r * 0.4), hx - hrx * 0.4, sd * (hry + r * 0.65)], r * 0.04, "#c9a77a"); line(g, [hx - hrx * 1.2, sd * (hry + r * 0.48), hx - hrx * 1.1, sd * (hry + r * 0.85)], r * 0.04, "#c9a77a"); }
  if (f.horns === "ossi") for (const sd of [-1, 1]) { line(g, [hx - hrx * 0.2, sd * hry * 0.3, hx - hrx * 0.5, sd * hry * 0.6], r * 0.05, hsl(c, -20)); g.fillStyle = "#3a2a1a"; circ(g, hx - hrx * 0.5, sd * hry * 0.6, r * 0.04); g.fill(); }
  if (f.horns === "rhino") { g.fillStyle = "#cfc6b8"; g.beginPath(); g.moveTo(tip - r * 0.15, -r * 0.07); g.lineTo(tip + r * 0.25, 0); g.lineTo(tip - r * 0.15, r * 0.07); g.fill(); }
  if (f.horns === "tri") { for (const sd of [-1, 1]) line(g, [hx, sd * hry * 0.4, hx + r * 0.55, sd * hry * 0.55], r * 0.07, "#e8dcc0"); g.fillStyle = "#e8dcc0"; g.beginPath(); g.moveTo(tip - r * 0.1, -r * 0.05); g.lineTo(tip + r * 0.15, 0); g.lineTo(tip - r * 0.1, r * 0.05); g.fill(); }
  if (f.tusks) for (const sd of [-1, 1]) { g.strokeStyle = "#f2ead6"; g.lineWidth = r * 0.07; g.beginPath(); g.moveTo(hx + hrx * 0.7, sd * hry * 0.35); g.quadraticCurveTo(hx + hrx + r * 0.5 * f.tusks, sd * hry * (0.9 + f.tusks * 0.3), hx + hrx + r * 0.55 * f.tusks, sd * hry * 0.2); g.stroke(); }
  if (f.trunk) {
    const len = r * 0.9 * f.trunk;
    const N = 10; let px = hx + hrx * 0.8, py = 0;
    for (let i = 1; i <= N; i++) { const k = i / N, x = hx + hrx * 0.8 + len * k, y = Math.sin(t * 2.5 - k * 3) * r * 0.25 * k; line(g, [px, py, x, y], r * (0.16 - k * 0.09), hsl(c, -4)); px = x; py = y; }
  }
  // глаза
  if (f.frog || f.eyes === "big") for (const sd of [-1, 1]) { g.fillStyle = shade(g, hx + hrx * 0.1, sd * hry * 0.7, r * 0.14, c); circ(g, hx + hrx * 0.1, sd * hry * 0.75, r * 0.14); g.fill(); eye(g, hx + hrx * 0.15, sd * hry * 0.75, r * 0.09); }
  else eyes(g, hx + hrx * 0.35, hry * 0.55, r * 0.065);
}

// ---------- Птицы, птерозавры, летучие мыши ----------
function drawBird(g, n, r, t, mv) {
  const f = n.f, c = n.c;
  const flapSpd = f.flap || 12, flap = Math.sin(t * flapSpd), span = 0.55 + 0.45 * Math.abs(flap);
  if (f.bat || f.ptero) {
    for (const sd of [-1, 1]) {
      const sp = r * (f.ptero ? 1.9 : 1.4) * span;
      g.fillStyle = f.ptero ? "hsla(25,40%,55%,.9)" : "hsla(20,15%,22%,.95)";
      g.beginPath(); g.moveTo(r * 0.25, sd * r * 0.15); g.lineTo(r * 0.05, sd * sp);
      for (let k = 0; k < 4; k++) g.quadraticCurveTo(-r * (0.15 + k * 0.15), sd * sp * (0.9 - k * 0.2), -r * (0.25 + k * 0.15), sd * sp * (0.75 - k * 0.2));
      g.lineTo(-r * 0.35, sd * r * 0.12); g.closePath(); g.fill();
      g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = r * 0.03;
      for (let k = 0; k < 4; k++) line(g, [r * 0.05, sd * r * 0.2, -r * (0.25 + k * 0.15), sd * sp * (0.75 - k * 0.2)], r * 0.025, "rgba(0,0,0,.35)");
    }
    g.fillStyle = shade(g, 0, 0, r * 0.4, c); ell(g, 0, 0, r * 0.42, r * 0.22); g.fill();
    g.fillStyle = shade(g, r * 0.4, 0, r * 0.2, c); circ(g, r * 0.4, 0, r * 0.18); g.fill();
    if (f.bat) for (const sd of [-1, 1]) { g.fillStyle = hsl(c, -10); g.beginPath(); g.moveTo(r * 0.38, sd * r * 0.08); g.lineTo(r * 0.25, sd * r * 0.35); g.lineTo(r * 0.48, sd * r * 0.15); g.fill(); }
    if (f.ptero) { g.fillStyle = "hsl(35,60%,55%)"; g.beginPath(); g.moveTo(r * 0.5, -r * 0.06); g.lineTo(r * 1.2, 0); g.lineTo(r * 0.5, r * 0.06); g.fill(); g.fillStyle = "hsl(5,60%,50%)"; g.beginPath(); g.moveTo(r * 0.35, -r * 0.05); g.lineTo(-r * 0.15, 0); g.lineTo(r * 0.35, r * 0.05); g.fill(); }
    eyes(g, r * 0.48, r * 0.09, r * 0.045);
    return;
  }
  // хвост
  if (f.longtail) { for (let i = 0; i < 8; i++) { const x = -r * 0.45 - i * r * 0.15; for (const sd of [-1, 1]) { g.fillStyle = hsl(c, -5 + (i % 2) * 8); ell(g, x, sd * r * 0.1, r * 0.12, r * 0.06, sd * 0.6); g.fill(); } line(g, [-r * 0.4, 0, -r * 1.6, Math.sin(t * 3) * r * 0.1], r * 0.05, hsl(c, -15)); } }
  else if (!f.penguin) for (let i = -2; i <= 2; i++) { g.fillStyle = hsl(c, -8 + Math.abs(i) * 3); ell(g, -r * 0.65, i * r * 0.07, r * 0.28, r * 0.07, i * 0.25); g.fill(); }
  // крылья
  if (f.fly) for (const sd of [-1, 1]) {
    const sp = r * (f.owl ? 1.2 : 1.4) * span;
    const col = f.parrot ? (sd < 0 ? "hsl(215,80%,45%)" : "hsl(215,80%,45%)") : hsl(c, -6);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(r * 0.25, sd * r * 0.2);
    g.quadraticCurveTo(r * 0.15, sd * sp * 0.8, -r * 0.15, sd * sp);
    g.lineTo(-r * 0.3, sd * sp * 0.85); g.lineTo(-r * 0.35, sd * sp * 0.65); g.lineTo(-r * 0.4, sd * sp * 0.45);
    g.quadraticCurveTo(-r * 0.35, sd * r * 0.3, -r * 0.3, sd * r * 0.15); g.closePath(); g.fill();
    g.strokeStyle = hsl(c, -25, 0.5); g.lineWidth = r * 0.025;
    for (let k = 0; k < 4; k++) line(g, [r * 0.05, sd * (r * 0.3 + k * sp * 0.15), -r * 0.3, sd * (r * 0.3 + k * sp * 0.18)], r * 0.02, hsl(c, -25, 0.4));
    if (f.parrot) { g.fillStyle = "hsl(50,90%,55%)"; ell(g, -r * 0.05, sd * sp * 0.4, r * 0.1, sp * 0.2); g.fill(); }
  } else if (f.penguin) {
    const fl = Math.sin(t * 6) * 0.3 * mv;
    for (const sd of [-1, 1]) { g.fillStyle = "#151a22"; ell(g, r * 0.05, sd * r * 0.45, r * 0.32, r * 0.08, sd * (0.5 + fl)); g.fill(); }
  } else for (const sd of [-1, 1]) { g.fillStyle = hsl(c, -10); ell(g, -r * 0.1, sd * r * 0.3, r * 0.45, r * 0.13, sd * -0.15); g.fill(); }
  // тело
  const bodyC = f.parrot ? [0, 80, 50] : c;
  g.fillStyle = shade(g, 0, 0, r * 0.6, bodyC); ell(g, 0, 0, r * (f.penguin ? 0.6 : 0.55), r * (f.penguin ? 0.42 : 0.35)); g.fill();
  if (f.penguin) { g.fillStyle = "rgba(240,240,245,.9)"; ell(g, r * 0.1, 0, r * 0.3, r * 0.16); g.fill(); }
  // голова
  const hr = r * (f.owl ? 0.38 : 0.26), hx = r * (f.owl ? 0.4 : 0.55);
  g.fillStyle = shade(g, hx, 0, hr, f.whitehead ? [40, 20, 92] : bodyC); circ(g, hx, 0, hr); g.fill();
  if (f.owl) { for (const sd of [-1, 1]) { g.fillStyle = "hsl(35,30%,75%)"; circ(g, hx + hr * 0.3, sd * hr * 0.45, hr * 0.42); g.fill(); g.fillStyle = hsl(c, -15); g.beginPath(); g.moveTo(hx - hr * 0.2, sd * hr * 0.5); g.lineTo(hx - hr * 0.9, sd * hr * 0.95); g.lineTo(hx - hr * 0.4, sd * hr * 0.2); g.fill(); } }
  if (f.comb) { g.fillStyle = "#e0262a"; for (let i = 0; i < 3; i++) { circ(g, hx - hr * 0.2 + i * hr * 0.35, 0, hr * 0.28); g.fill(); } }
  if (f.crest) { g.fillStyle = hsl(c, -15); g.beginPath(); g.moveTo(hx, -r * 0.05); g.lineTo(hx - r * 0.5, 0); g.lineTo(hx, r * 0.05); g.fill(); }
  // клюв
  const bx = hx + hr * 0.85, bc = f.whitehead || f.beak === "hook" ? "hsl(45,90%,55%)" : f.penguin ? "hsl(25,90%,55%)" : f.beak === "needle" ? "#222" : "hsl(40,70%,50%)";
  g.fillStyle = bc; g.beginPath();
  const bl = f.beak === "needle" ? r * 0.7 : f.beak === "long" ? r * 0.6 : f.beak === "hook" ? r * 0.25 : r * 0.2, bw = f.beak === "needle" ? r * 0.025 : r * 0.08;
  g.moveTo(bx - r * 0.02, -bw); g.lineTo(bx + bl, 0); g.lineTo(bx - r * 0.02, bw); g.fill();
  if (f.owl) { eyes(g, hx + hr * 0.4, hr * 0.45, hr * 0.28); }
  else eyes(g, hx + hr * 0.35, hr * 0.6, r * 0.06);
}

// ---------- Обезьяны и люди ----------
function drawHominid(g, n, r, t, mv) {
  r *= 1.3; // вид сверху у людей компактный — рисуем чуть крупнее
  const f = n.f, c = n.c, ape = n.body === "ape";
  const big = f.big ? 1.18 : 1, s = Math.sin(t * (8 + mv * 3)) * (0.2 + 0.8 * mv);
  const skin = [25, 45, 62], fur = c;
  const bodyC = f.clothes ? [210, 45, 45] : f.cloak ? [30, 35, 35] : fur;
  const armC = ape || f.hairy ? fur : skin;
  // ноги
  if (!ape) for (const sd of [-1, 1]) { g.fillStyle = f.clothes ? "#2b3346" : hsl(fur, -12); ell(g, sd * s * r * 0.35, sd * r * 0.2, r * 0.2, r * 0.11); g.fill(); }
  else for (const sd of [-1, 1]) { g.fillStyle = hsl(fur, -12); ell(g, -r * 0.3 - sd * s * r * 0.2, sd * r * 0.3 * big, r * 0.18, r * 0.12); g.fill(); }
  // руки
  const arm = (f.arms || 1) * (ape ? 1.25 : 0.9);
  const hands = [];
  for (const sd of [-1, 1]) {
    const sx = 0, sy = sd * r * 0.55 * big;
    const hx = ape ? r * 0.35 * arm + sd * s * r * 0.25 : -sd * s * r * 0.4 + r * 0.05;
    const hy = sd * r * (ape ? 0.68 : 0.62) * big;
    line(g, [sx, sy, (sx + hx) / 2 + (ape ? 0 : -r * 0.05), (sy + hy) / 2 + sd * r * 0.06, hx, hy], r * (ape ? 0.24 : 0.17) * big, hsl(armC, -4));
    g.fillStyle = hsl(ape ? [c[0], c[1], c[2] - 8] : skin, -6); circ(g, hx, hy, r * 0.12 * big); g.fill();
    hands.push([hx, hy]);
  }
  // орудия
  const [tx, ty] = hands[1];
  if (f.tool === "stone") { g.fillStyle = "#8d8a84"; ell(g, tx + r * 0.12, ty, r * 0.13, r * 0.1, 0.4); g.fill(); g.fillStyle = "#b7b3ab"; ell(g, tx + r * 0.15, ty - r * 0.03, r * 0.05, r * 0.04); g.fill(); }
  if (f.tool === "spear") { line(g, [tx - r * 0.6, ty, tx + r * 1.2, ty], r * 0.06, "#7a5a36"); g.fillStyle = "#9a958c"; g.beginPath(); g.moveTo(tx + r * 1.45, ty); g.lineTo(tx + r * 1.15, ty - r * 0.08); g.lineTo(tx + r * 1.15, ty + r * 0.08); g.fill(); }
  if (f.tool === "torch") {
    line(g, [tx - r * 0.1, ty, tx + r * 0.45, ty], r * 0.08, "#6b4a2a");
    const fx = tx + r * 0.55, fy = ty, fl = 1 + Math.sin(t * 17) * 0.15 + Math.sin(t * 29) * 0.1;
    const gl = g.createRadialGradient(fx, fy, 0, fx, fy, r * 1.4 * fl); gl.addColorStop(0, "rgba(255,200,90,.45)"); gl.addColorStop(1, "rgba(255,140,40,0)");
    g.fillStyle = gl; circ(g, fx, fy, r * 1.4 * fl); g.fill();
    g.fillStyle = "hsl(30,100%,55%)"; circ(g, fx, fy, r * 0.17 * fl); g.fill();
    g.fillStyle = "hsl(50,100%,70%)"; circ(g, fx + r * 0.02, fy, r * 0.09 * fl); g.fill();
  }
  // туловище (плечи)
  g.fillStyle = shade(g, 0, 0, r * 0.6 * big, bodyC);
  ell(g, ape ? -r * 0.05 : 0, 0, r * (ape ? 0.42 : 0.3) * big, r * (ape ? 0.62 : 0.56) * big); g.fill();
  if (f.silver) { g.fillStyle = "rgba(190,190,195,.75)"; ell(g, -r * 0.2, 0, r * 0.2, r * 0.38); g.fill(); }
  if (f.clothes) { g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = r * 0.04; line(g, [r * 0.28, -r * 0.2, r * 0.28, r * 0.2], r * 0.04, "rgba(255,255,255,.3)"); }
  if (f.cloak) { g.strokeStyle = "hsl(30,30%,55%)"; g.lineWidth = r * 0.04; for (let i = 0; i < 8; i++) line(g, [-r * 0.2 + (i % 3) * r * 0.1, -r * 0.4 + i * r * 0.11, -r * 0.3 + (i % 3) * r * 0.1, -r * 0.35 + i * r * 0.11], r * 0.03, "hsl(30,30%,55%)"); }
  // голова
  const hx = ape ? r * 0.25 * big : r * 0.03, hr = r * (ape ? 0.27 : 0.25) * big;
  g.fillStyle = shade(g, hx, 0, hr, ape ? fur : skin); circ(g, hx, 0, hr); g.fill();
  if (ape) { g.fillStyle = f.silver || c[2] < 25 ? "hsl(20,15%,30%)" : "hsla(25,40%,65%,.95)"; ell(g, hx + hr * 0.45, 0, hr * 0.5, hr * 0.62); g.fill(); }
  else {
    g.fillStyle = f.hairy ? hsl(fur, -10) : "hsl(25,35%,16%)";
    g.beginPath(); g.arc(hx - hr * 0.1, 0, hr * 0.95, Math.PI * 0.55, Math.PI * 1.45); g.fill();
    ell(g, hx - hr * 0.3, 0, hr * 0.6, hr * 0.85); g.fill();
    g.fillStyle = "hsl(25,40%,52%)"; ell(g, hx + hr * 0.95, 0, hr * 0.18, hr * 0.13); g.fill();
  }
  for (const sd of [-1, 1]) { g.fillStyle = "#1a0f08"; circ(g, hx + hr * 0.65, sd * hr * 0.35, r * 0.035); g.fill(); }
}
