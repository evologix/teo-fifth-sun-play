/* Teò: Fifth Sun - level table, audio helpers, Title and Complete scenes, game boot. Loaded after fx.js and main.js. */
'use strict';
// Every level plugs in here: level JSON, painted terrain JSON (+ segment PNGs in terrainDir), music key
// (assets/audio/music/<key>.mp3), completion card (assets/ui/<card>.png) and par time for the time star.
const LEVELS = [
  { id: 'level01', name: 'Temple Outskirts', json: 'assets/levels/level01.json', terrain: 'assets/terrain/level01_terrain.json', terrainDir: 'assets/terrain/', music: 'temple', card: 'complete_level01', parTime: 150 },
  // { id: 'level02', name: 'Jungle Roll', json: 'assets/levels/level02.json', terrain: 'assets/terrain/level02_terrain.json', terrainDir: 'assets/terrain/', music: 'jungle', card: 'complete_level02', parTime: 160 },
  // { id: 'level03', name: 'Mictlan Depths', json: 'assets/levels/level03.json', terrain: 'assets/terrain/level03_terrain.json', terrainDir: 'assets/terrain/', music: 'mictlan', card: 'complete_level03', parTime: 180 },
];
const UI_IMG = ['seal', 'logo', 'star', 'star_empty', 'button', 'button_gold'];
function preloadCommon(sc) {
  for (const u of UI_IMG) if (!sc.textures.exists('ui_' + u)) sc.load.image('ui_' + u, V('assets/ui/' + u + '.png'));
  for (const L of LEVELS) if (!sc.textures.exists('ui_' + L.card)) sc.load.image('ui_' + L.card, V('assets/ui/' + L.card + '.png'));
  for (const s of TEX.sfx) if (!sc.cache.audio.exists(s)) sc.load.audio(s, V('assets/audio/sfx/' + s + '.mp3'));
}

// ---------- audio: mute (persisted) + looping music with a short crossfade between scenes ----------
const AUDIO = {
  game: null,
  unlocked() { const s = this.game && this.game.sound; return !!s && !s.locked && (!s.context || s.context.state === 'running'); },
  muted() { try { return localStorage.getItem('teoMute') === '1'; } catch (_) { return false; } },
  setMute(m) { try { localStorage.setItem('teoMute', m ? '1' : '0'); } catch (_) { } if (this.game) this.game.sound.mute = m; this.ui(); },
  toggleMute() { this.setMute(!this.muted()); },
  ui() { const b = document.getElementById('bMute'); if (b) { b.textContent = this.muted() ? '\u{1F507}' : '\u{1F50A}'; b.classList.toggle('on', !this.muted()); } },
};
const MUSIC = {
  cur: null, key: null, FADE: 900,
  play(scene, key, vol = 0.42) {
    if (this.key === key && this.cur && this.cur.isPlaying) return;
    const old = this.cur;
    if (old) scene.tweens.add({ targets: old, volume: 0, duration: this.FADE, onComplete: () => { old.stop(); old.destroy(); } });
    this.cur = null; this.key = key;
    if (!scene.cache.audio.exists(key)) return;
    const m = scene.sound.add(key, { loop: true, volume: 0 }); m.play(); this.cur = m;
    scene.tweens.add({ targets: m, volume: vol, duration: this.FADE });
  },
};
function setMenu(on) { document.body.classList.toggle('menu', on); }
function setupMute() {
  const b = document.getElementById('bMute'); if (!b) return;
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  b.addEventListener('click', (e) => { stop(e); AUDIO.toggleMute(); });
  for (const t of ['pointerdown', 'touchstart', 'mousedown']) b.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
  AUDIO.ui();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupMute); else setupMute();
const TXT = { fontFamily: 'Cinzel, Georgia, serif', fontStyle: 'bold', color: '#ffe9b0', stroke: '#1a0c04', strokeThickness: 6 };

// ---------- Title: the logo assembles from flying shards, explodes with sun rays, the orb rolls in ----------
class Title extends Phaser.Scene {
  constructor() { super('title'); }
  preload() {
    this.load.image('L0_sky', V('assets/bg/L0_sky.jpg')); this.load.image('L2_mid', V('assets/bg/L2_mid.webp')); this.load.image('L3_near', V('assets/bg/L3_near.webp'));
    this.load.image('orb', V('assets/sprites/orb.png')); this.load.image('orb_spec', V('assets/sprites/orb_spec.png'));
    preloadCommon(this);
    this.load.audio('music_title', V('assets/audio/music/title.mp3'));
    const bar = this.add.rectangle(VW / 2 - 200, VH / 2, 0, 8, 0xffd060).setOrigin(0, 0.5);
    this.add.rectangle(VW / 2, VH / 2, 404, 12).setStrokeStyle(2, 0xd8a85a);
    this.load.on('progress', (p) => bar.width = 400 * p);
  }
  create() {
    setMenu(true); this.makeFxTextures();
    this.children.removeAll(true);
    const sky = this.add.image(VW / 2, VH / 2, 'L0_sky'); sky.setScale(Math.max(VW / sky.width, VH / sky.height));
    const mid = this.add.image(VW / 2, VH + 40, 'L2_mid').setOrigin(0.5, 1); mid.setScale(VW * 1.1 / mid.width).setAlpha(0.9);
    const near = this.add.image(VW / 2, VH + 60, 'L3_near').setOrigin(0.5, 1); near.setScale(VW * 1.15 / near.width);
    this.add.rectangle(0, 0, VW, VH, 0x0a0614, 0.45).setOrigin(0);
    const LX = VW / 2, LY = 250;
    this.rays = [];
    for (let i = 0; i < 12; i++) {
      const r = this.add.image(LX, LY, 'fx_ray').setOrigin(0.5, 0).setRotation(i * Math.PI / 6).setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? 0xffc050 : 0xffe9a0).setAlpha(0).setScale(1.1, 0.75);
      this.rays.push(r);
    }
    this.sun = this.add.image(LX, LY, 'fx_soft').setTint(0xffc050).setBlendMode(Phaser.BlendModes.ADD).setScale(0).setAlpha(0.8);
    this.add.particles(0, 0, 'fx_spark', { x: { min: 0, max: VW }, y: VH + 10, speedY: { min: -60, max: -20 }, speedX: { min: -10, max: 10 }, lifespan: 9000, scale: { start: 0.25, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: [0xffd060, 0x5fe0a8, 0xff8a40], blendMode: 'ADD', frequency: LOWFX ? 300 : 90 });
    // logo cut into shards that fly in from all around and lock into place
    const tex = this.textures.get('ui_logo'), src = tex.getSourceImage(), cols = 12, rows = 5, cw = src.width / cols, ch = src.height / rows;
    const sc = 760 / src.width;
    this.logoParts = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const fn = 'p' + i + '_' + j; if (!tex.has(fn)) tex.add(fn, 0, i * cw, j * ch, cw, ch);
      const tx = LX + (i * cw + cw / 2 - src.width / 2) * sc, ty = LY + (j * ch + ch / 2 - src.height / 2) * sc;
      const a = Math.random() * Math.PI * 2, d = 700 + Math.random() * 400;
      const p = this.add.image(LX + Math.cos(a) * d, LY + Math.sin(a) * d, 'ui_logo', fn).setScale(sc * 2.5).setRotation((Math.random() - 0.5) * 8).setAlpha(0);
      this.tweens.add({ targets: p, x: tx, y: ty, rotation: 0, scale: sc, alpha: 1, duration: 900 + Math.random() * 300, delay: 150 + (i + j) * 35, ease: 'Expo.out' });
      this.logoParts.push(p);
    }
    this.logo = this.add.image(LX, LY, 'ui_logo', '__BASE').setScale(sc).setAlpha(0);
    this.time.delayedCall(1600, () => this.explode(true));
    // the orb rolls in along the ground
    this.orb = this.add.image(-80, 560, 'orb'); this.orb.setScale(110 / this.orb.width);
    this.spec = this.add.image(-80, 560, 'orb_spec'); this.spec.setScale(110 / this.spec.width).setAlpha(0.8);
    this.tweens.add({ targets: [this.orb, this.spec], x: LX, duration: 1700, delay: 900, ease: 'Cubic.out' });
    this.tweens.add({ targets: this.orb, rotation: Math.PI * 6, duration: 1700, delay: 900, ease: 'Cubic.out' });
    this.tweens.add({ targets: [this.orb, this.spec], y: 548, duration: 380, delay: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut', repeatDelay: 900 });
    this.prompt = this.add.text(LX, 660, 'Tap / press to start', Object.assign({}, TXT, { fontSize: '34px' })).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: this.prompt, alpha: 1, delay: 2200, duration: 500, onComplete: () => this.tweens.add({ targets: this.prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 }) });
    this.add.text(VW - 16, VH - 12, 'Level 1 - ' + LEVELS[0].name, Object.assign({}, TXT, { fontSize: '16px', strokeThickness: 4 })).setOrigin(1, 1).setAlpha(0.7);
    this.stage = AUDIO.unlocked() ? 1 : 0;
    if (this.stage) MUSIC.play(this, 'music_title', 0.5);
    const go = () => this.onTap();
    this.input.on('pointerdown', go); this.input.keyboard.on('keydown', go);
    window.TEO_TITLE = this;
  }
  explode(first) {
    const LX = VW / 2, LY = 250, cam = this.cameras.main;
    if (first) { this.logoParts.forEach(p => p.destroy()); this.logo.setAlpha(1); }
    this.tweens.add({ targets: this.logo, scale: this.logo.scale * 1.12, duration: 140, yoyo: true, ease: 'Quad.out' });
    cam.flash(350, 255, 230, 170); cam.shake(350, 0.01);
    this.rays.forEach((r, i) => { this.tweens.killTweensOf(r); r.setAlpha(0.6).setScale(1.6, 1.2); this.tweens.add({ targets: r, alpha: 0.22, scaleX: 1.1, scaleY: 0.8, duration: 900 }); this.tweens.add({ targets: r, rotation: r.rotation + Math.PI * 2, duration: 30000, repeat: -1 }); });
    this.tweens.killTweensOf(this.sun); this.sun.setScale(9).setAlpha(1); this.tweens.add({ targets: this.sun, scale: 5, alpha: 0.5, duration: 800, onComplete: () => this.tweens.add({ targets: this.sun, scale: 5.6, alpha: 0.4, duration: 1800, yoyo: true, repeat: -1 }) });
    for (let i = 0; i < 2; i++) { const ring = this.add.circle(LX, LY, 60).setStrokeStyle(8, i ? 0x5fe0a8 : 0xffd060).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: ring, scale: 12, alpha: 0, delay: i * 150, duration: 900, ease: 'Cubic.out', onComplete: () => ring.destroy() }); }
    const em = this.add.particles(LX, LY, 'fx_spark', { speed: { min: 150, max: 700 }, angle: { min: 0, max: 360 }, lifespan: 1400, gravityY: 250, scale: { start: 0.8, end: 0 }, rotate: { min: 0, max: 360 }, tint: [0xffd060, 0x5fe0a8, 0xff6a4a, 0xfff4d8], blendMode: 'ADD', emitting: false, emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-360, -90, 720, 180) } });
    em.explode(LOWFX ? 50 : 140); this.time.delayedCall(1600, () => em.destroy());
    if (AUDIO.unlocked()) this.sound.play('title_boom', { volume: 0.8 });
  }
  onTap() {
    if (this.leaving) return;
    try { if (this.sound.context && this.sound.context.state === 'suspended') this.sound.context.resume(); } catch (_) { }
    if (this.stage === 0) {   // first gesture: unlock audio, boom, title music
      this.stage = 1;
      const kick = () => { this.sound.play('ui_click', { volume: 0.6 }); this.explode(false); MUSIC.play(this, 'music_title', 0.5); };
      if (this.sound.locked) this.sound.once('unlocked', kick); else kick();
      this.prompt.setText('Tap / press to play');
      return;
    }
    this.leaving = true; this.sound.play('ui_click', { volume: 0.6 }); this.sound.play('card_whoosh', { volume: 0.5 });
    this.cameras.main.fadeOut(500, 10, 6, 20);
    this.time.delayedCall(520, () => this.scene.start('game', { level: 0 }));
  }
}
Object.assign(Title.prototype, window.TEO_FXM);

// ---------- Complete: painted sun-stone medallion bursts in, shards + confetti, tweened stats, stars, buttons ----------
class Complete extends Phaser.Scene {
  constructor() { super('complete'); }
  create(st) {
    this.st = st; setMenu(true); const L = LEVELS[st.level];
    const dim = this.add.rectangle(0, 0, VW, VH, 0x0a0614, 0).setOrigin(0); this.tweens.add({ targets: dim, fillAlpha: 0.6, duration: 500 });
    const CX = 400, CY = 350;
    const rays = []; for (let i = 0; i < 10; i++) { const r = this.add.image(CX, CY, 'fx_ray').setOrigin(0.5, 0).setRotation(i * Math.PI / 5).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd060).setAlpha(0).setScale(1.2, 0.6); rays.push(r); this.tweens.add({ targets: r, rotation: r.rotation + Math.PI * 2, duration: 24000, repeat: -1 }); }
    const halo = this.add.image(CX, CY, 'fx_soft').setTint(0xffc050).setBlendMode(Phaser.BlendModes.ADD).setScale(0).setAlpha(0.7);
    const card = this.add.image(CX, CY, 'ui_' + L.card).setScale(0).setRotation(-Math.PI * 2.5);
    const S = 540 / card.width;
    this.sound.play('card_whoosh', { volume: 0.7 });
    this.tweens.add({ targets: card, scale: S * 1.18, rotation: 0.08, duration: 650, ease: 'Cubic.out', onComplete: () => {
      this.impact(CX, CY, rays, halo);
      this.tweens.add({ targets: card, scale: S, rotation: 0, duration: 380, ease: 'Back.out' });
      this.tweens.add({ targets: card, y: CY - 6, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: 400 });
    } });
    this.card = card;
    // stats panel
    const PX = 920; const panel = this.add.graphics().setAlpha(0);
    panel.fillStyle(0x0c0604, 0.4).fillRoundedRect(PX - 214, 136, 440, 400, 22); panel.fillStyle(0x2a170c, 0.9).fillRoundedRect(PX - 220, 130, 440, 400, 22);
    panel.fillStyle(0x4a2c16, 0.55).fillRoundedRect(PX - 216, 134, 432, 150, { tl: 20, tr: 20, bl: 0, br: 0 }); panel.lineStyle(3, 0xd8a85a, 1).strokeRoundedRect(PX - 220, 130, 440, 400, 22);
    this.tweens.add({ targets: panel, alpha: 1, delay: 900, duration: 300 });
    const rows = [['TIME', st.time, (v) => { const m = Math.floor(v / 60), s = v - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }],
      ['JADE', st.jade, (v) => Math.round(v) + ' / ' + st.jadeTotal], ['SECRETS', st.secrets, (v) => Math.round(v) + ' / ' + st.secretsTotal], ['SCORE', st.score, (v) => Math.round(v).toLocaleString('en-GB')]];
    rows.forEach(([label, val, fmt], i) => {
      const y = 170 + i * 58;
      const lt = this.add.text(PX - 190, y, label, Object.assign({}, TXT, { fontSize: '24px', color: '#d8a85a', strokeThickness: 4 })).setAlpha(0);
      const vt = this.add.text(PX + 190, y, fmt(0), Object.assign({}, TXT, { fontSize: '30px', strokeThickness: 5 })).setOrigin(1, 0).setAlpha(0);
      this.tweens.add({ targets: [lt, vt], alpha: 1, delay: 1000 + i * 350, duration: 200 });
      let last = -1;
      this.tweens.addCounter({ from: 0, to: val, delay: 1000 + i * 350, duration: 700, ease: 'Cubic.out', onUpdate: (tw) => { vt.setText(fmt(tw.getValue())); const k = Math.floor(tw.progress * 10); if (k !== last) { last = k; this.sound.play('ui_tick', { volume: 0.25, rate: 0.9 + k * 0.05 }); } },
        onComplete: () => { vt.setText(fmt(val)); this.tweens.add({ targets: vt, scale: 1.25, duration: 90, yoyo: true }); } });
    });
    for (let i = 0; i < 3; i++) {
      const x = PX - 110 + i * 110, y = 438, got = i < st.stars;
      const e = this.add.image(x, y, 'ui_star_empty').setScale(0.42).setAlpha(0); this.tweens.add({ targets: e, alpha: 0.8, delay: 2400, duration: 200 });
      if (got) { const s = this.add.image(x, y, 'ui_star').setScale(0).setRotation(-1.5); this.time.delayedCall(2500 + i * 300, () => { this.sound.play('star', { volume: 0.6, rate: 1 + i * 0.12 }); this.tweens.add({ targets: s, scale: 0.5, rotation: 0, duration: 420, ease: 'Back.out' }); this.burstAt(x, y, 18); }); }
    }
    // buttons
    const hasNext = !!LEVELS[st.level + 1];
    this.btn(PX - 108, 600, 'REPLAY', 'ui_button', () => this.replay(), 3300);
    this.btn(PX + 108, 600, hasNext ? 'NEXT LEVEL' : 'NEXT LEVEL', 'ui_button_gold', () => this.next(), 3400);
    if (!hasNext) this.add.text(PX + 108, 646, 'more levels coming soon', Object.assign({}, TXT, { fontSize: '14px', strokeThickness: 3 })).setOrigin(0.5).setAlpha(0.75);
    this.input.keyboard.on('keydown-ENTER', () => this.next()); this.input.keyboard.on('keydown-R', () => this.replay()); this.input.keyboard.on('keydown-SPACE', () => this.next());
    window.TEO_COMPLETE = this;
  }
  burstAt(x, y, n) { const em = this.add.particles(x, y, 'fx_spark', { speed: { min: 60, max: 260 }, angle: { min: 0, max: 360 }, lifespan: 700, scale: { start: 0.5, end: 0 }, tint: [0xffd060, 0xfff4d8], blendMode: 'ADD', emitting: false }); em.explode(n); this.time.delayedCall(900, () => em.destroy()); }
  impact(x, y, rays, halo) {
    this.sound.play('card_impact', { volume: 0.8 }); this.cameras.main.shake(260, 0.012); this.cameras.main.flash(220, 255, 240, 200);
    rays.forEach(r => this.tweens.add({ targets: r, alpha: 0.35, duration: 400 }));
    halo.setScale(10); this.tweens.add({ targets: halo, scale: 6.5, alpha: 0.45, duration: 600 });
    const ring = this.add.circle(x, y, 270).setStrokeStyle(10, 0xffe080).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    // gold shards
    if (!this.textures.exists('fx_shard')) { const g = this.make.graphics({ add: false }); g.fillStyle(0xffffff).fillTriangle(0, 0, 22, 6, 6, 26); g.generateTexture('fx_shard', 24, 28); g.destroy(); }
    if (!this.textures.exists('fx_conf')) { const g = this.make.graphics({ add: false }); g.fillStyle(0xffffff).fillRect(0, 0, 14, 8); g.generateTexture('fx_conf', 14, 8); g.destroy(); }
    const sh = this.add.particles(x, y, 'fx_shard', { speed: { min: 300, max: 800 }, angle: { min: 0, max: 360 }, gravityY: 900, lifespan: 1500, scale: { start: 1.2, end: 0.4 }, rotate: { start: 0, end: 720 }, tint: [0xffd060, 0xe8a030, 0xfff0b0, 0xb87a20], emitting: false, emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 240) } });
    sh.explode(LOWFX ? 30 : 70);
    const cf = this.add.particles(0, -20, 'fx_conf', { x: { min: 0, max: VW }, speedY: { min: 120, max: 260 }, speedX: { min: -80, max: 80 }, lifespan: 4200, rotate: { start: 0, end: 900 }, scaleY: { start: 1, end: -1, ease: 'Sine.inOut', yoyo: true }, tint: [0xffd060, 0x5fe0a8, 0x40d0e0, 0xff6a4a, 0xff8ac0, 0xfff4d8], frequency: LOWFX ? 60 : 18, quantity: 2 });
    this.time.delayedCall(2600, () => cf.stop());
  }
  btn(x, y, label, tex, cb, delay) {
    const b = this.add.image(x, y, tex).setScale(0.48).setAlpha(0);
    const t = this.add.text(x, y - 2, label, Object.assign({}, TXT, { fontSize: '22px', color: tex === 'ui_button_gold' ? '#3a1c06' : '#06261a', stroke: tex === 'ui_button_gold' ? '#fff0c0' : '#c8ffe4', strokeThickness: 2 })).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [b, t], alpha: 1, delay, duration: 250 });
    this.tweens.add({ targets: b, scale: { from: 0.2, to: 0.48 }, delay, duration: 350, ease: 'Back.out' });
    b.setInteractive({ useHandCursor: true });
    b.on('pointerover', () => b.setScale(0.52)); b.on('pointerout', () => b.setScale(0.48));
    b.on('pointerdown', () => { this.sound.play('ui_click', { volume: 0.7 }); this.tweens.add({ targets: [b, t], scale: '*=0.9', duration: 70, yoyo: true, onComplete: cb }); });
    (this.btns = this.btns || []).push({ label, b });
  }
  replay() { if (this.leaving) return; this.leaving = true; this.scene.stop('game'); this.scene.start('game', { level: this.st.level }); }
  next() {
    if (this.leaving) return; this.leaving = true; const n = this.st.level + 1;
    this.scene.stop('game');
    if (LEVELS[n]) this.scene.start('game', { level: n }); else { MUSIC.play(this, 'music_title', 0.5); this.scene.start('title'); }
  }
}

// ---------- boot ----------
const SKIP_TITLE = QS.has('play') || (navigator.webdriver && !QS.has('title'));   // automated tests start straight in the level
let TEO_PHASER = null;
function bootGame() { if (TEO_PHASER) return; TEO_PHASER = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VW, height: VH,
  backgroundColor: '#120c1c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'matter', matter: { gravity: { y: 1 }, debug: false } },
  input: { mouse: { preventDefaultDown: true } },
  scene: SKIP_TITLE ? [window.TEO_GAME, Title, Complete] : [Title, window.TEO_GAME, Complete],
}); window.TEO_PHASER = TEO_PHASER;
AUDIO.game = TEO_PHASER; TEO_PHASER.sound.mute = AUDIO.muted(); }
// wait (briefly) for the Cinzel webfont so canvas text uses it
try { Promise.race([document.fonts.load('900 30px Cinzel'), new Promise(r => setTimeout(r, 1500))]).then(bootGame, bootGame); } catch (_) { bootGame(); }
