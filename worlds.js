/* Teò: Fifth Sun - per-world content for Level 2 (Jungle) and Level 3 (Mictlan): enemies, traps, pits, the loop,
   ambient particles and colour grade. Mixed into the Game scene (loaded after fx.js, before main.js). */
'use strict';
// animated sprite strips (384 px frames) made by tools/art/make_sprites2.py
const SHEETS = { jaguar_warrior: 6, poison_frog: 3, macaw: 6, carnivorous_plant: 3, skeleton_dog: 6, bat: 6, lava_jet: 5 };
const WORLD_SPRITES = { jungle: ['jaguar_warrior', 'poison_frog', 'macaw', 'carnivorous_plant', 'cacao_pod'], mictlan: ['skeleton_dog', 'bat', 'sugar_skull', 'lava_jet', 'marigold'] };
// grade per world: fog / foreground / vignette tints, parallax overlay, god rays, collectible halo
const WORLD = {
  temple: { fog: 0xffffff, fg: 0xffffff, vig: 0xffffff, overlay: [0x0a0814, 0.28], rays: 0xffffff, halo: 0x5fe0a8 },
  jungle: { fog: 0xd6f2c8, fg: 0x8fb488, vig: 0xd8efc4, overlay: [0x061a10, 0.22], rays: 0xe6ffc0, halo: 0xffd070 },
  mictlan: { fog: 0x8c7ad0, fg: 0x6a5a90, vig: 0xb4a4e8, overlay: [0x0e0620, 0.30], rays: null, halo: 0xffa040 },
};
const WFX = {
  preloadWorld(L) {
    for (const s of WORLD_SPRITES[L.world] || []) {
      if (this.textures.exists(s)) continue;
      if (SHEETS[s]) this.load.spritesheet(s, V('assets/sprites/' + s + '.png'), { frameWidth: 384, frameHeight: 384 });
      else this.load.image(s, V('assets/sprites/' + s + '.png'));
    }
  },

  // ---------- build ----------
  buildWorld() {
    const W = WORLD[this.L.world] || WORLD.temple; this.wcfg = W;
    // grade
    for (const f of this.fog || []) f.ts.setTint(W.fog);
    for (const f of this.fgp || []) f.im.setTint(W.fg);
    if (this.vig) this.vig.setTint(W.vig);
    if (this.parOverlay) this.parOverlay.setFillStyle(W.overlay[0], W.overlay[1]);
    for (const r of this.rays || []) { if (W.rays === null) r.setVisible(false).setActive(false); else r.setTint(W.rays); }
    if (W.rays === null) this.rays = [];
    this.buildPits(); this.buildJets(); this.buildLoops();
    if (this.L.world !== 'temple' && !LOWFX && !FXOFF.has('amb')) {
      for (const e of this.ambientEm || []) e.destroy();
      this.ambientEm = this.L.world === 'jungle' ? this.jungleAmbient() : this.mictlanAmbient();
    }
  },
  jungleAmbient() {
    if (!this.textures.exists('fx_leaf')) this.canvasTex('fx_leaf', 40, 20, (c) => { const g = c.createLinearGradient(0, 0, 40, 20); g.addColorStop(0, '#d8f08a'); g.addColorStop(1, '#2e6a2a'); c.fillStyle = g; c.beginPath(); c.moveTo(2, 10); c.quadraticCurveTo(20, -4, 38, 10); c.quadraticCurveTo(20, 24, 2, 10); c.fill(); });
    const zone = { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, VW, VH) }, em = [];
    // fireflies: drifting, pulsing yellow-green points
    em.push(this.add.particles(0, 0, 'fx_soft', { emitZone: zone, lifespan: 5000, speedX: { min: -12, max: 12 }, speedY: { min: -10, max: 6 }, scale: { start: 0.07, end: 0.03 }, alpha: { start: 0, end: 1, ease: 'Sine.inOut', yoyo: true }, tint: [0xe8ff80, 0xb8ff70, 0xfff0a0], blendMode: 'ADD', frequency: 160 }).setScrollFactor(0).setDepth(9));
    // falling leaves, tumbling
    em.push(this.add.particles(0, 0, 'fx_leaf', { x: { min: 0, max: VW + 200 }, y: -20, lifespan: 9000, speedY: { min: 30, max: 60 }, speedX: { min: -40, max: -10 }, rotate: { start: 0, end: 540 }, scaleY: { start: 1, end: -1, ease: 'Sine.inOut', yoyo: true }, scale: { min: 0.6, max: 1 }, alpha: 0.85, tint: [0xffffff, 0xd0e090, 0xe0b060], frequency: 700 }).setScrollFactor(0).setDepth(9));
    // waterfall mist at points from the level file
    for (const f of LV.fx || []) if (f.type === 'mist') {
      const x = this.X(f.x), y = this.Y(f.y);
      em.push(this.add.particles(x, y, 'fx_smoke', { lifespan: 2200, speedY: { min: -40, max: -10 }, speedX: { min: -20, max: 30 }, scale: { start: 0.3, end: 1.4 }, alpha: { start: 0.35, end: 0 }, tint: [0xffffff, 0xd8fff0], frequency: 120, x: { min: -40, max: 40 } }).setDepth(2.2));
      em.push(this.add.particles(x, y - 20, 'fx_spark', { lifespan: 700, speed: { min: 30, max: 110 }, angle: { min: 200, max: 340 }, gravityY: 200, scale: { start: 0.2, end: 0 }, tint: 0xe0fff8, blendMode: 'ADD', frequency: 60 }).setDepth(2.3));
    }
    return em;
  },
  mictlanAmbient() {
    const zone = { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, VW, VH) }, em = [];
    // embers rising from below
    em.push(this.add.particles(0, 0, 'fx_soft', { x: { min: 0, max: VW }, y: VH + 10, lifespan: 6000, speedY: { min: -70, max: -25 }, speedX: { min: -15, max: 15 }, scale: { start: 0.07, end: 0.01 }, alpha: { start: 1, end: 0 }, tint: [0xff9a3a, 0xffd070, 0xff5a20], blendMode: 'ADD', frequency: 90 }).setScrollFactor(0).setDepth(9));
    // ghostly wisps
    em.push(this.add.particles(0, 0, 'fx_smoke', { emitZone: zone, lifespan: 7000, speedX: { min: 8, max: 26 }, speedY: { min: -10, max: 4 }, scale: { start: 0.4, end: 1.6 }, alpha: { start: 0, end: 0.22, ease: 'Sine.inOut', yoyo: true }, tint: [0xb8e8ff, 0xd0c0ff], blendMode: 'ADD', frequency: 500 }).setScrollFactor(0).setDepth(8.5));
    // crystal glints along the surface (world space)
    const glints = this.add.particles(0, 0, 'fx_spark', { lifespan: 600, scale: { start: 0, end: 0.5, ease: 'Sine.inOut', yoyo: true }, alpha: 1, tint: [0x7ff8ff, 0xe080ff, 0xffffff], blendMode: 'ADD', emitting: false }).setDepth(7);
    this.time.addEvent({ delay: 140, loop: true, callback: () => { const cam = this.cameras.main, x = cam.scrollX + Math.random() * VW, gy = this.groundY(x, -1e9); if (isFinite(gy)) glints.emitParticleAt(x, gy - Math.random() * 90, 1); } });
    em.push(glints);
    return em;
  },
  buildPits() {
    // kill sensors at the bottom of every pit in the terrain file, plus lava glow / water shimmer
    this.pits = [];
    const s = this.TR.scale;
    this.segs.forEach((r) => (r.sg.pits || []).forEach(([a, b, kind]) => {
      const x0 = r.ox + a * s, x1 = r.ox + b * s, w = x1 - x0, y = this.H - 150 * s;
      this.staticRect(x0, y + 20, w, this.H - y + 200, 'spike', { isSensor: true });
      this.pits.push({ x0, x1, kind });
      if (kind === 'lava') {
        const g = this.add.image(x0 + w / 2, y + 30, 'fx_soft').setTint(0xff7a20).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(w * 1.8, 220).setAlpha(0.5).setDepth(1.1);
        this.tweens.add({ targets: g, alpha: 0.3, duration: 600 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        if (!LOWFX) this.add.particles(x0 + w / 2, y + 20, 'fx_spark', { x: { min: -w / 2, max: w / 2 }, lifespan: 1400, speedY: { min: -120, max: -40 }, scale: { start: 0.3, end: 0 }, tint: [0xffd070, 0xff7a20], blendMode: 'ADD', frequency: 220 }).setDepth(1.2);
      } else {
        const g = this.add.image(x0 + w / 2, y + 30, 'fx_soft').setTint(0x9ffff0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(w * 1.4, 120).setAlpha(0.25).setDepth(1.1);
        this.tweens.add({ targets: g, alpha: 0.12, duration: 1200, yoyo: true, repeat: -1 });
      }
    }));
  },
  buildJets() {
    this.jets = [];
    for (const j of LV.jets || []) {
      const x = this.X(j.x), gy = this.surfaceAt(x);
      const im = this.add.sprite(x, gy + 8, 'lava_jet', 4).setOrigin(0.5, 1).setDepth(3); im.setScale(1.4 * U / 384);
      const glow = this.add.image(x, gy - 60, 'fx_soft').setTint(0xff8a30).setBlendMode(Phaser.BlendModes.ADD).setScale(2.2).setAlpha(0).setDepth(3.1);
      const col = this.add.particles(x, gy - 30, 'fx_flame', { lifespan: { min: 300, max: 520 }, speedY: { min: -520, max: -360 }, speedX: { min: -20, max: 20 }, scale: { start: 0.9, end: 0.2 }, alpha: { start: 1, end: 0 }, tint: [0xfff0b0, 0xffb040, 0xff5a20], blendMode: 'ADD', frequency: LOWFX ? 40 : 16, emitting: false }).setDepth(3.2);
      const smoke = this.add.particles(x, gy - 40, 'fx_smoke', { lifespan: 900, speedY: { min: -60, max: -30 }, scale: { start: 0.2, end: 0.6 }, alpha: { start: 0.4, end: 0 }, tint: 0x5a4a5a, frequency: 120, emitting: false }).setDepth(3.05);
      this.jets.push({ j, x, gy, im, glow, col, smoke, on: false, warn: false, period: (j.period || 2.8) * 1000, dur: (j.on || 1.2) * 1000, off: (j.offset || 0) * 1000 });
    }
  },
  buildLoops() {
    this.loops = [];
    for (const lp of LV.loops || []) {
      const x = this.X(lp.x), gy = this.surfaceAt(x), r = lp.r * U, key = 'fx_loop_' + lp.r;
      if (!this.textures.exists(key)) this.canvasTex(key, Math.ceil(2 * r + 120), Math.ceil(2 * r + 120), (c, w, h) => {
        const cx = w / 2, cy = h / 2, R0 = r + 6, band = 46;
        const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, R0 + band);   // lit from the upper left
        g.addColorStop(0, '#8a78b0'); g.addColorStop(0.7, '#3a2c52'); g.addColorStop(1, '#140c20');
        c.lineWidth = band; c.strokeStyle = g; c.beginPath(); c.arc(cx, cy, R0 + band / 2, 0, 7); c.stroke();
        c.lineWidth = 7; c.strokeStyle = '#e8dcc4'; c.beginPath(); c.arc(cx, cy, R0 + 3, 0, 7); c.stroke();          // bone-white running surface
        c.strokeStyle = 'rgba(255,140,40,.85)'; c.lineWidth = 3; for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; c.beginPath(); c.moveTo(cx + Math.cos(a) * (R0 + 12), cy + Math.sin(a) * (R0 + 12)); c.lineTo(cx + Math.cos(a + 0.12) * (R0 + band - 6), cy + Math.sin(a + 0.12) * (R0 + band - 6)); c.stroke(); }
      });
      const cy = gy - r;
      const im = this.add.image(x, cy, key).setDepth(1.9);
      const glow = this.add.image(x, cy, 'fx_soft').setTint(0xff7a30).setBlendMode(Phaser.BlendModes.ADD).setScale(r / 40).setAlpha(0.18).setDepth(1.85);
      this.tweens.add({ targets: glow, alpha: 0.08, duration: 1400, yoyo: true, repeat: -1 });
      this.add.text(x, cy - r - 70, lp.hint || 'Roll in fast to loop!', { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#ffe9b0', stroke: '#1a0c04', strokeThickness: 5 }).setOrigin(0.5).setDepth(8);
      this.loops.push({ x, cy, r, min: (lp.minSpeed || 7) * U / 60 });
    }
  },

  // ---------- enemies ----------
  makeWorldEnemy(e) {
    const x = this.X(e.x), y = this.Y(e.y), T = e.type;
    const sprite = (key, size, depth = 5) => { const im = SHEETS[key] ? this.add.sprite(x, y, key, 0) : this.add.image(x, y, key); im.setDepth(depth).setScale(size * U / 384); return im; };
    if (T === 'jaguar_warrior' || T === 'skeleton_dog' || T === 'poison_frog') {
      const r = (T === 'poison_frog' ? 0.36 : 0.5) * U;
      const body = this.matter.add.circle(x, y - 4, r, { label: 'enemy', friction: 0.05, frictionAir: 0.01, restitution: 0, density: 0.002, inertia: Infinity });
      const img = sprite(T, T === 'poison_frog' ? 1.05 : T === 'jaguar_warrior' ? 1.9 : 1.7);
      const en = { kind: T, e, body, img, alive: true, home: { x, y: y - 4 }, r, dir: -1, t: Math.random() * 3, s0: img.scale, cd: 1 + Math.random(), face0: T === 'poison_frog' ? 1 : -1, state: 'patrol' };
      en.shadow = this.addShadow(2.6 * r); body.enemy = en; return en;
    }
    if (T === 'carnivorous_plant') {
      const gy = this.surfaceAt(x);
      const img = sprite(T, 1.9, 4).setOrigin(0.5, 0.96).setPosition(x, gy + 6);
      const hy = gy - 1.25 * U;
      const body = this.matter.add.circle(x, hy, 0.62 * U, { isStatic: true, isSensor: true, label: 'enemy' });
      const en = { kind: T, e, body, img, alive: true, t: (e.offset || 0), s0: img.scale, hx: x, hy, phase: 'open', harmless: true, period: e.period || 2.4 };
      en.shadow = this.addShadow(1.4 * U); this.placeShadow(en.shadow, x, gy); body.enemy = en; return en;
    }
    if (T === 'macaw' || T === 'bat') {
      const img = sprite(T, T === 'macaw' ? 1.5 : 1.3);
      const body = this.matter.add.circle(x, y, 0.42 * U, { isStatic: true, isSensor: true, label: 'enemy' });
      const en = { kind: T, e, body, img, alive: true, t: Math.random() * 6, base: { x, y }, s0: img.scale, face0: T === 'macaw' ? 1 : 1, state: 'hover', cd: 1.5 };
      en.shadow = this.addShadow(1.2 * U); body.enemy = en; return en;
    }
    if (T === 'sugar_skull') {
      const img = sprite(T, 1.05);
      const aura = this.add.image(x, y, 'fx_soft').setTint(0x9fe8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.7).setAlpha(0.3).setDepth(4.8);
      const body = this.matter.add.circle(x, y, 0.42 * U, { isStatic: true, isSensor: true, label: 'enemy' });
      const en = { kind: T, e, body, img, aura, alive: true, t: Math.random() * 6, home: { x, y }, pos: { x, y }, s0: img.scale };
      en.shadow = this.addShadow(1.1 * U); body.enemy = en; return en;
    }
    return null;
  },
  updateWorldEnemy(en, p, time, dt) {
    const b = en.body, dx = p.position.x - (b.position.x), dy = p.position.y - b.position.y, dist = Math.hypot(dx, dy);
    en.t += dt;
    const frame = (n, fps) => Math.floor(en.t * fps) % n;
    if (en.kind === 'jaguar_warrior' || en.kind === 'skeleton_dog' || en.kind === 'poison_frog') {
      const pa = en.e.patrol || { xMin: en.e.x - 3, xMax: en.e.x + 3 }, xMin = this.X(pa.xMin), xMax = this.X(pa.xMax);
      const grounded = Math.abs(b.velocity.y) < 0.6 && this.groundY(b.position.x, b.position.y) - b.position.y < en.r + 10;
      en.cd -= dt;
      if (b.position.x < xMin) en.dir = 1; if (b.position.x > xMax) en.dir = -1;
      const near = Math.abs(dx) < 7 * U && Math.abs(dy) < 2.5 * U;
      if (en.kind === 'poison_frog') {
        // hopper: crouch, then leap toward the player (or along its patrol); squash frames
        if (grounded && en.cd <= 0 && en.state !== 'crouch') { en.state = 'crouch'; en.crouchT = 0.22; }
        if (en.state === 'crouch') { en.crouchT -= dt; if (en.crouchT <= 0) { const d = near ? Math.sign(dx) || en.dir : en.dir; MB.setVelocity(b, { x: d * 3.6, y: -8.4 }); en.dir = d; en.state = 'air'; en.cd = 1.1 + Math.random() * 0.7; this.sfx('jump', 0.25, 1.6); } }
        else if (grounded && en.state === 'air' && b.velocity.y >= 0) { en.state = 'idle'; en.land = 1; MB.setVelocity(b, { x: 0, y: b.velocity.y }); }
        const f = en.state === 'crouch' ? 1 : en.state === 'air' ? 2 : 0; en.img.setFrame(f);
        en.land = Math.max(0, (en.land || 0) - dt * 5); const sq = Math.sin(en.land * Math.PI) * 0.18;
        en.img.setScale(en.s0 * (1 + sq), en.s0 * (1 - sq));
      } else if (en.kind === 'jaguar_warrior') {
        // patrol, chase, and pounce when close
        let want = near ? Math.sign(dx) : en.dir;
        if (b.position.x < xMin - 2 * U && want < 0) want = 1; if (b.position.x > xMax + 2 * U && want > 0) want = -1;
        if (grounded) MB.setVelocity(b, { x: Phaser.Math.Linear(b.velocity.x, want * (near ? 4.2 : 2.2), 0.08), y: b.velocity.y });
        if (near && grounded && en.cd <= 0 && Math.abs(dx) < 4.5 * U) { MB.setVelocity(b, { x: Math.sign(dx) * 7, y: -8.5 }); en.cd = 2.2; this.sfx('fire', 0.25, 0.6); }
        en.img.setFrame(grounded ? frame(6, 4 + Math.abs(b.velocity.x) * 2.5) : 2);
        if (Math.abs(b.velocity.x) > 0.3) en.face = Math.sign(b.velocity.x);
      } else {
        // skeleton dog: trots, then on sight crouches (tell) and dashes straight at the player
        if (en.state === 'patrol') {
          MB.setVelocity(b, { x: Phaser.Math.Linear(b.velocity.x, en.dir * 1.6, 0.1), y: b.velocity.y });
          if (near && grounded && en.cd <= 0) { en.state = 'tell'; en.tell = 0.45; en.dashDir = Math.sign(dx) || 1; this.sfx('stone_bonk', 0.3, 1.8); }
        } else if (en.state === 'tell') { MB.setVelocity(b, { x: 0, y: b.velocity.y }); en.tell -= dt; en.img.setTint(0xff9a9a); if (en.tell <= 0) { en.state = 'dash'; en.dash = 0.8; en.img.clearTint(); } }
        else if (en.state === 'dash') { MB.setVelocity(b, { x: en.dashDir * 10.5, y: b.velocity.y }); en.dash -= dt; if (en.dash <= 0) { en.state = 'patrol'; en.cd = 1.6; } }
        en.img.setFrame(en.state === 'tell' ? 0 : frame(6, en.state === 'dash' ? 16 : 6));
        if (Math.abs(b.velocity.x) > 0.3) en.face = Math.sign(b.velocity.x);
      }
      if (en.kind !== 'poison_frog') { const bob = en.state === 'tell' ? 0.06 : 0; en.img.setScale(en.s0 * (1 + bob), en.s0 * (1 - bob)); }
      else if (Math.abs(b.velocity.x) > 0.3) en.face = Math.sign(b.velocity.x);
      en.img.setFlipX((en.face || en.dir) * en.face0 < 0);
      en.img.setPosition(b.position.x, b.position.y - en.img.displayHeight * 0.5 + en.r + 4);
      this.placeShadow(en.shadow, b.position.x, b.position.y + en.r);
      if (b.position.y > this.H) this.killEnemy(en);
      return;
    }
    if (en.kind === 'carnivorous_plant') {
      // open (safe) -> shiver (tell) -> SNAP (dangerous) -> reopen
      const P = en.period, c = ((en.t % (P + 1.1)) + (P + 1.1)) % (P + 1.1);
      const ph = c < P - 0.45 ? 'open' : c < P ? 'tell' : c < P + 0.55 ? 'snap' : 'reopen';
      if (ph !== en.phase) {
        en.phase = ph;
        if (ph === 'snap') { this.sfx('card_impact', 0.25, 1.9); this.tweens.add({ targets: en.img, scaleX: en.s0 * 1.12, scaleY: en.s0 * 0.92, duration: 70, yoyo: true }); }
      }
      en.harmless = ph === 'open' || ph === 'reopen';
      en.img.setFrame(ph === 'snap' ? 2 : ph === 'tell' ? 1 : 0);
      en.img.setAngle(ph === 'tell' ? Math.sin(en.t * 60) * 3 : Math.sin(en.t * 1.7) * 2);
      if (ph === 'snap' && Math.hypot(p.position.x - en.hx, p.position.y - en.hy) < 0.62 * U + R) this.hurt({ x: en.hx, y: en.hy });
      return;
    }
    if (en.kind === 'macaw') {
      const rg = (en.e.range || 3.5) * U, x = en.base.x + Math.sin(en.t * 0.55) * rg, y = en.base.y + Math.sin(en.t * 1.4) * 0.7 * U;
      MB.setPosition(b, { x, y }); en.img.setPosition(x, y).setFrame(frame(6, 11)).setFlipX(Math.cos(en.t * 0.55) < 0).setRotation(Math.cos(en.t * 1.4) * 0.12);
      this.placeShadow(en.shadow, x, y + 0.5 * U); return;
    }
    if (en.kind === 'bat') {
      let x, y;
      if (en.state === 'hover') {
        x = en.base.x + Math.sin(en.t * 0.9) * 0.8 * U; y = en.base.y + Math.sin(en.t * 2.3) * 0.3 * U; en.cd -= dt;
        if (en.cd <= 0 && Math.abs(dx) < 6 * U && dy > 0 && dy < 7 * U) { en.state = 'swoop'; en.s = 0; en.from = { x, y }; en.to = { x: p.position.x, y: p.position.y }; this.sfx('card_whoosh', 0.3, 1.7); }
      } else {
        en.s += dt / 1.3; const s = Math.min(1, en.s), q = s < 0.5 ? s * 2 : 2 - s * 2;   // dive to the target and climb back
        const back = { x: en.from.x + (en.to.x - en.from.x) * 2, y: en.from.y };
        const ax = s < 0.5 ? en.from.x : back.x;
        x = s < 0.5 ? Phaser.Math.Linear(en.from.x, en.to.x, Phaser.Math.Easing.Sine.Out(q)) : Phaser.Math.Linear(en.to.x, en.base.x, 1 - q);
        y = Phaser.Math.Linear(en.from.y, en.to.y, Phaser.Math.Easing.Quadratic.InOut(q));
        if (s >= 1) { en.state = 'hover'; en.cd = 2.2; en.t = 0; }
      }
      MB.setPosition(b, { x, y }); en.img.setPosition(x, y).setFrame(frame(6, en.state === 'swoop' ? 20 : 12));
      this.placeShadow(en.shadow, x, y + 0.5 * U); return;
    }
    if (en.kind === 'sugar_skull') {
      // drifts toward the player when near, otherwise floats back home; bobs and wobbles
      const tgt = dist < 9 * U ? p.position : en.home, vx = tgt.x - en.pos.x, vy = tgt.y - 0.3 * U - en.pos.y, l = Math.hypot(vx, vy) || 1, sp = dist < 9 * U ? 1.5 : 1.0;
      if (l > 4) { en.pos.x += vx / l * sp * dt * 60; en.pos.y += vy / l * sp * dt * 60; }
      const x = en.pos.x, y = en.pos.y + Math.sin(en.t * 2.2) * 0.25 * U;
      MB.setPosition(b, { x, y }); en.img.setPosition(x, y).setRotation(Math.sin(en.t * 1.6) * 0.18).setFlipX(vx < 0);
      en.aura.setPosition(x, y).setAlpha(0.22 + Math.sin(en.t * 3) * 0.1);
      this.placeShadow(en.shadow, x, y + 0.5 * U); return;
    }
  },

  // ---------- per-frame world update: jets, loop ----------
  updateWorld(time, p, grounded, dt) {
    for (const J of this.jets || []) {
      const c = ((time + J.off) % J.period + J.period) % J.period, on = c < J.dur, warn = !on && c > J.period - 550;
      if (on !== J.on) { J.on = on; if (on) { J.col.start(); this.sfx('fire', 0.35, 0.55); } else J.col.stop(); }
      if (warn !== J.warn) { J.warn = warn; if (warn) J.smoke.start(); else J.smoke.stop(); }
      J.im.setFrame(on ? Math.floor(time / 70) % 4 : 4);
      J.glow.setAlpha(on ? 0.55 + Math.sin(time / 50) * 0.1 : warn ? 0.18 + Math.sin(time / 40) * 0.08 : 0);
      if (on && Math.abs(p.position.x - J.x) < 0.5 * U + R * 0.6 && p.position.y > J.gy - 3.0 * U && p.position.y < J.gy + 10) this.hurt({ x: J.x, y: J.gy + 40 });
    }
    // loop-the-loop: rolling in fast enough carries the orb round the ring (scripted along the circle)
    const L = this.looping;
    if (L) {
      L.a -= L.v / L.r * dt * 60;
      const x = L.cx + Math.cos(L.a) * L.r, y = L.cy + Math.sin(L.a) * L.r;
      MB.setPosition(p, { x, y }); MB.setVelocity(p, { x: Math.sin(L.a) * L.v, y: -Math.cos(L.a) * L.v });
      MB.setAngularVelocity(p, L.v / R);
      for (const r of this.pickupRefs) if (!r.taken && r.body && Math.hypot(r.img.x - x, r.img.y - y) < R + 22) this.playerHit(r.body);
      if (L.a <= Math.PI / 2 - Math.PI * 2) { this.looping = null; MB.setPosition(p, { x: L.cx, y: L.cy + L.r }); MB.setVelocity(p, { x: L.v, y: 0 }); this.toast('LOOP!'); this.addScore(500, x, y - 40, 'loop'); this.sfx('star', 0.6); }
      return true;
    }
    for (const lp of this.loops || []) {
      const sp = p.velocity.x;
      if (grounded && Math.abs(p.position.x - lp.x) < 14 && sp >= lp.min && p.position.y > lp.cy) {
        this.looping = { cx: lp.x, cy: lp.cy, r: lp.r - R - 8, a: Math.PI / 2, v: Math.max(sp, lp.min * 1.15) }; this.sfx('card_whoosh', 0.5, 1.3);
      } else if (grounded && Math.abs(p.position.x - lp.x) < 14 && sp > 1 && sp < lp.min && time - (lp.lastHint || 0) > 2500) { lp.lastHint = time; this.toast('Faster! Roll in with speed to loop'); }
    }
    return false;
  },
};
window.TEO_WFX = WFX;
