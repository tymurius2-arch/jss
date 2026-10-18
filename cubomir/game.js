// Кубомир — игра: рендер, игрок, мобы, крафт, интерфейс, звук, сохранения, управление.
'use strict';
(function () {
  const THREE = window.THREE;
  const { ID, B, ITEMS, TOOL, RECIPES, TILE, tileAvg, atlas, iconFor, HUDI, SOLID } = window.CubeData;
  const { World, WH, SEA, BIOME_NAMES, M: LIGHT_MARGIN } = window.CubeWorld;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  const lightCurve = (l) => Math.pow(0.84, 15 - l);

  // ======================================================================
  // Настройки
  // ======================================================================
  const SKEY = 'kubomir.settings';
  const settings = Object.assign({
    dist: isTouch ? 4 : 6, fov: 72, sens: 1, vol: 0.7, res: 1, music: true, clouds: true, bob: true,
    autojump: isTouch, map: true, fps: false,
  }, (() => { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch { return {}; } })());
  const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch { } };

  // ======================================================================
  // Звук (всё синтезируется Web Audio)
  // ======================================================================
  const Sound = {
    ctx: null, master: null, noiseBuf: null, rainGain: null, musicBus: null, nextMusic: 20,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      const comp = c.createDynamicsCompressor();
      comp.connect(c.destination);
      this.master = c.createGain(); this.master.gain.value = settings.vol; this.master.connect(comp);
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // Реверберация для музыки
      const ir = c.createBuffer(2, c.sampleRate * 2.5, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const a = ir.getChannelData(ch); for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 2.6); }
      const rev = c.createConvolver(); rev.buffer = ir;
      this.musicBus = c.createGain(); this.musicBus.gain.value = 0.22;
      const wet = c.createGain(); wet.gain.value = 0.6;
      this.musicBus.connect(this.master); this.musicBus.connect(rev); rev.connect(wet); wet.connect(this.master);
      // Дождь
      const rs = c.createBufferSource(); rs.buffer = this.noiseBuf; rs.loop = true;
      const rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 1400;
      this.rainGain = c.createGain(); this.rainGain.gain.value = 0;
      rs.connect(rf); rf.connect(this.rainGain); this.rainGain.connect(this.master); rs.start();
    },
    setVol(v) { if (this.master) this.master.gain.value = v; },
    noise(o) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + (o.at || 0);
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = o.rate || 1;
      const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q ?? 1;
      if (o.freq2) f.frequency.exponentialRampToValueAtTime(o.freq2, t + o.dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain ?? 0.4), t + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      s.connect(f); f.connect(g); g.connect(o.bus || this.master);
      s.start(t, Math.random() * 1.5); s.stop(t + o.dur + 0.05);
    },
    tone(o) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + (o.at || 0);
      const s = c.createOscillator(); s.type = o.type || 'sine';
      s.frequency.setValueAtTime(o.f0, t);
      if (o.f1) s.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain ?? 0.3), t + (o.attack || 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      s.connect(g); g.connect(o.bus || this.master);
      s.start(t); s.stop(t + o.dur + 0.05);
    },
    block(kind, action, vol = 1) {
      if (!this.ctx) return;
      const k = { step: 0.3, place: 0.8, break: 1, hit: 0.22 }[action] * vol;
      if (k < 0.02) return;
      const low = action === 'break' ? 0.8 : 1;
      switch (kind) {
        case 'wood': this.noise({ freq: 650 * low, q: 1.6, dur: 0.1, gain: 0.5 * k }); this.tone({ type: 'triangle', f0: 190 * low, f1: 110, dur: 0.09, gain: 0.25 * k }); break;
        case 'grass': this.noise({ type: 'highpass', freq: 2400, dur: 0.12, gain: 0.35 * k }); break;
        case 'gravel': this.noise({ freq: 900 * low, q: 0.6, dur: 0.15, gain: 0.5 * k }); break;
        case 'sand': this.noise({ type: 'highpass', freq: 3600, dur: 0.15, gain: 0.3 * k }); break;
        case 'snow': this.noise({ freq: 3000, q: 0.4, dur: 0.14, gain: 0.3 * k }); break;
        case 'wool': this.noise({ type: 'lowpass', freq: 500, dur: 0.12, gain: 0.45 * k }); break;
        case 'glass':
          if (action === 'break') for (let i = 0; i < 4; i++) this.tone({ f0: rand(1800, 4200), dur: 0.12, gain: 0.12, at: i * 0.03 });
          this.noise({ type: 'highpass', freq: 4000, dur: 0.18, gain: 0.3 * k }); break;
        case 'metal': this.tone({ type: 'square', f0: 900, f1: 600, dur: 0.08, gain: 0.08 * k }); this.noise({ freq: 2500, q: 2, dur: 0.1, gain: 0.3 * k }); break;
        case 'water': this.noise({ type: 'lowpass', freq: 900, freq2: 300, dur: 0.3, gain: 0.4 * k }); break;
        default: this.noise({ freq: 1500 * low, q: 0.9, dur: 0.12, gain: 0.5 * k }); if (action === 'break') this.noise({ freq: 900, q: 0.9, dur: 0.12, gain: 0.35 * k, at: 0.04 });
      }
    },
    hurt() { this.tone({ type: 'sawtooth', f0: 320, f1: 140, dur: 0.22, gain: 0.25 }); this.noise({ freq: 700, dur: 0.12, gain: 0.25 }); },
    boom(d = 0) {
      const v = clamp(1 - d / 60, 0.08, 1);
      this.noise({ type: 'lowpass', freq: 900, freq2: 60, q: 0.7, dur: 1.6, gain: 1.2 * v, rate: 0.6 });
      this.tone({ type: 'sine', f0: 70, f1: 28, dur: 1.1, gain: 0.7 * v });
    },
    pop() { this.tone({ f0: rand(500, 700), f1: rand(1100, 1500), dur: 0.08, gain: 0.18 }); },
    eat() { for (let i = 0; i < 3; i++) this.noise({ freq: 1200, q: 0.8, dur: 0.07, gain: 0.35, at: i * 0.13 }); },
    burp() { this.tone({ type: 'sawtooth', f0: 120, f1: 80, dur: 0.35, gain: 0.25 }); },
    click() { this.tone({ f0: 900, f1: 600, dur: 0.05, gain: 0.12 }); },
    fuse() { this.noise({ type: 'highpass', freq: 3000, dur: 1.3, gain: 0.25, attack: 0.3 }); },
    splash() { this.noise({ type: 'lowpass', freq: 1600, freq2: 300, dur: 0.45, gain: 0.5 }); },
    chime() { [523, 659, 784, 1046].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.4, gain: 0.12, at: i * 0.09 })); },
    mob(type, d) {
      if (!this.ctx) return;
      const v = clamp(1 - d / 22, 0, 1) * 0.8;
      if (v <= 0.02) return;
      if (type === 'pig') { this.tone({ type: 'square', f0: 330, f1: 210, dur: 0.12, gain: 0.08 * v }); this.tone({ type: 'square', f0: 300, f1: 190, dur: 0.12, gain: 0.08 * v, at: 0.16 }); }
      else if (type === 'sheep') { this.tone({ type: 'sawtooth', f0: 420, f1: 380, dur: 0.5, gain: 0.08 * v }); }
      else if (type === 'zombie') { this.tone({ type: 'sawtooth', f0: 95, f1: 70, dur: 0.9, gain: 0.18 * v }); this.noise({ type: 'lowpass', freq: 400, dur: 0.8, gain: 0.15 * v }); }
    },
    thunder() { this.noise({ type: 'lowpass', freq: 500, freq2: 40, dur: 3, gain: 0.9, rate: 0.4, attack: 0.05 }); },
    music() {
      if (!this.ctx || !settings.music) return;
      const scales = [[0, 2, 4, 7, 9, 12, 14, 16], [0, 3, 5, 7, 10, 12, 15], [0, 2, 5, 7, 9, 12, 14]];
      const sc = scales[randi(0, scales.length - 1)], root = [196, 220, 174.6, 246.9][randi(0, 3)];
      let t = 0;
      const n = randi(8, 16);
      for (let i = 0; i < n; i++) {
        const f = root * Math.pow(2, sc[randi(0, sc.length - 1)] / 12);
        this.tone({ type: 'sine', f0: f, dur: 2.6, gain: 0.35, at: t, attack: 0.01, bus: this.musicBus });
        this.tone({ type: 'triangle', f0: f * 2, dur: 1.4, gain: 0.06, at: t, bus: this.musicBus });
        if (Math.random() < 0.3) this.tone({ type: 'sine', f0: f / 2, dur: 3.5, gain: 0.2, at: t, attack: 0.3, bus: this.musicBus });
        t += [0.45, 0.6, 0.9, 1.2][randi(0, 3)];
      }
    },
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, () => Sound.init(), { passive: true }));

  // ======================================================================
  // Рендер
  // ======================================================================
  THREE.ColorManagement.enabled = false;
  const canvas = $('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  const skyScene = new THREE.Scene();
  const hudScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 400);
  camera.rotation.order = 'YXZ';
  const skyCam = new THREE.PerspectiveCamera(settings.fov, 1, 1, 2000);
  skyCam.rotation.order = 'YXZ';
  const hudCam = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * settings.res * (isTouch ? 0.75 : 1));
    renderer.setSize(w, h, false);
    for (const c of [camera, skyCam, hudCam]) { c.aspect = w / h; c.updateProjectionMatrix(); }
  }
  addEventListener('resize', resize);
  resize();

  const atlasTex = new THREE.CanvasTexture(atlas);
  atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestFilter; atlasTex.generateMipmaps = false;

  const U = {
    map: { value: atlasTex }, daylight: { value: 1 }, skyTint: { value: new THREE.Color(1, 1, 1) },
    fogColor: { value: new THREE.Color(0.6, 0.75, 1) }, fogNear: { value: 50 }, fogFar: { value: 100 }, time: { value: 0 },
  };
  const VS = `attribute vec3 data; varying vec2 vUv; varying vec3 vData; varying float vFog; varying vec3 vW;
    void main(){ vUv = uv; vData = data; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mv = viewMatrix * wp; vFog = length(mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const FS = `uniform sampler2D map; uniform float daylight; uniform vec3 skyTint; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float time; uniform float water;
    varying vec2 vUv; varying vec3 vData; varying float vFog; varying vec3 vW;
    void main(){
      vec4 t = texture2D(map, vUv);
      if (t.a < (water > 0.5 ? 0.05 : 0.5)) discard;
      float sky = pow(0.84, (1.0 - vData.y) * 15.0) * daylight;
      float bl = pow(0.84, (1.0 - vData.z) * 15.0);
      vec3 light = max(vec3(sky) * skyTint, vec3(bl) * vec3(1.0, 0.9, 0.74));
      light = max(light, vec3(0.045));
      vec3 c = t.rgb * vData.x * light;
      if (water > 0.5) c *= 0.9 + 0.12 * sin(vW.x * 1.3 + time * 1.7) * sin(vW.z * 1.1 + time * 1.3);
      float f = smoothstep(fogNear, fogFar, vFog);
      gl_FragColor = vec4(mix(c, fogColor, f), water > 0.5 ? t.a : 1.0);
    }`;
  const matOpaque = new THREE.ShaderMaterial({ uniforms: Object.assign({ water: { value: 0 } }, U), vertexShader: VS, fragmentShader: FS });
  const matWater = new THREE.ShaderMaterial({ uniforms: Object.assign({ water: { value: 1 } }, U), vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });

  // ---------- Небо ----------
  const skyUni = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, glow: { value: new THREE.Color() } };
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), new THREE.ShaderMaterial({
    uniforms: skyUni, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 glow; varying vec3 vP;
      void main(){ float h = clamp(vP.y, -0.2, 1.0); vec3 c = mix(horizon, top, smoothstep(-0.05, 0.55, h));
        float s = max(dot(normalize(vP), sunDir), 0.0); c += glow * pow(s, 6.0) * smoothstep(-0.3, 0.2, h);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  skyScene.add(skyDome);
  function pixelTex(size, painter) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    painter(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  }
  const sunTex = pixelTex(16, (g) => { g.fillStyle = '#fff6b0'; g.fillRect(2, 2, 12, 12); g.fillStyle = '#ffe36a'; g.fillRect(4, 4, 8, 8); g.fillStyle = '#ffffff'; g.fillRect(5, 5, 6, 6); });
  const moonTex = pixelTex(16, (g) => { g.fillStyle = '#d9dde6'; g.fillRect(3, 3, 10, 10); g.fillStyle = '#a8adb8'; g.fillRect(5, 5, 2, 2); g.fillRect(9, 8, 3, 3); g.fillRect(6, 10, 2, 1); });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }));
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
  skyScene.add(sun, moon);
  const starGeo = new THREE.BufferGeometry();
  { const p = []; for (let i = 0; i < 1500; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); p.push(Math.cos(a) * r * 800, Math.abs(u) * 800 - 40, Math.sin(a) * r * 800); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
  skyScene.add(stars);
  const cloudTex = (() => {
    const N = 64, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), s = new window.CubeNoise.Simplex(1234);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const a = (x / N) * Math.PI * 2, b = (y / N) * Math.PI * 2;
      const v = s.noise3(Math.cos(a) * 2.2, Math.sin(a) * 2.2 + Math.cos(b) * 2.2, Math.sin(b) * 2.2) + s.noise3(Math.cos(a) * 5, Math.sin(b) * 5, 3) * 0.35;
      if (v > 0.18) { g.fillStyle = '#fff'; g.fillRect(x, y, 1, 1); }
    }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = false;
    return t;
  })();
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(1536, 1536), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.82, fog: false, depthWrite: false, side: THREE.DoubleSide }));
  clouds.rotation.x = -Math.PI / 2;
  cloudTex.repeat.set(2, 2);
  scene.add(clouds);
  // Дождь
  const RAIN_N = 1400;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) { const x = rand(-20, 20), y = rand(-14, 18), z = rand(-20, 20); rainPos.set([x, y, z, x, y - 0.7, z], i * 6); }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa8c4ff, transparent: true, opacity: 0.4, fog: false, depthWrite: false }));
  rain.frustumCulled = false;
  scene.add(rain);

  // ---------- Частицы ----------
  class Particles {
    constructor(max, size) {
      this.max = max; this.n = 0;
      this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
      this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.grav = new Float32Array(max);
      const g = new THREE.BufferGeometry();
      this.pa = new THREE.BufferAttribute(this.pos, 3); this.pa.setUsage(THREE.DynamicDrawUsage);
      this.ca = new THREE.BufferAttribute(this.col, 3); this.ca.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', this.pa); g.setAttribute('color', this.ca);
      this.mat = new THREE.PointsMaterial({ size, vertexColors: true, sizeAttenuation: true, fog: true });
      this.obj = new THREE.Points(g, this.mat); this.obj.frustumCulled = false;
      scene.add(this.obj);
    }
    add(x, y, z, vx, vy, vz, r, g, b, life, grav = 18) {
      if (this.n >= this.max) return;
      const i = this.n++;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
      this.life[i] = life; this.grav[i] = grav;
    }
    update(dt) {
      let i = 0;
      while (i < this.n) {
        this.life[i] -= dt;
        if (this.life[i] <= 0) {
          const l = --this.n;
          if (i !== l) {
            for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[l * 3 + k]; this.vel[i * 3 + k] = this.vel[l * 3 + k]; this.col[i * 3 + k] = this.col[l * 3 + k]; }
            this.life[i] = this.life[l]; this.grav[i] = this.grav[l];
          }
          continue;
        }
        const p = i * 3;
        this.vel[p + 1] -= this.grav[i] * dt;
        const nx = this.pos[p] + this.vel[p] * dt, ny = this.pos[p + 1] + this.vel[p + 1] * dt, nz = this.pos[p + 2] + this.vel[p + 2] * dt;
        if (world && SOLID[world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))] && this.grav[i] > 0) { this.vel[p] *= 0.3; this.vel[p + 1] = 0; this.vel[p + 2] *= 0.3; }
        else { this.pos[p] = nx; this.pos[p + 1] = ny; this.pos[p + 2] = nz; }
        i++;
      }
      this.obj.geometry.setDrawRange(0, this.n);
      this.pa.needsUpdate = true; this.ca.needsUpdate = true;
    }
    clear() { this.n = 0; this.obj.geometry.setDrawRange(0, 0); }
  }
  const sparks = new Particles(4000, 0.11);
  const smoke = new Particles(1200, 0.55);
  function blockParticles(x, y, z, b, n = 24, light = 1) {
    const c = tileAvg[B[b].side ?? B[b].top] || [128, 128, 128];
    for (let i = 0; i < n; i++) {
      const k = (0.75 + Math.random() * 0.4) * light / 255;
      sparks.add(x + Math.random(), y + Math.random(), z + Math.random(), rand(-2, 2), rand(0, 4), rand(-2, 2), c[0] * k, c[1] * k, c[2] * k, rand(0.4, 1));
    }
  }

  // ---------- Геометрия предметов ----------
  const geoCache = new Map();
  function tileUV(t, u, v) { const tx = t % 16, ty = (t / 16) | 0; return [(tx + u) / 16, 1 - (ty + 1 - v) / 16]; }
  function itemGeometry(id) {
    if (geoCache.has(id)) return geoCache.get(id);
    const it = ITEMS[id], b = it && it.block ? B[id] : null;
    let g;
    if (b && b.shape === 'cube') {
      g = new THREE.BoxGeometry(1, b.height, 1);
      const tiles = [b.side, b.side, b.top, b.bottom, b.front, b.side];
      if (b.frontSides) tiles[0] = tiles[1] = tiles[5] = b.front;
      const uv = g.attributes.uv, col = [];
      const sh = [0.8, 0.8, 1, 0.5, 0.65, 0.65];
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
        const vi = f * 4 + k;
        let u = uv.getX(vi), v = uv.getY(vi);
        if (f !== 2 && f !== 3) v *= b.height;
        const [uu, vv] = tileUV(tiles[f], u * 0.998 + 0.001, v * 0.998 + 0.001);
        uv.setXY(vi, uu, vv);
        col.push(sh[f], sh[f], sh[f]);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    } else {
      const t = b ? b.top : it.tile;
      g = new THREE.PlaneGeometry(1, 1);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) { const [uu, vv] = tileUV(t, uv.getX(i) * 0.998 + 0.001, uv.getY(i) * 0.998 + 0.001); uv.setXY(i, uu, vv); }
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(uv.count * 3).fill(1), 3));
      g.userData.flat = true;
    }
    geoCache.set(id, g);
    return g;
  }
  const itemMat = () => new THREE.MeshBasicMaterial({ map: atlasTex, alphaTest: 0.5, vertexColors: true, side: THREE.DoubleSide });

  // Подсветка блока и трещины
  const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
  hl.visible = false; scene.add(hl);
  const crackGeo = new THREE.BoxGeometry(1.006, 1.006, 1.006);
  const crackUV0 = crackGeo.attributes.uv.array.slice();
  const crack = new THREE.Mesh(crackGeo, new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  crack.visible = false; scene.add(crack);
  let crackStage = -1;
  function setCrack(stage) {
    if (stage === crackStage) return;
    crackStage = stage;
    const uv = crackGeo.attributes.uv, t = TILE['crack' + stage];
    for (let i = 0; i < uv.count; i++) { const [u, v] = tileUV(t, crackUV0[i * 2] * 0.998 + 0.001, crackUV0[i * 2 + 1] * 0.998 + 0.001); uv.setXY(i, u, v); }
    uv.needsUpdate = true;
  }

  // ======================================================================
  // Модели мобов
  // ======================================================================
  function canvasTex(w, h, painter) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); painter(g, w, h);
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  }
  function noisy(base, v, extra) {
    return canvasTex(8, 8, (g) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const k = 1 + (Math.random() - 0.5) * v;
        g.fillStyle = `rgb(${clamp(base[0] * k, 0, 255) | 0},${clamp(base[1] * k, 0, 255) | 0},${clamp(base[2] * k, 0, 255) | 0})`;
        g.fillRect(x, y, 1, 1);
      }
      if (extra) extra(g);
    });
  }
  const px = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const TEX = {
    pigSkin: noisy([240, 160, 160], 0.1),
    pigFace: noisy([240, 160, 160], 0.08, (g) => { px(g, '#fff', 1, 2); px(g, '#000', 2, 2); px(g, '#000', 5, 2); px(g, '#fff', 6, 2); px(g, '#d97c86', 2, 4, 4, 3); px(g, '#7a3a40', 3, 5); px(g, '#7a3a40', 4, 5); }),
    wool: noisy([235, 235, 232], 0.12),
    sheepSkin: noisy([215, 190, 170], 0.1),
    sheepFace: noisy([215, 190, 170], 0.08, (g) => { px(g, '#fff', 1, 3); px(g, '#000', 2, 3); px(g, '#000', 5, 3); px(g, '#fff', 6, 3); px(g, '#e8a0a0', 3, 5, 2, 1); }),
    zSkin: noisy([86, 145, 70], 0.15),
    zFace: noisy([86, 145, 70], 0.12, (g) => { px(g, '#1d2f1a', 1, 3, 2, 1); px(g, '#1d2f1a', 5, 3, 2, 1); px(g, '#2c4a26', 3, 5, 2, 1); px(g, '#2c4a26', 2, 6, 4, 1); }),
    zShirt: noisy([40, 160, 165], 0.12),
    zPants: noisy([60, 60, 150], 0.12),
    creeper: noisy([90, 185, 70], 0.45),
    creeperFace: noisy([90, 185, 70], 0.4, (g) => { px(g, '#000', 1, 2, 2, 2); px(g, '#000', 5, 2, 2, 2); px(g, '#000', 3, 4, 2, 2); px(g, '#000', 2, 5, 1, 2); px(g, '#000', 5, 5, 1, 2); }),
    steveSkin: noisy([200, 150, 115], 0.08),
    steveFace: noisy([200, 150, 115], 0.06, (g) => { px(g, '#4a2f1a', 0, 0, 8, 2); px(g, '#4a2f1a', 0, 2, 1, 1); px(g, '#4a2f1a', 7, 2, 1, 1); px(g, '#fff', 1, 4); px(g, '#3b5ec8', 2, 4); px(g, '#3b5ec8', 5, 4); px(g, '#fff', 6, 4); px(g, '#8a5a3a', 3, 6, 2, 1); }),
    hair: noisy([74, 47, 26], 0.15),
    steveShirt: noisy([0, 170, 180], 0.1),
    stevePants: noisy([50, 50, 140], 0.1),
  };
  function box(w, h, d, mat, x, y, z, pivotTop) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    if (!pivotTop) { m.position.set(x, y, z); return m; }
    const g = new THREE.Group(); g.position.set(x, y, z); m.position.y = -h / 2; g.add(m);
    return g;
  }
  const MOBS = {
    pig: { w: 0.45, h: 0.9, hp: 10, speed: 1.4, hostile: false, drops: () => [[ID.MEAT, randi(1, 3)]] },
    sheep: { w: 0.45, h: 1.3, hp: 8, speed: 1.3, hostile: false, drops: () => [[ID.WOOL, randi(1, 2)], [ID.MEAT, randi(0, 2)]] },
    zombie: { w: 0.3, h: 1.9, hp: 20, speed: 2.4, hostile: true, dmg: 3, drops: () => [[ID.ROTTEN, randi(0, 2)]] },
    creeper: { w: 0.3, h: 1.7, hp: 20, speed: 2.2, hostile: true, drops: () => [[ID.GUNPOWDER, randi(1, 2)]] },
  };
  function buildModel(type) {
    const root = new THREE.Group();
    const mats = [];
    const mk = (tex) => { const m = new THREE.MeshBasicMaterial({ map: tex }); mats.push(m); return m; };
    const parts = { legs: [], arms: [] };
    if (type === 'pig') {
      const skin = mk(TEX.pigSkin), face = mk(TEX.pigFace);
      root.add(box(0.62, 0.5, 1.0, skin, 0, 0.62, 0));
      for (const [x, z] of [[-0.18, 0.32], [0.18, 0.32], [-0.18, -0.32], [0.18, -0.32]]) { const l = box(0.24, 0.38, 0.24, skin, x, 0.38, z, true); root.add(l); parts.legs.push(l); }
      const head = box(0.5, 0.5, 0.5, [skin, skin, skin, skin, face, skin], 0, 0.78, 0.68); root.add(head); parts.head = head;
    } else if (type === 'sheep') {
      const wool = mk(TEX.wool), skin = mk(TEX.sheepSkin), face = mk(TEX.sheepFace);
      root.add(box(0.75, 0.62, 1.1, wool, 0, 0.95, 0));
      for (const [x, z] of [[-0.2, 0.36], [0.2, 0.36], [-0.2, -0.36], [0.2, -0.36]]) { const l = box(0.22, 0.66, 0.22, skin, x, 0.66, z, true); root.add(l); parts.legs.push(l); }
      const head = box(0.42, 0.45, 0.5, [skin, skin, wool, skin, face, skin], 0, 1.2, 0.68); root.add(head); parts.head = head;
    } else if (type === 'zombie' || type === 'player') {
      const pl = type === 'player';
      const skin = mk(pl ? TEX.steveSkin : TEX.zSkin), face = mk(pl ? TEX.steveFace : TEX.zFace), shirt = mk(pl ? TEX.steveShirt : TEX.zShirt), pants = mk(pl ? TEX.stevePants : TEX.zPants);
      const topMat = pl ? mk(TEX.hair) : skin;
      const head = box(0.5, 0.5, 0.5, [skin, skin, topMat, skin, face, skin], 0, 1.65, 0); root.add(head); parts.head = head;
      root.add(box(0.5, 0.72, 0.26, shirt, 0, 1.04, 0));
      for (const x of [-0.37, 0.37]) { const a = box(0.24, 0.72, 0.24, [skin, skin, shirt, skin, skin, skin], x, 1.4, 0, true); root.add(a); parts.arms.push(a); if (!pl) a.rotation.x = -Math.PI / 2; }
      for (const x of [-0.125, 0.125]) { const l = box(0.25, 0.68, 0.25, pants, x, 0.68, 0, true); root.add(l); parts.legs.push(l); }
    } else if (type === 'creeper') {
      const skin = mk(TEX.creeper), face = mk(TEX.creeperFace);
      const head = box(0.5, 0.5, 0.5, [skin, skin, skin, skin, face, skin], 0, 1.45, 0); root.add(head); parts.head = head;
      root.add(box(0.5, 0.75, 0.3, skin, 0, 0.82, 0));
      for (const [x, z] of [[-0.125, 0.2], [0.125, 0.2], [-0.125, -0.2], [0.125, -0.2]]) { const l = box(0.25, 0.45, 0.25, skin, x, 0.45, z, true); root.add(l); parts.legs.push(l); }
    }
    return { root, mats, parts };
  }

  // ======================================================================
  // Состояние игры
  // ======================================================================
  let world = null;
  let mode = 'menu'; // menu | loading | play
  let paused = false;
  let uiOpen = null; // null | 'inv' | 'console'
  let G = null;
  const P = { x: 0, y: 80, z: 0, vx: 0, vy: 0, vz: 0, w: 0.3, h: 1.8, yaw: 0, pitch: 0, onGround: false, flying: false, inWater: false, inLava: false, headWater: false, health: 20, food: 20, sat: 5, exh: 0, air: 15, hurtT: 0, invT: 0, fallStart: null, regenT: 0, stepDist: 0, dead: false, sneak: false, sprint: false, third: false, swing: 0, bobT: 0, cactusT: 0, lavaT: 0, drownT: 0 };
  const inv = { slots: new Array(36).fill(null), sel: 0, cursor: null, ver: 0 };
  const ents = [];
  let chunkOffs = [];
  const urgent = new Set();
  let target = null;
  let mining = null;
  let attackCD = 0, useCD = 0;
  let mapMode = 1;
  const keys = new Set();
  const input = { fwd: 0, str: 0, jump: false, down: false, mouseL: false, mouseR: false, touchBreak: false, sprintTouch: false };
  let lastFrame = performance.now(), fps = 60, fpsAcc = 0, fpsN = 0;
  let shake = 0;

  const ACH = [
    { id: 'wood', name: 'Добыча древесины', desc: 'Добудь бревно', icon: ID.LOG },
    { id: 'bench', name: 'Мастерская', desc: 'Сделай верстак', icon: ID.TABLE },
    { id: 'pick', name: 'Пора копать!', desc: 'Сделай кирку', icon: TOOL.pickaxe_wood },
    { id: 'stone', name: 'Каменный век', desc: 'Добудь булыжник', icon: ID.COBBLE },
    { id: 'torch', name: 'Да будет свет', desc: 'Поставь факел', icon: ID.TORCH },
    { id: 'furnace', name: 'Горячая тема', desc: 'Сделай печь', icon: ID.FURNACE },
    { id: 'iron', name: 'Железный век', desc: 'Выплавь железный слиток', icon: ID.IRON },
    { id: 'cook', name: 'Шеф-повар', desc: 'Пожарь мясо', icon: ID.MEAT_COOKED },
    { id: 'diamond', name: 'Алмазы!', desc: 'Найди алмаз', icon: ID.DIAMOND },
    { id: 'zombie', name: 'Охотник на монстров', desc: 'Победи зомби', icon: ID.ROTTEN },
    { id: 'creeper', name: 'Тссс… БУМ', desc: 'Победи крипера', icon: ID.GUNPOWDER },
    { id: 'boom', name: 'Подрывник', desc: 'Взорви динамит', icon: ID.TNT },
    { id: 'sleep', name: 'Сладких снов', desc: 'Поспи в кровати', icon: ID.BED },
    { id: 'deep', name: 'В самое пекло', desc: 'Спустись ниже 12-го блока', icon: ID.LAVA },
    { id: 'high', name: 'Покоритель вершин', desc: 'Поднимись выше 100-го блока', icon: ID.SNOW },
    { id: 'build', name: 'Строитель', desc: 'Поставь 100 блоков', icon: ID.BRICK },
    { id: 'night', name: 'Пережил ночь', desc: 'Встреть рассвет в режиме выживания', icon: ID.JACK },
  ];
  function unlock(id) {
    if (!G || G.ach[id]) return;
    G.ach[id] = Date.now();
    const a = ACH.find((x) => x.id === id);
    if (!a) return;
    toast(`<img src="${iconFor(a.icon)}" alt=""><div><small>Достижение!</small>${a.name}</div>`, 'ach', 4000);
    Sound.chime();
  }

  // ======================================================================
  // Чанки: загрузка, меши, выгрузка
  // ======================================================================
  function rebuildOffsets(r = settings.dist) {
    chunkOffs = [];
    const R = r + 1;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const d2 = dx * dx + dz * dz;
      if (d2 <= (R + 0.5) * (R + 0.5)) chunkOffs.push([dx, dz, d2]);
    }
    chunkOffs.sort((a, b) => a[2] - b[2]);
  }
  function makeMesh(d, mat, ch) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.p, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(d.u, 2));
    g.setAttribute('data', new THREE.BufferAttribute(d.d, 3));
    g.setIndex(new THREE.BufferAttribute(d.i, 1));
    const top = ch.top + 2;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(8, top / 2, 8), Math.hypot(8, top / 2, 8));
    const m = new THREE.Mesh(g, mat);
    m.position.set(ch.cx * 16, 0, ch.cz * 16);
    m.matrixAutoUpdate = false; m.updateMatrix();
    scene.add(m);
    return m;
  }
  function disposeChunkMesh(ch) {
    for (const k of ['meshO', 'meshW']) if (ch[k]) { scene.remove(ch[k]); ch[k].geometry.dispose(); ch[k] = null; }
  }
  function buildMesh(ch) {
    const out = world.meshChunk(ch);
    disposeChunkMesh(ch);
    if (out.o) ch.meshO = makeMesh(out.o, matOpaque, ch);
    if (out.w) ch.meshW = makeMesh(out.w, matWater, ch);
    ch.dirty = false; ch.meshed = true;
  }
  function neighborsReady(cx, cz) {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (!world.getChunk(cx + i, cz + j)) return false;
    return true;
  }
  function streamChunks(budget, cx0, cz0, r = settings.dist) {
    const t0 = performance.now();
    const pcx = cx0 ?? Math.floor(P.x / 16), pcz = cz0 ?? Math.floor(P.z / 16);
    const genR2 = (r + 1.5) * (r + 1.5), meshR2 = (r + 0.5) * (r + 0.5);
    for (const [dx, dz, d2] of chunkOffs) {
      if (d2 > genR2) break;
      if (!world.getChunk(pcx + dx, pcz + dz)) { world.genChunk(pcx + dx, pcz + dz); if (performance.now() - t0 > budget * 0.5) break; }
    }
    for (const [dx, dz, d2] of chunkOffs) {
      if (d2 > meshR2) break;
      if (performance.now() - t0 > budget) break;
      const ch = world.getChunk(pcx + dx, pcz + dz);
      if (ch && ch.dirty && neighborsReady(ch.cx, ch.cz)) buildMesh(ch);
    }
  }
  let unloadT = 0;
  function unloadFar(cx0, cz0, r = settings.dist) {
    const lim = (r + 3) * (r + 3);
    for (const [k, ch] of world.chunks) {
      const dx = ch.cx - cx0, dz = ch.cz - cz0;
      if (dx * dx + dz * dz > lim) { disposeChunkMesh(ch); world.chunks.delete(k); }
    }
  }
  function blockChanged(x, y, z) {
    const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const ch = world.getChunk(cx + dx, cz + dz);
      if (!ch) continue;
      const rx0 = ch.cx * 16 - LIGHT_MARGIN, rz0 = ch.cz * 16 - LIGHT_MARGIN;
      if (x < rx0 || x >= rx0 + 16 + 2 * LIGHT_MARGIN || z < rz0 || z >= rz0 + 16 + 2 * LIGHT_MARGIN) continue;
      ch.dirty = true;
      const nx = dx === 0 || (dx === -1 && lx === 0) || (dx === 1 && lx === 15);
      const nz = dz === 0 || (dz === -1 && lz === 0) || (dz === 1 && lz === 15);
      if (nx && nz) urgent.add(ch);
    }
  }
  function flushUrgent() {
    for (const ch of urgent) if (world.chunks.has(World.key(ch.cx, ch.cz)) && neighborsReady(ch.cx, ch.cz)) buildMesh(ch);
    urgent.clear();
  }
  function setBlock(x, y, z, b) {
    const ch = world.setBlock(x, y, z, b);
    if (ch) blockChanged(x, y, z);
    return ch;
  }
  function disposeWorld() {
    if (!world) return;
    for (const ch of world.chunks.values()) disposeChunkMesh(ch);
    world.chunks.clear();
    while (ents.length) removeEnt(ents[0]);
    sparks.clear(); smoke.clear();
    world = null;
  }

  // ======================================================================
  // Инвентарь
  // ======================================================================
  const maxStack = (id) => (ITEMS[id] ? ITEMS[id].stack : 64);
  function newStack(id, n, dur) {
    const it = ITEMS[id];
    const s = { id, n };
    if (it && it.tool) s.dur = dur ?? it.tool.dur;
    return s;
  }
  function addItem(id, n = 1, dur) {
    if (!ITEMS[id]) return n;
    const max = maxStack(id);
    if (max > 1) for (let i = 0; i < 36 && n > 0; i++) {
      const s = inv.slots[i];
      if (s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; }
    }
    for (let i = 0; i < 36 && n > 0; i++) {
      if (!inv.slots[i]) { const k = Math.min(n, max); inv.slots[i] = newStack(id, k, dur); n -= k; }
    }
    inv.ver++;
    return n;
  }
  function countItem(id) { let c = 0; for (const s of inv.slots) if (s && s.id === id) c += s.n; return c; }
  function removeItem(id, n) {
    for (let i = 35; i >= 0 && n > 0; i--) {
      const s = inv.slots[i];
      if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) inv.slots[i] = null; }
    }
    inv.ver++;
  }
  const held = () => inv.slots[inv.sel];
  function useHeld(n = 1) {
    if (G.mode === 'creative') return;
    const s = held(); if (!s) return;
    s.n -= n; if (s.n <= 0) inv.slots[inv.sel] = null;
    inv.ver++;
  }
  function damageTool(n = 1) {
    if (G.mode === 'creative') return;
    const s = held(); if (!s || s.dur == null) return;
    s.dur -= n;
    if (s.dur <= 0) { inv.slots[inv.sel] = null; Sound.tone({ type: 'square', f0: 300, f1: 90, dur: 0.25, gain: 0.15 }); toast(`${ITEMS[s.id].name} сломался`); }
    inv.ver++;
  }
  function onPickup(id) {
    if (id === ID.LOG || id === ID.BIRCH_LOG || id === ID.SPRUCE_LOG) unlock('wood');
    if (id === ID.COBBLE) unlock('stone');
    if (id === ID.DIAMOND) unlock('diamond');
  }

  // ======================================================================
  // Сущности: предметы, мобы, динамит
  // ======================================================================
  function addEnt(e) { ents.push(e); if (e.mesh) scene.add(e.mesh); return e; }
  function removeEnt(e) {
    const i = ents.indexOf(e); if (i >= 0) ents.splice(i, 1);
    if (e.mesh) { scene.remove(e.mesh); e.mesh.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (!m.userData.shared) m.dispose(); }); }); }
    e.dead = true;
  }
  function spawnItem(x, y, z, id, n = 1, dur, toss) {
    if (!n || !ITEMS[id]) return;
    const g = itemGeometry(id);
    const mesh = new THREE.Mesh(g, itemMat());
    const flat = g.userData.flat;
    mesh.scale.setScalar(flat ? 0.42 : 0.26);
    const e = { kind: 'item', id, n, dur, x, y, z, vx: rand(-1.5, 1.5), vy: rand(2.5, 4), vz: rand(-1.5, 1.5), w: 0.13, h: 0.26, age: 0, pick: 0.6, mesh, flat, onGround: false };
    if (toss) { e.vx = toss[0]; e.vy = toss[1]; e.vz = toss[2]; e.pick = 1.4; }
    return addEnt(e);
  }
  function spawnMob(type, x, y, z) {
    const def = MOBS[type];
    const model = buildModel(type);
    const e = { kind: 'mob', type, def, x, y, z, vx: 0, vy: 0, vz: 0, w: def.w, h: def.h, yaw: rand(0, 6.28), hp: def.hp, onGround: false, ai: 0, dir: null, flee: 0, hurtT: 0, atkCD: 0, fuse: 0, walk: 0, mesh: model.root, model, sayT: rand(4, 15), burnT: 0, swell: 0 };
    return addEnt(e);
  }
  function spawnTNT(x, y, z, fuse = 4) {
    const mesh = new THREE.Mesh(itemGeometry(ID.TNT), itemMat());
    mesh.scale.setScalar(0.98);
    Sound.fuse();
    return addEnt({ kind: 'tnt', x, y, z, vx: rand(-0.5, 0.5), vy: 3, vz: rand(-0.5, 0.5), w: 0.49, h: 0.98, fuse, mesh, onGround: false });
  }
  function entBrightness(x, y, z) {
    const [s, b] = world.lightAt(Math.floor(x), Math.floor(y), Math.floor(z));
    return Math.max(0.08, Math.max(lightCurve(s) * U.daylight.value, lightCurve(b)));
  }

  // ---------- Физика ----------
  function moveAxis(e, axis, d) {
    if (!d) return false;
    if (axis === 0) e.x += d; else if (axis === 1) e.y += d; else e.z += d;
    const x0 = Math.floor(e.x - e.w), x1 = Math.floor(e.x + e.w), y0 = Math.floor(e.y), y1 = Math.floor(e.y + e.h), z0 = Math.floor(e.z - e.w), z1 = Math.floor(e.z + e.w);
    let hit = false;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const b = world.getBlock(x, y, z);
      if (!SOLID[b]) continue;
      const bh = B[b].height;
      if (e.y >= y + bh || e.y + e.h <= y) continue;
      if (e.x + e.w <= x || e.x - e.w >= x + 1 || e.z + e.w <= z || e.z - e.w >= z + 1) continue;
      hit = true;
      if (axis === 0) e.x = d > 0 ? x - e.w - 1e-4 : x + 1 + e.w + 1e-4;
      else if (axis === 1) e.y = d > 0 ? y - e.h - 1e-4 : y + bh + 1e-4;
      else e.z = d > 0 ? z - e.w - 1e-4 : z + 1 + e.w + 1e-4;
    }
    return hit;
  }
  function collidesAt(e) {
    const x0 = Math.floor(e.x - e.w), x1 = Math.floor(e.x + e.w), y0 = Math.floor(e.y), y1 = Math.floor(e.y + e.h - 1e-3), z0 = Math.floor(e.z - e.w), z1 = Math.floor(e.z + e.w);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const b = world.getBlock(x, y, z);
      if (SOLID[b] && e.y < y + B[b].height && e.y + e.h > y) return true;
    }
    return false;
  }
  function physics(e, dt, opts = {}) {
    const dx = e.vx * dt, dy = e.vy * dt, dz = e.vz * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.4));
    const wasGround = e.onGround;
    e.onGround = false;
    let hx = false, hz = false;
    for (let s = 0; s < steps; s++) {
      if (moveAxis(e, 1, dy / steps)) { if (dy < 0) e.onGround = true; e.vy = 0; }
      const sx = e.x, sz = e.z;
      const bx = moveAxis(e, 0, dx / steps), bz = moveAxis(e, 2, dz / steps);
      if ((bx || bz) && (wasGround || e.onGround) && opts.step) {
        // Подъём на невысокие блоки (кровать и т. п.)
        const save = { x: e.x, y: e.y, z: e.z };
        e.x = sx; e.z = sz; e.y += 0.6;
        if (!collidesAt(e)) {
          const bx2 = moveAxis(e, 0, dx / steps), bz2 = moveAxis(e, 2, dz / steps);
          moveAxis(e, 1, -0.6);
          if (!bx2 && !bz2 && e.y - save.y > 0.01) { continue; }
        }
        e.x = save.x; e.y = save.y; e.z = save.z;
      }
      if (bx) { hx = true; e.vx = 0; }
      if (bz) { hz = true; e.vz = 0; }
    }
    return hx || hz;
  }
  function liquidAt(e, yOff) {
    const b = world.getBlock(Math.floor(e.x), Math.floor(e.y + yOff), Math.floor(e.z));
    return b === ID.WATER ? 1 : b === ID.LAVA ? 2 : 0;
  }

  // ---------- Взрыв ----------
  function explode(x, y, z, r, source) {
    Sound.boom(Math.hypot(x - P.x, y - P.y, z - P.z));
    shake = Math.max(shake, clamp(1.2 - Math.hypot(x - P.x, z - P.z) / 30, 0, 1.2));
    if (source === 'tnt') unlock('boom');
    const r2 = r * r;
    const R = Math.ceil(r);
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2 * rand(0.65, 1.05)) continue;
      const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz;
      const b = world.getBlock(bx, by, bz);
      if (!b || B[b].blast) continue;
      if (b === ID.TNT) { setBlock(bx, by, bz, 0); spawnTNT(bx + 0.5, by, bz + 0.5, rand(0.5, 1.5)); continue; }
      setBlock(bx, by, bz, 0);
      if (Math.random() < 0.22 && G.mode !== 'creative') { const dr = dropFor(b); if (dr) spawnItem(bx + 0.5, by + 0.5, bz + 0.5, dr[0], dr[1]); }
    }
    for (let i = 0; i < 70; i++) {
      const a = rand(0, 6.28), u = rand(-1, 1), s = rand(2, 9), k = Math.sqrt(1 - u * u);
      sparks.add(x, y, z, Math.cos(a) * k * s, u * s + 2, Math.sin(a) * k * s, 1, rand(0.4, 0.9), 0.1, rand(0.3, 0.9), 6);
    }
    for (let i = 0; i < 40; i++) smoke.add(x + rand(-r, r) * 0.6, y + rand(-1, r * 0.6), z + rand(-r, r) * 0.6, rand(-1, 1), rand(0.5, 2.5), rand(-1, 1), rand(0.5, 0.8), rand(0.5, 0.8), rand(0.5, 0.8), rand(0.8, 2.2), -0.5);
    const hurtR = r * 2;
    const pd = Math.hypot(P.x - x, P.y + 0.9 - y, P.z - z);
    if (pd < hurtR && !P.dead) {
      const k = 1 - pd / hurtR;
      hurt(Math.round(k * r * 5), source === 'creeper' ? 'взорван крипером' : 'подорвался на динамите', x, z, 14 * k);
      P.vy += 7 * k;
    }
    for (const e of ents.slice()) {
      if (e.kind !== 'mob' && e.kind !== 'item') continue;
      const d = Math.hypot(e.x - x, e.y - y, e.z - z);
      if (d > hurtR) continue;
      const k = 1 - d / hurtR;
      if (e.kind === 'mob') hurtMob(e, Math.round(k * r * 5), x, z, 14 * k, false);
      else { e.vx += (e.x - x) / (d + 0.1) * 8 * k; e.vy += 6 * k; }
    }
    flushUrgent();
  }

  // ---------- Мобы ----------
  function hurtMob(e, dmg, sx, sz, kb = 6, byPlayer = true) {
    if (e.dead || dmg <= 0) return;
    e.hp -= dmg; e.hurtT = 0.35;
    const dx = e.x - sx, dz = e.z - sz, l = Math.hypot(dx, dz) || 1;
    e.vx += (dx / l) * kb; e.vz += (dz / l) * kb; e.vy = Math.max(e.vy, 4.5);
    if (!e.def.hostile) e.flee = 5;
    Sound.tone({ type: 'square', f0: e.type === 'pig' ? 400 : e.type === 'sheep' ? 500 : 160, f1: 120, dur: 0.15, gain: 0.12 });
    if (e.hp <= 0) killMob(e, byPlayer);
  }
  function killMob(e, byPlayer) {
    if (e.dead) return;
    for (let i = 0; i < 20; i++) smoke.add(e.x + rand(-0.4, 0.4), e.y + rand(0, e.h), e.z + rand(-0.4, 0.4), rand(-0.6, 0.6), rand(0.5, 1.5), rand(-0.6, 0.6), 0.9, 0.9, 0.9, rand(0.4, 0.9), -0.4);
    if (byPlayer || G.mode !== 'creative') for (const [id, n] of e.def.drops()) if (n > 0) spawnItem(e.x, e.y + 0.5, e.z, id, n);
    if (byPlayer) { if (e.type === 'zombie') unlock('zombie'); if (e.type === 'creeper') unlock('creeper'); G.stats.kills = (G.stats.kills || 0) + 1; }
    removeEnt(e);
  }
  function updateMob(e, dt) {
    const def = e.def;
    if (!world.getChunk(Math.floor(e.x) >> 4, Math.floor(e.z) >> 4)?.meshed) { removeEnt(e); return; }
    const dxp = P.x - e.x, dzp = P.z - e.z, dyp = P.y - e.y, dist = Math.hypot(dxp, dzp);
    if (def.hostile && dist > 80) { removeEnt(e); return; }
    e.hurtT = Math.max(0, e.hurtT - dt); e.atkCD -= dt; e.ai -= dt; e.flee -= dt; e.sayT -= dt;
    const liq = liquidAt(e, 0.4);
    let mx = 0, mz = 0, speed = def.speed;
    const chase = def.hostile && !P.dead && G.mode !== 'creative' && dist < 18 && Math.abs(dyp) < 10;
    if (chase) { mx = dxp / (dist || 1); mz = dzp / (dist || 1); }
    else if (e.flee > 0) { mx = -dxp / (dist || 1); mz = -dzp / (dist || 1); speed *= 1.8; }
    else {
      if (e.ai <= 0) { e.ai = rand(2, 6); e.dir = Math.random() < 0.6 ? rand(0, 6.28) : null; }
      if (e.dir != null) { mx = Math.sin(e.dir); mz = Math.cos(e.dir); speed *= 0.6; }
    }
    // Крипер
    if (e.type === 'creeper') {
      if (chase && dist < 2.6) { if (e.fuse === 0) Sound.fuse(); e.fuse += dt; mx = mz = 0; }
      else e.fuse = Math.max(0, e.fuse - dt * 0.6);
      if (e.fuse >= 1.5) { const x = e.x, y = e.y + 0.8, z = e.z; removeEnt(e); explode(x, y, z, 3, 'creeper'); return; }
    }
    // Зомби: атака и горение днём
    if (e.type === 'zombie') {
      if (chase && dist < 1.1 && Math.abs(dyp) < 1.6 && e.atkCD <= 0) { e.atkCD = 1; hurt(def.dmg, 'был убит зомби', e.x, e.z, 6); }
      const [sk] = world.lightAt(Math.floor(e.x), Math.floor(e.y + 1.6), Math.floor(e.z));
      if (sk >= 14 && U.daylight.value > 0.75 && G.rain < 0.4 && liq === 0) {
        e.burnT -= dt;
        if (Math.random() < dt * 12) sparks.add(e.x + rand(-0.3, 0.3), e.y + rand(0, 1.9), e.z + rand(-0.3, 0.3), 0, 1.5, 0, 1, rand(0.3, 0.7), 0, 0.5, -1);
        if (e.burnT <= 0) { e.burnT = 1; hurtMob(e, 1, e.x, e.z, 0, false); if (e.dead) return; }
      }
    }
    if (e.sayT <= 0) { e.sayT = rand(6, 18); Sound.mob(e.type, dist); }
    const tvx = mx * speed, tvz = mz * speed;
    const acc = e.onGround ? 10 : 2;
    e.vx += (tvx - e.vx) * Math.min(1, acc * dt);
    e.vz += (tvz - e.vz) * Math.min(1, acc * dt);
    if (liq) { e.vy += (liq === 1 ? 14 : 10) * dt; e.vy = Math.min(e.vy, 2.2); e.vy -= 9 * dt; if (liq === 2) { e.burnT -= dt; if (e.burnT <= 0) { e.burnT = 0.5; hurtMob(e, 4, e.x, e.z, 0, false); if (e.dead) return; } } }
    else e.vy -= 26 * dt;
    e.vy = Math.max(e.vy, -50);
    const blocked = physics(e, dt, { step: true });
    if (blocked && e.onGround && (mx || mz)) e.vy = 8.4;
    if (e.y < -30) { removeEnt(e); return; }
    // Отталкивание от игрока
    if (dist < e.w + P.w + 0.1 && Math.abs(dyp) < 1.5) { const k = (e.w + P.w + 0.1 - dist) * 4; e.vx -= dxp / (dist || 1) * k; e.vz -= dzp / (dist || 1) * k; }
    // Модель
    if (mx || mz) e.yaw = Math.atan2(mx, mz);
    const mv = Math.hypot(e.vx, e.vz);
    e.walk += mv * dt * 3.2;
    const sw = Math.sin(e.walk) * Math.min(0.8, mv * 0.4);
    const L = e.model.parts.legs;
    for (let i = 0; i < L.length; i++) L[i].rotation.x = (i % 2 === (L.length === 4 ? (i < 2 ? 0 : 1) : 0) ? sw : -sw);
    if (e.type === 'player') for (let i = 0; i < 2; i++) e.model.parts.arms[i].rotation.x = i ? sw : -sw;
    e.mesh.position.set(e.x, e.y, e.z);
    let ry = e.mesh.rotation.y, d = e.yaw - ry;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    e.mesh.rotation.y = ry + d * Math.min(1, dt * 10);
    if (e.type === 'creeper') { const s = 1 + Math.min(e.fuse, 1.5) * 0.12 + (e.fuse > 0 ? Math.sin(e.fuse * 30) * 0.02 : 0); e.mesh.scale.set(s, 1 + (s - 1) * 0.5, s); }
    const br = entBrightness(e.x, e.y + e.h * 0.7, e.z);
    const flash = e.type === 'creeper' && e.fuse > 0 && Math.floor(e.fuse * 8) % 2 === 0;
    for (const m of e.model.mats) {
      if (flash) m.color.setRGB(1.6, 1.6, 1.6);
      else if (e.hurtT > 0) m.color.setRGB(br * 1.4, br * 0.4, br * 0.4);
      else m.color.setRGB(br, br, br);
    }
  }
  let spawnT = 0;
  function trySpawning(dt) {
    spawnT -= dt;
    if (spawnT > 0) return;
    spawnT = 1;
    let passive = 0, hostile = 0;
    for (const e of ents) if (e.kind === 'mob') { if (e.def.hostile) hostile++; else passive++; }
    const day = smooth(-0.18, 0.25, Math.sin(G.time * Math.PI * 2));
    const tryPos = (minR, maxR) => {
      const a = rand(0, 6.28), r = rand(minR, maxR);
      const x = Math.floor(P.x + Math.cos(a) * r), z = Math.floor(P.z + Math.sin(a) * r);
      const ch = world.getChunk(x >> 4, z >> 4);
      if (!ch || !ch.meshed) return null;
      return { x, z, ch, i: (x & 15) * 16 + (z & 15) };
    };
    if (passive < 10 && Math.random() < 0.25) {
      const p = tryPos(22, 44);
      if (p && p.ch.mapB[p.i] === ID.GRASS) {
        const y = p.ch.mapH[p.i] + 1;
        const type = Math.random() < 0.5 ? 'pig' : 'sheep';
        const n = randi(1, 3);
        for (let k = 0; k < n; k++) if (!SOLID[world.getBlock(p.x, y, p.z)]) spawnMob(type, p.x + 0.5 + rand(-1, 1), y, p.z + 0.5 + rand(-1, 1));
      }
    }
    if (!G.mobs || hostile >= 14) return;
    for (let k = 0; k < 4; k++) {
      const p = tryPos(18, 42);
      if (!p) continue;
      let y;
      if (Math.random() < 0.5) y = p.ch.mapH[p.i] + 1;
      else y = Math.floor(P.y + rand(-20, 10));
      if (y < 2 || y >= WH - 2) continue;
      const b0 = world.getBlock(p.x, y, p.z), b1 = world.getBlock(p.x, y + 1, p.z), bd = world.getBlock(p.x, y - 1, p.z);
      if (b0 || b1 || !SOLID[bd] || B[bd].cutout || bd === ID.BEDROCK) continue;
      const [s, bl] = world.lightAt(p.x, y, p.z);
      const eff = Math.max(bl, Math.round(s * (day * 0.85 + 0.15)));
      if (eff >= 7) continue;
      spawnMob(Math.random() < 0.7 ? 'zombie' : 'creeper', p.x + 0.5, y, p.z + 0.5);
      return;
    }
  }

  // ---------- Предметы на земле ----------
  function updateItem(e, dt) {
    e.age += dt; e.pick -= dt;
    if (e.age > 300 || e.y < -30) { removeEnt(e); return; }
    const liq = liquidAt(e, 0.1);
    if (liq === 2) { removeEnt(e); return; }
    if (liq) { e.vy += 12 * dt; e.vy = Math.min(e.vy, 1.5); e.vy -= 10 * dt; } else e.vy -= 20 * dt;
    const d = Math.hypot(P.x - e.x, P.y + 0.8 - e.y, P.z - e.z);
    if (e.pick <= 0 && !P.dead && d < 2.6) {
      const k = 10 * dt / Math.max(d, 0.3);
      e.vx += (P.x - e.x) * k * 4; e.vy += (P.y + 0.8 - e.y) * k * 4; e.vz += (P.z - e.z) * k * 4;
      if (d < 0.75) {
        const left = addItem(e.id, e.n, e.dur);
        if (left < e.n) { Sound.pop(); onPickup(e.id); }
        if (!left) { removeEnt(e); return; }
        e.n = left;
      }
    }
    if (e.onGround) { e.vx *= Math.pow(0.02, dt); e.vz *= Math.pow(0.02, dt); }
    physics(e, dt);
    e.mesh.position.set(e.x, e.y + 0.13 + Math.sin(e.age * 3) * 0.06, e.z);
    e.mesh.rotation.y = e.flat ? Math.atan2(camera.position.x - e.x, camera.position.z - e.z) : e.age * 1.5;
    const br = entBrightness(e.x, e.y + 0.2, e.z);
    e.mesh.material.color.setRGB(br, br, br);
  }
  function updateTNT(e, dt) {
    e.fuse -= dt;
    e.vy -= 20 * dt;
    e.vx *= 0.98; e.vz *= 0.98;
    physics(e, dt);
    e.mesh.position.set(e.x, e.y + 0.49, e.z);
    const fl = Math.floor(e.fuse * 5) % 2 === 0;
    const br = entBrightness(e.x, e.y + 0.5, e.z);
    e.mesh.material.color.setRGB(fl ? 2 : br, fl ? 2 : br, fl ? 2 : br);
    if (Math.random() < dt * 20) smoke.add(e.x, e.y + 1.1, e.z, rand(-0.2, 0.2), 1, rand(-0.2, 0.2), 0.6, 0.6, 0.6, 0.8, -0.3);
    if (e.fuse <= 0) { removeEnt(e); explode(e.x, e.y + 0.5, e.z, 4, 'tnt'); }
  }

  // ======================================================================
  // Игрок
  // ======================================================================
  function hurt(dmg, cause, sx, sz, kb = 5) {
    if (P.dead || G.mode === 'creative' || dmg <= 0 || P.invT > 0) return;
    P.health -= dmg; P.invT = 0.5; P.hurtT = 0.4;
    Sound.hurt();
    shake = Math.max(shake, 0.25);
    if (sx != null) { const dx = P.x - sx, dz = P.z - sz, l = Math.hypot(dx, dz) || 1; P.vx += dx / l * kb; P.vz += dz / l * kb; P.vy = Math.max(P.vy, 4); }
    P.exh += 0.1;
    if (P.health <= 0) die(cause);
  }
  function die(cause) {
    P.dead = true; P.health = 0;
    $('death-cause').textContent = `Игрок ${cause}.`;
    if (document.pointerLockElement) document.exitPointerLock();
    closeInventory();
    show('scr-death');
    G.stats.deaths = (G.stats.deaths || 0) + 1;
  }
  function respawn() {
    P.dead = false; P.health = 20; P.food = 20; P.sat = 5; P.air = 15; P.exh = 0;
    P.x = G.spawn.x; P.y = G.spawn.y; P.z = G.spawn.z; P.vx = P.vy = P.vz = 0; P.fallStart = null;
    hide('scr-death');
    placeOnSurface();
    requestLock();
  }
  function placeOnSurface() {
    const x = Math.floor(P.x), z = Math.floor(P.z);
    if (!world.isLoaded(x, z)) return;
    let y = Math.floor(P.y);
    if (!collidesAt(P) && SOLID[world.getBlock(x, y - 1, z)]) return;
    for (let yy = WH - 2; yy > 0; yy--) {
      const b = world.getBlock(x, yy, z);
      if (SOLID[b] || b === ID.WATER || b === ID.LAVA) { P.y = yy + 1; return; }
    }
  }
  function eyePos() { return [P.x, P.y + (P.sneak && P.onGround ? 1.45 : 1.62), P.z]; }
  function lookDir() {
    const cp = Math.cos(P.pitch);
    return [-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp];
  }
  function groundUnder(x, z) {
    const y = Math.floor(P.y - 0.05);
    for (const ox of [-P.w, P.w]) for (const oz of [-P.w, P.w]) if (SOLID[world.getBlock(Math.floor(x + ox), y, Math.floor(z + oz))]) return true;
    return false;
  }
  let lastSpace = 0, lastW = 0;
  function updatePlayer(dt) {
    const creative = G.mode === 'creative';
    if (!creative) P.flying = false;
    const ch = world.getChunk(Math.floor(P.x) >> 4, Math.floor(P.z) >> 4);
    if (!ch || !ch.meshed) return;
    P.invT -= dt; P.hurtT -= dt;
    const liqFeet = liquidAt(P, 0.2), liqBody = liquidAt(P, 0.9);
    P.inWater = liqFeet === 1 || liqBody === 1;
    P.inLava = liqFeet === 2 || liqBody === 2;
    P.headWater = liquidAt(P, P.sneak ? 1.45 : 1.62);
    const ui = uiOpen && uiOpen !== 'none';
    let fwd = ui ? 0 : input.fwd, str = ui ? 0 : input.str;
    if (!ui && !isTouch) {
      fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      str = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    }
    const jump = !ui && (keys.has('Space') || input.jump);
    const down = !ui && (keys.has('ShiftLeft') || keys.has('ShiftRight') || input.down);
    P.sneak = down && !P.flying && !P.inWater;
    if (fwd <= 0) P.sprint = false;
    if (!ui && (keys.has('ControlLeft') || input.sprintTouch) && fwd > 0) P.sprint = true;
    if (P.food <= 6 && !creative) P.sprint = false;
    let speed = P.flying ? (P.sprint ? 21 : 10.8) : P.sneak ? 1.4 : P.sprint ? 5.6 : 4.3;
    if (P.inWater && !P.flying) speed *= 0.5;
    if (P.inLava && !P.flying) speed *= 0.35;
    const s = Math.sin(P.yaw), c = Math.cos(P.yaw);
    let wx = -s * fwd + c * str, wz = -c * fwd - s * str;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    let tvx = wx * speed, tvz = wz * speed;
    const acc = P.flying ? 8 : P.onGround ? 16 : P.inWater ? 6 : 3.2;
    P.vx += (tvx - P.vx) * Math.min(1, acc * dt);
    P.vz += (tvz - P.vz) * Math.min(1, acc * dt);
    if (P.flying) {
      const tv = (jump ? 1 : 0) - (down ? 1 : 0);
      P.vy += (tv * 9 - P.vy) * Math.min(1, 10 * dt);
    } else if (P.inWater || P.inLava) {
      P.vy -= 9 * dt; P.vy *= Math.pow(0.15, dt);
      if (jump) P.vy = Math.min(P.vy + 26 * dt, 3.6);
      P.vy = Math.max(P.vy, -4);
    } else {
      P.vy -= 28 * dt;
      P.vy = Math.max(P.vy, -60);
      if (jump && P.onGround) { P.vy = 8.6; P.exh += P.sprint ? 0.2 : 0.05; }
    }
    // Осторожный шаг: не падать с края
    if (P.sneak && P.onGround) {
      if (!groundUnder(P.x + P.vx * dt * 2, P.z)) P.vx = 0;
      if (!groundUnder(P.x, P.z + P.vz * dt * 2)) P.vz = 0;
    }
    const ox = P.x, oz = P.z, wasGround = P.onGround;
    const blocked = physics(P, dt, { step: true });
    if (blocked && P.onGround && settings.autojump && (fwd || str) && !P.flying) {
      const fx = Math.floor(P.x + wx * 0.6), fz = Math.floor(P.z + wz * 0.6), fy = Math.floor(P.y);
      if (SOLID[world.getBlock(fx, fy, fz)] && !SOLID[world.getBlock(fx, fy + 1, fz)] && !SOLID[world.getBlock(fx, fy + 2, fz)]) P.vy = 8.6;
    }
    if (P.flying && P.onGround && !jump) P.flying = false;
    // Падение
    if (P.onGround || P.inWater || P.flying || P.inLava) {
      if (P.fallStart != null && P.onGround && !P.inWater) {
        const fall = P.fallStart - P.y;
        if (fall > 3.4) { hurt(Math.floor(fall - 3), 'упал с высоты'); }
        if (fall > 1.5) { const b = world.getBlock(Math.floor(P.x), Math.floor(P.y - 0.1), Math.floor(P.z)); Sound.block(B[b].sound, 'step', 1.6); }
      }
      P.fallStart = null;
    } else if (P.fallStart == null || P.y > P.fallStart) P.fallStart = P.y;
    if (P.inWater && !P._wasWater && P.vy < -5) Sound.splash();
    P._wasWater = P.inWater;
    // Шаги и усталость
    const moved = Math.hypot(P.x - ox, P.z - oz);
    if (P.onGround && wasGround && moved > 0) {
      P.stepDist += moved; P.bobT += moved * 2.2;
      if (P.sprint) P.exh += moved * 0.1;
      if (P.stepDist > 1.8) { P.stepDist = 0; const b = world.getBlock(Math.floor(P.x), Math.floor(P.y - 0.2), Math.floor(P.z)); if (b && !P.sneak) Sound.block(B[b].sound, 'step'); }
    }
    if (P.y < -40) die('выпал из мира');
    // Урон от окружения
    if (!creative) {
      P.cactusT -= dt; P.lavaT -= dt;
      if (P.inLava && P.lavaT <= 0) { P.lavaT = 0.5; hurt(4, 'сгорел в лаве'); }
      if (P.cactusT <= 0) {
        const e = { x: P.x, y: P.y, z: P.z, w: P.w + 0.04, h: P.h };
        for (let x = Math.floor(e.x - e.w); x <= Math.floor(e.x + e.w); x++) for (let y = Math.floor(e.y); y <= Math.floor(e.y + e.h); y++) for (let z = Math.floor(e.z - e.w); z <= Math.floor(e.z + e.w); z++)
          if (world.getBlock(x, y, z) === ID.CACTUS) { P.cactusT = 0.5; hurt(1, 'укололся о кактус'); }
      }
      // Воздух
      if (P.headWater === 1) { P.air -= dt; if (P.air <= 0) { P.air = 0; P.drownT -= dt; if (P.drownT <= 0) { P.drownT = 1; hurt(2, 'утонул'); } } }
      else P.air = Math.min(15, P.air + dt * 5);
      // Голод и регенерация
      while (P.exh >= 4) { P.exh -= 4; if (P.sat > 0) P.sat = Math.max(0, P.sat - 1); else P.food = Math.max(0, P.food - 1); }
      P.exh += dt * 0.012;
      P.regenT -= dt;
      if (P.regenT <= 0) {
        P.regenT = 3.5;
        if (P.food >= 18 && P.health < 20) { P.health = Math.min(20, P.health + 1); P.exh += 1.5; }
        else if (P.food <= 0 && P.health > 1) hurt(1, 'умер от голода');
      }
    } else { P.health = 20; P.food = 20; P.air = 15; }
    if (P.y < 12) unlock('deep');
    if (P.y > 100) unlock('high');
  }

  // ---------- Цель взгляда ----------
  function rayAABB(o, d, min, max, maxT) {
    let t0 = 0, t1 = maxT;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < min[a] || o[a] > max[a]) return null; continue; }
      let ta = (min[a] - o[a]) / d[a], tb = (max[a] - o[a]) / d[a];
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return null;
    }
    return t0;
  }
  function updateTarget() {
    const eye = eyePos(), dir = lookDir();
    const reach = G.mode === 'creative' ? 7 : 5;
    const hit = world.raycast(eye[0], eye[1], eye[2], dir[0], dir[1], dir[2], reach, (b) => b !== ID.WATER && b !== ID.LAVA);
    let mob = null, mt = hit ? hit.t : reach;
    for (const e of ents) {
      if (e.kind !== 'mob') continue;
      const t = rayAABB(eye, dir, [e.x - e.w, e.y, e.z - e.w], [e.x + e.w, e.y + e.h, e.z + e.w], Math.min(mt, 3.6));
      if (t != null && t < mt) { mt = t; mob = e; }
    }
    target = mob ? { mob } : hit;
    if (hit && !mob) {
      const def = B[hit.b];
      hl.visible = true;
      if (def.shape === 'torch') { hl.scale.set(0.2, 0.65, 0.2); hl.position.set(hit.x + 0.5, hit.y + 0.31, hit.z + 0.5); }
      else if (def.shape === 'cross') { hl.scale.set(0.75, 0.9, 0.75); hl.position.set(hit.x + 0.5, hit.y + 0.45, hit.z + 0.5); }
      else { hl.scale.set(1, def.height, 1); hl.position.set(hit.x + 0.5, hit.y + def.height / 2, hit.z + 0.5); }
    } else hl.visible = false;
  }

  // ---------- Ломание и установка ----------
  function canHarvest(b, it) {
    const def = B[b];
    if (def.tool !== 'pickaxe' || !def.tier) return true;
    return !!(it && it.tool && it.tool.kind === 'pickaxe' && it.tool.tier >= def.tier);
  }
  function breakTime(b) {
    const def = B[b];
    if (def.hardness < 0) return Infinity;
    if (G.mode === 'creative') return 0;
    if (def.hardness === 0) return 0.05;
    const s = held(), it = s && ITEMS[s.id];
    const right = it && it.tool && it.tool.kind === def.tool;
    let t = def.hardness * (canHarvest(b, it) ? 1.5 : 5);
    if (right) t /= it.tool.speed;
    if (it && it.tool && it.tool.kind === 'sword' && def.cutout) t /= 3;
    if (P.inWater && !P.onGround) t *= 3;
    return t;
  }
  function dropFor(b) {
    const def = B[b];
    if (b === ID.LEAVES || b === ID.BIRCH_LEAVES || b === ID.SPRUCE_LEAVES) {
      const r = Math.random();
      if (r < 0.06) return [ID.SAPLING, 1];
      if (r < 0.1 && b === ID.LEAVES) return [ID.APPLE, 1];
      return null;
    }
    if (b === ID.GRAVEL && Math.random() < 0.12) return [ID.FLINT, 1];
    if (b === ID.TALLGRASS) return null;
    if (!def.drop) return null;
    return [def.drop, 1];
  }
  const replaceable = (b) => b === 0 || b === ID.WATER || b === ID.LAVA || (B[b].replace === true);
  function needsSupport(b) { return B[b].support; }
  function supportOK(b, below) {
    const s = B[b].support;
    if (!s) return true;
    if (s === 'soil') return below === ID.GRASS || below === ID.DIRT || below === ID.SNOW_GRASS || (b === ID.DEADBUSH && below === ID.SAND);
    if (s === 'sand') return below === ID.SAND || (b === ID.CACTUS && below === ID.CACTUS);
    if (s === 'solid') return SOLID[below] && B[below].full;
    return true;
  }
  function breakBlock(x, y, z, byPlayer = true) {
    const b = world.getBlock(x, y, z);
    if (!b) return;
    const def = B[b];
    const s = held(), it = s && ITEMS[s.id];
    setBlock(x, y, z, 0);
    const [sk, bl] = world.lightAt(x, y + 1, z);
    blockParticles(x, y, z, b, 26, Math.max(lightCurve(sk) * U.daylight.value, lightCurve(bl)) * 255 / 255 * 1);
    Sound.block(def.sound, 'break');
    if (byPlayer && G.mode !== 'creative') {
      if (canHarvest(b, it)) { const d = dropFor(b); if (d) spawnItem(x + 0.5, y + 0.3, z + 0.5, d[0], d[1]); }
      if (it && it.tool && def.hardness > 0) damageTool(it.tool.kind === 'sword' ? 2 : 1);
      P.exh += 0.005;
    }
    if (G.saplings) G.saplings.delete(`${x},${y},${z}`);
    afterRemove(x, y, z);
    flushUrgent();
  }
  function afterRemove(x, y, z) {
    // Растения и факелы без опоры падают
    const above = world.getBlock(x, y + 1, z);
    if (above && needsSupport(above) && !supportOK(above, 0)) {
      if (above === ID.CACTUS) { let yy = y + 1; while (world.getBlock(x, yy, z) === ID.CACTUS) { setBlock(x, yy, z, 0); spawnItem(x + 0.5, yy + 0.5, z + 0.5, ID.CACTUS, 1); yy++; } }
      else { setBlock(x, y + 1, z, 0); const d = dropFor(above); if (d && G.mode !== 'creative') spawnItem(x + 0.5, y + 1.3, z + 0.5, d[0], d[1]); }
    }
    // Песок и гравий падают
    let yy = y + 1;
    while (B[world.getBlock(x, yy, z)].gravity) {
      const g = world.getBlock(x, yy, z);
      let ny = yy;
      while (ny > 0 && replaceable(world.getBlock(x, ny - 1, z))) ny--;
      if (ny === yy) break;
      setBlock(x, yy, z, 0); setBlock(x, ny, z, g);
      yy++;
    }
    // Вода/лава затекает
    let liq = 0;
    for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = world.getBlock(x + dx, y + dy, z + dz);
      if (n === ID.WATER || n === ID.LAVA) { liq = n; break; }
    }
    if (liq && world.getBlock(x, y, z) === 0) { setBlock(x, y, z, liq); flowLiquid(x, y, z, liq); }
  }
  function flowLiquid(x, y, z, liq) {
    const other = liq === ID.WATER ? ID.LAVA : ID.WATER;
    const maxSpread = liq === ID.WATER ? 4 : 2;
    const q = [[x, y, z, 0]];
    let n = 0;
    const seen = new Set([`${x},${y},${z}`]);
    const touch = (cx, cy, cz) => {
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
        if (world.getBlock(cx + dx, cy + dy, cz + dz) === other) {
          if (liq === ID.WATER) setBlock(cx + dx, cy + dy, cz + dz, ID.OBSIDIAN); else { setBlock(cx, cy, cz, ID.COBBLE); return true; }
          Sound.noise({ type: 'highpass', freq: 3000, dur: 0.5, gain: 0.25 });
        }
      }
      return false;
    };
    if (touch(x, y, z)) return;
    while (q.length && n < 500) {
      const [cx, cy, cz, d] = q.shift();
      const below = world.getBlock(cx, cy - 1, cz);
      const canFlow = (b) => b === 0 || (B[b].shape === 'cross') || b === ID.TORCH;
      if (cy > 0 && canFlow(below)) {
        if (below) { const dr = dropFor(below); if (dr) spawnItem(cx + 0.5, cy - 0.5, cz + 0.5, dr[0], dr[1]); }
        setBlock(cx, cy - 1, cz, liq); n++;
        if (touch(cx, cy - 1, cz)) continue;
        q.push([cx, cy - 1, cz, 0]);
        continue;
      }
      if (below === liq) continue;
      if (d >= maxSpread) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${cx + dx},${cy},${cz + dz}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const b = world.getBlock(cx + dx, cy, cz + dz);
        if (!canFlow(b)) continue;
        if (b) { const dr = dropFor(b); if (dr) spawnItem(cx + dx + 0.5, cy + 0.5, cz + dz + 0.5, dr[0], dr[1]); }
        setBlock(cx + dx, cy, cz + dz, liq); n++;
        if (touch(cx + dx, cy, cz + dz)) continue;
        q.push([cx + dx, cy, cz + dz, d + 1]);
      }
    }
  }
  function entityIn(x, y, z) {
    const box = (e) => e.x + e.w > x && e.x - e.w < x + 1 && e.z + e.w > z && e.z - e.w < z + 1 && e.y + e.h > y && e.y < y + 1;
    if (box(P)) return true;
    for (const e of ents) if (e.kind === 'mob' && box(e)) return true;
    return false;
  }
  function placeBlock(id) {
    if (!target || target.mob) return false;
    let x = target.x, y = target.y, z = target.z;
    if (!B[target.b].replace) { x += target.nx; y += target.ny; z += target.nz; }
    if (y < 0 || y >= WH) return false;
    const cur = world.getBlock(x, y, z);
    if (!replaceable(cur)) return false;
    const def = B[id];
    if (def.solid && entityIn(x, y, z)) return false;
    if (!supportOK(id, world.getBlock(x, y - 1, z))) return false;
    setBlock(x, y, z, id);
    Sound.block(def.sound, 'place');
    P.swing = 1;
    useHeld();
    G.stats.placed = (G.stats.placed || 0) + 1;
    if (G.stats.placed >= 100) unlock('build');
    if (id === ID.TORCH) unlock('torch');
    if (id === ID.SAPLING) G.saplings.set(`${x},${y},${z}`, G.playTime + rand(40, 120));
    if (id === ID.WATER || id === ID.LAVA) flowLiquid(x, y, z, id);
    if (def.gravity) settleGravity(x, y, z);
    flushUrgent();
    return true;
  }
  function settleGravity(x, y, z) {
    const g = world.getBlock(x, y, z);
    if (!B[g].gravity) return;
    let ny = y;
    while (ny > 0 && replaceable(world.getBlock(x, ny - 1, z))) ny--;
    if (ny !== y) { setBlock(x, y, z, 0); setBlock(x, ny, z, g); }
  }
  function useAction() {
    if (P.dead) return;
    const s = held(), it = s && ITEMS[s.id];
    // Блоки с действием
    if (target && !target.mob && !P.sneak) {
      const def = B[target.b];
      if (def.use === 'table') { openInventory('table'); return; }
      if (def.use === 'furnace') { openInventory('furnace'); return; }
      if (def.use === 'tnt') { setBlock(target.x, target.y, target.z, 0); spawnTNT(target.x + 0.5, target.y, target.z + 0.5); flushUrgent(); P.swing = 1; return; }
      if (def.use === 'bed') { sleep(target); return; }
    }
    if (it && it.food) {
      if (P.food < 20 || G.mode === 'creative') {
        P.food = Math.min(20, P.food + it.food); P.sat = Math.min(P.food, P.sat + it.food * 0.6);
        Sound.eat(); setTimeout(() => Sound.burp(), 520);
        if (s.id === ID.ROTTEN && Math.random() < 0.6) { P.food = Math.max(0, P.food - 2); toast('Фу, гнилое…'); }
        useHeld(); P.swing = 1;
        return;
      }
    }
    if (it && it.block) placeBlock(s.id);
  }
  function sleep(t) {
    const day = smooth(-0.18, 0.25, Math.sin(G.time * Math.PI * 2));
    G.spawn = { x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5 };
    if (day > 0.35) { toast('Точка возрождения сохранена. Спать можно только ночью'); return; }
    for (const e of ents) if (e.kind === 'mob' && e.def.hostile && Math.hypot(e.x - P.x, e.z - P.z) < 10) { toast('Нельзя спать — рядом монстры'); return; }
    const ov = $('ov-sleep');
    ov.style.opacity = 1;
    setTimeout(() => {
      G.time = 0.0; G.day++; G.rainTarget = 0;
      for (const e of ents.slice()) if (e.kind === 'mob' && e.def.hostile) removeEnt(e);
      ov.style.opacity = 0;
      unlock('sleep');
      toast('Доброе утро! День ' + (G.day + 1));
    }, 1400);
  }
  function attack(e) {
    const s = held(), it = s && ITEMS[s.id];
    let dmg = it && it.tool ? it.tool.dmg : 1;
    const crit = P.vy < -1 && !P.onGround && !P.inWater;
    if (crit) { dmg *= 1.5; for (let i = 0; i < 10; i++) sparks.add(e.x, e.y + e.h * 0.7, e.z, rand(-2, 2), rand(0, 3), rand(-2, 2), 1, 1, 0.6, 0.5, 8); }
    hurtMob(e, dmg, P.x, P.z, P.sprint ? 9 : 6, true);
    if (it && it.tool) damageTool(it.tool.kind === 'sword' ? 1 : 2);
    P.exh += 0.1; P.swing = 1;
    attackCD = 0.42;
  }
  function updateActions(dt) {
    attackCD -= dt; useCD -= dt;
    const breaking = input.mouseL || input.touchBreak;
    if (breaking && target && target.mob) {
      if (attackCD <= 0) attack(target.mob);
      mining = null;
    } else if (breaking && target && !target.mob) {
      if (!mining || mining.x !== target.x || mining.y !== target.y || mining.z !== target.z || mining.b !== target.b) mining = { x: target.x, y: target.y, z: target.z, b: target.b, p: 0, t: breakTime(target.b), tick: 0 };
      if (G.mode === 'creative') {
        if (attackCD <= 0) { breakBlock(target.x, target.y, target.z); attackCD = 0.22; mining = null; }
      } else if (mining.t !== Infinity) {
        mining.p += dt / Math.max(mining.t, 0.0001);
        mining.tick -= dt;
        P.swing = Math.max(P.swing, 0.6);
        if (mining.tick <= 0) { mining.tick = 0.22; Sound.block(B[mining.b].sound, 'hit'); const c = tileAvg[B[mining.b].side]; sparks.add(target.x + 0.5 + target.nx * 0.52, target.y + 0.5 + target.ny * 0.52, target.z + 0.5 + target.nz * 0.52, rand(-1, 1), rand(0, 2), rand(-1, 1), c[0] / 255, c[1] / 255, c[2] / 255, 0.4); }
        if (mining.p >= 1) { breakBlock(mining.x, mining.y, mining.z); mining = null; }
      }
    } else mining = null;
    if (mining && mining.p > 0 && G.mode !== 'creative') {
      crack.visible = true;
      crack.position.set(mining.x + 0.5, mining.y + 0.5, mining.z + 0.5);
      setCrack(Math.min(7, Math.floor(mining.p * 8)));
      $('crack-hint').hidden = !isTouch;
      $('crack-hint').firstChild.style.width = (mining.p * 100) + '%';
    } else { crack.visible = false; $('crack-hint').hidden = true; }
    if (input.mouseR && useCD <= 0) { useCD = 0.26; useAction(); }
  }

  // ======================================================================
  // Время, погода, небо
  // ======================================================================
  const C3 = (r, g, b) => new THREE.Color(r, g, b);
  const SKY = { dayTop: C3(0.29, 0.55, 0.93), dayHor: C3(0.68, 0.82, 1.0), nightTop: C3(0.01, 0.015, 0.05), nightHor: C3(0.05, 0.08, 0.18), sunset: C3(1.0, 0.55, 0.3), rain: C3(0.42, 0.46, 0.52) };
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  let flashT = 0;
  function updateSky(dt, camPos) {
    const ang = G.time * Math.PI * 2;
    const sunY = Math.sin(ang);
    const day = smooth(-0.18, 0.25, sunY);
    const sunset = Math.max(0, 1 - Math.abs(sunY) * 3.2) * smooth(-0.3, 0.05, sunY + 0.15);
    let daylight = (0.16 + 0.84 * day) * (1 - 0.38 * G.rain);
    if (flashT > 0) { flashT -= dt; daylight = Math.max(daylight, 1.3); }
    U.daylight.value = daylight;
    U.skyTint.value.setRGB(lerp(0.78, 1, day) + sunset * 0.1, lerp(0.82, 1, day) - sunset * 0.12, lerp(1, 1, day) - sunset * 0.28);
    const top = tmpC.copy(SKY.nightTop).lerp(SKY.dayTop, day);
    const hor = tmpC2.copy(SKY.nightHor).lerp(SKY.dayHor, day).lerp(SKY.sunset, sunset * 0.65);
    if (G.rain > 0) { const rc = SKY.rain.clone().multiplyScalar(0.25 + 0.75 * day); top.lerp(rc, G.rain * 0.8); hor.lerp(rc, G.rain * 0.8); }
    if (flashT > 0) { top.setRGB(0.9, 0.9, 1); hor.setRGB(0.9, 0.9, 1); }
    skyUni.top.value.copy(top); skyUni.horizon.value.copy(hor);
    skyUni.glow.value.setRGB(1, 0.6, 0.3).multiplyScalar(sunset * 0.8 * (1 - G.rain));
    const sd = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.18).normalize();
    skyUni.sunDir.value.copy(sd);
    sun.position.copy(sd).multiplyScalar(700); sun.lookAt(0, 0, 0);
    moon.position.copy(sd).multiplyScalar(-700); moon.lookAt(0, 0, 0);
    sun.material.opacity = 1 - G.rain * 0.9; moon.material.opacity = 1 - G.rain * 0.9;
    stars.material.opacity = (1 - day) * (1 - G.rain);
    const far = settings.dist * 16 - 4;
    let fogC = hor, near = far * 0.5 * (1 - G.rain * 0.45), ff = far * (1 - G.rain * 0.25);
    const head = P.headWater && mode === 'play';
    if (head === 1) { fogC = tmpC.setRGB(0.05, 0.16, 0.42).multiplyScalar(0.3 + 0.7 * daylight); near = 0; ff = 16; }
    else if (head === 2) { fogC = tmpC.setRGB(0.9, 0.35, 0.05); near = 0; ff = 2.5; }
    U.fogColor.value.copy(fogC); U.fogNear.value = near; U.fogFar.value = ff;
    scene.fog = scene.fog || new THREE.Fog(0, 1, 2);
    scene.fog.color.copy(fogC); scene.fog.near = near; scene.fog.far = ff;
    camera.far = Math.max(64, far + 24); camera.updateProjectionMatrix();
    // Облака
    clouds.visible = settings.clouds;
    if (settings.clouds) {
      G.cloudX = (G.cloudX || 0) + dt * 1.2;
      clouds.position.set(camPos.x, WH + 22, camPos.z);
      cloudTex.offset.set((camPos.x + G.cloudX) / 768, -(camPos.z) / 768);
      const cb = 0.25 + 0.75 * day;
      clouds.material.color.setRGB(cb * (1 - G.rain * 0.4), cb * (1 - G.rain * 0.4), cb * (1 - G.rain * 0.35));
      clouds.material.opacity = 0.8 + G.rain * 0.15;
    }
    return { day, sunY };
  }
  function updateWeather(dt) {
    G.weatherT -= dt;
    if (G.weatherT <= 0) { G.weatherT = rand(180, 600); G.rainTarget = Math.random() < 0.3 ? (Math.random() < 0.3 ? 1 : 0.7) : 0; }
    G.rain += (G.rainTarget - G.rain) * Math.min(1, dt * 0.15);
    if (G.rain < 0.002) G.rain = 0;
    const [sk] = world.lightAt(Math.floor(P.x), Math.floor(P.y + 1.6), Math.floor(P.z));
    const show = G.rain > 0.02 && sk >= 10;
    rain.visible = show;
    if (show) {
      rain.material.opacity = 0.45 * G.rain;
      const p = rainPos;
      for (let i = 0; i < RAIN_N; i++) {
        const o = i * 6;
        p[o + 1] -= dt * 26; p[o + 4] -= dt * 26;
        if (p[o + 1] < -14) { const x = rand(-20, 20), z = rand(-20, 20), y = 18; p[o] = p[o + 3] = x; p[o + 2] = p[o + 5] = z; p[o + 1] = y; p[o + 4] = y - 0.7; }
      }
      rainGeo.attributes.position.needsUpdate = true;
      rain.position.set(P.x, P.y + 1, P.z);
    }
    if (Sound.rainGain) Sound.rainGain.gain.value = (show ? 0.25 : 0.06 * (G.rain > 0.02 ? 1 : 0)) * G.rain;
    if (G.rainTarget >= 1 && G.rain > 0.8 && Math.random() < dt * 0.03) { flashT = 0.12; setTimeout(() => Sound.thunder(), rand(200, 1600)); }
  }

  // ======================================================================
  // Предмет в руке и вид от третьего лица
  // ======================================================================
  const handGroup = new THREE.Group();
  hudScene.add(handGroup);
  let handMesh = null, handId = -1;
  const armMat = new THREE.MeshBasicMaterial({ map: TEX.steveSkin });
  function updateHand(dt) {
    const s = held(), id = s ? s.id : 0;
    if (id !== handId) {
      handId = id;
      if (handMesh) { handGroup.remove(handMesh); if (handMesh.material !== armMat) handMesh.material.dispose(); }
      if (id) {
        const g = itemGeometry(id);
        handMesh = new THREE.Mesh(g, itemMat());
        if (g.userData.flat) { handMesh.scale.setScalar(0.55); handMesh.rotation.set(0, -Math.PI / 2 + 0.35, 0.25); handMesh.position.set(0.02, 0.06, 0); }
        else { handMesh.scale.setScalar(0.34); handMesh.rotation.set(0, 0.75, 0); handMesh.position.set(0, 0, 0); }
      } else {
        handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), armMat);
        handMesh.rotation.set(-1.15, 0.1, 0.25); handMesh.position.set(0.05, -0.05, 0);
      }
      handGroup.add(handMesh);
    }
    P.swing = Math.max(0, P.swing - dt * 3.2);
    const sw = Math.sin((1 - P.swing) * Math.PI) * (P.swing > 0 ? 1 : 0);
    const mv = Math.hypot(P.vx, P.vz);
    const bob = settings.bob && P.onGround ? Math.min(1, mv / 4) : 0;
    handGroup.position.set(0.52 + Math.sin(P.bobT) * 0.025 * bob - sw * 0.15, -0.48 - Math.abs(Math.cos(P.bobT)) * 0.03 * bob + sw * 0.12, -0.82 - sw * 0.2);
    handGroup.rotation.set(-sw * 0.9, sw * 0.3, sw * 0.2);
    const br = entBrightness(P.x, P.y + 1.6, P.z);
    handMesh.material.color.setRGB(br, br, br);
    handGroup.visible = !P.third && !P.dead;
  }
  let playerModel = null;
  function updatePlayerModel() {
    if (!playerModel) { playerModel = buildModel('player'); scene.add(playerModel.root); }
    const m = playerModel;
    m.root.visible = P.third && !P.dead;
    if (!m.root.visible) return;
    m.root.position.set(P.x, P.y, P.z);
    m.root.rotation.y = P.yaw + Math.PI;
    const mv = Math.hypot(P.vx, P.vz);
    const sw = Math.sin(P.bobT) * Math.min(0.8, mv * 0.25);
    m.parts.legs[0].rotation.x = sw; m.parts.legs[1].rotation.x = -sw;
    m.parts.arms[0].rotation.x = -sw; m.parts.arms[1].rotation.x = sw - Math.sin((1 - P.swing) * Math.PI) * (P.swing > 0 ? 1.2 : 0);
    m.parts.head.rotation.x = -P.pitch * 0.8;
    const br = entBrightness(P.x, P.y + 1.6, P.z);
    for (const mt of m.mats) mt.color.setRGB(br, br, br);
  }

  // ======================================================================
  // HUD
  // ======================================================================
  const hotbarEl = $('hotbar');
  const hotSlots = [];
  for (let i = 0; i < 9; i++) {
    const d = document.createElement('div'); d.className = 'slot';
    d.addEventListener('pointerdown', () => { inv.sel = i; inv.ver++; showItemName(); });
    hotbarEl.appendChild(d); hotSlots.push(d);
  }
  function slotHTML(s) {
    if (!s) return '';
    let h = `<img src="${iconFor(s.id)}" alt="">`;
    if (s.n > 1) h += `<span class="n">${s.n}</span>`;
    const it = ITEMS[s.id];
    if (it && it.tool && s.dur != null && s.dur < it.tool.dur) { const f = s.dur / it.tool.dur; h += `<span class="dur"><i style="width:${(f * 100).toFixed(0)}%;background:hsl(${(f * 120).toFixed(0)},90%,50%)"></i></span>`; }
    return h;
  }
  let hudVer = -1, hudHP = -1, hudFood = -1, hudAir = -99, hudMode = '';
  const heartsEl = $('hearts'), foodEl = $('food'), airEl = $('air');
  for (let i = 0; i < 10; i++) { heartsEl.appendChild(new Image()); foodEl.appendChild(new Image()); airEl.appendChild(new Image()); }
  function updateHUD() {
    if (inv.ver !== hudVer) {
      hudVer = inv.ver;
      for (let i = 0; i < 9; i++) { hotSlots[i].innerHTML = slotHTML(inv.slots[i]); hotSlots[i].classList.toggle('sel', i === inv.sel); }
      if (uiOpen === 'inv') renderInventory();
    }
    const creative = G.mode === 'creative';
    if (hudMode !== G.mode) { hudMode = G.mode; $('bars').style.visibility = creative ? 'hidden' : 'visible'; $('t-fly').hidden = !creative; }
    const hp = Math.ceil(P.health);
    if (hp !== hudHP) {
      hudHP = hp;
      [...heartsEl.children].forEach((im, i) => { const v = hp - i * 2; im.src = v >= 2 ? HUDI.heart : v === 1 ? HUDI.heartHalf : HUDI.heartEmpty; });
    }
    heartsEl.classList.toggle('blink', P.hurtT > 0 && Math.floor(P.hurtT * 10) % 2 === 0);
    const fd = Math.ceil(P.food);
    if (fd !== hudFood) { hudFood = fd; [...foodEl.children].forEach((im, i) => { const v = fd - i * 2; im.src = v >= 2 ? HUDI.food : v === 1 ? HUDI.foodHalf : HUDI.foodEmpty; }); }
    const air = P.headWater === 1 || P.air < 15 ? Math.ceil(P.air / 1.5) : -1;
    if (air !== hudAir) { hudAir = air; [...airEl.children].forEach((im, i) => { im.src = HUDI.bubble; im.style.visibility = i < air ? 'visible' : 'hidden'; }); }
    $('ov-water').style.opacity = P.headWater === 1 ? 1 : 0;
    $('ov-lava').style.opacity = P.headWater === 2 ? 1 : 0;
    $('ov-hurt').style.opacity = P.hurtT > 0 ? P.hurtT * 2 : (P.health <= 4 && !creative ? 0.35 + Math.sin(performance.now() / 300) * 0.15 : 0);
    const flying = creative && P.flying;
    $('t-up').hidden = !flying; $('t-down').hidden = !flying;
    $('t-fly').classList.toggle('on', P.flying);
    $('t-sneak').classList.toggle('on', input.sprintTouch);
  }
  let nameT = 0;
  function showItemName() {
    const s = held();
    const el = $('itemname');
    el.textContent = s ? ITEMS[s.id].name : '';
    el.style.opacity = 1; nameT = 2;
  }
  function toast(html, cls = '', ms = 2600) {
    const t = document.createElement('div');
    t.className = 'toast ' + cls; t.innerHTML = html;
    $('toasts').appendChild(t);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 600); }, ms);
  }
  function chat(text) {
    const d = document.createElement('div'); d.textContent = text;
    $('chatlog').appendChild(d);
    while ($('chatlog').children.length > 8) $('chatlog').firstChild.remove();
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 1000); }, 7000);
  }
  // Мини-карта
  const MAPC = [];
  for (let b = 0; b < 256; b++) {
    const def = B[b];
    MAPC[b] = def && def.top != null ? tileAvg[def.top] : [0, 0, 0];
  }
  MAPC[ID.WATER] = [48, 86, 200]; MAPC[ID.ICE] = [160, 200, 250]; MAPC[ID.LAVA] = [255, 110, 20];
  const mapCv = $('minimap'), mapG = mapCv.getContext('2d');
  const mapImg = mapG.createImageData(160, 160);
  let mapT = 0;
  function drawMap() {
    mapCv.hidden = !settings.map || mapMode === 0;
    $('coords').hidden = !settings.map || mapMode === 0;
    if (mapCv.hidden) return;
    mapCv.classList.toggle('big', mapMode === 2);
    $('coords').style.display = mapMode === 2 ? 'none' : '';
    const scale = mapMode === 2 ? 2 : 1;
    const px0 = Math.floor(P.x), pz0 = Math.floor(P.z), d = mapImg.data;
    let lastCh = null, lastKey = null;
    for (let my = 0; my < 160; my++) for (let mx = 0; mx < 160; mx++) {
      const x = px0 + (mx - 80) * scale, z = pz0 + (my - 80) * scale;
      const key = ((x >> 4) + 32768) * 65536 + ((z >> 4) + 32768);
      const ch = key === lastKey ? lastCh : (lastCh = world.chunks.get(key), lastKey = key, lastCh);
      const o = (my * 160 + mx) * 4;
      if (!ch) { d[o] = 18; d[o + 1] = 20; d[o + 2] = 28; d[o + 3] = 255; continue; }
      const i = (x & 15) * 16 + (z & 15), b = ch.mapB[i], h = ch.mapH[i];
      const c = MAPC[b] || [0, 0, 0];
      let k = 0.75 + (h - SEA) / 140;
      if (b === ID.WATER) { let depth = 0; const base = ((x & 15) * 16 + (z & 15)) * WH; for (let y = h; y > 0 && ch.data[base + y] === ID.WATER; y--) depth++; k = 1.15 - Math.min(depth, 20) / 28; }
      else {
        const zn = z - 1, chn = world.chunks.get(((x >> 4) + 32768) * 65536 + ((zn >> 4) + 32768));
        if (chn) { const hn = chn.mapH[(x & 15) * 16 + (zn & 15)]; k *= h > hn ? 1.12 : h < hn ? 0.86 : 1; }
      }
      d[o] = clamp(c[0] * k, 0, 255); d[o + 1] = clamp(c[1] * k, 0, 255); d[o + 2] = clamp(c[2] * k, 0, 255); d[o + 3] = 255;
    }
    mapG.putImageData(mapImg, 0, 0);
    for (const e of ents) {
      if (e.kind !== 'mob') continue;
      const mx = 80 + (e.x - P.x) / scale, my = 80 + (e.z - P.z) / scale;
      if (mx < 0 || my < 0 || mx > 160 || my > 160) continue;
      mapG.fillStyle = e.def.hostile ? '#ff3b3b' : '#ffb3d0';
      mapG.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
    const sx = 80 + (G.spawn.x - P.x) / scale, sz = 80 + (G.spawn.z - P.z) / scale;
    if (sx > 0 && sz > 0 && sx < 160 && sz < 160) { mapG.fillStyle = '#ffd447'; mapG.fillRect(sx - 2, sz - 2, 4, 4); }
    mapG.save(); mapG.translate(80, 80); mapG.rotate(-P.yaw);
    mapG.fillStyle = '#fff'; mapG.strokeStyle = '#000'; mapG.lineWidth = 1.5;
    mapG.beginPath(); mapG.moveTo(0, -7); mapG.lineTo(5, 5); mapG.lineTo(0, 2); mapG.lineTo(-5, 5); mapG.closePath(); mapG.fill(); mapG.stroke();
    mapG.restore();
    world.column(Math.floor(P.x), Math.floor(P.z));
    $('coords').textContent = `${Math.floor(P.x)} ${Math.floor(P.y)} ${Math.floor(P.z)} · ${BIOME_NAMES[world._b]}`;
  }

  // ======================================================================
  // Инвентарь и крафт (экран)
  // ======================================================================
  let invStation = 'hand', invTab = 'craft';
  const invGrid = $('inv-grid'), invHot = $('inv-hot');
  const invSlotEls = [];
  for (let i = 0; i < 36; i++) {
    const d = document.createElement('div'); d.className = 'slot'; d.dataset.i = i;
    (i < 9 ? invHot : invGrid).appendChild(d);
    invSlotEls[i] = d;
    d.addEventListener('click', (e) => slotClick(i, e.shiftKey ? 'shift' : 'left'));
    d.addEventListener('contextmenu', (e) => { e.preventDefault(); slotClick(i, 'right'); });
    d.addEventListener('pointerenter', () => showTip(inv.slots[i]));
    d.addEventListener('pointerleave', hideTip);
  }
  function slotClick(i, btn) {
    const s = inv.slots[i], c = inv.cursor;
    Sound.click();
    if (btn === 'shift' && s) {
      const range = i < 9 ? [9, 36] : [0, 9];
      inv.slots[i] = null;
      let n = s.n;
      const max = maxStack(s.id);
      for (let j = range[0]; j < range[1] && n; j++) { const t = inv.slots[j]; if (t && t.id === s.id && t.n < max) { const k = Math.min(n, max - t.n); t.n += k; n -= k; } }
      for (let j = range[0]; j < range[1] && n; j++) if (!inv.slots[j]) { inv.slots[j] = Object.assign({}, s, { n }); n = 0; }
      if (n) inv.slots[i] = Object.assign({}, s, { n });
    } else if (btn === 'right') {
      if (!c && s) { const h = Math.ceil(s.n / 2); inv.cursor = Object.assign({}, s, { n: h }); s.n -= h; if (!s.n) inv.slots[i] = null; }
      else if (c && (!s || (s.id === c.id && s.n < maxStack(s.id)))) { if (!s) inv.slots[i] = Object.assign({}, c, { n: 1 }); else s.n++; c.n--; if (!c.n) inv.cursor = null; }
    } else {
      if (!c) { inv.cursor = s; inv.slots[i] = null; }
      else if (!s) { inv.slots[i] = c; inv.cursor = null; }
      else if (s.id === c.id && maxStack(s.id) > 1) { const k = Math.min(c.n, maxStack(s.id) - s.n); s.n += k; c.n -= k; if (!c.n) inv.cursor = null; }
      else { inv.slots[i] = c; inv.cursor = s; }
    }
    inv.ver++;
    renderCursor();
  }
  function renderCursor() {
    const el = $('cursor-item');
    el.hidden = !inv.cursor;
    if (inv.cursor) el.innerHTML = `<img src="${iconFor(inv.cursor.id)}" alt="">${inv.cursor.n > 1 ? `<span class="n">${inv.cursor.n}</span>` : ''}`;
  }
  addEventListener('pointermove', (e) => {
    const el = $('cursor-item'); el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px';
    const tp = $('tooltip'); tp.style.left = (e.clientX + 16) + 'px'; tp.style.top = (e.clientY + 12) + 'px';
  });
  function showTip(s) {
    if (!s || isTouch) return;
    const it = ITEMS[s.id], tp = $('tooltip');
    let extra = '';
    if (it.tool) extra = `Урон: ${it.tool.dmg} · прочность ${s.dur}/${it.tool.dur}`;
    else if (it.food) extra = `Сытость: +${it.food}`;
    else if (it.fuel) extra = `Топливо: ${it.fuel}`;
    tp.innerHTML = it.name + (extra ? `<small>${extra}</small>` : '');
    tp.hidden = false;
  }
  function hideTip() { $('tooltip').hidden = true; }
  $('inv-trash').addEventListener('click', () => {
    if (!inv.cursor) return;
    if (G.mode !== 'creative') { const d = lookDir(); spawnItem(P.x, P.y + 1.4, P.z, inv.cursor.id, inv.cursor.n, inv.cursor.dur, [d[0] * 6, 2 + d[1] * 6, d[2] * 6]); }
    inv.cursor = null; renderCursor();
  });
  function stationRecipes() {
    if (invStation === 'furnace') return RECIPES.filter((r) => r.st === 'furnace');
    if (invStation === 'table') return RECIPES.filter((r) => r.st !== 'furnace');
    return RECIPES.filter((r) => r.st === 'hand');
  }
  function canCraft(r, times = 1) {
    if (G.mode === 'creative') return true;
    for (const [id, n] of r.in) if (countItem(id) < n * times) return false;
    if (r.st === 'furnace' && fuelAvailable() < times) return false;
    return true;
  }
  function fuelAvailable() {
    let f = G.fuel;
    for (const s of inv.slots) if (s && ITEMS[s.id].fuel) f += ITEMS[s.id].fuel * s.n;
    return Math.floor(f);
  }
  function burnFuel() {
    if (G.fuel >= 1) { G.fuel -= 1; return true; }
    const order = [ID.COAL, ID.LOG, ID.BIRCH_LOG, ID.SPRUCE_LOG, ID.PLANKS, ID.STICK];
    for (const id of order) if (countItem(id)) {
      removeItem(id, 1); G.fuel += ITEMS[id].fuel;
      if (G.fuel >= 1) { G.fuel -= 1; return true; }
    }
    for (let i = 0; i < 36; i++) { const s = inv.slots[i]; if (s && ITEMS[s.id].fuel) { removeItem(s.id, 1); G.fuel += ITEMS[s.id].fuel; if (G.fuel >= 1) { G.fuel -= 1; return true; } } }
    return false;
  }
  function craft(r, times) {
    let made = 0;
    for (let k = 0; k < times; k++) {
      if (!canCraft(r)) break;
      if (G.mode !== 'creative') {
        if (r.st === 'furnace' && !burnFuel()) break;
        for (const [id, n] of r.in) removeItem(id, n);
      }
      const left = addItem(r.out, r.n);
      if (left) spawnItem(P.x, P.y + 1, P.z, r.out, left);
      made++;
    }
    if (!made) return;
    Sound.tone({ type: 'triangle', f0: 520, f1: 780, dur: 0.12, gain: 0.15 });
    if (r.out === ID.TABLE) unlock('bench');
    if (ITEMS[r.out].tool && ITEMS[r.out].tool.kind === 'pickaxe') unlock('pick');
    if (r.out === ID.FURNACE) unlock('furnace');
    if (r.out === ID.IRON && r.st === 'furnace') unlock('iron');
    if (r.out === ID.MEAT_COOKED) unlock('cook');
    onPickup(r.out);
    inv.ver++;
  }
  function renderTabs() {
    const tabs = [];
    if (G.mode === 'creative') tabs.push(['catalog', 'Все блоки']);
    tabs.push(['craft', invStation === 'furnace' ? 'Печь' : invStation === 'table' ? 'Верстак' : 'Крафт']);
    if (!tabs.find((t) => t[0] === invTab)) invTab = tabs[0][0];
    $('inv-tabs').innerHTML = tabs.map(([k, n]) => `<button data-t="${k}" class="${k === invTab ? 'on' : ''}">${n}</button>`).join('');
  }
  $('inv-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; invTab = b.dataset.t; renderInventory(); });
  $('inv-search').addEventListener('input', () => renderInventory());
  function renderInventory() {
    for (let i = 0; i < 36; i++) invSlotEls[i].innerHTML = slotHTML(inv.slots[i]);
    renderTabs();
    $('inv-title').textContent = invStation === 'table' ? 'Верстак' : invStation === 'furnace' ? 'Печь' : 'Инвентарь';
    const cat = invTab === 'catalog';
    $('inv-catalog').hidden = !cat; $('inv-search').hidden = !cat; $('inv-recipes').hidden = cat;
    $('inv-fuel').hidden = cat || invStation !== 'furnace';
    if (cat) {
      const q = $('inv-search').value.trim().toLowerCase();
      const ids = ITEMS.map((it, i) => it && i).filter((i) => i && (!q || ITEMS[i].name.toLowerCase().includes(q)));
      const html = ids.map((id) => `<div class="slot" data-id="${id}" title="${ITEMS[id].name}"><img src="${iconFor(id)}" alt=""></div>`).join('');
      if ($('inv-catalog').dataset.q !== q || !$('inv-catalog').innerHTML) { $('inv-catalog').innerHTML = html; $('inv-catalog').dataset.q = q; }
      return;
    }
    if (invStation === 'furnace') $('inv-fuel').innerHTML = `🔥 Топливо: <b>${fuelAvailable()}</b> плавок (уголь — 8, бревно — 2, доски — 1)`;
    const list = stationRecipes();
    const ok = list.map((r) => canCraft(r));
    const order = list.map((r, i) => i).sort((a, b) => (ok[b] - ok[a]) || 0);
    $('inv-recipes').innerHTML = order.map((i) => {
      const r = list[i], can = ok[i];
      const ing = r.in.map(([id, n]) => `<span class="${G.mode !== 'creative' && countItem(id) < n ? 'miss' : ''}"><img src="${iconFor(id)}" alt="">${n} ${ITEMS[id].name}</span>`).join('');
      const maxTimes = G.mode === 'creative' ? 1 : Math.max(0, Math.min(...r.in.map(([id, n]) => Math.floor(countItem(id) / n)), r.st === 'furnace' ? fuelAvailable() : 99));
      return `<div class="recipe ${can ? '' : 'no'}"><div class="out"><img src="${iconFor(r.out)}" alt="">${r.n > 1 ? `<span class="n">${r.n}</span>` : ''}</div>
        <div><div class="nm">${ITEMS[r.out].name}</div><div class="ing">${ing}${r.st === 'table' && invStation !== 'table' ? '<span>· нужен верстак</span>' : ''}</div></div>
        <div class="acts"><button data-r="${RECIPES.indexOf(r)}" data-x="1" ${can ? '' : 'disabled'}>${r.st === 'furnace' ? 'Плавить' : 'Создать'}</button>${maxTimes > 1 ? `<button data-r="${RECIPES.indexOf(r)}" data-x="${maxTimes}">×${maxTimes}</button>` : ''}</div></div>`;
    }).join('');
  }
  $('inv-recipes').addEventListener('click', (e) => { const b = e.target.closest('button[data-r]'); if (!b || b.disabled) return; craft(RECIPES[+b.dataset.r], +b.dataset.x); });
  $('inv-catalog').addEventListener('click', (e) => {
    const d = e.target.closest('[data-id]'); if (!d) return;
    const id = +d.dataset.id;
    Sound.click();
    if (e.shiftKey || isTouch) { addItem(id, maxStack(id)); }
    else { inv.cursor = newStack(id, maxStack(id)); renderCursor(); }
  });
  function openInventory(station = 'hand') {
    if (uiOpen === 'inv') return;
    invStation = station;
    invTab = G.mode === 'creative' && station === 'hand' ? 'catalog' : 'craft';
    uiOpen = 'inv';
    $('inv').hidden = false;
    if (document.pointerLockElement) document.exitPointerLock();
    input.mouseL = input.mouseR = input.touchBreak = false;
    renderInventory();
  }
  function closeInventory() {
    if (uiOpen !== 'inv') return;
    $('inv').hidden = true; hideTip();
    uiOpen = null;
    if (inv.cursor) { const left = addItem(inv.cursor.id, inv.cursor.n, inv.cursor.dur); if (left) spawnItem(P.x, P.y + 1.2, P.z, inv.cursor.id, left, inv.cursor.dur); inv.cursor = null; renderCursor(); }
    requestLock();
  }
  $('b-inv-close').addEventListener('click', closeInventory);
  $('inv').addEventListener('pointerdown', (e) => { if (e.target === $('inv') && inv.cursor) $('inv-trash').click(); });

  // ======================================================================
  // Команды
  // ======================================================================
  const ALIASES = {};
  for (const k of Object.keys(ID)) ALIASES[k.toLowerCase()] = ID[k];
  for (const k of Object.keys(TOOL)) { ALIASES[k] = TOOL[k]; const [a, b] = k.split('_'); ALIASES[b + '_' + a] = TOOL[k]; }
  Object.assign(ALIASES, { tnt: ID.TNT, wood: ID.LOG, log: ID.LOG, bed: ID.BED, torch: ID.TORCH, meat: ID.MEAT_COOKED });
  function findItem(q) {
    q = q.toLowerCase();
    if (/^\d+$/.test(q) && ITEMS[+q]) return +q;
    if (ALIASES[q] != null && ITEMS[ALIASES[q]]) return ALIASES[q];
    const it = ITEMS.find((x) => x && x.name.toLowerCase() === q) || ITEMS.find((x) => x && x.name.toLowerCase().includes(q));
    return it ? it.id : null;
  }
  function command(line) {
    const [cmd, ...a] = line.replace(/^\//, '').trim().split(/\s+/);
    const say = (t) => chat(t);
    switch ((cmd || '').toLowerCase()) {
      case 'help': say('/time day|night|noon|midnight · /gamemode survival|creative · /give <предмет> [кол-во] · /tp x y z · /spawn pig|sheep|zombie|creeper [n] · /weather clear|rain|thunder · /seed · /heal · /kill · /clear · /explode [r] · /spawnpoint'); break;
      case 'time': { const v = a[0]; const map = { day: 0.02, morning: 0.0, noon: 0.25, sunset: 0.48, night: 0.55, midnight: 0.75 }; const t = map[v] ?? parseFloat(v); if (isNaN(t)) say('Пример: /time day'); else { G.time = ((t % 1) + 1) % 1; say('Время изменено'); } break; }
      case 'gamemode': case 'gm': { const v = (a[0] || '').toLowerCase(); const m = ['creative', 'c', '1', 'творчество'].includes(v) ? 'creative' : ['survival', 's', '0', 'выживание'].includes(v) ? 'survival' : null; if (!m) say('Пример: /gamemode creative'); else { G.mode = m; P.flying = false; say(m === 'creative' ? 'Режим: творчество' : 'Режим: выживание'); inv.ver++; } break; }
      case 'give': { const id = findItem(a[0] || ''); const n = Math.min(64 * 36, parseInt(a[1] || '0') || maxStack(id ?? 1)); if (id == null) say('Не знаю такой предмет'); else { const left = addItem(id, n); say(`Выдано: ${ITEMS[id].name} × ${n - left}`); } break; }
      case 'tp': { const [x, y, z] = a.map(Number); if ([x, y, z].some(isNaN)) say('Пример: /tp 100 80 -50'); else { P.x = x + 0.5; P.y = y; P.z = z + 0.5; P.vy = 0; P.fallStart = null; say('Телепорт!'); } break; }
      case 'spawn': case 'summon': { const t = (a[0] || '').toLowerCase(); const ru = { свинья: 'pig', овца: 'sheep', зомби: 'zombie', крипер: 'creeper' }; const type = MOBS[t] ? t : ru[t]; if (!type) say('Мобы: pig, sheep, zombie, creeper'); else { const n = Math.min(30, parseInt(a[1] || '1') || 1); const d = lookDir(); for (let i = 0; i < n; i++) spawnMob(type, P.x + d[0] * 3 + rand(-1, 1), P.y + 0.5, P.z + d[2] * 3 + rand(-1, 1)); say(`Призвано: ${type} × ${n}`); } break; }
      case 'weather': { const v = a[0]; G.rainTarget = v === 'rain' ? 0.7 : v === 'thunder' ? 1 : 0; G.weatherT = rand(300, 900); say(v === 'clear' ? 'Ясно' : 'Пошёл дождь'); break; }
      case 'seed': say('Сид: ' + world.seedStr); break;
      case 'heal': P.health = 20; P.food = 20; P.sat = 5; say('Здоровье восстановлено'); break;
      case 'kill': P.invT = 0; G.mode === 'creative' ? say('В творчестве нельзя') : (P.health = 0, die('решил начать заново')); break;
      case 'clear': inv.slots.fill(null); inv.ver++; say('Инвентарь очищен'); break;
      case 'explode': { const r = Math.min(10, parseFloat(a[0]) || 4); const t = target && !target.mob ? target : null; if (t) explode(t.x + 0.5, t.y + 0.5, t.z + 0.5, r, 'tnt'); else say('Посмотри на блок'); break; }
      case 'spawnpoint': G.spawn = { x: P.x, y: P.y, z: P.z }; say('Точка возрождения здесь'); break;
      case 'fly': if (G.mode === 'creative') { P.flying = !P.flying; } else say('Полёт только в творчестве'); break;
      default: say('Неизвестная команда. /help — список');
    }
  }
  function openConsole(prefix = '') {
    if (mode !== 'play' || uiOpen) return;
    uiOpen = 'console';
    $('console-wrap').hidden = false;
    const c = $('console'); c.value = prefix;
    if (document.pointerLockElement) document.exitPointerLock();
    setTimeout(() => c.focus(), 0);
  }
  function closeConsole() { $('console-wrap').hidden = true; uiOpen = null; $('console').blur(); requestLock(); }
  $('console').addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { const v = $('console').value.trim(); if (v) { chat('> ' + v); command(v); } closeConsole(); }
    else if (e.key === 'Escape') closeConsole();
  });

  // ======================================================================
  // Экраны и сохранения
  // ======================================================================
  const screens = ['scr-main', 'scr-worlds', 'scr-new', 'scr-settings', 'scr-help', 'scr-pause', 'scr-ach', 'scr-death', 'scr-loading'];
  let backTo = 'scr-main';
  function show(id) { for (const s of screens) $(s).hidden = s !== id; }
  function hide(id) { $(id).hidden = true; }
  const WKEY = 'kubomir.worlds';
  const listWorlds = () => { try { return JSON.parse(localStorage.getItem(WKEY)) || []; } catch { return []; } };
  const saveList = (l) => { try { localStorage.setItem(WKEY, JSON.stringify(l)); } catch { } };
  function renderWorlds() {
    const l = listWorlds().sort((a, b) => b.played - a.played);
    const el = $('world-list');
    if (!l.length) { el.innerHTML = '<div class="empty">Миров пока нет — создай первый!</div>'; return; }
    const MODES = { survival: 'Выживание', creative: 'Творчество' }, TYPES = { normal: 'обычный', amplified: 'высокие горы', islands: 'архипелаг', flat: 'плоский' };
    el.innerHTML = l.map((w) => `<div class="world" data-id="${w.id}" tabindex="0"><b>${escapeHTML(w.name)}</b><button class="btn small danger del" data-del="${w.id}" aria-label="Удалить">✕</button><span>${MODES[w.mode] || ''} · ${TYPES[w.type] || ''} · ${new Date(w.played).toLocaleDateString('ru-RU')}</span></div>`).join('');
  }
  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  $('world-list').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      const id = del.dataset.del, w = listWorlds().find((x) => x.id === id);
      if (w && confirm(`Удалить мир «${w.name}»? Это нельзя отменить.`)) { saveList(listWorlds().filter((x) => x.id !== id)); try { localStorage.removeItem('kubomir.world.' + id); } catch { } renderWorlds(); }
      return;
    }
    const w = e.target.closest('[data-id]');
    if (w) loadWorld(w.dataset.id);
  });
  function saveWorld(quiet = true) {
    if (!world || !G || mode !== 'play') return;
    const data = {
      v: 1, seed: world.seedStr, type: world.type, mode: G.mode, mobs: G.mobs, time: G.time, day: G.day, playTime: G.playTime,
      player: { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch, health: P.health, food: P.food, sat: P.sat, flying: P.flying },
      spawn: G.spawn, sel: inv.sel, inv: inv.slots.map((s) => (s ? [s.id, s.n, s.dur ?? -1] : 0)), fuel: G.fuel, ach: G.ach, stats: G.stats,
      saplings: [...G.saplings], rain: G.rainTarget, edits: world.serializeEdits(),
    };
    try {
      localStorage.setItem('kubomir.world.' + G.id, JSON.stringify(data));
      const l = listWorlds(); const w = l.find((x) => x.id === G.id);
      if (w) { w.played = Date.now(); w.mode = G.mode; saveList(l); }
      if (!quiet) toast('Мир сохранён');
    } catch (e) { toast('Не удалось сохранить: в браузере закончилось место'); }
  }
  function newWorld(name, seed, gm, type, mobs) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const l = listWorlds();
    l.push({ id, name: name || 'Мир', seed, mode: gm, type, created: Date.now(), played: Date.now() });
    saveList(l);
    startWorld({ id, seed, type, mode: gm, mobs });
  }
  function loadWorld(id) {
    let data = null;
    try { data = JSON.parse(localStorage.getItem('kubomir.world.' + id)); } catch { }
    const meta = listWorlds().find((x) => x.id === id);
    if (!data && !meta) { toast('Мир не найден'); return; }
    if (!data) data = { seed: meta.seed, type: meta.type, mode: meta.mode, mobs: true };
    data.id = id;
    startWorld(data);
  }
  const TIPS = [
    'Ударь по дереву, чтобы добыть бревно. Из бревна — доски, из досок — верстак.',
    'Зомби горят на солнце, а криперы — нет. Держись от криперов подальше!',
    'Динамит поджигается правой кнопкой (или касанием).',
    'Алмазы встречаются ниже 18-го блока. Для них нужна железная кирка.',
    'Кровать пропускает ночь и запоминает точку возрождения.',
    'Шифт — осторожный шаг: с края не упадёшь.',
    'Вода, вылитая на лаву, превращает её в обсидиан.',
    'В творчестве дважды нажми пробел, чтобы взлететь.',
    'Команда /give tnt 64 — для любителей громких звуков.',
    'Факелы отпугивают монстров: в светлых местах они не появляются.',
    'Если долго бегать, проголодаешься. Жареное мясо сытнее сырого.',
    'Песок и гравий падают, если под ними пусто.',
  ];
  function startWorld(d) {
    disposeWorld();
    world = new World(d.seed, d.type || 'normal');
    world.loadEdits(d.edits);
    G = {
      id: d.id, mode: d.mode || 'survival', mobs: d.mobs !== false, time: d.time ?? 0.02, day: d.day || 0, playTime: d.playTime || 0,
      spawn: d.spawn || null, fuel: d.fuel || 0, ach: d.ach || {}, stats: d.stats || {}, saplings: new Map(d.saplings || []),
      rain: d.rain || 0, rainTarget: d.rain || 0, weatherT: rand(120, 400), cloudX: 0, fresh: !d.player,
    };
    if (!G.spawn) G.spawn = world.findSpawn();
    const p = d.player || { x: G.spawn.x, y: G.spawn.y, z: G.spawn.z, yaw: rand(0, 6.28), pitch: -0.1, health: 20, food: 20, sat: 5 };
    Object.assign(P, { x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0, pitch: p.pitch || 0, health: p.health ?? 20, food: p.food ?? 20, sat: p.sat ?? 5, flying: !!p.flying, vx: 0, vy: 0, vz: 0, dead: false, air: 15, fallStart: null, exh: 0, invT: 1 });
    inv.slots = new Array(36).fill(null);
    if (d.inv) d.inv.forEach((s, i) => { if (s && ITEMS[s[0]]) inv.slots[i] = { id: s[0], n: s[1], ...(s[2] >= 0 ? { dur: s[2] } : {}) }; });
    else if (G.mode === 'creative') [ID.GRASS, ID.STONE, ID.PLANKS, ID.LOG, ID.GLASS, ID.BRICK, ID.TORCH, ID.TNT, ID.GLOWSTONE].forEach((id, i) => (inv.slots[i] = newStack(id, 64)));
    inv.sel = d.sel || 0; inv.ver++; inv.cursor = null;
    rebuildOffsets();
    mode = 'loading';
    $('load-title').textContent = G.fresh ? 'Генерация мира…' : 'Загрузка мира…';
    $('load-tip').textContent = TIPS[randi(0, TIPS.length - 1)];
    $('load-bar').style.width = '0%';
    show('scr-loading');
    $('hud').hidden = true; $('touch').hidden = true;
  }
  function finishLoading() {
    mode = 'play';
    if (G.fresh) {
      // Ищем открытое место без деревьев
      for (let i = 0; i < 30; i++) {
        const x = Math.floor(P.x), z = Math.floor(P.z);
        let top = 0;
        for (let y = WH - 1; y > 0; y--) { const b = world.getBlock(x, y, z); if (b && B[b].shape !== 'cross') { top = b; P.y = y + 1; break; } }
        if (top !== ID.LEAVES && top !== ID.BIRCH_LEAVES && top !== ID.SPRUCE_LEAVES && top !== ID.LOG && top !== ID.WATER && top !== ID.CACTUS) break;
        P.x += 1; P.z += 1;
      }
      G.spawn = { x: P.x, y: P.y, z: P.z };
      for (let i = 0; i < 6; i++) {
        const a = rand(0, 6.28), r = rand(8, 24), x = Math.floor(P.x + Math.cos(a) * r), z = Math.floor(P.z + Math.sin(a) * r);
        const ch = world.getChunk(x >> 4, z >> 4);
        if (ch && ch.mapB[(x & 15) * 16 + (z & 15)] === ID.GRASS) spawnMob(Math.random() < 0.5 ? 'pig' : 'sheep', x + 0.5, ch.mapH[(x & 15) * 16 + (z & 15)] + 1, z + 0.5);
      }
      G.fresh = false;
      setTimeout(() => saveWorld(), 500);
    } else placeOnSurface();
    show(null);
    $('hud').hidden = false;
    $('touch').hidden = !isTouch;
    hudVer = -1; hudHP = -1; hudFood = -1; hudAir = -99; hudMode = '';
    toast(isTouch ? 'Левая половина — ходьба, правая — обзор. Касание — поставить, удержание — ломать' : 'Кликни по экрану, чтобы управлять мышью. E — инвентарь, Esc — пауза', '', 5000);
    requestLock();
  }
  function quitToMenu() {
    saveWorld();
    if (document.pointerLockElement) document.exitPointerLock();
    closeInventory();
    $('hud').hidden = true; $('touch').hidden = true;
    paused = false;
    startMenuWorld();
  }

  // ---------- Меню с живой панорамой ----------
  const SPLASH = ['Бесконечный!', 'Теперь с криперами!', 'Сделано из кода!', '100% кубов!', 'Не копай вниз!', 'Ссссс…', 'Как в детстве!', 'Без загрузок!', 'Алмазы внизу!', 'Тыквы светятся!', 'Работает на телефоне!', 'Ночь тёмная!', 'Динамит в комплекте!'];
  let menuYaw = 0;
  function startMenuWorld() {
    disposeWorld();
    world = new World('menu-' + randi(0, 99999), 'normal');
    G = { mode: 'creative', time: rand(0.05, 0.4), rain: 0, rainTarget: 0, weatherT: 9999, ach: {}, stats: {}, saplings: new Map(), spawn: { x: 0, y: 0, z: 0 }, cloudX: 0 };
    const s = world.findSpawn();
    P.x = s.x; P.z = s.z; P.y = s.y + 18; P.headWater = 0;
    rebuildOffsets(Math.min(settings.dist, isTouch ? 4 : 6));
    mode = 'menu';
    show('scr-main');
    $('splash').textContent = SPLASH[randi(0, SPLASH.length - 1)];
  }

  // ======================================================================
  // Управление: клавиатура и мышь
  // ======================================================================
  function requestLock() {
    if (isTouch || mode !== 'play' || uiOpen || paused || P.dead) return;
    try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch { }
  }
  canvas.addEventListener('mousedown', (e) => {
    if (isTouch || mode !== 'play' || uiOpen || paused) return;
    if (!document.pointerLockElement) { requestLock(); return; }
    if (e.button === 0) input.mouseL = true;
    if (e.button === 2) { input.mouseR = true; useCD = 0; }
    if (e.button === 1 && target && !target.mob) { const b = target.b; const id = b === ID.GRASS ? ID.GRASS : b; if (ITEMS[id]) { const i = inv.slots.findIndex((s) => s && s.id === id); if (i >= 0 && i < 9) inv.sel = i; else if (G.mode === 'creative') { inv.slots[inv.sel] = newStack(id, 64); } inv.ver++; showItemName(); } }
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) input.mouseL = false; if (e.button === 2) input.mouseR = false; });
  addEventListener('contextmenu', (e) => { if (mode === 'play') e.preventDefault(); });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas || mode !== 'play' || uiOpen) return;
    const k = 0.0022 * settings.sens;
    P.yaw -= e.movementX * k;
    P.pitch = clamp(P.pitch - e.movementY * k, -1.55, 1.55);
  });
  addEventListener('wheel', (e) => {
    if (mode !== 'play' || uiOpen || paused) return;
    inv.sel = (inv.sel + (e.deltaY > 0 ? 1 : 8)) % 9; inv.ver++; showItemName();
  }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && mode === 'play' && !uiOpen && !paused && !P.dead) openPause();
    input.mouseL = input.mouseR = false;
  });
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (mode !== 'play') return;
    const code = e.code;
    if (code === 'Escape') {
      if (uiOpen === 'inv') { closeInventory(); return; }
      if (paused) { resume(); return; }
      return;
    }
    if (paused || P.dead) return;
    if (uiOpen === 'inv') { if (code === 'KeyE') closeInventory(); return; }
    if (uiOpen) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'F3', 'F5', 'Slash', 'Tab'].includes(code)) e.preventDefault();
    if (code === 'KeyW' && !e.repeat) { const now = performance.now(); if (now - lastW < 280) P.sprint = true; lastW = now; }
    if (code === 'Space' && !e.repeat) {
      const now = performance.now();
      if (G.mode === 'creative' && now - lastSpace < 300) { P.flying = !P.flying; P.vy = 0; }
      lastSpace = now;
    }
    keys.add(code);
    if (/^Digit[1-9]$/.test(code)) { inv.sel = +code.slice(5) - 1; inv.ver++; showItemName(); }
    if (code === 'KeyE') openInventory('hand');
    if (code === 'KeyQ') dropHeld(e.ctrlKey);
    if (code === 'KeyF' && G.mode === 'creative') { P.flying = !P.flying; P.vy = 0; }
    if (code === 'KeyM') { mapMode = (mapMode + 1) % 3; drawMap(); }
    if (code === 'F3') { settings.fps = !settings.fps; saveSettings(); }
    if (code === 'F5') P.third = !P.third;
    if (code === 'KeyT') { e.preventDefault(); openConsole(''); }
    if (code === 'Slash') openConsole('/');
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); input.mouseL = input.mouseR = false; });
  function dropHeld(all) {
    const s = held(); if (!s) return;
    const n = all ? s.n : 1;
    const d = lookDir();
    spawnItem(P.x + d[0] * 0.3, P.y + 1.4, P.z + d[2] * 0.3, s.id, n, s.dur, [d[0] * 6, 2 + d[1] * 6, d[2] * 6]);
    if (G.mode !== 'creative') { s.n -= n; if (!s.n) inv.slots[inv.sel] = null; }
    inv.ver++;
  }

  // ---------- Сенсорное управление ----------
  if (isTouch) {
    const stick = $('stick');
    let moveId = null, mx0 = 0, my0 = 0, autoSprint = false;
    $('t-move').addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (moveId !== null) return;
      moveId = e.pointerId; mx0 = e.clientX; my0 = e.clientY;
      stick.style.left = mx0 + 'px'; stick.style.top = my0 + 'px'; stick.classList.add('on'); stick.firstChild.style.transform = '';
      $('stick-hint').hidden = true;
      $('t-move').setPointerCapture(e.pointerId);
    });
    $('t-move').addEventListener('pointermove', (e) => {
      if (e.pointerId !== moveId) return;
      let dx = e.clientX - mx0, dy = e.clientY - my0;
      const l = Math.hypot(dx, dy), max = 55;
      if (l > max) { dx = dx / l * max; dy = dy / l * max; }
      stick.firstChild.style.transform = `translate(${dx}px,${dy}px)`;
      input.str = Math.abs(dx) > 8 ? dx / max : 0;
      input.fwd = Math.abs(dy) > 8 ? -dy / max : 0;
      if (dy < -max * 0.95 && !input.sprintTouch) { input.sprintTouch = true; autoSprint = true; }
    });
    const endMove = (e) => { if (e.pointerId !== moveId) return; moveId = null; input.fwd = input.str = 0; stick.classList.remove('on'); if (autoSprint) { input.sprintTouch = false; autoSprint = false; } };
    $('t-move').addEventListener('pointerup', endMove);
    $('t-move').addEventListener('pointercancel', endMove);
    let lookId = null, lx = 0, ly = 0, lt = 0, ldrag = 0, lholdTimer = null;
    $('t-look').addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (lookId !== null) return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY; lt = performance.now(); ldrag = 0;
      $('t-look').setPointerCapture(e.pointerId);
      clearTimeout(lholdTimer);
      lholdTimer = setTimeout(() => { if (lookId === e.pointerId && ldrag < 12) input.touchBreak = true; }, 280);
    });
    $('t-look').addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      ldrag += Math.abs(dx) + Math.abs(dy);
      const k = 0.0055 * settings.sens;
      P.yaw -= dx * k; P.pitch = clamp(P.pitch - dy * k, -1.55, 1.55);
    });
    const endLook = (e) => {
      if (e.pointerId !== lookId) return;
      lookId = null; clearTimeout(lholdTimer);
      if (!input.touchBreak && ldrag < 12 && performance.now() - lt < 280 && mode === 'play' && !uiOpen) {
        if (target && target.mob) attack(target.mob); else useAction();
      }
      input.touchBreak = false;
    };
    $('t-look').addEventListener('pointerup', endLook);
    $('t-look').addEventListener('pointercancel', endLook);
    const hold = (id, on, off) => {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); on(); });
      el.addEventListener('pointerup', (e) => { e.preventDefault(); off && off(); });
      el.addEventListener('pointercancel', () => off && off());
    };
    hold('t-jump', () => {
      const now = performance.now();
      if (G.mode === 'creative' && now - lastSpace < 300) { P.flying = !P.flying; P.vy = 0; }
      lastSpace = now; input.jump = true;
    }, () => (input.jump = false));
    hold('t-up', () => (input.jump = true), () => (input.jump = false));
    hold('t-down', () => (input.down = true), () => (input.down = false));
    hold('t-break', () => (input.touchBreak = true), () => (input.touchBreak = false));
    hold('t-place', () => { input.mouseR = true; useCD = 0; }, () => (input.mouseR = false));
    hold('t-sneak', () => (input.sprintTouch = !input.sprintTouch));
    hold('t-fly', () => { if (G.mode === 'creative') { P.flying = !P.flying; P.vy = 0; } });
    hold('t-inv', () => (uiOpen === 'inv' ? closeInventory() : openInventory('hand')));
    hold('t-pause', () => openPause());
    hold('t-chat', () => openConsole('/'));
    hold('t-view', () => { P.third = !P.third; });
    // Двойное касание по слоту — выбросить предмет
    let lastSlotTap = 0;
    hotbarEl.addEventListener('pointerdown', () => { const now = performance.now(); if (now - lastSlotTap < 300) dropHeld(false); lastSlotTap = now; });
  }

  // ---------- Пауза ----------
  function openPause() {
    if (mode !== 'play' || P.dead) return;
    paused = true;
    closeInventory();
    if (uiOpen === 'console') closeConsole();
    if (document.pointerLockElement) document.exitPointerLock();
    const day = G.day + 1;
    $('pause-info').textContent = `День ${day} · сид: ${world.seedStr} · ${G.mode === 'creative' ? 'творчество' : 'выживание'}`;
    show('scr-pause');
    saveWorld();
  }
  function resume() { paused = false; show(null); requestLock(); }

  // ---------- Кнопки меню ----------
  const on = (id, f) => $(id).addEventListener('click', () => { Sound.init(); Sound.click(); f(); });
  on('b-play', () => { renderWorlds(); show('scr-worlds'); });
  on('b-worlds-back', () => show('scr-main'));
  on('b-new', () => { $('nw-name').value = 'Мир ' + (listWorlds().length + 1); $('nw-seed').value = ''; show('scr-new'); setTimeout(() => !isTouch && $('nw-name').focus(), 50); });
  on('b-new-back', () => { renderWorlds(); show('scr-worlds'); });
  let nwMode = 'survival';
  $('nw-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; nwMode = b.dataset.v; [...$('nw-mode').children].forEach((x) => x.classList.toggle('on', x === b)); });
  $('new-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const seed = $('nw-seed').value.trim() || String(randi(1, 2147483646));
    newWorld($('nw-name').value.trim(), seed, nwMode, $('nw-type').value, $('nw-mobs').checked);
  });
  on('b-settings', () => { backTo = 'scr-main'; openSettings(); });
  on('b-pause-settings', () => { backTo = 'scr-pause'; openSettings(); });
  on('b-settings-back', () => { saveSettings(); show(backTo); });
  on('b-help', () => { backTo = 'scr-main'; show('scr-help'); });
  on('b-pause-help', () => { backTo = 'scr-pause'; show('scr-help'); });
  on('b-help-back', () => show(backTo));
  on('b-resume', resume);
  on('b-quit', quitToMenu);
  on('b-ach', () => {
    $('ach-list').innerHTML = ACH.map((a) => `<div class="ach ${G.ach[a.id] ? 'done' : ''}"><img src="${iconFor(a.icon)}" alt=""><div><b>${G.ach[a.id] ? '✓ ' : ''}${a.name}</b><span>${a.desc}</span></div></div>`).join('') +
      `<p style="text-align:center">Получено: ${ACH.filter((a) => G.ach[a.id]).length} из ${ACH.length} · блоков поставлено: ${G.stats.placed || 0} · мобов побеждено: ${G.stats.kills || 0}</p>`;
    show('scr-ach');
  });
  on('b-ach-back', () => show('scr-pause'));
  on('b-respawn', respawn);
  on('b-death-quit', () => { P.dead = false; P.health = 20; P.x = G.spawn.x; P.y = G.spawn.y; P.z = G.spawn.z; quitToMenu(); });
  function openSettings() {
    const bind = (id, key, fmt, apply) => {
      const el = $('s-' + id), v = $('v-' + id);
      el.value = settings[key]; v.textContent = fmt(settings[key]);
      el.oninput = () => { settings[key] = parseFloat(el.value); v.textContent = fmt(settings[key]); apply && apply(); };
    };
    bind('dist', 'dist', (x) => `${x} чанков`, () => { if (mode === 'play') rebuildOffsets(); });
    bind('fov', 'fov', (x) => `${x}°`, () => { camera.fov = skyCam.fov = settings.fov; camera.updateProjectionMatrix(); skyCam.updateProjectionMatrix(); });
    bind('sens', 'sens', (x) => x.toFixed(1));
    bind('vol', 'vol', (x) => Math.round(x * 100) + '%', () => Sound.setVol(settings.vol));
    bind('res', 'res', (x) => Math.round(x * 100) + '%', resize);
    const chk = (id, key) => { const el = $('s-' + id); el.checked = !!settings[key]; el.onchange = () => { settings[key] = el.checked; saveSettings(); }; };
    chk('music', 'music'); chk('clouds', 'clouds'); chk('bob', 'bob'); chk('autojump', 'autojump'); chk('map', 'map'); chk('fps', 'fps');
    show('scr-settings');
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saveWorld(); if (mode === 'play' && !paused && !P.dead) openPause(); } });
  addEventListener('beforeunload', () => saveWorld());

  // Текстуры для интерфейса
  function tileURL(t, scale = 4) {
    const c = document.createElement('canvas'); c.width = c.height = 16 * scale;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(atlas, (t % 16) * 16, ((t / 16) | 0) * 16, 16, 16, 0, 0, 16 * scale, 16 * scale);
    return c.toDataURL();
  }
  document.documentElement.style.setProperty('--stone', `url(${tileURL(TILE.stone)})`);
  document.documentElement.style.setProperty('--dirt', `url(${tileURL(TILE.dirt)})`);
  $('logo-text').classList.add('textured');

  // ======================================================================
  // Главный цикл
  // ======================================================================
  let saveT = 60, slowT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.1);
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    U.time.value = now / 1000;
    if (!world) return;
    const camPos = camera.position;

    if (mode === 'menu') {
      menuYaw += dt * 0.05;
      streamChunks(8, Math.floor(P.x / 16), Math.floor(P.z / 16), Math.min(settings.dist, isTouch ? 4 : 6));
      camera.position.set(P.x, P.y, P.z);
      camera.rotation.set(-0.12, menuYaw, 0);
      G.time += dt / 600;
      updateSky(dt, camera.position);
      handGroup.visible = false;
      if (playerModel) playerModel.root.visible = false;
    } else if (mode === 'loading') {
      const pcx = Math.floor(P.x / 16), pcz = Math.floor(P.z / 16);
      streamChunks(40, pcx, pcz);
      let need = 0, have = 0;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { need++; const ch = world.getChunk(pcx + dx, pcz + dz); if (ch && ch.meshed) have++; }
      $('load-bar').style.width = (have / need * 100).toFixed(0) + '%';
      camera.position.set(P.x, P.y + 1.62, P.z);
      updateSky(dt, camera.position);
      if (have === need) finishLoading();
    } else if (mode === 'play') {
      if (!paused) {
        G.playTime += dt;
        const prevTime = G.time;
        G.time += dt / 1200;
        if (G.time >= 1) { G.time -= 1; G.day++; }
        if (prevTime < 0.97 && G.time >= 0.97 || (prevTime > G.time && G.time < 0.02)) { if (G.mode === 'survival' && !P.dead) setTimeout(() => unlock('night'), 0); }
        if (!P.dead) { updatePlayer(dt); updateTarget(); updateActions(dt); }
        for (const e of ents.slice()) {
          if (e.dead) continue;
          if (e.kind === 'item') updateItem(e, dt);
          else if (e.kind === 'mob') updateMob(e, dt);
          else if (e.kind === 'tnt') updateTNT(e, dt);
        }
        // Мобы не залезают друг в друга
        for (let i = 0; i < ents.length; i++) {
          const a = ents[i]; if (a.kind !== 'mob') continue;
          for (let j = i + 1; j < ents.length; j++) {
            const b = ents[j]; if (b.kind !== 'mob') continue;
            const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.w + b.w;
            if (d < m && d > 0.001 && Math.abs(a.y - b.y) < 1.5) { const k = (m - d) * 2; a.vx -= dx / d * k; a.vz -= dz / d * k; b.vx += dx / d * k; b.vz += dz / d * k; }
          }
        }
        trySpawning(dt);
        updateWeather(dt);
        sparks.update(dt); smoke.update(dt);
        // Саженцы растут
        slowT -= dt;
        if (slowT <= 0) {
          slowT = 1;
          for (const [k, t] of G.saplings) {
            if (t > G.playTime) continue;
            const [x, y, z] = k.split(',').map(Number);
            if (!world.isLoaded(x, z)) continue;
            G.saplings.delete(k);
            if (world.getBlock(x, y, z) !== ID.SAPLING) continue;
            const ch = world.growTree(x, y, z, Math.random() < 0.3 ? 'birch' : 'oak');
            for (const [a, b, c] of ch) blockChanged(a, b, c);
            flushUrgent();
          }
        }
        saveT -= dt;
        if (saveT <= 0) { saveT = 60; saveWorld(); }
        Sound.nextMusic -= dt;
        if (Sound.nextMusic <= 0) { Sound.nextMusic = rand(70, 180); Sound.music(); }
      }
      streamChunks(paused ? 4 : 7);
      unloadT -= dt;
      if (unloadT <= 0) { unloadT = 2; unloadFar(Math.floor(P.x / 16), Math.floor(P.z / 16)); }
      // Камера
      const eye = eyePos();
      let bobX = 0, bobY = 0;
      if (settings.bob && P.onGround && !P.flying) { const mv = Math.min(1, Math.hypot(P.vx, P.vz) / 4.3); bobX = Math.sin(P.bobT) * 0.05 * mv; bobY = Math.abs(Math.cos(P.bobT)) * 0.07 * mv; }
      if (shake > 0) { shake = Math.max(0, shake - dt * 1.8); bobX += rand(-1, 1) * shake * 0.3; bobY += rand(-1, 1) * shake * 0.3; }
      const roll = P.hurtT > 0 ? Math.sin(P.hurtT * 20) * 0.04 : 0;
      if (P.third) {
        const d = lookDir();
        const hit = world.raycast(eye[0], eye[1], eye[2], -d[0], -d[1], -d[2], 4.2, (b) => SOLID[b] && B[b].full);
        const dist = hit ? Math.max(0.3, hit.t - 0.25) : 4;
        camera.position.set(eye[0] - d[0] * dist, eye[1] - d[1] * dist, eye[2] - d[2] * dist);
      } else camera.position.set(eye[0] + Math.cos(P.yaw) * bobX, eye[1] + bobY, eye[2] - Math.sin(P.yaw) * bobX);
      camera.rotation.set(P.pitch, P.yaw, roll);
      const targetFov = settings.fov * (P.sprint && Math.hypot(P.vx, P.vz) > 5 ? 1.12 : 1);
      if (Math.abs(camera.fov - targetFov) > 0.1) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix(); }
      updateSky(dt, camera.position);
      updateHand(dt);
      updatePlayerModel();
      updateHUD();
      nameT -= dt; if (nameT <= 0) $('itemname').style.opacity = 0;
      mapT -= dt; if (mapT <= 0) { mapT = 0.25; drawMap(); }
      const dbg = $('debug');
      dbg.hidden = !settings.fps;
      if (settings.fps) {
        const [sk, bl] = world.lightAt(Math.floor(P.x), Math.floor(P.y + 0.5), Math.floor(P.z));
        world.column(Math.floor(P.x), Math.floor(P.z));
        const hh = Math.floor(G.time * 24 + 6) % 24, mm = Math.floor((G.time * 24 * 60) % 60);
        dbg.textContent = `Кубомир · ${fps.toFixed(0)} FPS\nXYZ: ${P.x.toFixed(1)} ${P.y.toFixed(1)} ${P.z.toFixed(1)}\nЧанк: ${Math.floor(P.x) >> 4} ${Math.floor(P.z) >> 4} · загружено ${world.chunks.size}\nБиом: ${BIOME_NAMES[world._b]} · свет: небо ${sk}, блоки ${bl}\nСущностей: ${ents.length} · частиц: ${sparks.n + smoke.n}\nДень ${G.day + 1}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${G.rain > 0.05 ? ' · дождь' : ''}\n${target && !target.mob ? 'Цель: ' + B[target.b].name + ` (${target.x} ${target.y} ${target.z})` : target && target.mob ? 'Цель: ' + target.mob.type + ` ♥${Math.max(0, target.mob.hp)}` : ''}`;
      }
    }
    // Рендер: небо → мир → рука
    skyCam.quaternion.copy(camera.quaternion);
    skyCam.fov = camera.fov; skyCam.updateProjectionMatrix();
    renderer.clear();
    renderer.render(skyScene, skyCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
    if (mode === 'play' && handGroup.visible) { renderer.clearDepth(); hudCam.fov = 70; renderer.render(hudScene, hudCam); }
  }

  // Старт
  startMenuWorld();
  requestAnimationFrame(frame);
  window.__kubomir = { get world() { return world; }, P, inv, G: () => G, command, ents, settings, input, api: { setBlock, spawnMob, spawnTNT, explode, openInventory, closeInventory, breakBlock, placeBlock, flushUrgent, useAction, updateTarget, get target() { return target; }, openPause, resume } };
})();
