/* Teò: Fifth Sun - v4 polish layer: living sprites (secondary motion, signatures, dissolve deaths, spawn pop-in), orb streaks,
   per-world weather (clouds, gusts, dust devils, rain + lightning, butterflies, birds, lava bubbles, ash, bats, purple crackle),
   dynamic light pools, surface-aware rolling audio, spatial enemy voices, ambience and an SFX/music balance.
   Mixed into the Game scene (loaded after worlds.js, before main.js). ?lowfx=1 / F key drop the heavy layers. */
'use strict';
const SFX_V4 = ['roll_stone', 'roll_sand', 'roll_grass', 'roll_wood', 'roll_obsidian', 'skid', 'scrape', 'whoosh_loop', 'thud', 'v_frog', 'v_macaw', 'v_jaguar',
  'v_bat', 'v_dog', 'v_skull', 'v_serpent', 'v_roller', 'v_plant', 'v_jet', 'thunder', 'crackle', 'amb_temple', 'amb_jungle', 'amb_rain', 'amb_mictlan'];
const SURF_SND = { temple: ['stone', 'sand'], jungle: ['grass', 'wood', 'stone'], mictlan: ['obsidian', 'stone'] };
const VOICE = { poison_frog: 'v_frog', macaw: 'v_macaw', jaguar_warrior: 'v_jaguar', bat: 'v_bat', skeleton_dog: 'v_dog', sugar_skull: 'v_skull', hover: 'v_serpent', roller: 'v_roller', carnivorous_plant: 'v_plant', flyer: 'v_macaw' };
// idle-voice cadence (s) for enemies that call out on their own; the rest speak on actions (hop, pounce, bark, swoop, snap)
const IDLE_VOICE = { macaw: [3, 7], sugar_skull: [4, 8], hover: [4, 9], roller: [3, 6], flyer: [4, 8], jaguar_warrior: [6, 11] };
// eye position as a fraction of the display size (x toward the facing side), and particle signature per enemy kind
const EYE = { jaguar_warrior: [0.22, -0.28], skeleton_dog: [0.3, -0.22], poison_frog: [0.16, -0.18], macaw: [0.28, -0.18], bat: [0.08, -0.08], sugar_skull: [0.14, -0.06], roller: [0.1, -0.12], hover: [0.3, -0.1], carnivorous_plant: [0.05, -0.62], flyer: [0.3, -0.06] };
const SIGN = { jaguar_warrior: 'paw', skeleton_dog: 'bone', poison_frog: 'slime', macaw: 'feather', bat: 'wing', sugar_skull: 'ghost', roller: 'grit', hover: 'jade', carnivorous_plant: 'pollen', flyer: 'jade' };
const SELF_SCALE = new Set(['roller', 'hover', 'poison_frog', 'jaguar_warrior', 'skeleton_dog']);
const PCAP = LOWFX ? 0.3 : 1;   // global particle-count multiplier
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
// audio balance (persisted): SFX includes ambience; music multiplies the per-track base volume
Object.assign(AUDIO_MIX = window.AUDIO_MIX || {}, {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : clamp(+v, 0, 1); } catch (_) { return d; } },
  sfx() { return this.get('teoSfxVol', 1); }, music() { return this.get('teoMusVol', 0.8); },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (_) { } const M = window.MUSIC; if (M && M.cur && M.base !== undefined) try { M.cur.setVolume(M.base * this.music()); } catch (_) { } },
});
var AUDIO_MIX; window.AUDIO_MIX = AUDIO_MIX;
function setupVolume() {
  const b = document.getElementById('bVol'), pn = document.getElementById('volPanel'); if (!b || !pn) return;
  const stop = (e) => { e.stopPropagation(); };
  for (const el of [b, pn]) for (const t of ['pointerdown', 'touchstart', 'mousedown', 'click', 'touchend']) el.addEventListener(t, stop, { passive: true });
  b.addEventListener('click', (e) => { e.preventDefault(); pn.classList.toggle('open'); });
  for (const [id, k, d] of [['volSfx', 'teoSfxVol', 1], ['volMus', 'teoMusVol', 0.8]]) {
    const r = document.getElementById(id); if (!r) continue; r.value = Math.round(AUDIO_MIX.get(k, d) * 100);
    r.addEventListener('input', () => AUDIO_MIX.set(k, r.value / 100));
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupVolume); else setupVolume();

const PFX = {
  preloadPolish() { for (let i = 0; i < 4; i++) if (!this.textures.exists('cloud' + i)) this.load.image('cloud' + i, V('assets/fx/cloud' + i + '.png')); },
  makePolishTextures() {
    const T = (k, w, h, f) => this.canvasTex(k, w, h, f);
    T('fx_streak', 128, 16, (c) => { const g = c.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; c.beginPath(); c.ellipse(64, 8, 64, 5, 0, 0, 7); c.fill(); });
    T('fx_drop', 6, 40, (c) => { const g = c.createLinearGradient(0, 0, 0, 40); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.9)'); c.fillStyle = g; c.fillRect(1, 0, 4, 40); });
    T('fx_dot', 16, 16, (c) => { const g = c.createRadialGradient(8, 8, 0, 8, 8, 8); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 16, 16); });
    T('fx_bfly', 32, 24, (c) => { c.fillStyle = '#fff'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(16 + s * 8, 8, 8, 7, s * 0.5, 0, 7); c.fill(); c.beginPath(); c.ellipse(16 + s * 6, 17, 5, 5, -s * 0.4, 0, 7); c.fill(); } c.fillStyle = '#222'; c.fillRect(15, 4, 2, 17); });
    T('fx_bird', 40, 16, (c) => { c.strokeStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(2, 4); c.quadraticCurveTo(12, 2, 20, 12); c.quadraticCurveTo(28, 2, 38, 4); c.stroke(); });
    T('fx_batsil', 48, 22, (c) => { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(24, 8); c.quadraticCurveTo(14, 0, 2, 4); c.quadraticCurveTo(8, 10, 6, 18); c.quadraticCurveTo(14, 12, 24, 16); c.quadraticCurveTo(34, 12, 42, 18); c.quadraticCurveTo(40, 10, 46, 4); c.quadraticCurveTo(34, 0, 24, 8); c.fill(); });
    T('fx_shimmer', 256, 256, (c) => { c.strokeStyle = 'rgba(255,240,210,.5)'; c.lineWidth = 2; c.filter = 'blur(2px)'; for (let x = 0; x < 256; x += 16) { c.beginPath(); for (let y = 0; y <= 256; y += 8) c.lineTo(x + Math.sin(y / 256 * Math.PI * 4 + x) * 5, y); c.stroke(); } });
  },
  P(key, cfg, depth, max) { const e = this.add.particles(0, 0, key, Object.assign({ emitting: false, maxParticles: Math.max(4, Math.round(max * PCAP)) }, cfg)); e.setDepth(depth); return e; },

  // ---------- build ----------
  buildPolish() {
    this.makePolishTextures();
    const W = this.L.world, now = this.time.now;
    this.pol = { world: W, t: 0, gust: 0, gustT: now + 6000, devilT: now + 9000, rain: 0, rainOn: W === 'jungle', rainT: now + 16000, boltT: now + (W === 'jungle' ? 3500 : 9000), heavy: [], flash: 0, surf: SURF_SND[W] ? SURF_SND[W][0] : 'stone', surfT: 0, hist: [], skidT: 0, flyT: now + 2500 };
    const heavy = (o) => { this.pol.heavy.push(o); return o; };
    // drifting painterly clouds at three parallax depths (one in low-FX)
    this.clouds = [];
    const ct = { temple: [0xfff0dc, 0.8], jungle: [0xe0f0d8, 0.6], mictlan: [0x7a5aa8, 0.32] }[W] || [0xffffff, 0.7];
    const layers = [[-99.6, 0.03, 0.55, 0.9, 4, 0.004], [-98.9, 0.1, 0.85, 0.75, 3, 0.008], [-97.3, 0.22, 1.25, 0.55, 3, 0.014]];
    layers.forEach(([d, fx, sc, a, n, drift], li) => {
      if (LOWFX && li > 0) return;
      for (let i = 0; i < n; i++) {
        const im = this.add.image(0, 0, 'cloud' + ((i + li) % 4)).setScrollFactor(0).setDepth(d).setScale(sc * (0.8 + Math.random() * 0.5)).setAlpha(ct[1] * a).setTint(ct[0]).setFlipX(Math.random() < 0.5);
        const c = { im, fx, drift: drift * (0.7 + Math.random() * 0.6), x0: Math.random() * (VW + 900), y0: (W === 'mictlan' ? 40 : 10) + Math.random() * VH * (W === 'mictlan' ? 0.5 : 0.32) + li * 30, span: VW + 900 };
        this.clouds.push(li ? heavy(c) : c);
      }
    });
    // particle signatures (world space, capped)
    const S = this.sigEm = {};
    S.jade = this.P('fx_spark', { lifespan: 700, speed: { min: 6, max: 30 }, scale: { start: 0.28, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xb8ffd8, 0x5fe0a8, 0xfff1c8], blendMode: 'ADD', gravityY: -20 }, 6.8, 60);
    S.gold = this.P('fx_spark', { lifespan: 700, speed: { min: 6, max: 30 }, scale: { start: 0.28, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xfff0b0, 0xffc040], blendMode: 'ADD', gravityY: -20 }, 6.8, 40);
    S.slime = this.P('fx_dot', { lifespan: 600, speedX: { min: -40, max: 40 }, speedY: { min: -60, max: -10 }, gravityY: 500, scale: { start: 0.55, end: 0.2 }, alpha: { start: 0.9, end: 0 }, tint: [0x7cff6a, 0x30d0a0, 0xd8ff40] }, 5.4, 40);
    S.paw = this.P('fx_smoke', { lifespan: 600, speedX: { min: -30, max: 30 }, speedY: { min: -30, max: -5 }, scale: { start: 0.08, end: 0.3 }, alpha: { start: 0.5, end: 0 }, tint: [0xc8a070, 0xa88050] }, 5.4, 30);
    S.bone = this.P('fx_smoke', { lifespan: 650, speedX: { min: -30, max: 30 }, speedY: { min: -30, max: -5 }, scale: { start: 0.08, end: 0.3 }, alpha: { start: 0.45, end: 0 }, tint: [0xd8d0e8, 0x9080b0] }, 5.4, 30);
    S.wing = this.P('fx_dot', { lifespan: 900, speedX: { min: -20, max: 20 }, speedY: { min: 10, max: 40 }, scale: { start: 0.35, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: [0xc080ff, 0x9fe8ff], blendMode: 'ADD' }, 5.4, 40);
    S.ghost = this.P('fx_soft', { lifespan: 800, speed: { min: 2, max: 12 }, scale: { start: 0.45, end: 0.05 }, alpha: { start: 0.35, end: 0 }, tint: [0x9fe8ff, 0xd0c0ff, 0xffffff], blendMode: 'ADD' }, 4.7, 50);
    S.feather = this.P('fx_leaf', { lifespan: 1600, speedX: { min: -30, max: 30 }, speedY: { min: 10, max: 50 }, rotate: { start: 0, end: 360 }, scale: { start: 0.6, end: 0.3 }, alpha: { start: 0.9, end: 0 }, tint: [0xff4030, 0x3070ff, 0xffd040] }, 5.4, 16);
    S.grit = this.P('fx_dot', { lifespan: 450, speedX: { min: -60, max: 60 }, speedY: { min: -90, max: -20 }, gravityY: 600, scale: { start: 0.4, end: 0.1 }, alpha: { start: 0.9, end: 0 }, tint: [0x8a6a4e, 0xb09070] }, 5.4, 30);
    S.pollen = this.P('fx_dot', { lifespan: 1400, speedX: { min: -12, max: 12 }, speedY: { min: -30, max: -8 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xfff060, 0xff90d0], blendMode: 'ADD' }, 5.4, 30);
    S.lava = this.P('fx_spark', { lifespan: 900, speedX: { min: -40, max: 40 }, speedY: { min: -200, max: -60 }, gravityY: 300, scale: { start: 0.3, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xffd070, 0xff7a20, 0xff4010], blendMode: 'ADD' }, 3.3, 60);
    S.dissolve = this.P('fx_dot', { lifespan: { min: 500, max: 1100 }, speed: { min: 20, max: 140 }, gravityY: -60, scale: { start: 0.6, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD' }, 7.2, 120);
    // orb: motion-blur ghosts + speed streaks + landing sparks
    this.orbGhosts = LOWFX ? [] : [0.28, 0.16, 0.08].map(a => heavy({ im: this.add.image(0, 0, 'orb').setDepth(5.8).setAlpha(0).setScale(this.orb.scale).setData('a', a) }));
    this.streaks = [0, 1, 2].map(i => this.add.image(0, 0, 'fx_streak').setOrigin(1, 0.5).setDepth(5.7).setBlendMode(Phaser.BlendModes.ADD).setTint(i ? 0xffe0a0 : 0xffffff).setAlpha(0));
    this.pLandSpark = this.P('fx_spark', { lifespan: { min: 200, max: 450 }, speedX: { min: -320, max: 320 }, speedY: { min: -220, max: -40 }, gravityY: 900, scale: { start: 0.3, end: 0 }, tint: [0xfff0b0, 0xffb040], blendMode: 'ADD' }, 7, 60);
    // dynamic light pools: follow the nearest braziers / lava / jets, flicker, and flare with lightning
    this.lights = LOWFX ? [] : [0, 1, 2].map(() => this.add.image(0, 0, 'fx_soft').setScrollFactor(0).setDepth(88).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    this.lightSrc = [];
    for (const b of this.braziers || []) this.lightSrc.push({ x: b.im.x, y: b.im.y - 110, tint: 0xffa040, k: 1, r: 520 });
    for (const pt of this.pits || []) if (pt.kind === 'lava') this.lightSrc.push({ x: (pt.x0 + pt.x1) / 2, y: this.H - 60, tint: 0xff6a20, k: 1.2, r: 700 });
    for (const J of this.jets || []) this.lightSrc.push({ x: J.x, y: J.gy - 90, tint: 0xff8a30, k: 0, r: 520, jet: J });
    this.flashRect = this.add.rectangle(0, 0, VW, VH, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(95);
    this.skyFlash = this.add.rectangle(0, 0, VW, VH, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(-95.2);
    this.boltG = this.add.graphics().setScrollFactor(0).setDepth(-95.1).setBlendMode(Phaser.BlendModes.ADD);
    if (W === 'temple') this.buildTempleWeather(heavy); else if (W === 'jungle') this.buildJungleWeather(heavy); else if (W === 'mictlan') this.buildMictlanWeather(heavy);
    // dust: footfalls and gust puffs
    this.pStep = this.P('fx_smoke', { lifespan: 500, speedX: { min: -40, max: 40 }, speedY: { min: -30, max: -5 }, scale: { start: 0.1, end: 0.35 }, alpha: { start: 0.45, end: 0 }, tint: W === 'mictlan' ? [0x7a6a90, 0x4a3a60] : W === 'jungle' ? [0x8a7a50, 0x6a6040] : [0xd8b58a, 0xc49a6a] }, 5.3, 40);
    this.pol.ready = true;
  },
  buildTempleWeather(heavy) {
    if (!LOWFX) { this.shimmer = heavy({ ts: this.add.tileSprite(0, VH * 0.35, VW, VH * 0.65, 'fx_shimmer').setOrigin(0).setScrollFactor(0).setDepth(-95.8).setAlpha(0.07).setBlendMode(Phaser.BlendModes.ADD) }); }
    this.sandEm = this.P('fx_streak', { x: VW + 40, y: { min: VH * 0.3, max: VH }, lifespan: 1600, speedX: { min: -1100, max: -700 }, speedY: { min: -20, max: 40 }, scaleX: { min: 0.4, max: 1.2 }, scaleY: 0.4, alpha: { start: 0.5, end: 0 }, tint: [0xe8c890, 0xd8b070, 0xfff0d0], frequency: 25, quantity: 2 }, 9.5, 120).setScrollFactor(0);
    this.sandPuff = this.P('fx_smoke', { lifespan: 1400, speedX: { min: -260, max: -120 }, speedY: { min: -40, max: 0 }, scale: { start: 0.3, end: 1.2 }, alpha: { start: 0.35, end: 0 }, tint: [0xe8cfa0, 0xd8b58a] }, 5.2, 40);
    this.devilEm = this.P('fx_smoke', { lifespan: 900, speed: { min: 0, max: 15 }, scale: { start: 0.18, end: 0.5 }, alpha: { start: 0.55, end: 0 }, tint: [0xe0c090, 0xc8a070, 0xf0dcb0], rotate: { min: 0, max: 360 } }, 5.1, 120);
  },
  buildJungleWeather(heavy) {
    this.rainEm = this.P('fx_drop', { x: { min: -100, max: VW + 200 }, y: -40, lifespan: 900, speedY: { min: 900, max: 1200 }, speedX: { min: -180, max: -120 }, rotate: 8, scaleY: { min: 0.6, max: 1.1 }, alpha: { min: 0.25, max: 0.55 }, tint: 0xd8f0ff, frequency: LOWFX ? 40 : 12, quantity: LOWFX ? 2 : 4 }, 9.4, 260).setScrollFactor(0);
    this.splashEm = this.P('fx_dot', { lifespan: 300, speedX: { min: -70, max: 70 }, speedY: { min: -140, max: -40 }, gravityY: 700, scale: { start: 0.35, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: 0xe0f4ff }, 5.2, 80);
    this.flies = [];
    if (!LOWFX) for (let i = 0; i < 4; i++) this.flies.push(heavy({ im: this.add.image(0, 0, 'fx_bfly').setDepth(8).setTint([0xffa020, 0x40c0ff, 0xff60c0, 0xfff060][i]).setScale(0.9), t: Math.random() * 9, ox: Math.random() * VW, oy: 120 + Math.random() * 300 }));
    this.birds = [];
  },
  buildMictlanWeather(heavy) {
    this.ashEm = this.P('fx_dot', { x: { min: 0, max: VW + 200 }, y: -10, lifespan: 9000, speedY: { min: 20, max: 55 }, speedX: { min: -30, max: 5 }, scale: { min: 0.15, max: 0.4 }, alpha: { start: 0.7, end: 0.1 }, tint: [0x9a90a8, 0x6a6070, 0xc0b8c8], frequency: LOWFX ? 260 : 70, emitting: true }, 9.3, 150).setScrollFactor(0);
    this.dripEm = this.P('fx_drop', { x: { min: 0, max: VW }, y: -20, lifespan: 1400, speedY: { min: 200, max: 300 }, gravityY: 900, scaleY: 0.5, scaleX: 1.4, alpha: { start: 1, end: 0.6 }, tint: [0xff8a30, 0xffc060], blendMode: 'ADD', frequency: LOWFX ? 1600 : 600, emitting: true }, 9.2, 20).setScrollFactor(0);
    this.bubbles = [];
    for (const pt of this.pits || []) if (pt.kind === 'lava') this.bubbles.push({ pt, t: Math.random() * 2 });
    this.crystal = LOWFX ? [] : [0x30f0ff, 0xd060ff].map((c, i) => heavy({ im: this.add.image(VW * (0.2 + i * 0.6), VH * 0.55, 'fx_soft').setScrollFactor(0).setDepth(88.5).setBlendMode(Phaser.BlendModes.ADD).setTint(c).setDisplaySize(VW * 0.7, VH * 0.9).setAlpha(0.08) }));
    this.birds = [];
  },

  // ---------- audio ----------
  startPolishAudio() {
    const W = this.L.world, mk = (k, v = 0) => this.cache.audio.exists(k) ? (() => { const s = this.sound.add(k, { loop: true, volume: v }); s.play(); return s; })() : null;
    this.rollSnds = {}; for (const s of SURF_SND[W] || ['stone']) this.rollSnds[s] = { snd: mk('roll_' + s), v: 0 };
    this.whooshSnd = mk('whoosh_loop'); this.ambSnd = mk('amb_' + W); this.rainSnd = W === 'jungle' ? mk('amb_rain') : null;
    this.events.once('shutdown', () => { for (const s of [this.whooshSnd, this.ambSnd, this.rainSnd, ...Object.values(this.rollSnds || {}).map(o => o.snd)]) if (s) { s.stop(); s.destroy(); } });
  },
  sfxAt(k, x, y, vol = 0.6, rate = 1) {
    const o = this.pbody ? this.pbody.position : { x, y }, d = Math.hypot(x - o.x, y - o.y); if (d > 1500) return;
    const fall = clamp(1 - (d - 250) / 1250, 0, 1); if (fall <= 0.02) return;
    this.sfx(k, vol * fall, rate * (0.94 + Math.random() * 0.12), clamp((x - o.x) / 700, -1, 1));
  },
  sampleSurface(x, y) {   // colour of the painted terrain just under the orb -> surface type
    const W = this.L.world, s = this.TR.scale;
    const r = this.segs.find(q => x >= q.ox && x < q.ox + q.w); if (!r) return null;
    const i = this.segs.indexOf(r); let c = null;
    try { c = this.textures.getPixel(Math.floor((x - r.ox) / s), Math.floor(y / s), this.L.id + '_seg' + i); } catch (_) { }
    if (!c || c.alpha < 40) return null;
    const R = c.red / 255, G = c.green / 255, B = c.blue / 255, v = Math.max(R, G, B), sat = v ? (v - Math.min(R, G, B)) / v : 0;
    if (W === 'mictlan') return v < 0.32 ? 'obsidian' : 'stone';
    if (W === 'jungle') return G > R * 1.02 && G > B ? 'grass' : (R > G && G > B && sat > 0.35 && v < 0.75) ? 'wood' : 'stone';
    return (R > G && G > B && sat > 0.28 && v > 0.55) ? 'sand' : 'stone';
  },
  updatePolishAudio(time, p, sp, grounded, dt) {
    if (!this.rollSnds) return;
    const P = this.pol, VS = AUDIO_MIX.sfx();
    if (grounded && time > P.surfT) { P.surfT = time + 150; const s = this.sampleSurface(p.position.x, p.position.y + R + 6); if (s && this.rollSnds[s]) P.surf = s; }
    const amt = grounded && !this.done ? clamp((sp - 0.4) / 14, 0, 1) : 0;
    for (const [k, o] of Object.entries(this.rollSnds)) {
      if (!o.snd) continue; const tgt = (k === P.surf ? amt : 0) * 0.55 * VS; o.v += (tgt - o.v) * 0.15;
      o.snd.setVolume(o.v); o.snd.setRate(0.7 + Math.min(sp, 20) / 20 * 0.9);
    }
    if (this.whooshSnd) { const w = (clamp((sp - 9) / 12, 0, 1) * (grounded ? 0.5 : 1) + (!grounded && sp > 5 ? 0.15 : 0)) * 0.4 * VS; P.wv = (P.wv || 0) + (w - (P.wv || 0)) * 0.1; this.whooshSnd.setVolume(P.wv); this.whooshSnd.setRate(0.8 + Math.min(sp, 24) / 24 * 0.6); }
    if (this.ambSnd) this.ambSnd.setVolume((0.3 + P.gust * 0.35) * VS);
    if (this.rainSnd) this.rainSnd.setVolume(P.rain * 0.45 * VS);
  },
  onLandFx(speed, x, y) {   // called from the contact handler on a fresh landing
    const k = clamp((speed - 5) / 14, 0, 1);
    this.sfx('thud', 0.15 + k * 0.6, 1.15 - k * 0.35);
    if (this.pStep) { this.pStep.explode(Math.round((4 + k * 10) * PCAP), x - R * 0.6, y); this.pStep.explode(Math.round((4 + k * 10) * PCAP), x + R * 0.6, y); }
    if (speed > 11 && this.pLandSpark) { this.pLandSpark.explode(Math.round(10 + k * 18), x, y); this.cameras.main.shake(90, 0.003 + k * 0.004); }
  },
  onScrape(speed, x, y) {
    if (this.time.now - (this.pol && this.pol.scrapeT || 0) < 300) return; this.pol.scrapeT = this.time.now;
    this.sfx('scrape', clamp(speed / 20, 0.2, 0.7), 0.9 + Math.random() * 0.2); if (this.pLandSpark) this.pLandSpark.explode(Math.round(8 * PCAP) + 2, x, y);
  },

  // ---------- enemies: secondary motion, signature, voice ----------
  polishEnemy(en, dt, time) {
    const im = en.img; if (!im || !im.active) return;
    if (!en.pol) en.pol = { pop: 0, t: Math.random() * 6, blink: 1 + Math.random() * 3, bt: 0, rc: 0, voice: 1.5 + Math.random() * 4, sig: Math.random(), px: im.x, py: im.y, step: 0,
      glint: this.add.image(im.x, im.y, 'fx_spark').setDepth(im.depth + 0.05).setBlendMode(Phaser.BlendModes.ADD).setScale(0).setTint(0xfffbe8) };
    const Q = en.pol, cam = this.cameras.main.worldView; Q.t += dt;
    const vis = im.x > cam.x - 120 && im.x < cam.right + 120 && im.y > cam.y - 160 && im.y < cam.bottom + 160;
    if (vis && Q.pop === 0 && this.pStep) { this.pStep.explode(6, im.x, im.y + im.displayHeight * 0.3); this.sigEm.jade.explode(4, im.x, im.y); }
    if (vis || Q.pop > 0) Q.pop = Math.min(1, Q.pop + dt * 3);
    const pop = Q.pop < 1 ? Phaser.Math.Easing.Back.Out(Q.pop) : 1;
    const vx = (im.x - Q.px) / Math.max(dt * 60, 0.2), vy = (im.y - Q.py) / Math.max(dt * 60, 0.2); Q.px = im.x; Q.py = im.y;
    const self = SELF_SCALE.has(en.kind), s0 = en.s0 || im.scale;
    const bx = self ? Math.abs(im.scaleX) : s0, by = self ? Math.abs(im.scaleY) : s0;
    const ground = en.kind === 'jaguar_warrior' || en.kind === 'skeleton_dog' || en.kind === 'poison_frog';
    const br = Math.sin(Q.t * (ground ? 3.2 : 2.4)) * (ground ? 0.03 : 0.045);
    const st = clamp(vy * 0.018, -0.12, 0.16) * (ground || en.kind === 'roller' ? 1 : 0.4);
    const tell = en.state === 'tell' || en.state === 'crouch' || en.state === 'wind' || en.phase === 'tell';
    const ant = tell ? 0.12 : 0;
    Q.rc = Math.max(0, Q.rc - dt * 4); const rc = Math.sin(Q.rc * Math.PI) * 0.25;
    Q.blink -= dt; if (Q.blink <= 0) { Q.bt = 0.13; Q.blink = 2.2 + Math.random() * 3.5; } Q.bt = Math.max(0, Q.bt - dt);
    const bl = Q.bt > 0 ? 0.06 : 0;
    const wob = en.kind === 'sugar_skull' || en.kind === 'carnivorous_plant' ? Math.sin(Q.t * 7) * 0.035 : 0;
    Q.snap = Math.max(0, (Q.snap || 0) - dt * 6); const sn = Math.sin(Q.snap * Math.PI) * 0.14;
    im.setScale(bx * pop * (1 - br * 0.6 - st * 0.5 + ant * 0.18 + rc + wob + sn), by * pop * (1 + br + st - ant * 0.28 - rc * 0.8 - bl - wob - sn * 0.5));
    if (ground) { const lean = clamp(vx * 0.035, -0.22, 0.22) + (tell ? Math.sin(Q.t * 70) * 0.04 : 0); im.setRotation(im.rotation + (lean - im.rotation) * 0.2); }
    else if (en.kind === 'bat' || en.kind === 'macaw') im.setRotation(im.rotation + clamp(vx * 0.03, -0.3, 0.3));
    // eye glint (hidden while blinking), twinkles every few seconds
    const face = im.flipX ? -1 : 1, E = EYE[en.kind] || [0, -0.2], gl = (Q.t % 3.1) < 0.35 && Q.bt <= 0 ? Math.sin((Q.t % 3.1) / 0.35 * Math.PI) : 0;
    Q.glint.setPosition(im.x + E[0] * im.displayWidth * face * (en.face0 === -1 ? -1 : 1), im.y + E[1] * im.displayHeight).setScale(gl * 0.35 * pop).setRotation(Q.t * 2).setVisible(vis);
    // particle signature
    const sig = SIGN[en.kind]; Q.sig += dt * (LOWFX ? 2 : 6);
    if (vis && sig && Q.sig >= 1) { Q.sig = 0; const e = this.sigEm[sig];
      const moving = Math.abs(vx) > 0.4;
      if (sig === 'paw' || sig === 'bone') { if (moving) e.emitParticleAt(im.x - Math.sign(vx) * im.displayWidth * 0.2, im.y + im.displayHeight * 0.42, 1); }
      else if (sig === 'grit') { if (moving) e.emitParticleAt(im.x, im.y + im.displayHeight * 0.42, 1); }
      else if (sig === 'slime') { if (Math.random() < 0.5 || Math.abs(vy) > 1) e.emitParticleAt(im.x + (Math.random() - 0.5) * im.displayWidth * 0.5, im.y + im.displayHeight * 0.1, 1); }
      else if (sig === 'feather') { if (Math.random() < 0.25) e.emitParticleAt(im.x - face * im.displayWidth * 0.3, im.y, 1); }
      else if (sig === 'pollen') { if (Math.random() < 0.5) e.emitParticleAt(im.x + (Math.random() - 0.5) * 30, im.y - im.displayHeight * 0.6, 1); }
      else e.emitParticleAt(im.x + (Math.random() - 0.5) * im.displayWidth * 0.4, im.y + (Math.random() - 0.3) * im.displayHeight * 0.4, 1);
    }
    // footstep puffs for walkers
    if (ground && Math.abs(vx) > 1.2 && vis) { Q.step += dt * Math.abs(vx) * 0.9; if (Q.step > 1) { Q.step = 0; this.pStep.emitParticleAt(im.x, im.y + im.displayHeight * 0.45, 2); } }
    // idle voice
    const iv = IDLE_VOICE[en.kind]; Q.voice -= dt;
    if (iv && Q.voice <= 0) { Q.voice = iv[0] + Math.random() * (iv[1] - iv[0]); if (vis && (en.kind !== 'roller' || Math.abs(vx) > 0.5)) this.sfxAt(VOICE[en.kind], im.x, im.y, 0.45); }
  },
  enemyRecoil(en) { if (en.pol) en.pol.rc = 1; },
  dissolveEnemy(en, parts) {   // hit flash -> knockback spin away from the orb -> dissolve into particles of its signature colour
    const im = en.img, o = this.pbody.position, d = Math.sign(im.x - o.x) || 1;
    const tint = { jaguar_warrior: [0xffc040, 0x40a040], skeleton_dog: [0xe8e0ff, 0x9080c0], poison_frog: [0x60ff60, 0x30d0ff], macaw: [0xff4030, 0x3070ff, 0xffd040], bat: [0xc080ff, 0x6040a0], sugar_skull: [0x9fe8ff, 0xff90d0, 0xffffff], roller: [0xc8a070, 0xffd060], hover: [0x5fe0a8, 0xd8ffe8], carnivorous_plant: [0x80e060, 0xff6080], flyer: [0x5fe0a8, 0xffd060] }[en.kind] || [0xffffff];
    if (en.pol && en.pol.glint) en.pol.glint.destroy();
    this.sfxAt(VOICE[en.kind] || 'hit', im.x, im.y, 0.5, 1.25);
    this.tweens.add({ targets: parts, x: '+=' + d * 90, y: '-=70', angle: d * 540, duration: 420, ease: 'Cubic.out' });
    this.tweens.add({ targets: parts, alpha: 0, scaleX: '*=0.6', scaleY: '*=0.6', delay: 200, duration: 380, onComplete: () => parts.forEach(q => q.destroy()) });
    const E = this.sigEm.dissolve; E.setParticleTint(tint[0]);
    this.time.delayedCall(220, () => { const w = im.displayWidth || 60, h = im.displayHeight || 60, n = Math.round(36 * PCAP) + 6;
      for (let i = 0; i < n; i++) { E.setParticleTint(tint[i % tint.length]); E.emitParticleAt(im.x + (Math.random() - 0.5) * w * 0.7, im.y + (Math.random() - 0.5) * h * 0.7, 1); } });
  },

  // ---------- weather / lighting ----------
  lightning(purple) {
    const P = this.pol; if (!P) return; P.flash = 1; P.flashCol = purple ? 0xb070ff : 0xe8f0ff;
    const x0 = 100 + Math.random() * (VW - 200), g = this.boltG; g.clear();
    const draw = (w, a, col) => { g.lineStyle(w, col, a); g.beginPath(); let x = x0, y = -10; g.moveTo(x, y); while (y < VH * 0.62) { x += (Math.random() - 0.5) * 70; y += 30 + Math.random() * 40; g.lineTo(x, y); if (Math.random() < 0.18) { g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 120, y + 60); g.moveTo(x, y); } } g.strokePath(); };
    draw(10, 0.25, P.flashCol); draw(3, 1, 0xffffff);
    g.setAlpha(1); this.tweens.killTweensOf(g); this.tweens.add({ targets: g, alpha: 0, duration: 380, delay: 90 });
    this.skyFlash.setFillStyle(P.flashCol, purple ? 0.5 : 0.8); this.tweens.killTweensOf(this.skyFlash);
    this.tweens.add({ targets: this.skyFlash, fillAlpha: 0, duration: 420, delay: 60 });
    this.flashRect.setFillStyle(P.flashCol, purple ? 0.18 : 0.35); this.tweens.killTweensOf(this.flashRect);
    this.tweens.add({ targets: this.flashRect, fillAlpha: 0, duration: 260, onComplete: () => { if (!purple) { this.flashRect.setFillStyle(P.flashCol, 0.22); this.tweens.add({ targets: this.flashRect, fillAlpha: 0, duration: 300, delay: 80 }); } } });
    if (purple) this.sfx('crackle', 0.55 * (AUDIO_MIX.sfx() ? 1 : 0), 0.9 + Math.random() * 0.2, (x0 - VW / 2) / VW);
    this.time.delayedCall(purple ? 120 : 300 + Math.random() * 900, () => { this.sfx('thunder', purple ? 0.35 : 0.7, purple ? 1.3 : 0.9 + Math.random() * 0.2, (x0 - VW / 2) / VW); this.cameras.main.shake(400, purple ? 0.002 : 0.004); });
    P.lastBolt = this.time.now;
  },
  spawnFlock(key, tint, n, y, sc) {
    const dir = Math.random() < 0.5 ? 1 : -1, x = dir > 0 ? -60 : VW + 60;
    for (let i = 0; i < n; i++) this.birds.push({ im: this.add.image(x - dir * i * 34, y + (i % 2) * 14 + Math.random() * 8, key).setScrollFactor(0).setDepth(-98.2).setTint(tint).setAlpha(0.7).setScale(sc), vx: dir * (90 + Math.random() * 30), t: Math.random() * 6 });
  },
  updatePolish(time, p, sp, grounded, dir) {
    const P = this.pol; if (!P || !P.ready) return;
    const dt = Math.min(0.05, this.game.loop.delta / 1000), cam = this.cameras.main, W = P.world, fxOn = this.fxOn !== false; P.t += dt;
    // clouds
    for (const c of this.clouds) { if (!c.im.visible) continue; const x = ((c.x0 - cam.scrollX * c.fx - time * c.drift * (1 + P.gust * 3)) % c.span + c.span) % c.span - 450; c.im.setPosition(x, c.y0 - Math.min(this.extraY, cam.scrollY * c.fx * 0.5)); }
    // orb: ghosts + streaks
    P.hist.unshift({ x: p.position.x, y: p.position.y, a: p.angle }); if (P.hist.length > 10) P.hist.pop();
    const fast = clamp((sp - 8) / 12, 0, 1), ang = Math.atan2(p.velocity.y, p.velocity.x);
    this.orbGhosts.forEach((g, i) => { const h = P.hist[Math.min(P.hist.length - 1, (i + 1) * 2)]; g.im.setVisible(fxOn).setPosition(h.x, h.y).setRotation(h.a).setAlpha(g.im.getData('a') * fast); });
    this.streaks.forEach((s, i) => { const off = (i - 1) * R * 0.55; s.setPosition(p.position.x - Math.sin(ang) * off - Math.cos(ang) * R * 0.3, p.position.y + Math.cos(ang) * off - Math.sin(ang) * R * 0.3).setRotation(ang)
      .setDisplaySize(R * (2 + fast * 5) * (i === 1 ? 1.3 : 0.8), i === 1 ? R * 0.9 : R * 0.25).setAlpha(fast * (i === 1 ? 0.35 : 0.5)); });
    if (grounded && sp > 9 && Math.random() < 0.35 * PCAP) { const gy = this.groundY(p.position.x, p.position.y); if (gy - p.position.y < R + 14) this.pStep.emitParticleAt(p.position.x - Math.sign(p.velocity.x) * R, gy - 2, 1); }
    // skid on a sudden reversal
    if (grounded && dir && Math.sign(dir) !== Math.sign(p.velocity.x) && Math.abs(p.velocity.x) > 4.5 && time > P.skidT) {
      P.skidT = time + 380; this.sfx('skid', clamp(Math.abs(p.velocity.x) / 14, 0.25, 0.75), 0.9 + Math.random() * 0.2);
      const gy = this.groundY(p.position.x, p.position.y); if (isFinite(gy)) { this.pStep.explode(Math.round(8 * PCAP) + 2, p.position.x + Math.sign(p.velocity.x) * R * 0.5, gy); this.pLandSpark.explode(Math.round(6 * PCAP) + 2, p.position.x, gy); }
    }
    // collectibles: sparkle signature from a visible one now and then
    if (this.pickupRefs && Math.random() < (LOWFX ? 0.15 : 0.5)) { const r = this.pickupRefs[(Math.random() * this.pickupRefs.length) | 0];
      if (r && !r.taken && r.img.active && cam.worldView.contains(r.img.x, r.img.y)) (r.p.type === 'jade_bead' ? (W === 'temple' ? this.sigEm.jade : this.sigEm.gold) : this.sigEm.gold).emitParticleAt(r.img.x + (Math.random() - 0.5) * r.img.displayWidth, r.img.y + (Math.random() - 0.5) * r.img.displayHeight, 1); }
    // foreground sway (gusts lean it further)
    for (const f of this.fgp || []) if (f.im.visible) f.im.setRotation((Math.sin(P.t * 1.3 + f.bx) * 0.035 + Math.sin(P.t * 3.1 + f.bx * 2) * 0.01 + P.gust * 0.06) * (f.by ? -1 : 1));
    // dynamic lights
    if (this.lights.length && fxOn) {
      const near = this.lightSrc.map(s => ({ s, d: Math.abs(s.x - (cam.scrollX + VW / 2)) })).filter(o => o.d < VW).sort((a, b) => a.d - b.d).slice(0, 3);
      this.lights.forEach((L, i) => { const o = near[i]; if (!o) { L.setAlpha(0); return; } const s = o.s, k = s.jet ? (s.jet.on ? 1.3 : s.jet.warn ? 0.4 : 0) : s.k;
        const fl = 0.75 + Math.sin(time / 90 + i * 2) * 0.12 + Math.random() * 0.13;
        L.setPosition(s.x - cam.scrollX, s.y - cam.scrollY).setTint(s.tint).setDisplaySize(s.r * 2, s.r * 1.6).setAlpha(0.2 * k * fl * (1 + P.flash)); });
    } else this.lights.forEach(L => L.setAlpha(0));
    P.flash = Math.max(0, P.flash - dt * 3);
    // per-world weather
    if (W === 'temple') {
      if (this.shimmer) { this.shimmer.ts.setVisible(fxOn); this.shimmer.ts.tilePositionY -= dt * 40; this.shimmer.ts.tilePositionX = cam.scrollX * 0.3 + Math.sin(P.t * 2) * 6; this.shimmer.ts.setAlpha(0.05 + Math.sin(P.t * 1.7) * 0.02); }
      if (time > P.gustT) { P.gustT = time + 8000 + Math.random() * 7000; P.gustOn = time + 2600; this.sfx('whoosh_loop', 0.35, 0.7); }
      const gOn = time < (P.gustOn || 0); P.gust += ((gOn ? 1 : 0) - P.gust) * dt * 2;
      this.sandEm.emitting = P.gust > 0.2 && fxOn; this.sandEm.frequency = LOWFX ? 80 : 25;
      if (P.gust > 0.3 && Math.random() < 0.25 * P.gust * PCAP) { const x = cam.scrollX + Math.random() * VW, gy = this.groundY(x, -1e9); if (isFinite(gy)) this.sandPuff.emitParticleAt(x, gy - 6, 1); }
      if (time > P.devilT && !P.devil) { P.devil = { x: cam.scrollX + VW * (0.6 + Math.random() * 0.3), vx: -(40 + Math.random() * 50), life: 6 }; P.devilT = time + 16000 + Math.random() * 14000; }
      if (P.devil) { const D = P.devil; D.life -= dt; D.x += D.vx * dt; const gy = this.groundY(D.x, -1e9);
        if (isFinite(gy) && fxOn) for (let i = 0; i < (LOWFX ? 1 : 3); i++) { const h = Math.random() * 190, r = 8 + h * 0.32, a = P.t * 14 + Math.random() * 6; this.devilEm.emitParticleAt(D.x + Math.cos(a) * r + Math.sin(P.t * 2 + h * 0.02) * 12, gy - h * Math.min(1, D.life, 6 - D.life), 1); }
        if (D.life <= 0) P.devil = null; }
    } else if (W === 'jungle') {
      if (time > P.rainT) { P.rainOn = !P.rainOn; P.rainT = time + (P.rainOn ? 14000 + Math.random() * 8000 : 9000 + Math.random() * 7000); }
      P.rain += ((P.rainOn ? 1 : 0) - P.rain) * dt * 0.6; this.rainEm.emitting = P.rain > 0.15; this.rainEm.setAlpha(P.rain);
      if (P.rain > 0.3) for (let i = 0; i < (LOWFX ? 1 : 3); i++) { const x = cam.scrollX + Math.random() * VW, gy = this.groundY(x, -1e9); if (isFinite(gy) && gy > cam.scrollY && gy < cam.scrollY + VH) this.splashEm.emitParticleAt(x, gy - 4, 1); }
      if (P.rain > 0.6 && time > P.boltT) { P.boltT = time + 6000 + Math.random() * 7000; this.lightning(false); }
      for (const f of this.flies) { f.im.setVisible(fxOn); f.t += dt; let x = f.ox + Math.sin(f.t * 0.7) * 160 + Math.sin(f.t * 2.3) * 30, y = f.oy + Math.sin(f.t * 1.1) * 60 + Math.sin(f.t * 4) * 12;
        if (x - (cam.scrollX % 4000) < -300) f.ox += VW; f.im.setPosition(cam.scrollX + ((x % (VW + 200)) + VW + 200) % (VW + 200) - 100, cam.scrollY + y).setScale(0.9 * Math.abs(Math.sin(f.t * 16)) + 0.15, 0.9); }
      if (time > P.flyT) { P.flyT = time + 5000 + Math.random() * 6000; this.spawnFlock('fx_bird', 0x203020, 3 + (Math.random() * 3 | 0), 60 + Math.random() * 140, 0.6); }
    } else if (W === 'mictlan') {
      this.ashEm.emitting = fxOn || LOWFX;
      for (const B of this.bubbles) { B.t -= dt; if (B.t <= 0) { B.t = 0.4 + Math.random() * 1.4; const pt = B.pt, x = pt.x0 + Math.random() * (pt.x1 - pt.x0), y = this.H - 150 * this.TR.scale + 26;
        if (x > cam.scrollX - 50 && x < cam.scrollX + VW + 50) { const b = this.add.image(x, y, 'fx_dot').setTint(0xffa040).setBlendMode(Phaser.BlendModes.ADD).setDepth(1.25).setScale(0.2);
          this.tweens.add({ targets: b, scale: 1.2 + Math.random(), y: y - 8, duration: 500 + Math.random() * 400, ease: 'Sine.out', onComplete: () => { this.sigEm.lava.explode(Math.round(6 * PCAP) + 1, x, y - 8); b.destroy(); } }); } } }
      for (const c of this.crystal) { c.im.setVisible(fxOn); c.im.setAlpha(Math.random() < 0.06 ? 0.16 : 0.07 + Math.sin(time / 300 + c.im.x) * 0.02); }
      if (time > P.flyT) { P.flyT = time + 4500 + Math.random() * 5000; this.spawnFlock('fx_batsil', 0x140a20, 2 + (Math.random() * 4 | 0), 50 + Math.random() * 220, 0.7); }
      if (time > P.boltT) { P.boltT = time + 10000 + Math.random() * 9000; this.lightning(true); }
      for (const J of this.jets || []) if (J.on && Math.random() < 0.4 * PCAP) this.sigEm.lava.emitParticleAt(J.x + (Math.random() - 0.5) * 30, J.gy - 20 - Math.random() * 120, 1);
    }
    if (this.birds) { for (const b of this.birds) { b.t += dt; b.im.x += b.vx * dt; b.im.y += Math.sin(b.t * 2) * 0.3; b.im.setScale(b.im.scaleX, Math.abs(Math.sin(b.t * (b.im.texture.key === 'fx_bird' ? 7 : 14))) * 0.7 + 0.15); if (b.im.x < -120 || b.im.x > VW + 120) { b.im.destroy(); b.dead = true; } } this.birds = this.birds.filter(b => !b.dead); }
    // enemies
    for (const en of this.enemies) if (en.alive) this.polishEnemy(en, dt, time);
    this.updatePolishAudio(time, p, sp, grounded, dt);
  },
  setFxPolish(on) {
    if (!this.pol) return;
    for (const h of this.pol.heavy) (h.im || h.ts).setVisible(on);
    for (const e of [this.sandEm, this.splashEm, this.devilEm]) if (e) e.setVisible(on);
    for (const L of this.lights || []) L.setVisible(on);
  },
  polishState() { const P = this.pol; return P ? { world: P.world, surf: P.surf, rain: +P.rain.toFixed(2), gust: +P.gust.toFixed(2), clouds: this.clouds.length, flash: P.flash, lastBolt: P.lastBolt || 0, fx: this.fxOn !== false } : null; },
};
window.TEO_PFX = PFX; window.SFX_V4 = SFX_V4;
