/* Червоний китайський дракон у стилі витинанки.
   Тіло будується вздовж хвилястої лінії (хребта), тому дракон плавно «пливе».
   Голова, роги, грива і перлина — окремі фігури, які рухаються разом із тілом. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const W = 1200, H = 600;
  const HX = 340, LEN = 760, N = 180;

  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const f = (v) => v.toFixed(1);
  const P = (p) => f(p[0]) + " " + f(p[1]);
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

  function spine(s, t) {
    const env = 0.22 + 0.78 * Math.min(1, s * 1.7);
    const y = 292 + env * 142 * Math.sin(s * Math.PI * 2.7 - t * 1.0 + 0.55) + 12 * Math.sin(t * 0.6);
    const x = HX + s * LEN + 26 * s * Math.sin(s * Math.PI * 1.3 + t * 0.45);
    return [x, y];
  }
  function width(s) {
    if (s < 0.07) return 27 + (s / 0.07) * 11;
    const u = (s - 0.07) / 0.93;
    return 41 * Math.pow(1 - u, 0.8) + 2.5;
  }

  // Голова у власних координатах: початок — шия, морда дивиться вліво (−x).
  const HEAD = `
    <g class="dr-fill">
      <path class="dr-dark" d="M-30 -44 C-14 -82 14 -104 58 -118 C26 -98 4 -76 -14 -40 Z"/>
      <path d="M-44 -46 C-26 -86 4 -108 48 -124 C16 -102 -6 -80 -26 -42 Z"/>
      <path d="M-4 -88 C2 -104 12 -116 26 -132 C18 -112 12 -100 10 -84 Z"/>
      <path d="M-12 -32 C18 -54 42 -48 66 -64 C52 -42 34 -32 10 -20 Z"/>
      <path d="M-4 -14 C30 -22 52 -12 80 -26 C64 -4 36 2 4 0 Z"/>
      <path d="M-6 8 C24 12 48 28 74 22 C56 40 28 36 0 24 Z"/>
      <path d="M-18 26 C2 44 18 58 40 66 C14 66 -6 54 -28 34 Z"/>
      <path d="M-122 42 C-120 60 -110 74 -96 84 C-104 68 -106 56 -100 44 Z"/>
      <path d="M-98 40 C-92 58 -80 68 -64 72 C-74 60 -78 50 -76 38 Z"/>
      <path d="M-76 36 C-66 52 -52 58 -38 60 C-50 50 -54 42 -52 32 Z"/>
      <path d="M6 -27 C-10 -40 -30 -52 -52 -50 L-60 -48 L-66 -68 L-74 -48 L-84 -64 L-88 -42
               C-100 -37 -112 -37 -124 -33 C-134 -41 -148 -41 -157 -31 C-163 -22 -161 -12 -151 -8
               L-96 -4 C-86 -2 -78 2 -72 8 C-60 18 -40 26 -20 30 L6 27 Z"/>
      <path class="dr-mouth" d="M-151 -8 L-96 -4 C-86 -2 -78 2 -74 12 C-96 18 -120 26 -142 34 Z"/>
      <path d="M-74 12 C-96 18 -120 26 -142 34 C-149 36 -151 45 -140 47 C-118 47 -96 41 -74 37 C-56 33 -40 32 -26 30 Z"/>
    </g>
    <g class="dr-cut-fill">
      <path d="M-148 -8 l3 12 l4 -11 Z M-138 -7 l2 6 l3 -6 Z M-130 -7 l2 6 l3 -6 Z M-122 -6 l2 6 l3 -6 Z
               M-114 -6 l2 6 l3 -6 Z M-106 -5 l3 12 l4 -11 Z"/>
      <path d="M-139 33 l4 -12 l5 10 Z M-128 29 l3 -6 l4 5 Z M-120 26 l3 -6 l4 5 Z M-112 23 l3 -6 l4 5 Z
               M-104 21 l3 -6 l4 5 Z M-96 18 l4 -12 l5 10 Z"/>
      <path d="M-62 -34 C-70 -43 -88 -41 -93 -32 C-85 -26 -72 -26 -62 -34 Z"/>
    </g>
    <circle class="dr-fill" cx="-79" cy="-33" r="4.2"/>
    <g class="dr-cut">
      <path d="M-150 -25 a5 5 0 1 1 7 -4"/>
      <path d="M-40 -8 C-50 2 -58 9 -66 12"/>
      <path d="M-30 4 C-40 13 -48 18 -58 21"/>
      <path d="M-104 -30 C-90 -32 -78 -40 -70 -48"/>
      <path d="M-36 -40 C-24 -56 -6 -72 24 -92" opacity=".8"/>
    </g>
    <path class="dr-line" d="M-100 10 C-130 16 -160 8 -176 21 C-186 30 -178 40 -168 33"/>`;

  function mount(svg) {
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = "";
    const root = el("g", { class: "dr-root" }, svg);
    const tail = el("path", { class: "dr-fill" }, root);
    const legsBack = el("path", { class: "dr-limb dr-limb-back" }, root);
    const clawsBack = el("path", { class: "dr-claw dr-limb-back" }, root);
    const spikes = el("path", { class: "dr-fill" }, root);
    const body = el("path", { class: "dr-fill" }, root);
    const scales = el("path", { class: "dr-cut" }, root);
    const belly = el("path", { class: "dr-cut dr-cut-thin" }, root);
    const legsFront = el("path", { class: "dr-limb" }, root);
    const clawsFront = el("path", { class: "dr-claw" }, root);
    const tufts = el("path", { class: "dr-fill" }, root);
    const head = el("g", {}, root);
    const whiskers = el("path", { class: "dr-line dr-whisker" }, head);
    const headArt = el("g", {}, head);
    headArt.innerHTML = HEAD;
    const pearl = el("g", { class: "dr-pearl" }, root);
    const pearlFlames = el("path", { class: "dr-fill", opacity: ".55" }, pearl);
    el("circle", { class: "dr-fill", r: 21 }, pearl);
    el("path", { class: "dr-cut", d: "M-12 0 a12 12 0 0 1 24 0 a6 6 0 0 1 -12 0 a6 6 0 0 0 -12 0" }, pearl);
    el("circle", { class: "dr-cut", r: 15 }, pearl);

    const pts = new Array(N + 1), tan = new Array(N + 1), nor = new Array(N + 1), wid = new Array(N + 1);

    function leg(s, side, e, fdx, t, k) {
      const i = Math.round(s * N);
      const b = add(pts[i], nor[i], -wid[i] * 0.35);
      const sw = Math.sin(t * 1.3 + k * 1.7);
      const E = [b[0] + e[0] + sw * 5, b[1] + e[1] + sw * 3];
      const F = [E[0] + fdx[0] + sw * 7, E[1] + fdx[1] - sw * 4];
      const d = norm([F[0] - E[0], F[1] - E[1]]);
      let limb = `M${P(b)} Q${P(add(b, [e[0] * 0.3, e[1] * 0.9]))} ${P(E)} L${P(F)} `;
      let claws = "";
      for (const a of [-0.65, -0.1, 0.5]) {
        const c = rot(d, a), q = rot(c, side * 0.9);
        claws += `M${P(F)} Q${P(add(F, c, 13))} ${P(add(add(F, c, 18), q, 7))} `;
      }
      // пучок полум'я на лікті
      const back = norm([-d[0] + 0.6, -d[1] - 0.2]);
      const tuft = `M${P(add(E, [0, -6]))} Q${P(add(E, back, 22))} ${P(add(add(E, back, 34), [0, -8]))} Q${P(add(E, back, 16))} ${P(add(E, [2, 7]))} Z `;
      return { limb, claws, tuft };
    }

    function frame(time) {
      const t = time / 1000;
      for (let i = 0; i <= N; i++) { const s = i / N; pts[i] = spine(s, t); wid[i] = width(s); }
      for (let i = 0; i <= N; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
        tan[i] = norm([b[0] - a[0], b[1] - a[1]]);
        nor[i] = [tan[i][1], -tan[i][0]];
      }
      // тіло
      let top = "", bot = "";
      for (let i = 0; i <= N; i++) top += (i ? "L" : "M") + P(add(pts[i], nor[i], wid[i]));
      for (let i = N; i >= 0; i--) bot += "L" + P(add(pts[i], nor[i], -wid[i]));
      body.setAttribute("d", top + bot + "Z");

      // гребінь на спині
      let sp = "";
      for (let i = 5; i < N - 8; i += 4) {
        const w = wid[i + 1], len = 7 + w * 0.6;
        const a = add(pts[i], nor[i], wid[i] - 1), c = add(pts[i + 4], nor[i + 4], wid[i + 4] - 1);
        const apex = add(add(pts[i + 1], nor[i + 1], w + len), tan[i + 1], len * 0.75);
        sp += `M${P(a)}Q${P(add(pts[i + 1], nor[i + 1], w + len * 0.55))} ${P(apex)}L${P(c)}Z`;
      }
      spikes.setAttribute("d", sp);

      // луска
      let sc = "";
      const rows = [0.5, 0.08, -0.32];
      rows.forEach((j, r) => {
        for (let i = 6 + (r % 2) * 3; i < N - 6; i += 6) {
          const w = wid[i]; if (w < 7) continue;
          const c = add(pts[i], nor[i], j * w), rr = w * 0.21;
          sc += `M${P(add(c, nor[i], rr))}Q${P(add(c, tan[i], rr * 1.9))} ${P(add(c, nor[i], -rr))}`;
        }
      });
      let ln = "";
      for (let i = 2; i < N - 4; i++) ln += (i === 2 ? "M" : "L") + P(add(pts[i], nor[i], wid[i] * 0.8));
      scales.setAttribute("d", sc + ln);

      // черево
      let bl = "";
      for (let i = 2; i < N - 8; i++) bl += (i === 2 ? "M" : "L") + P(add(pts[i], nor[i], -wid[i] * 0.55));
      for (let i = 4; i < N - 10; i += 4) bl += `M${P(add(pts[i], nor[i], -wid[i] * 0.58))}L${P(add(pts[i], nor[i], -wid[i] * 0.9))}`;
      belly.setAttribute("d", bl);

      // лапи
      const L1 = leg(0.135, -1, [-50, 40], [-40, -18], t, 0);
      const L2 = leg(0.2, 1, [14, 54], [-26, 30], t, 1);
      const L3 = leg(0.5, 1, [22, 46], [-20, 34], t, 2);
      const L4 = leg(0.58, 1, [40, 32], [28, 30], t, 3);
      legsFront.setAttribute("d", L1.limb + L3.limb);
      clawsFront.setAttribute("d", L1.claws + L3.claws);
      legsBack.setAttribute("d", L2.limb + L4.limb);
      clawsBack.setAttribute("d", L2.claws + L4.claws);
      tufts.setAttribute("d", L1.tuft + L2.tuft + L3.tuft + L4.tuft);

      // хвіст-полум'я
      const tip = pts[N], td = tan[N];
      let tl = "";
      for (let k = -2; k <= 2; k++) {
        const a = k * 0.42 + 0.18 * Math.sin(t * 1.6 + k);
        const d = rot(td, a), pp = [d[1], -d[0]];
        const L = 78 - Math.abs(k) * 14, b = 7;
        const end = add(add(tip, d, L), pp, 10 * Math.sin(t * 2 + k));
        tl += `M${P(add(tip, pp, b))}Q${P(add(add(tip, d, L * 0.55), pp, b + 9))} ${P(end)}Q${P(add(add(tip, d, L * 0.45), pp, -4))} ${P(add(tip, pp, -b))}Z`;
      }
      tail.setAttribute("d", tl);

      // голова
      const h = pts[0], fw = norm([pts[0][0] - pts[3][0], pts[0][1] - pts[3][1]]);
      const ang = Math.atan2(fw[1], fw[0]) * 180 / Math.PI - 180;
      head.setAttribute("transform", `translate(${f(h[0])} ${f(h[1])}) rotate(${f(ang)}) scale(1.12)`);
      const s1 = Math.sin(t * 1.2), s2 = Math.sin(t * 0.9 + 1);
      whiskers.setAttribute("d",
        `M-148 -30 C-176 ${f(-74 + s1 * 6)} -128 ${f(-106 + s1 * 10)} -88 ${f(-82 + s1 * 6)} S-30 ${f(-84 + s1 * 14)} ${f(22 + s1 * 6)} ${f(-74 + s1 * 18)}` +
        `M-142 -10 C-182 ${f(10 + s2 * 6)} -196 ${f(54 + s2 * 10)} -164 ${f(74 + s2 * 8)} S-112 ${f(80 + s2 * 12)} ${f(-82 + s2 * 6)} ${f(104 + s2 * 14)}`);

      // перлина попереду
      const pr = [h[0] - 248, 262 + 16 * Math.sin(t * 0.9)];
      pearl.setAttribute("transform", `translate(${f(pr[0])} ${f(pr[1])})`);
      let pf = "";
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + t * 0.6;
        const d = [Math.cos(a), Math.sin(a)], pp = [-d[1], d[0]];
        const L = 34 + 6 * Math.sin(t * 2.2 + k * 1.3);
        pf += `M${P(add(d, pp, 8 - 0))}Q${P(add(add([0, 0], d, L * 0.7), pp, 10))} ${P(add(add([0, 0], d, L), pp, -4))}Q${P(add([0, 0], d, L * 0.55))} ${P(add([0, 0], pp, -8))}Z`;
      }
      pearlFlames.setAttribute("d", pf);
    }

    let raf = 0, running = false, visible = true;
    const reduce = () => document.documentElement.dataset.motion === "off";
    function loop(ts) { frame(ts); raf = requestAnimationFrame(loop); }
    function start() {
      if (running || !visible || reduce() || document.hidden) return;
      running = true; raf = requestAnimationFrame(loop);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }
    frame(4200);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(svg);
    }
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    start();
    return { start, stop, refresh() { stop(); if (reduce()) frame(4200); else start(); } };
  }

  window.PDDragon = { mount };
})();
