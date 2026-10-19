/* Teò: Fifth Sun - visual polish layer (procedural textures, particles, lighting, HUD). Mixed into the Game scene by main.js.
   One light: upper-left, warm. Shared palette below. ?lowfx=1 disables the heavy bits (particles, fog, FX pipelines, god rays). */
'use strict';
const QS = new URLSearchParams(location.search);
const LOWFX = QS.has('lowfx') && QS.get('lowfx') !== '0';
const FXOFF = new Set((QS.get('fxoff') || '').split(','));   // debug: fg,vig,fog,rays,amb,glow,braz
const PAL = { light: '#fff1c8', warm: '#ffb24a', ember: '#ff7a2a', jade: '#3fbf8a', jadeDeep: '#0f5a44', stone: '#8a6a4e', stoneDark: '#3a2618', shadow: '#1a0d06', sky: '#e8b070' };
const hex = (s) => parseInt(s.slice(1), 16);
const LIGHT = { x: -0.6, y: -0.8 };   // direction the light comes FROM (upper left)

const FXM = {
  // ---------- procedural textures ----------
  canvasTex(key, w, h, draw) {
    if (this.textures.exists(key)) return;
    const ct = this.textures.createCanvas(key, w, h); draw(ct.getContext(), w, h); ct.refresh();
  },
  makeFxTextures() {
    const rad = (cx, x, y, r, stops) => { const g = cx.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
    this.canvasTex('fx_soft', 128, 128, (c) => { c.fillStyle = rad(c, 64, 64, 64, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, 128, 128); });
    this.canvasTex('fx_spark', 64, 64, (c) => {
      c.fillStyle = rad(c, 32, 32, 32, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, 64, 64);
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(32, 0); c.quadraticCurveTo(34, 30, 64, 32); c.quadraticCurveTo(34, 34, 32, 64); c.quadraticCurveTo(30, 34, 0, 32); c.quadraticCurveTo(30, 30, 32, 0); c.fill();
    });
    this.canvasTex('fx_flame', 64, 96, (c) => {
      const g = c.createLinearGradient(0, 96, 0, 0); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.5, 'rgba(255,200,90,.9)'); g.addColorStop(1, 'rgba(255,120,30,0)');
      c.filter = 'blur(3px)'; c.fillStyle = g; c.beginPath(); c.moveTo(32, 4); c.bezierCurveTo(52, 40, 58, 70, 32, 90); c.bezierCurveTo(6, 70, 12, 40, 32, 4); c.fill();
    });
    this.canvasTex('fx_smoke', 128, 128, (c) => {
      c.filter = 'blur(6px)';
      for (let i = 0; i < 9; i++) { const x = 40 + Math.random() * 48, y = 40 + Math.random() * 48, r = 18 + Math.random() * 22; c.fillStyle = rad(c, x, y, r, [[0, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, 128, 128); }
    });
    // shading overlay for round things: lit upper-left, core shadow lower-right; and a warm bounce rim on the shadow side
    this.canvasTex('fx_shade', 256, 256, (c) => {
      c.beginPath(); c.arc(128, 128, 126, 0, 7); c.clip();
      c.fillStyle = rad(c, 80, 70, 230, [[0, 'rgba(255,240,200,.18)'], [0.35, 'rgba(0,0,0,0)'], [0.75, 'rgba(26,13,6,.45)'], [1, 'rgba(26,13,6,.7)']]); c.fillRect(0, 0, 256, 256);
    });
    this.canvasTex('fx_rim', 256, 256, (c) => {
      c.fillStyle = 'rgba(255,190,110,1)'; c.beginPath(); c.arc(128, 128, 124, 0, 7); c.fill();
      c.globalCompositeOperation = 'destination-out'; c.filter = 'blur(6px)'; c.beginPath(); c.arc(112, 110, 122, 0, 7); c.fill();
    });
    this.canvasTex('fx_ray', 128, 1024, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 1024); g.addColorStop(0, 'rgba(255,240,200,.9)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      c.filter = 'blur(14px)'; c.fillStyle = g; c.beginPath(); c.moveTo(44, 0); c.lineTo(84, 0); c.lineTo(118, 1024); c.lineTo(10, 1024); c.fill();
    });
    this.canvasTex('fx_vig', 640, 360, (c) => {
      c.fillStyle = rad(c, 300, 160, 420, [[0, 'rgba(255,150,60,.05)'], [0.55, 'rgba(20,8,2,.05)'], [1, 'rgba(20,8,2,.72)']]); c.fillRect(0, 0, 640, 360);
      c.fillStyle = rad(c, 60, 20, 360, [[0, 'rgba(255,214,140,.30)'], [1, 'rgba(255,214,140,0)']]); c.fillRect(0, 0, 640, 360);   // key light bloom, upper left
    });
    this.canvasTex('fx_fog', 1024, 256, (c) => {
      c.filter = 'blur(18px)';
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * 1024, y = 120 + Math.random() * 110, r = 40 + Math.random() * 90;
        for (const ox of [-1024, 0, 1024]) { c.fillStyle = rad(c, x + ox, y, r, [[0, 'rgba(255,225,185,.30)'], [1, 'rgba(255,225,185,0)']]); c.fillRect(0, 0, 1024, 256); }
      }
    });
    // foreground pieces (dark, blurred, lit edge on the left): fern clusters and a broken column. Separate sprites, so only
    // their own pixels cost fill rate (a full-screen tile layer was a measurable hit in software GL)
    const leafs = (c, W, H, cx, n, seed, up) => {
      let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < n; i++) {
        const a = up ? -Math.PI / 2 + (rnd() - 0.5) * 2.6 : Math.PI / 2 + (rnd() - 0.5) * 2.2, l = H * (0.35 + rnd() * 0.6);
        c.save(); c.translate(cx + (rnd() - 0.5) * W * 0.3, up ? H + 6 : -6); c.rotate(a);
        c.fillStyle = rnd() < 0.3 ? '#2e1e10' : '#0e0905'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(l * 0.5, -l * 0.2, l, 0); c.quadraticCurveTo(l * 0.5, l * 0.2, 0, 0); c.fill(); c.restore();
      }
    };
    this.canvasTex('fx_fg_fern', 620, 330, (c, W, H) => { c.filter = 'blur(5px)'; leafs(c, W, H, W / 2, 36, 7, true); });
    this.canvasTex('fx_fg_hang', 420, 260, (c, W, H) => { c.filter = 'blur(5px)'; leafs(c, W, H, W / 2, 18, 11, false); });
    this.canvasTex('fx_fg_pillar', 150, 480, (c, W, H) => {
      c.filter = 'blur(4px)';
      const g = c.createLinearGradient(20, 0, 130, 0); g.addColorStop(0, '#4a2e18'); g.addColorStop(0.22, '#1e120a'); g.addColorStop(1, '#0a0503');
      c.fillStyle = g; c.beginPath(); c.moveTo(28, H); c.lineTo(28, 70); c.lineTo(50, 40); c.lineTo(70, 58); c.lineTo(96, 30); c.lineTo(122, 64); c.lineTo(122, H); c.fill();
      c.fillRect(12, H - 70, 126, 40);
      c.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 110; y < H - 80; y += 70) c.fillRect(28, y, 94, 6);
    });
    // painted brazier: stone bowl on a pedestal, lit from upper left
    this.canvasTex('fx_brazier', 160, 200, (c) => {
      const lin = (x0, x1, a, b, m) => { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(0.35, m); g.addColorStop(1, b); return g; };
      c.fillStyle = lin(50, 110, '#b08a62', '#2e1c10', '#7a5838'); c.fillRect(60, 80, 40, 100);
      c.fillStyle = lin(30, 130, '#c49a6a', '#2a180c', '#7c5a3c'); c.fillRect(36, 172, 88, 24); c.fillRect(48, 160, 64, 14);
      c.fillStyle = lin(10, 150, '#d4aa76', '#2a170a', '#8a6440'); c.beginPath(); c.moveTo(8, 34); c.lineTo(152, 34); c.quadraticCurveTo(140, 92, 80, 96); c.quadraticCurveTo(20, 92, 8, 34); c.fill();
      c.fillStyle = '#e8c48c'; c.fillRect(8, 30, 144, 8);
      c.strokeStyle = 'rgba(40,20,8,.6)'; c.lineWidth = 3; for (let x = 28; x < 140; x += 22) { c.beginPath(); c.moveTo(x, 44); c.lineTo(x + 6, 70); c.stroke(); }
      c.fillStyle = 'rgba(255,140,40,.85)'; c.beginPath(); c.ellipse(80, 34, 64, 8, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,230,160,.8)'; c.beginPath(); c.ellipse(80, 33, 40, 4, 0, 0, 7); c.fill();
    });
    // shaded sphere segment for the serpent body and a flyer (jade hummingbird spirit)
    this.canvasTex('fx_seg', 64, 64, (c) => { c.fillStyle = rad(c, 24, 22, 40, [[0, '#d8ffe8'], [0.25, '#4fcf98'], [0.7, '#14704f'], [1, '#062a1e']]); c.beginPath(); c.arc(32, 32, 30, 0, 7); c.fill(); });
    this.canvasTex('fx_fbody', 128, 80, (c) => {
      c.fillStyle = rad(c, 52, 28, 70, [[0, '#f4ffe0'], [0.2, '#5fd49e'], [0.65, '#16765a'], [1, '#05261c']]); c.beginPath(); c.ellipse(60, 42, 44, 26, 0, 0, 7); c.fill();
      c.fillStyle = '#e8b040'; c.beginPath(); c.moveTo(100, 36); c.lineTo(127, 42); c.lineTo(100, 48); c.fill();
      c.fillStyle = '#ffd47a'; c.beginPath(); c.arc(88, 36, 5, 0, 7); c.fill(); c.fillStyle = '#1a0d06'; c.beginPath(); c.arc(89, 36, 2.5, 0, 7); c.fill();
      c.fillStyle = '#c0402a'; c.beginPath(); c.moveTo(18, 40); c.lineTo(0, 30); c.lineTo(4, 54); c.fill();
    });
    this.canvasTex('fx_wing', 120, 60, (c) => {
      const g = c.createLinearGradient(0, 0, 120, 60); g.addColorStop(0, '#fff2c0'); g.addColorStop(0.3, '#e0a040'); g.addColorStop(1, '#5a2a10');
      c.fillStyle = g; c.beginPath(); c.moveTo(4, 56); c.quadraticCurveTo(30, 0, 118, 4); c.quadraticCurveTo(80, 30, 4, 56); c.fill();
      c.strokeStyle = 'rgba(60,30,10,.5)'; c.lineWidth = 2; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(8, 54); c.lineTo(30 + i * 20, 6 + i * 4); c.stroke(); }
    });
  },

  // ---------- ground height cache (for contact shadows / dust) ----------
  buildSurfaceCache() {
    const n = Math.ceil(this.W / 8) + 1, s = new Float32Array(n).fill(Infinity);
    for (const pl of this.polys) for (let i = 0; i < pl.length - 1; i++) {
      const a = pl[i], c = pl[i + 1]; if (c.x <= a.x) continue;
      for (let k = Math.ceil(a.x / 8); k * 8 <= c.x && k < n; k++) { const y = a.y + (c.y - a.y) * (k * 8 - a.x) / (c.x - a.x); if (y < s[k]) s[k] = y; }
    }
    this.surf = s;
  },
  groundY(x, fromY) {   // first surface at/below fromY
    const k = Math.round(x / 8); if (k < 0 || k >= this.surf.length) return Infinity;
    const y = this.surf[k]; return y >= fromY - 4 ? y : Infinity;
  },
  addShadow(w) { return this.add.image(0, 0, 'fx_soft').setTint(0x1a0d06).setDepth(1.2).setAlpha(0).setData('w', w); },
  placeShadow(sh, x, yBottom) {
    const gy = this.groundY(x, yBottom), d = gy - yBottom, max = 6 * U;
    if (!(d > -8 && d < max)) { sh.setVisible(false); return; }
    const f = 1 - Math.max(0, d) / max, w = sh.getData('w') * (0.55 + 0.45 * f);
    sh.setVisible(true).setPosition(x + Math.max(0, d) * 0.3 + 6, gy - 3).setDisplaySize(w, w * 0.22).setAlpha(0.6 * f);
  },

  // ---------- lighting rig on round sprites ----------
  addLightRig(x, y, diam, depth) {
    const shade = this.add.image(x, y, 'fx_shade').setDepth(depth + 0.1).setDisplaySize(diam, diam);
    const rim = this.add.image(x, y, 'fx_rim').setDepth(depth + 0.2).setDisplaySize(diam, diam).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
    return { shade, rim, set(px, py, sx = 1, sy = 1) { shade.setPosition(px, py).setDisplaySize(diam * sx, diam * sy); rim.setPosition(px, py).setDisplaySize(diam * sx, diam * sy); }, destroy() { shade.destroy(); rim.destroy(); }, fade(sc) { sc.tweens.add({ targets: [shade, rim], alpha: 0, duration: 300 }); } };
  },
  fxGlow(img, color, outer = 4) { if (!FXOFF.has('glow') && !LOWFX && img.preFX) { img.preFX.setPadding(24); return img.preFX.addGlow(color, outer, 0, false, 0.1, 12); } },

  // ---------- particles ----------
  makeParticles() {
    const P = (key, cfg, depth) => { const e = this.add.particles(0, 0, key, Object.assign({ emitting: false }, cfg)); e.setDepth(depth); return e; };
    this.pDust = P('fx_smoke', { lifespan: { min: 400, max: 800 }, speed: { min: 20, max: 90 }, angle: { min: 200, max: 340 }, scale: { start: 0.12, end: 0.45 }, alpha: { start: 0.5, end: 0 }, tint: [0xd8b58a, 0xc49a6a, 0xe8cfa0], gravityY: -20, rotate: { min: 0, max: 360 } }, 5.5);
    this.pSpark = P('fx_spark', { lifespan: { min: 250, max: 500 }, speed: { min: 120, max: 340 }, scale: { start: 0.35, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xfff0b0, 0xffb040, 0xff7a2a], blendMode: 'ADD', gravityY: 300 }, 7);
    this.pJade = P('fx_spark', { lifespan: { min: 350, max: 650 }, speed: { min: 80, max: 260 }, scale: { start: 0.45, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xb8ffd8, 0x3fbf8a, 0xfff1c8], blendMode: 'ADD', gravityY: 120 }, 7);
    this.pPuff = P('fx_smoke', { lifespan: { min: 500, max: 900 }, speed: { min: 40, max: 160 }, scale: { start: 0.25, end: 0.8 }, alpha: { start: 0.65, end: 0 }, tint: [0x8a6a4e, 0x6a5040, 0xb09070], rotate: { min: 0, max: 360 }, gravityY: -30 }, 6.5);
    this.pTrail = P('fx_soft', { lifespan: 260, speed: 10, scale: { start: 0.18, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: 0xffb040, blendMode: 'ADD' }, 5.6);
  },
  burst(em, x, y, n) { if (em) em.explode(LOWFX ? Math.ceil(n / 3) : n, x, y); },

  // ---------- braziers, incense, ambient ----------
  buildBraziers() {
    this.braziers = [];
    if (FXOFF.has('braz')) return;
    const xs = LV.braziers || (this.L.world === 'temple' ? [11, 31, 47.5, 66, 92, 112, 127.5] : []);
    for (const ux of xs) {
      const x = ux * U, gy = this.groundY(x, -1e9); if (!isFinite(gy)) continue;
      const BS = 0.8, im = this.add.image(x, gy + 6, 'fx_brazier').setOrigin(0.5, 1).setDepth(1.5).setScale(BS);
      const top = gy + 6 - 200 * BS + 34 * BS;
      const sh = this.addShadow(120); this.placeShadow(sh, x, gy);
      const pool = this.add.image(x, top - 10, 'fx_soft').setDepth(1.4).setTint(0xff9a3a).setBlendMode(Phaser.BlendModes.ADD).setScale(3.2).setAlpha(0.35);
      this.tweens.add({ targets: pool, alpha: 0.22, scale: 2.9, duration: 120 + Math.random() * 80, yoyo: true, repeat: -1, repeatDelay: Math.random() * 200 });
      const fl = this.add.particles(x, top, 'fx_flame', { lifespan: { min: 380, max: 620 }, speedY: { min: -90, max: -40 }, speedX: { min: -12, max: 12 }, scale: { start: 0.55, end: 0.1 }, alpha: { start: 0.95, end: 0 }, tint: [0xfff0b0, 0xffb040, 0xff6a20], blendMode: 'ADD', frequency: LOWFX ? 90 : 40, x: { min: -14, max: 14 } }).setDepth(1.7);
      let smoke = null;
      if (!LOWFX) smoke = this.add.particles(x, top - 40, 'fx_smoke', { lifespan: { min: 2200, max: 3400 }, speedY: { min: -45, max: -25 }, speedX: { min: 6, max: 22 }, accelerationX: 6, scale: { start: 0.3, end: 1.3 }, alpha: { start: 0.28, end: 0 }, tint: [0x6a5446, 0x8a7060, 0x4a3a30], rotate: { min: 0, max: 360 }, frequency: 180 }).setDepth(1.6);
      this.braziers.push({ im, fl, smoke, pool });
    }
    // incense: thin pale wisps rising from the carved temple props
    if (!LOWFX) for (const d of LV.decor || []) {
      this.add.particles(this.X(d.x), this.Y(d.y - 0.9) - 1.6 * U, 'fx_smoke', { lifespan: 3000, speedY: { min: -30, max: -18 }, speedX: { min: -4, max: 10 }, accelerationX: 4, scale: { start: 0.08, end: 0.6 }, alpha: { start: 0.35, end: 0 }, tint: 0xe8dcc8, frequency: 260 }).setDepth(-0.5);
    }
  },
  buildAmbient() {
    // god rays from the upper left, screen-space, behind the terrain
    if (!LOWFX && !FXOFF.has('rays')) {
      this.rays = [];
      for (let i = 0; i < 5; i++) {
        const r = this.add.image(-60 + i * 210, -40, 'fx_ray').setOrigin(0.5, 0).setScrollFactor(0).setDepth(-95.5 + (i % 2) * 96).setRotation(-0.55)
          .setBlendMode(Phaser.BlendModes.ADD).setScale(1.2 + (i % 3) * 0.5, 1.1).setAlpha(i % 2 ? 0.05 : 0.14);
        this.tweens.add({ targets: r, alpha: r.alpha * 0.35, duration: 3000 + i * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.rays.push(r);
      }
    }
    if (!LOWFX && !FXOFF.has('amb')) {
      const zone = { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, VW, VH) };
      this.ambientEm = [];
      this.ambientEm.push(this.add.particles(0, 0, 'fx_soft', { emitZone: zone, lifespan: 6000, speedY: { min: -18, max: -6 }, speedX: { min: 4, max: 16 }, scale: { start: 0.06, end: 0.02 }, alpha: { start: 0, end: 0.9, ease: 'Sine.inOut' }, tint: [0xff8a2a, 0xffc060], blendMode: 'ADD', frequency: 220 }).setScrollFactor(0).setDepth(9));
      this.ambientEm.push(this.add.particles(0, 0, 'fx_soft', { emitZone: zone, lifespan: 8000, speedY: { min: -6, max: 6 }, speedX: { min: -14, max: -4 }, scale: 0.035, alpha: { start: 0.7, end: 0 }, tint: 0xfff0b0, frequency: 300 }).setScrollFactor(0).setDepth(9));
    }
    // haze between the parallax layers (L1|L2 and L2|L3)
    this.fog = [];
    if (!LOWFX && !FXOFF.has('fog')) for (const [d, a, s, fy] of [[-98.5, 0.75, 0.22, 0.1], [-97.5, 0.55, 0.42, 0.17]]) {
      const ts = this.add.tileSprite(0, VH * 0.42, VW, 256, 'fx_fog').setOrigin(0).setScrollFactor(0).setDepth(d).setAlpha(a).setTileScale(1.6, 1.6).setScale(1, 1.2);
      this.fog.push({ ts, s, fy, y0: VH * 0.42 });
    }
    // foreground silhouettes (in front of the orb, faster scroll, wrap every FGP px)
    this.fgp = [];
    if (!FXOFF.has('fg')) for (const [key, bx, by, sc] of [['fx_fg_fern', 80, 1, 0.7], ['fx_fg_pillar', 620, 1, 0.75], ['fx_fg_fern', 1000, 1, 0.55], ['fx_fg_hang', 1350, 0, 0.75], ['fx_fg_fern', 1800, 1, 0.8], ['fx_fg_pillar', 2350, 1, 0.65], ['fx_fg_hang', 2650, 0, 0.6], ['fx_fg_fern', 2950, 1, 0.65]]) {
      const im = this.add.image(0, 0, key).setOrigin(0, by).setScrollFactor(0).setDepth(50).setScale(sc).setAlpha(0.88);
      this.fgp.push({ im, bx, by });
    }
    // grade: vignette + key-light bloom (upper left)
    if (!FXOFF.has('vig')) this.vig = this.add.image(0, 0, 'fx_vig').setOrigin(0).setDisplaySize(VW, VH).setScrollFactor(0).setDepth(90);
  },
  updateAmbient(time) {
    const cam = this.cameras.main;
    for (const f of this.fog) { f.ts.tilePositionX = cam.scrollX * f.s / 1.6 + time * 0.006 * (f.s * 4); f.ts.y = f.y0 - Math.min(this.extraY, cam.scrollY * f.fy); }
    const FGP = 3200, dy = (this.H - VH - cam.scrollY) * 0.2;
    for (const f of this.fgp) {
      const x = ((f.bx - cam.scrollX * 1.35) % FGP + FGP) % FGP - 700;
      f.im.setVisible(x < VW && x > -f.im.displayWidth); if (f.im.visible) f.im.setPosition(x, (f.by ? VH + 4 : -4) + dy);
    }
  },

  // ---------- HUD ----------
  makeFancyHud() {
    const st = { fontFamily: 'Georgia, serif', fontSize: '24px', color: '#ffe9b0', stroke: '#1a0c04', strokeThickness: 4 };
    const panel = (x, y, w, h) => {
      const g = this.add.graphics().setScrollFactor(0).setDepth(99);
      g.fillStyle(0x0c0604, 0.35).fillRoundedRect(x + 4, y + 5, w, h, 14);
      g.fillStyle(0x2a170c, 0.82).fillRoundedRect(x, y, w, h, 14);
      g.fillStyle(0x4a2c16, 0.6).fillRoundedRect(x + 3, y + 3, w - 6, h * 0.45, { tl: 12, tr: 12, bl: 0, br: 0 });
      g.lineStyle(2, 0xd8a85a, 0.9).strokeRoundedRect(x, y, w, h, 14);
      g.lineStyle(1, 0xfff1c8, 0.25).strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 10);
      return g;
    };
    panel(14, 12, 470, 58);
    this.hudItems = {};
    const item = (key, tex, x, tint) => {
      const ic = this.add.image(x, 41, tex).setScrollFactor(0).setDepth(100); ic.setScale(34 / Math.max(ic.width, ic.height)); if (tint) ic.setTint(tint);
      ic.setData('s', ic.scale);
      const tx = this.add.text(x + 22, 41, '', st).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
      this.hudItems[key] = { ic, tx, shown: 0 };
    };
    item('jade_bead', artKey('jade_bead'), 40, 0); item('pyrite_sphere', 'sun_fragment', 160, 0xe8c060); item('sun_fragment', 'sun_fragment', 270, 0); item('secrets', 'xolotl', 380, 0);
    if (!LOWFX) { const s = this.hudItems.sun_fragment.ic; this.fxGlow(s, 0xffc040, 3); }
    panel(VW - 274, 12, 260, 58);
    this.add.text(VW - 258, 41, 'SCORE', Object.assign({}, st, { fontSize: '16px', color: '#d8a85a' })).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    this.scoreText = this.add.text(VW - 28, 41, '0', Object.assign({}, st, { fontSize: '30px' })).setOrigin(1, 0.5).setScrollFactor(0).setDepth(100);
    this.comboText = this.add.text(VW - 28, 86, '', Object.assign({}, st, { fontSize: '20px', color: '#ffcf6a' })).setOrigin(1, 0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.score = 0; this.scoreShown = 0; this.combo = 0; this.lastScoreT = -1e9;
  },
  refreshHudCounts(pop) {
    const c = this.counts, t = this.totals, v = { jade_bead: [c.jade_bead, t.jade_bead], pyrite_sphere: [c.pyrite_sphere, t.pyrite_sphere], sun_fragment: [c.sun_fragment, t.sun_fragment], secrets: [this.secretsFound, (LV.secrets || []).length] };
    for (const [k, [n, tot]] of Object.entries(v)) {
      const it = this.hudItems[k]; it.tx.setText(n + '/' + tot);
      if (pop && n !== it.shown) {
        this.tweens.killTweensOf([it.ic, it.tx]); it.ic.setScale(it.ic.getData('s')); it.tx.setScale(1);
        this.tweens.add({ targets: it.ic, scale: it.ic.getData('s') * 1.6, duration: 110, yoyo: true, ease: 'Back.out' });
        this.tweens.add({ targets: it.tx, scale: 1.3, duration: 110, yoyo: true });
      }
      it.shown = n;
    }
  },
  addScore(base, x, y, label) {
    const now = this.time.now; this.combo = now - this.lastScoreT < 1500 ? Math.min(this.combo + 1, 8) : 1; this.lastScoreT = now;
    const pts = base * this.combo, from = this.score; this.score += pts;
    if (this.scoreTween) this.scoreTween.stop();
    this.scoreTween = this.tweens.addCounter({ from: this.scoreShown, to: this.score, duration: 600, ease: 'Cubic.out', onUpdate: (tw) => { this.scoreShown = Math.round(tw.getValue()); this.scoreText.setText(this.scoreShown.toLocaleString('en-GB')); } });
    this.tweens.killTweensOf(this.scoreText); this.scoreText.setScale(1);
    this.tweens.add({ targets: this.scoreText, scale: 1.25, duration: 100, yoyo: true });
    if (this.combo > 1) { this.comboText.setText('COMBO x' + this.combo).setAlpha(1).setScale(1.3); this.tweens.killTweensOf(this.comboText); this.tweens.add({ targets: this.comboText, scale: 1, duration: 200, ease: 'Back.out' }); this.tweens.add({ targets: this.comboText, alpha: 0, delay: 1200, duration: 300 }); }
    const ft = this.add.text(x, y - 20, '+' + pts + (label ? ' ' + label : ''), { fontFamily: 'Georgia, serif', fontSize: this.combo > 1 ? '26px' : '22px', color: this.combo > 1 ? '#ffcf6a' : '#fff1c8', stroke: '#2a1206', strokeThickness: 4 }).setOrigin(0.5).setDepth(20).setScale(0.6);
    this.tweens.add({ targets: ft, scale: 1, duration: 140, ease: 'Back.out' });
    this.tweens.add({ targets: ft, y: ft.y - 60, alpha: 0, delay: 300, duration: 700, ease: 'Cubic.out', onComplete: () => ft.destroy() });
  },
  setFx(on) {   // F key: toggle the costly extras at runtime
    this.fxOn = on;
    for (const r of this.rays || []) r.setVisible(on);
    for (const f of this.fog) f.ts.setVisible(on);
    for (const b of this.braziers || []) if (b.smoke) b.smoke.setVisible(on).emitting = on;
    for (const e of this.ambientEm || []) { e.setVisible(on); e.emitting = on; }
    if (this.setFxPolish) this.setFxPolish(on);
  },
  hitFlash(img, ms = 80) { if (!img || !img.setTintFill) return; img.setTintFill(0xfff6e0); this.time.delayedCall(ms, () => img.active && img.clearTint()); },
};
window.TEO_FXM = FXM; window.TEO_LOWFX = LOWFX;
