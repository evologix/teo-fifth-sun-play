/* Teò: Fifth Sun - Level 1 (Temple Outskirts). Phaser 3 + Matter.js, plain JS, no build step. */
'use strict';
const U = 64;                 // pixels per level unit
const VW = 1280, VH = 720;    // 16:9 view
const R = 0.45 * U;           // orb radius
let LV, MB, MBodies;
// cache-busting: ?v=<commit> on the main.js tag is passed on to every asset URL
const VER = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || ''; } catch (e) { return ''; } })();
const V = (p) => VER ? p + (p.includes('?') ? '&' : '?') + 'v=' + VER : p;
// on-screen buttons (DOM overlay): pointer events cover mouse press-and-hold and multi-touch; each button tracks its own pointers
const PAD = { left: false, right: false, jump: false, fire: false, scene: null };
function setupPad() {
  for (const el of document.querySelectorAll('#pad .btn')) {
    const k = el.dataset.k, ids = new Set();
    const set = () => {
      const on = ids.size > 0, was = PAD[k]; PAD[k] = on; el.classList.toggle('on', on);
      const sc = PAD.scene; if (!sc || !on || was) return;
      sc.startAudio();
      if (k === 'jump') sc.jumpQueued = sc.time.now;
      if (k === 'fire') sc.fire();
    };
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    el.addEventListener('pointerdown', (e) => { stop(e); ids.add(e.pointerId); try { el.setPointerCapture(e.pointerId); } catch (_) { } set(); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, (e) => { stop(e); ids.delete(e.pointerId); set(); });
    for (const t of ['mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'contextmenu']) el.addEventListener(t, stop, { passive: false });
  }
  window.addEventListener('blur', () => { for (const k of ['left', 'right', 'jump', 'fire']) PAD[k] = false; document.querySelectorAll('#pad .btn').forEach(e => e.classList.remove('on')); });
}
window.TEO_PAD = PAD;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupPad); else setupPad();

// ---------- tilt-to-roll (deviceorientation) ----------
// TILT.dir is an analog -1..1 value; keys/buttons override it while pressed. iOS 13+ needs requestPermission() from a tap.
const TILT = { on: false, dir: 0, raw: 0, neutral: null, recal: true, granted: false, lastEvt: 0, DEAD: 3, FULL: 25, SMOOTH: 0.25 };
function tiltScreenAngle() {
  let a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (typeof window.orientation === 'number' ? window.orientation : 0);
  return ((a % 360) + 360) % 360;
}
function tiltRoll(e) {   // left/right roll in degrees, positive = tip the right-hand side of the screen down
  const a = tiltScreenAngle(), b = e.beta || 0, g = e.gamma || 0;
  if (a === 90) return b; if (a === 270) return -b; if (a === 180) return -g; return g;
}
function onTiltEvent(e) {
  if (e.beta == null && e.gamma == null) return;
  TILT.granted = true; TILT.lastEvt = performance.now();
  const r = tiltRoll(e); TILT.raw = r;
  if (!TILT.on) return;
  if (TILT.recal || TILT.neutral === null) { TILT.neutral = r; TILT.recal = false; }
  let d = r - TILT.neutral; d = ((d + 180) % 360 + 360) % 360 - 180;
  const m = Math.abs(d), t = m <= TILT.DEAD ? 0 : Math.min(1, (m - TILT.DEAD) / (TILT.FULL - TILT.DEAD));
  const target = Math.sign(d) * t;
  TILT.dir += (target - TILT.dir) * TILT.SMOOTH;
  if (Math.abs(TILT.dir) < 0.01 && target === 0) TILT.dir = 0;
}
function tiltUI() {
  const b = document.getElementById('bTilt'), c = document.getElementById('bCentre'), pr = document.getElementById('tiltPrompt');
  if (!b) return;
  b.classList.toggle('on', TILT.on); b.textContent = TILT.on ? 'TILT ON' : 'TILT';
  if (c) c.style.display = TILT.on ? 'flex' : 'none';
  document.body.classList.toggle('tilting', TILT.on);
  if (pr) pr.style.display = (!TILT.on && localStorage.getItem('teoTilt') === '1') ? 'block' : 'none';
}
function tiltSet(on) {
  TILT.on = on; TILT.dir = 0; TILT.recal = true;
  try { localStorage.setItem('teoTilt', on ? '1' : '0'); } catch (_) { }
  tiltUI();
}
function tiltEnable() {   // must run synchronously inside the tap handler for iOS
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    D.requestPermission().then(s => { if (s !== 'denied') tiltSet(true); else { tiltSet(false); alert('Motion access was denied. To allow it, close and reopen this page (or Safari > Settings > Motion & Orientation Access).'); } })
      .catch(() => { tiltSet(false); });
  } else tiltSet(true);
}
function setupTilt() {
  const b = document.getElementById('bTilt'), c = document.getElementById('bCentre'), pr = document.getElementById('tiltPrompt');
  window.addEventListener('deviceorientation', onTiltEvent);
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!b || !(touch || 'DeviceOrientationEvent' in window)) return;
  b.style.display = 'flex';
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  b.addEventListener('click', (e) => { stop(e); if (TILT.on) tiltSet(false); else tiltEnable(); });
  if (c) c.addEventListener('click', (e) => { stop(e); TILT.recal = true; TILT.dir = 0; flash(c); });
  if (pr) pr.addEventListener('click', (e) => { stop(e); tiltEnable(); });
  for (const el of [b, c, pr]) if (el) for (const t of ['pointerdown', 'touchstart', 'mousedown', 'dblclick']) el.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
  function flash(el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 250); }
  // persisted choice: enable directly where no permission is needed; iOS shows a tap prompt instead
  let saved = null; try { saved = localStorage.getItem('teoTilt'); } catch (_) { }
  const needsPerm = window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function';
  if (saved === '1') { if (!needsPerm) tiltSet(true); else DeviceOrientationEvent.requestPermission().then(r => { if (r !== 'denied') tiltSet(true); }).catch(() => { }); }
  tiltUI();
  // try to lock landscape (works in fullscreen / installed PWAs on some browsers; iOS ignores it)
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { }); } catch (_) { }
  const reorient = () => { TILT.recal = true; };
  if (screen.orientation) screen.orientation.addEventListener('change', reorient); window.addEventListener('orientationchange', reorient);
}
window.TEO_TILT = TILT; window.TEO_TILT_SET = tiltSet;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupTilt); else setupTilt();

const TEX = {
  bg: { L0_sky: 'assets/bg/L0_sky.jpg', L1_far: 'assets/bg/L1_far.webp', L2_mid: 'assets/bg/L2_mid.webp', L3_near: 'assets/bg/L3_near.webp' },
  sprites: ['jade_bead', 'speed_gate', 'sun_fragment', 'mask_roller', 'serpent_spirit', 'orb', 'orb_spec', 'cracked_wall',
    'mask_a', 'mask_b', 'serpent_head', 'xolotl', 'spike_strip', 'tilting_slab'],
  blocks: ['block_fill', 'block_top', 'block_corner_L', 'block_corner_R', 'ramp_22_5', 'ramp_30', 'ramp_45', 'spriteshape_fill', 'edge_strip'],
  sfx: ['jump', 'land', 'land_stone', 'jade', 'pyrite', 'sun_fragment', 'fire', 'hit', 'enemy_death', 'goal_unlock', 'fw_launch', 'fw_pop', 'fw_crackle', 'card_whoosh',
    'card_impact', 'ui_click', 'ui_tick', 'star', 'title_boom', 'roll_loop', 'stone_bonk', 'creak', 'door_open'],
};

const artKey = (type) => { const p = LV && LV.art && LV.art.sprites[type]; return p ? p.split('/').pop().replace('.png', '') : type; };

class Game extends Phaser.Scene {
  constructor() { super('game'); }
  init(data) { this.levelIndex = data && data.level !== undefined ? data.level : Phaser.Math.Clamp((+QS.get('level') || 1) - 1, 0, LEVELS.length - 1); this.L = LEVELS[this.levelIndex]; }

  preload() {
    const L = this.L;
    this.load.json(L.id, V(L.json));
    this.load.json(L.id + '_terrain', V(L.terrain));
    this.load.once('filecomplete-json-' + L.id + '_terrain', (key, type, data) => data.segments.forEach((sg, i) => this.load.image(L.id + '_seg' + i, V(L.terrainDir + sg.image))));
    for (const [k, p] of Object.entries(L.bg || TEX.bg)) if (!this.textures.exists(k)) this.load.image(k, V(p));
    for (const s of TEX.sprites) if (!this.textures.exists(s)) this.load.image(s, V('assets/sprites/' + s + '.png'));
    this.preloadWorld(L);
    preloadCommon(this);
    this.load.audio('music_' + L.music, V('assets/audio/music/' + L.music + '.mp3'));
  }

  // level units (+y up) -> world pixels (+y down)
  X(x) { return (x - LV.bounds.xMin) * U; }
  Y(y) { return (LV.bounds.yMax - y) * U; }

  create() {
    LV = JSON.parse(JSON.stringify(this.cache.json.get(this.L.id))); this.TR = this.cache.json.get(this.L.id + '_terrain');   // clone: placement resolves in place
    MB = Phaser.Physics.Matter.Matter.Body; MBodies = Phaser.Physics.Matter.Matter.Bodies;
    this.prepareTerrain();
    const b = LV.bounds;
    this.W = (b.xMax - b.xMin) * U; this.H = (b.yMax - b.yMin) * U;
    this.matter.world.setBounds(0, -400, this.W, this.H + 800, 64, true, true, false, false);
    this.matter.world.setGravity(0, 1);
    this.matter.world.engine.positionIterations = 8; this.matter.world.engine.velocityIterations = 8;

    this.makeFxTextures();
    this.makeParallax();
    this.dyn = [];             // {body, img} pairs synced each frame
    this.counts = { jade_bead: 0, pyrite_sphere: 0, sun_fragment: 0 };
    this.totals = { jade_bead: 0, pyrite_sphere: 0, sun_fragment: 0 };
    this.looping = null; this.startTime = undefined; this.audioStarted = false; this.rollSnd = null; this.rollVol = 0; this.jadeChain = 0; this.stats = null;
    this.pickupRefs = []; this.secretsFound = 0; this.done = false; this.lastGround = -1e9; this.lastJump = -1e9; this.facing = 1; this.prevSpeed = 0;

    this.buildTerrain(); this.buildSurfaceCache(); this.makeParticles(); this.shadows = [];
    this.buildDecor(); this.traps = []; this.buildSecrets(); this.buildPickups(); this.buildEnemies();
    this.buildCheckpointsAndGoal(); this.buildHints();
    this.makePlayer(); this.buildBraziers(); this.buildAmbient(); this.buildWorld(); this.fxOn = !LOWFX;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.W, this.H);
    cam.startFollow(this.orb, true, 0.08, 0.08);
    cam.setDeadzone(80, 60);
    cam.centerOn(this.orb.x, this.orb.y);

    { const c=this.game.canvas; c.setAttribute('tabindex','0'); c.style.outline='none'; const f=()=>{window.focus(); c.focus();}; f(); c.addEventListener('pointerdown',f); window.addEventListener('blur',()=>this.input.keyboard.resetKeys()); }
    this.keys = this.input.keyboard.addKeys('A,D,W,S,J,R,SPACE,LEFT,RIGHT,UP,DOWN,M');
    this.input.keyboard.on('keydown-SPACE', () => { this.jumpQueued = this.time.now; });
    this.input.keyboard.on('keydown-UP', () => { this.jumpQueued = this.time.now; });
    this.input.keyboard.on('keydown-J', () => this.fire());
    this.input.keyboard.on('keydown-R', () => this.respawn());
    this.input.keyboard.on('keydown-F', () => this.setFx(!this.fxOn));
    this.input.keyboard.on('keydown-M', () => AUDIO.toggleMute());
    // canvas click fires toward the cursor; the DOM buttons sit above the canvas and swallow their own events, and we also
    // ignore any pointer whose DOM target is not the canvas itself
    this.input.on('pointerdown', (p) => { this.startAudio(); const tg = p.event && p.event.target; if (tg && tg !== this.game.canvas) return; if (p.leftButtonDown() || p.wasTouch) this.fire(p); });
    PAD.scene = this;
    this.input.keyboard.on('keydown', () => this.startAudio());

    this.matter.world.on('collisionstart', (e) => this.onCollide(e.pairs, true));
    this.matter.world.on('collisionactive', (e) => this.onCollide(e.pairs, false));

    this.makeHud();
    this.events.once('shutdown', () => { if (this.rollSnd) { this.rollSnd.stop(); this.rollSnd.destroy(); } PAD.scene = null; });
    if (AUDIO.unlocked()) this.startAudio();
    setMenu(false);
    window.TEO = { lowfx: LOWFX, fps: () => this.game.loop.actualFps, scene: this, teleport: (x, y) => this.teleport(x, y), state: () => this.debugState(), shots: () => this.shots || 0,
      pickups: () => (this.pickupRefs || []).map((r, i) => ({ i, type: r.p.type, tag: r.p.tag || '', x: r.p.x, y: r.p.y, taken: !!r.taken })), goalLocked: () => this.goal.locked,
      surf: (x) => LV.bounds.yMax - this.surfaceAt(x * U) / U };
  }

  // ---------- audio ----------
  startAudio() {
    if (this.audioStarted) return;
    this.audioStarted = true;
    try { if (this.sound.context && this.sound.context.state === 'suspended') this.sound.context.resume(); } catch (e) { }
    MUSIC.play(this, 'music_' + this.L.music, 0.42);
    if (this.cache.audio.exists('roll_loop')) { this.rollSnd = this.sound.add('roll_loop', { loop: true, volume: 0 }); this.rollSnd.play(); }
  }
  sfx(k, vol = 0.6, rate = 1) { if (this.audioStarted && this.cache.audio.exists(k)) this.sound.play(k, { volume: vol, rate }); }
  updateRollSound(sp, grounded) {
    if (!this.rollSnd) return;
    const v = grounded && !this.done ? Phaser.Math.Clamp((sp - 0.4) / 14, 0, 1) : 0;
    this.rollVol = (this.rollVol || 0) + (v * 0.55 - (this.rollVol || 0)) * 0.15;
    this.rollSnd.setVolume(this.rollVol); this.rollSnd.setRate(0.7 + Math.min(sp, 20) / 20 * 0.9);
  }

  // ---------- parallax ----------
  makeParallax() {
    const H = VH * 1.4; this.extraY = H - VH;
    this.par = [];
    const fx = [0.04, 0.15, 0.32, 0.55], fy = [0.03, 0.08, 0.14, 0.21];
    LV.art.layers.forEach((k, i) => {
      const img0 = this.textures.get(k).getSourceImage();
      if (!this.textures.exists(k + '_m')) {
        const ct = this.textures.createCanvas(k + '_m', img0.width * 2, img0.height), cx = ct.getContext();
        cx.drawImage(img0, 0, 0); cx.save(); cx.translate(img0.width * 2, 0); cx.scale(-1, 1); cx.drawImage(img0, 0, 0); cx.restore(); ct.refresh();
      }
      const src = img0; k = k + '_m';
      const sc = H / src.height;
      const ts = this.add.tileSprite(0, 0, VW, H, k).setOrigin(0, 0).setScrollFactor(0).setDepth(-100 + i);
      ts.setTileScale(sc, sc);
      this.par.push({ ts, fx: fx[i], fy: fy[i], sc });
    });
    this.parOverlay = this.add.rectangle(0, 0, VW, VH, 0x0a0814, 0.28).setOrigin(0).setScrollFactor(0).setDepth(-90);
  }
  updateParallax() {
    const cam = this.cameras.main;
    for (const p of this.par) {
      p.ts.tilePositionX = cam.scrollX * p.fx / p.sc;
      p.ts.y = -Math.min(this.extraY, cam.scrollY * p.fy);
    }
  }

  // ---------- painted terrain ----------
  // The level is a row of painted PNG segments (transparent sky). Collision comes from tools/art/terrain_collision.py:
  // marching-squares outlines of each image's alpha, Douglas-Peucker simplified, cached as polylines in the terrain JSON
  // (image px, solid on the right of travel). Entities are placed by x plus a height h above the surface.
  prepareTerrain() {
    const T = this.TR, s = T.scale;
    this.polys = []; let ox = 0;
    this.segs = T.segments.map((sg) => { const r = { ox, w: sg.size[0] * s, h: sg.size[1] * s, sg }; ox += r.w; return r; });
    for (const r of this.segs) for (const pl of r.sg.collision) this.polys.push(pl.map(([x, y]) => ({ x: r.ox + x * s, y: y * s })));
    const Wp = ox, Hp = Math.max(...this.segs.map(r => r.h));
    LV.bounds = { xMin: 0, xMax: Wp / U, yMin: 0, yMax: Hp / U };
    // resolve {x, h} placements onto the surface (level units, +y up)
    const res = (o) => { if (o && o.h !== undefined && o.y === undefined) o.y = LV.bounds.yMax - this.surfaceAt((o.hx !== undefined ? o.hx : o.x) * U) / U + o.h; };
    res(LV.playerStart); res(LV.goal);
    for (const k of ['pickups', 'enemies', 'checkpoints', 'secrets', 'decor', 'tutorialHints']) for (const o of LV[k] || []) res(o);
    for (const o of LV.decor || []) o.y += 0.9;
    for (const o of LV.jets || []) res(o);
  }
  surfaceAt(xp) {   // world px -> top surface world y (searches sideways across gaps/seams)
    for (let d = 0; d < 40 * U; d += 8) for (const sx of d ? [xp - d, xp + d] : [xp]) {
      let best = Infinity;
      for (const pl of this.polys) for (let i = 0; i < pl.length - 1; i++) {
        const a = pl[i], c = pl[i + 1];
        if (c.x > a.x && a.x <= sx && sx <= c.x) best = Math.min(best, a.y + (c.y - a.y) * (sx - a.x) / (c.x - a.x));
      }
      if (best < Infinity) return best;
    }
    return this.H || 600;
  }
  staticRect(x, y, w, h, label = 'ground', opts = {}) {
    return this.matter.add.rectangle(x + w / 2, y + h / 2, w, h, Object.assign({ isStatic: true, label, friction: 0.6, restitution: 0.1 }, opts));
  }
  buildTerrain() {
    for (let i = 0; i < this.segs.length; i++) {
      const r = this.segs[i];
      this.add.image(r.ox, 0, this.L.id + '_seg' + i).setOrigin(0).setScale(this.TR.scale).setDepth(0);
    }
    // thin static segments whose top edge lies on the polyline, plus a small circle at every joint so convex
    // corners are rounded and the orb never catches a rectangle corner poking out of the surface
    const T = 28, J = 7, opts = { isStatic: true, label: 'ground', friction: 0.35, frictionStatic: 0.5, restitution: 0.02, slop: 0.02 };
    const parts = [];
    for (const pl of this.polys) {
      for (let i = 0; i < pl.length - 1; i++) {
        const a = pl[i], c = pl[i + 1], dx = c.x - a.x, dy = c.y - a.y, l = Math.hypot(dx, dy);
        if (l < 0.5) continue;
        const nx = -dy / l, ny = dx / l;   // right of travel = into the solid
        parts.push(MBodies.rectangle((a.x + c.x) / 2 + nx * T / 2, (a.y + c.y) / 2 + ny * T / 2, l, T, Object.assign({ angle: Math.atan2(dy, dx) }, opts)));
      }
      for (let i = 0; i < pl.length; i++) {
        const p = pl[i], a = pl[Math.max(0, i - 1)], c = pl[Math.min(pl.length - 1, i + 1)];
        const dx = c.x - a.x, dy = c.y - a.y, l = Math.hypot(dx, dy) || 1;
        parts.push(MBodies.circle(p.x - dy / l * J, p.y + dx / l * J, J, opts));
      }
    }
    this.matter.world.add(parts);
    this.nGroundParts = parts.length;
  }

  // ---------- entities ----------
  spr(key, x, y, size, anchor = 'c', depth = 3) {   // size in units (fits the longest side)
    const im = this.add.image(this.X(x), this.Y(y), key).setDepth(depth);
    const s = size * U / Math.max(im.width, im.height); im.setScale(s);
    if (anchor === 'b') im.setOrigin(0.5, 1);
    return im;
  }
  buildDecor() { for (const d of LV.decor || []) this.spr(artKey(d.type), d.x, d.y - 0.9, 1.8, 'b', -1).setAlpha(0.95); }
  buildTraps() {
    this.traps = [];
    for (const t of LV.traps) {
      if (t.type === 'spike_strip') {
        // the strip sits on the pit floor (top of the tile below it)
        const floor = Math.max(...LV.tiles.filter(k => k.x <= t.x && k.x + k.w >= t.x + t.w && k.y + k.h <= t.y + 0.01).map(k => k.y + k.h), t.y - 1);
        const im = this.add.image(this.X(t.x), this.Y(floor), 'spike_strip').setOrigin(0, 1).setDisplaySize(t.w * U, 0.55 * U).setDepth(3);
        this.staticRect(this.X(t.x), this.Y(floor + 0.45), t.w * U, 0.45 * U, 'spike', { isSensor: true });
      } else if (t.type === 'crumbling_step') {
        // replaces the top half unit of the terrace step under it
        const th = 0.5, x0 = this.X(t.x), y0 = this.Y(t.y), w = t.w * U;
        this.traps.push({ type: 'crumble', x0, y0, w, h: th * U, state: 'idle' });
        this.makeCrumble(this.traps[this.traps.length - 1]);
      } else if (t.type === 'tilting_slab') {
        const w = t.w * U, h = 0.4 * U, cx = this.X(t.x) + w / 2, cy = this.Y(t.y) - h / 2;
        const body = this.matter.add.rectangle(cx, cy, w, h, { label: 'slab', friction: 0.7, density: 0.004, frictionAir: 0.04 });
        this.matter.add.worldConstraint(body, 0, 1, { pointA: { x: cx, y: cy } });
        const img = this.add.image(cx, cy, 'tilting_slab').setDisplaySize(w, h * 1.6).setDepth(3);
        this.add.circle(cx, cy, 6, 0x2a2018).setDepth(4);
        this.slab = { body, img, cx, cy };
        this.dyn.push({ body, img });
      }
    }
  }
  makeCrumble(tr) {
    tr.body = this.staticRect(tr.x0, tr.y0, tr.w, tr.h, 'crumble', { friction: 0.6 });
    tr.img = this.add.image(tr.x0 + tr.w / 2, tr.y0 + tr.h / 2, 'tilting_slab').setDisplaySize(tr.w, tr.h * 1.3).setDepth(3).setTint(0xd8c8b0);
    tr.state = 'idle'; tr.body.trap = tr; this.groundBodiesDirty = true;
  }
  triggerCrumble(tr) {
    if (tr.state !== 'idle') return;
    tr.state = 'shaking'; this.sfx('creak', 0.7);
    this.tweens.add({ targets: tr.img, x: tr.img.x + 3, duration: 50, yoyo: true, repeat: 6 });
    this.time.delayedCall(600, () => {
      tr.state = 'falling'; this.groundBodiesDirty = true; this.sfx('stone_bonk', 0.6);
      MB.setStatic(tr.body, false); tr.body.collisionFilter.mask = 0; MB.setDensity(tr.body, 0.01);
      this.dyn.push({ body: tr.body, img: tr.img, temp: true });
      this.tweens.add({ targets: tr.img, alpha: 0, delay: 600, duration: 500 });
      this.time.delayedCall(1300, () => { this.matter.world.remove(tr.body); tr.img.destroy(); this.dyn = this.dyn.filter(d => d.body !== tr.body); tr.state = 'gone'; });
    });
  }
  buildSecrets() {
    for (const s of LV.secrets) {
      if (s.type === 'cracked_wall') {
        const x0 = this.X(s.x), y1 = this.Y(s.y - 0.5), y0 = this.Y(s.y + s.h);
        const body = this.staticRect(x0, y0, s.w * U, y1 - y0, 'cracked', { friction: 0.4 });
        const img = this.add.image(x0, y0, 'cracked_wall').setOrigin(0).setDisplaySize(s.w * U, y1 - y0).setDepth(3);
        body.secret = { s, img, body };
      } else if (s.type === 'xolotl') {
        const img = this.spr('xolotl', s.x, s.y, 1.5);
        this.tweens.add({ targets: img, y: img.y - 6, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        const body = this.matter.add.circle(img.x, img.y, 0.7 * U, { isStatic: true, isSensor: true, label: 'xolotl' });
        body.ref = { img, s };
      }
    }
  }
  buildPickups() {
    const size = { jade_bead: (LV.art && LV.art.collectSize) || 0.6, speed_gate: 2.2, sun_fragment: 1.1, pyrite_sphere: 0.8 };
    for (const p of LV.pickups) {
      const img = this.spr(artKey(p.type), p.x, p.y, size[p.type], 'c', p.type === 'speed_gate' ? 2 : 4);
      if (p.type === 'pyrite_sphere') img.setTint(0xe8c060);
      if (p.type === 'speed_gate') {
        const body = this.matter.add.rectangle(img.x, img.y, 0.6 * U, 2 * U, { isStatic: true, isSensor: true, label: 'gate' });
        body.ref = { img, p, last: 0 };
        continue;
      }
      if (this.totals[p.type] !== undefined) this.totals[p.type]++;
      this.tweens.add({ targets: img, y: img.y - 5, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const s0 = img.scale;
      this.tweens.add({ targets: img, scale: s0 * 1.08, angle: { from: -8, to: 8 }, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 600 });
      const halo = this.add.image(img.x, img.y, 'fx_soft').setDepth(3.9).setBlendMode(Phaser.BlendModes.ADD)
        .setTint(p.type === 'jade_bead' ? (WORLD[this.L.world] || WORLD.temple).halo : 0xffc040).setScale(size[p.type] * U / 64).setAlpha(0.35);
      this.tweens.add({ targets: halo, alpha: 0.12, scale: halo.scale * 0.8, duration: 800 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const glint = this.add.image(img.x - size[p.type] * U * 0.18, img.y - size[p.type] * U * 0.2, 'fx_spark').setDepth(4.2).setBlendMode(Phaser.BlendModes.ADD).setScale(0).setTint(0xfff6e0);
      this.tweens.add({ targets: glint, scale: size[p.type] * 0.5, angle: 90, duration: 220, yoyo: true, repeat: -1, repeatDelay: 1400 + Math.random() * 2400, delay: Math.random() * 2000 });
      const shadow = this.addShadow(size[p.type] * U * 1.1); this.placeShadow(shadow, img.x, img.y + size[p.type] * U * 0.4);
      if (p.type !== 'jade_bead') { this.fxGlow(img, 0xffb030, 5); this.tweens.add({ targets: img, angle: 360, duration: 6000, repeat: -1 }); }
      img.extras = [halo, glint, shadow];
      const body = this.matter.add.circle(img.x, img.y, size[p.type] * U * 0.45, { isStatic: true, isSensor: true, label: 'pickup' });
      body.ref = { img, p, body }; (this.pickupRefs = this.pickupRefs || []).push(body.ref);
    }
  }
  buildEnemies() {
    this.enemies = [];
    const list = LV.enemies.slice().concat(this.L.id === 'level01' ? [{ type: 'flyer', x: 53, h: 4.6, range: 3.5 }, { type: 'flyer', x: 110, h: 5, range: 3 }] : []);
    for (const e of list) if (e.y === undefined) e.y = LV.bounds.yMax - this.surfaceAt(e.x * U) / U + e.h;
    // extra hovering serpent spirit over the sunken plaza (not in Level01.json; demonstrates the hover behaviour)
    for (const e of list) {
      if (e.type === 'stone_mask_roller') {
        const r = 0.6 * U;
        const body = this.matter.add.circle(this.X(e.x), this.Y(e.y) - 4, r, { label: 'enemy', friction: 0.5, restitution: 0.2, density: 0.002, frictionAir: 0.01 });
        const img = this.add.image(body.position.x, body.position.y, 'mask_roller').setDepth(5); img.setScale(2 * r / Math.max(img.width, img.height) * 1.08);
        const en = { kind: 'roller', e, body, img, dir: 1, alive: true, home: { x: body.position.x, y: body.position.y }, s0: img.scale, sq: 0, pvy: 0, r };
        en.rig = this.addLightRig(img.x, img.y, 2 * r * 1.04, 5); en.shadow = this.addShadow(2.4 * r);
        body.enemy = en; this.enemies.push(en);
      } else if (e.type === 'serpent_spirit') {
        const img = this.spr('serpent_spirit', e.x, e.y, 1.4, 'c', 5);
        const body = this.matter.add.circle(img.x, img.y, 0.5 * U, { isStatic: true, isSensor: true, label: 'enemy' });
        const segs = []; for (let i = 0; i < 9; i++) segs.push(this.add.image(img.x, img.y, 'fx_seg').setDepth(4.9 - i * 0.01).setScale(0.62 - i * 0.045));
        const en = { kind: 'hover', e, body, img, alive: true, t: Math.random() * 6, base: { x: img.x, y: img.y }, segs, hist: [], s0: img.scale };
        en.shadow = this.addShadow(1.4 * U); en.aura = this.add.image(img.x, img.y, 'fx_soft').setDepth(4.8).setTint(0x5fe0a8).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setAlpha(0.3);
        body.enemy = en; this.enemies.push(en);
      } else if (e.type !== 'flyer') {
        const en = this.makeWorldEnemy(e); if (en) this.enemies.push(en);
      } else if (e.type === 'flyer') {
        const x = this.X(e.x), y = this.Y(e.y);
        const wb = this.add.image(x, y, 'fx_wing').setOrigin(0.05, 0.9).setDepth(4.8).setTint(0x8a6a4e).setScale(0.55);
        const bd = this.add.image(x, y, 'fx_fbody').setDepth(5).setScale(0.5);
        const wf = this.add.image(x, y, 'fx_wing').setOrigin(0.05, 0.9).setDepth(5.1).setScale(0.6);
        const body = this.matter.add.circle(x, y, 0.4 * U, { isStatic: true, isSensor: true, label: 'enemy' });
        const en = { kind: 'flyer', e, body, img: bd, wings: [wb, wf], alive: true, t: Math.random() * 6, base: { x, y } };
        en.shadow = this.addShadow(1.2 * U); body.enemy = en; this.enemies.push(en);
      }
    }
  }
  buildCheckpointsAndGoal() {
    this.checkpoint = { x: this.X(LV.playerStart.x), y: this.Y(LV.playerStart.y) };
    for (const c of LV.checkpoints) {
      const img = this.spr(artKey('checkpoint'), c.x, c.y - 0.5, 1.6, 'b', 2).setTint(0x9090a0);
      const body = this.matter.add.rectangle(img.x, img.y - 0.8 * U, 1.2 * U, 1.6 * U, { isStatic: true, isSensor: true, label: 'checkpoint' });
      body.ref = { img, c, active: false };
    }
    const g = LV.goal;
    const img = this.spr(artKey(g.type), g.x, g.y - 0.5, 2.6, 'b', 2);
    const cx = img.x, cy = img.y - 1.5 * U;
    const gh = this.add.image(cx, cy, 'fx_soft').setDepth(1.9).setTint(0xffc050).setBlendMode(Phaser.BlendModes.ADD).setScale(3).setAlpha(0.55);
    this.tweens.add({ targets: gh, scale: 3.8, alpha: 0.3, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const rays = [];
    for (let i = 0; i < 3; i++) { const ry = this.add.image(cx, cy, 'fx_ray').setOrigin(0.5, 0).setDepth(1.8).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6, 0.22).setAlpha(0.35).setRotation(i * 2.09); rays.push(ry); this.tweens.add({ targets: ry, rotation: ry.rotation + Math.PI * 2, duration: 14000, repeat: -1 }); }
    const em = this.add.particles(cx, cy, 'fx_spark', { lifespan: 1400, speed: { min: 10, max: 40 }, scale: { start: 0.3, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xfff0b0, 0xffc050], blendMode: 'ADD', frequency: LOWFX ? 400 : 120, emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 70) } }).setDepth(7);
    this.matter.add.rectangle(img.x, img.y - 1.3 * U, 1.6 * U, 2.6 * U, { isStatic: true, isSensor: true, label: 'goal' });
    // locked until every jade, pyrite and sun fragment is collected: dim altar, stone seal, hint
    const seal = this.add.image(cx, cy + 0.2 * U, 'ui_seal').setDepth(2.5).setScale(0.42);
    this.tweens.add({ targets: seal, angle: { from: -3, to: 3 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const hint = this.add.text(cx - 3.4 * U, cy - 0.4 * U, '', { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#ffe9b0', stroke: '#1a0c04', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setDepth(8);
    this.goal = { img, gh, rays, em, seal, hint, cx, cy, locked: true };
    img.setTint(0x6a6470).setAlpha(0.8); gh.setVisible(false); rays.forEach(r => r.setVisible(false)); em.stop();
  }
  cname() { return this.L.collect || 'jade'; }
  remaining() {
    const c = this.counts, t = this.totals;
    return { jade: t.jade_bead - c.jade_bead, pyrite: t.pyrite_sphere - c.pyrite_sphere, sun: t.sun_fragment - c.sun_fragment };
  }
  updateGoalLock() {
    const G = this.goal; if (!G) return;
    const r = this.remaining(), c = this.counts, t = this.totals;
    if (G.locked && r.jade <= 0 && r.pyrite <= 0 && r.sun <= 0) return this.unlockGoal();
    if (!G.locked) return;
    const extra = [r.pyrite > 0 ? r.pyrite + ' pyrite' : '', r.sun > 0 ? r.sun + ' sun fragment' + (r.sun > 1 ? 's' : '') : ''].filter(Boolean).join(' + ');
    G.hint.setText('SEALED\nCollect all ' + this.cname() + ' ' + c.jade_bead + '/' + t.jade_bead + (extra ? '\n+ ' + extra : ''));
  }
  unlockGoal() {
    const G = this.goal; G.locked = false;
    G.img.clearTint(); G.img.setAlpha(1); G.gh.setVisible(true); G.rays.forEach(r => r.setVisible(true)); G.em.start();
    this.tweens.killTweensOf(G.seal);
    this.tweens.add({ targets: G.seal, scale: 1.6, alpha: 0, angle: 40, duration: 500, ease: 'Cubic.out', onComplete: () => G.seal.destroy() });
    this.burst(this.pSpark, G.cx, G.cy, 50); this.burst(this.pJade, G.cx, G.cy, 30);
    for (let i = 0; i < 2; i++) { const ring = this.add.circle(G.cx, G.cy, 30).setStrokeStyle(6, i ? 0x9fffd0 : 0xffe080).setDepth(9).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: ring, scale: 6, alpha: 0, delay: i * 140, duration: 700, ease: 'Cubic.out', onComplete: () => ring.destroy() }); }
    G.hint.setText('THE SUN GATE IS OPEN!').setColor('#ffe080');
    this.tweens.add({ targets: G.hint, scale: 1.2, duration: 300, yoyo: true, repeat: 2 });
    this.cameras.main.flash(400, 255, 230, 160); this.cameras.main.shake(250, 0.006);
    this.sfx('goal_unlock', 0.9); this.toast('All treasures found - the Sun Gate is open!');
    this.updateHud();
  }
  buildHints() {
    for (const h of LV.tutorialHints || []) {
      this.add.text(this.X(h.x), this.Y(h.y), h.text, { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#ffe9b0', stroke: '#2a1408', strokeThickness: 4 })
        .setOrigin(0.5).setDepth(8).setAlpha(0.9);
    }
  }

  // ---------- player ----------
  makePlayer() {
    const x = this.X(LV.playerStart.x), y = this.Y(LV.playerStart.y);
    this.pbody = this.matter.add.circle(x, y, R, {
      label: 'player', friction: 0.08, frictionStatic: 0.2, frictionAir: 0.004, restitution: 0.25, density: 0.002,
      collisionFilter: { group: -1 },
    });
    this.orb = this.add.image(x, y, 'orb').setDepth(6); this.orb.setScale(2 * R / Math.max(this.orb.width, this.orb.height) * 1.02);
    this.spec = this.add.image(x, y, 'orb_spec').setDepth(7); this.spec.setScale(2 * R / this.spec.width * 1.02).setAlpha(0.8);
    this.glow = this.add.image(x, y, 'fx_soft').setDepth(5).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb040).setDisplaySize(R * 4.4, R * 4.4).setAlpha(0.35);
    this.orbRig = this.addLightRig(x, y, 2 * R * 1.02, 6); this.spec.setDepth(7.5);
    this.orbShadow = this.addShadow(2.6 * R);
    this.bolts = [];
  }
  syncOrb(p) {
    this.orb.setPosition(p.position.x, p.position.y).setRotation(p.angle); this.spec.setPosition(p.position.x, p.position.y); this.glow.setPosition(p.position.x, p.position.y);
    this.orbRig.set(p.position.x, p.position.y, 1, 1); this.placeShadow(this.orbShadow, p.position.x, p.position.y + R);
  }
  teleport(ux, uy) {
    MB.setPosition(this.pbody, { x: this.X(ux), y: this.Y(uy) }); MB.setVelocity(this.pbody, { x: 0, y: 0 }); MB.setAngularVelocity(this.pbody, 0);
    this.cameras.main.centerOn(this.X(ux), this.Y(uy));
  }
  respawn() {
    if (this.done) return;
    MB.setPosition(this.pbody, { x: this.checkpoint.x, y: this.checkpoint.y }); MB.setVelocity(this.pbody, { x: 0, y: 0 }); MB.setAngularVelocity(this.pbody, 0);
    this.cameras.main.flash(250, 255, 120, 60);
    for (const tr of this.traps) if (tr.type === 'crumble' && tr.state === 'gone') this.makeCrumble(tr);
    for (const en of this.enemies) if ((en.kind === 'roller' || en.home && en.r) && en.alive) { MB.setPosition(en.body, en.home); MB.setVelocity(en.body, { x: 0, y: 0 }); }
  }
  hurt(from) {
    if (this.time.now - (this.lastHurt || 0) < 800) return;
    this.lastHurt = this.time.now; this.sfx('hit', 0.8);
    const p = this.pbody.position, d = Math.sign(p.x - from.x) || 1;
    MB.setVelocity(this.pbody, { x: d * 9, y: -6 });
    this.cameras.main.shake(180, 0.006);
    this.tweens.add({ targets: this.orb, alpha: 0.3, duration: 90, yoyo: true, repeat: 3 }); this.hitFlash(this.orb, 70); this.burst(this.pSpark, p.x, p.y, 10);
  }
  fire(pointer) {
    if (this.done || this.time.now - (this.lastFire || 0) < 280) return;
    this.lastFire = this.time.now; this.startAudio(); this.shots = (this.shots || 0) + 1;
    const p = this.pbody.position; let dx = this.facing, dy = 0;
    if (pointer) { const wp = pointer.positionToCamera(this.cameras.main); dx = wp.x - p.x; dy = wp.y - p.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; }
    const sp = 16;
    const body = this.matter.add.circle(p.x + dx * (R + 10), p.y + dy * (R + 10), 9, { label: 'bolt', isSensor: true, ignoreGravity: true, collisionFilter: { group: -1 }, frictionAir: 0 });
    MB.setVelocity(body, { x: dx * sp + this.pbody.velocity.x * 0.3, y: dy * sp });
    const img = this.add.circle(body.position.x, body.position.y, 9, 0xffd23a).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    const halo = this.add.circle(body.position.x, body.position.y, 18, 0xff8a20, 0.35).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    this.groundBodiesDirty = true;
    const b = { body, img, halo, born: this.time.now }; body.bolt = b; this.bolts.push(b);
    this.sfx('fire', 0.45);
    this.burst(this.pSpark, body.position.x, body.position.y, 12);
  }
  killBolt(b) {
    this.groundBodiesDirty = true;
    if (b.dead) return; b.dead = true;
    this.burst(this.pSpark, b.body.position.x, b.body.position.y, 6);
    this.matter.world.remove(b.body); b.img.destroy(); b.halo.destroy();
  }
  killEnemy(en) {
    this.groundBodiesDirty = true;
    if (!en.alive) return; en.alive = false; this.sfx('enemy_death', 0.8);
    this.matter.world.remove(en.body); this.dyn = this.dyn.filter(d => d.body !== en.body);
    const ex = en.img.x, ey = en.img.y; this.hitFlash(en.img, 90);
    this.burst(this.pPuff, ex, ey, 18); this.burst(this.pSpark, ex, ey, 16); this.addScore(200, ex, ey);
    const parts = [en.img, ...(en.segs || []), ...(en.wings || [])]; if (en.aura) parts.push(en.aura);
    if (en.rig) en.rig.destroy(); if (en.shadow) en.shadow.destroy();
    this.tweens.add({ targets: parts, alpha: 0, scale: '*=1.4', angle: 180, delay: 90, duration: 400, onComplete: () => parts.forEach(o => o.destroy()) });
  }

  // ---------- collisions ----------
  onCollide(pairs, start) {
    for (const pr of pairs) {
      let a = pr.bodyA, b = pr.bodyB;
      a = a.parent || a; b = b.parent || b;
      if (b.label === 'player' || b.label === 'bolt') { [a, b] = [b, a]; }
      if (a.label === 'player') {
        if (!b.isSensor) {
          // ground if the contact normal points up from the player
          const n = pr.collision.normal; let up = n.y < 0 ? { x: n.x, y: n.y } : { x: -n.x, y: -n.y };  // normal pointing up, out of the ground
          const ny = -up.y;
          if (ny > 0.45) { this.lastGround = this.time.now; this.groundNormal = up; }
          if (start && this.prevSpeed > 6 && ny > 0.45 && this.time.now - (this.lastLand || 0) > 300) { this.lastLand = this.time.now; this.sfx(this.prevSpeed > 11 ? 'land_stone' : 'land', Math.min(0.8, 0.2 + this.prevSpeed / 25)); const q = this.pbody.position; this.burst(this.pDust, q.x, q.y + R * 0.9, Math.min(18, Math.round(this.prevSpeed))); this.landSquash = 1; }
        }
        if (!start) continue;
        this.playerHit(b);
      } else if (a.label === 'bolt' && start) {
        if (b.label === 'enemy') { this.killEnemy(b.enemy); this.killBolt(a.bolt); }
        else if (!b.isSensor && b.label !== 'player') this.killBolt(a.bolt);
      }
    }
  }
  playerHit(b) {
    switch (b.label) {
      case 'pickup': {
        const r = b.ref; if (r.taken) return; r.taken = true;
        this.counts[r.p.type] = (this.counts[r.p.type] || 0) + 1;
        if (r.p.type === 'jade_bead') { this.jadeChain = this.time.now - (this.lastJadeT || -1e9) < 1600 ? Math.min((this.jadeChain || 0) + 1, 12) : 0; this.lastJadeT = this.time.now; this.sfx('jade', 0.55, Math.pow(2, [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21][this.jadeChain] / 12)); } else this.sfx(r.p.type === 'pyrite_sphere' ? 'pyrite' : 'sun_fragment', 0.75);
        this.matter.world.remove(b);
        this.tweens.killTweensOf(r.img); for (const e of r.img.extras || []) { this.tweens.killTweensOf(e); e.destroy(); }
        this.tweens.add({ targets: r.img, y: r.img.y - 40, alpha: 0, scale: r.img.scale * 1.5, duration: 300, onComplete: () => r.img.destroy() });
        const jade = r.p.type === 'jade_bead';
        this.burst(jade ? this.pJade : this.pSpark, r.img.x, r.img.y, jade ? 16 : 28);
        const ring = this.add.circle(r.img.x, r.img.y, 18).setStrokeStyle(4, jade ? 0x9fffd0 : 0xffd060).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 380, ease: 'Cubic.out', onComplete: () => ring.destroy() });
        this.addScore({ jade_bead: 100, pyrite_sphere: 250, sun_fragment: 1000 }[r.p.type] || 100, r.img.x, r.img.y);
        if (r.p.secret) this.toast('Secret sun fragment!');
        this.updateHud(); break;
      }
      case 'spike': this.sfx('hit', 0.8); this.cameras.main.shake(150, 0.008); this.respawn(); break;
      case 'crumble': this.triggerCrumble(b.trap); break;
      case 'enemy': {
        const en = b.enemy; if (!en.alive) return;
        if (en.kind === 'carnivorous_plant' && en.harmless) return;
        const p = this.pbody, sp = Math.hypot(p.velocity.x, p.velocity.y);
        const above = p.position.y < en.body.position.y - 0.3 * U;
        if (above && Math.max(sp, this.prevSpeed) > 4) { this.killEnemy(en); MB.setVelocity(p, { x: p.velocity.x, y: -8 }); }
        else this.hurt(en.body.position);
        break;
      }
      case 'gate': {
        const r = b.ref; if (this.time.now - r.last < 800) return; r.last = this.time.now;
        const v = this.pbody.velocity, d = Math.sign(v.x) || this.facing;
        MB.setVelocity(this.pbody, { x: d * Math.max(Math.abs(v.x) * 1.6, 15), y: v.y });
        this.sfx('fw_launch', 0.5); this.toast('Speed gate!');
        this.tweens.add({ targets: r.img, scale: r.img.scale * 1.15, duration: 120, yoyo: true });
        break;
      }
      case 'checkpoint': {
        const r = b.ref; if (r.active) return; r.active = true; r.img.clearTint();
        this.checkpoint = { x: r.img.x, y: r.img.y - 1.2 * U }; this.toast('Checkpoint'); this.burst(this.pSpark, r.img.x, r.img.y - 0.8 * U, 30); this.fxGlow(r.img, 0xffc050, 3); this.sfx('star', 0.6); break;
      }
      case 'cracked': {
        const sp = Math.max(this.prevSpeed, Math.hypot(this.pbody.velocity.x, this.pbody.velocity.y)) * 60 / U;
        const sc = b.secret;
        if (sp >= sc.s.minSpeed) {
          this.matter.world.remove(b); this.groundBodiesDirty = true; this.sfx('door_open', 0.8); this.cameras.main.shake(200, 0.01);
          this.tweens.add({ targets: sc.img, alpha: 0, duration: 300, onComplete: () => sc.img.destroy() });
          for (let i = 0; i < 14; i++) { const c = this.add.rectangle(sc.img.x + U / 2, sc.img.y + Math.random() * sc.img.displayHeight, 10, 10, 0x8a7a68).setDepth(6); this.tweens.add({ targets: c, x: c.x - 80 - Math.random() * 120, y: c.y + 60 + Math.random() * 80, angle: 360, alpha: 0, duration: 700, onComplete: () => c.destroy() }); }
          this.secretsFound++; this.toast('Secret passage!'); this.addScore(2000, sc.img.x, sc.img.y, 'secret'); this.burst(this.pPuff, sc.img.x + U / 2, sc.img.y + sc.img.displayHeight / 2, 24); this.updateHud();
        } else if (this.time.now - (this.lastWallBonk || 0) > 600) { this.lastWallBonk = this.time.now; this.sfx('stone_bonk', 0.4); this.toast('The wall is cracked... hit it faster (' + sp.toFixed(1) + '/' + sc.s.minSpeed + ')'); }
        break;
      }
      case 'xolotl': {
        const r = b.ref; if (r.found) return; r.found = true; this.secretsFound++;
        this.toast('Xólotl found! Lore card unlocked'); this.addScore(2000, r.img.x, r.img.y, 'secret'); this.burst(this.pJade, r.img.x, r.img.y, 30); this.sfx('sun_fragment', 0.7); this.updateHud(); break;
      }
      case 'goal': if (this.goal && this.goal.locked) { if (this.time.now - (this.lastSealBonk || 0) > 1200) { this.lastSealBonk = this.time.now; this.sfx('stone_bonk', 0.6); this.cameras.main.shake(120, 0.004); const r = this.remaining(); this.toast('Sealed! Still need ' + [r.jade > 0 ? r.jade + ' ' + this.cname() : '', r.pyrite > 0 ? r.pyrite + ' pyrite' : '', r.sun > 0 ? r.sun + ' sun' : ''].filter(Boolean).join(', ')); this.tweens.add({ targets: this.goal.seal, scale: 0.48, duration: 80, yoyo: true }); } } else this.win(); break;
    }
  }

  // ---------- HUD ----------
  makeHud() {
    const st = { fontFamily: 'Georgia, serif', fontSize: '24px', color: '#ffe9b0', stroke: '#1a0c04', strokeThickness: 5 };
    this.makeFancyHud();
    this.add.text(VW / 2, VH - 14, 'A/D roll  Space jump  J/click fire  R restart  F effects  M mute', Object.assign({}, st, { fontSize: '16px' })).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100).setAlpha(0.8);
    this.toastText = this.add.text(VW / 2, 90, '', Object.assign({}, st, { fontSize: '28px' })).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.speedText = this.add.text(22, 104, '', Object.assign({}, st, { fontSize: '16px' })).setScrollFactor(0).setDepth(100).setAlpha(0.7);
    this.leftText = this.add.text(22, 78, '', Object.assign({}, st, { fontSize: '20px' })).setScrollFactor(0).setDepth(100);
    this.updateHud();
  }
  updateHud() {
    const c = this.counts, t = this.totals;
    this.refreshHudCounts(!!this.hudReady); this.hudReady = true;
    if (this.leftText) { const r = this.remaining(); this.leftText.setText(r.jade + r.pyrite + r.sun > 0 ? 'Left: ' + [r.jade + ' ' + this.cname(), r.pyrite + ' pyrite', r.sun + ' sun'].join('  ·  ') : 'All found! Go to the Sun Gate ▶').setColor(r.jade + r.pyrite + r.sun > 0 ? '#ffe9b0' : '#ffe080'); }
    this.updateGoalLock();
  }
  toast(msg) {
    this.toastText.setText(msg).setAlpha(1); this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1500, duration: 500 });
  }
  win() {
    if (this.done) return; this.done = true; setMenu(true);
    const secs = (this.time.now - (this.startTime || 0)) / 1000;
    this.stats = { level: this.levelIndex, time: secs, jade: this.counts.jade_bead, jadeTotal: this.totals.jade_bead, score: this.score, secrets: this.secretsFound, secretsTotal: (LV.secrets || []).length };
    this.stats.stars = 1 + (secs <= this.L.parTime ? 1 : 0) + (this.secretsFound >= this.stats.secretsTotal ? 1 : 0);
    try { const u = +(localStorage.getItem('teoUnlocked') || 1); if (this.levelIndex + 2 > u) localStorage.setItem('teoUnlocked', String(Math.min(LEVELS.length, this.levelIndex + 2))); } catch (_) { }
    MB.setVelocity(this.pbody, { x: 0, y: 0 }); MB.setAngularVelocity(this.pbody, 0);
    this.fireworks(this.goal.cx, this.goal.cy);
    this.time.delayedCall(2300, () => this.scene.launch('complete', this.stats));
  }
  fireworks(x, y) {
    const cam = this.cameras.main, G = this.goal, PAL = [0xffd060, 0x5fe0a8, 0x40d0e0, 0xff6a4a, 0xff8ac0, 0xfff4d8, 0xffa030];
    cam.stopFollow(); cam.pan(x, y - 2.5 * U, 700, 'Sine.easeInOut');
    cam.flash(500, 255, 240, 200); cam.shake(500, 0.014); this.sfx('title_boom', 0.8);
    // the altar bursts: glow pop, shock rings, stone shards
    this.tweens.add({ targets: G.img, scale: G.img.scale * 1.35, alpha: 0, duration: 450, ease: 'Cubic.out' });
    for (let i = 0; i < 3; i++) { const ring = this.add.circle(x, y, 40).setStrokeStyle(10 - i * 3, PAL[i]).setDepth(30).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: ring, scale: 9 + i * 3, alpha: 0, delay: i * 120, duration: 900, ease: 'Cubic.out', onComplete: () => ring.destroy() }); }
    const shards = this.add.particles(x, y, 'fx_spark', { speed: { min: 250, max: 650 }, angle: { min: 0, max: 360 }, gravityY: 600, lifespan: 1400, scale: { start: 0.9, end: 0 }, rotate: { min: 0, max: 360 }, tint: PAL, blendMode: 'ADD', emitting: false }).setDepth(30);
    shards.explode(LOWFX ? 40 : 110);
    this.burst(this.pSpark, x, y, 60); this.burst(this.pJade, x, y, 40);
    // rockets with trails, bursting into coloured stars, then crackle sparkle
    const n = LOWFX ? 6 : 12;
    for (let i = 0; i < n; i++) this.time.delayedCall(120 + i * 170 + Math.random() * 120, () => {
      const col = PAL[i % PAL.length], wv = cam.worldView, tx = Phaser.Math.Clamp(x + Phaser.Math.Between(-520, 520), wv.x + 120, wv.right - 120), ty = Phaser.Math.Between(wv.y + 110, wv.y + 380);
      const rk = this.add.image(x + Phaser.Math.Between(-40, 40), y, 'fx_spark').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setDepth(31);
      const trail = this.add.particles(0, 0, 'fx_spark', { follow: rk, lifespan: 500, speed: { min: 5, max: 30 }, scale: { start: 0.45, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [col, 0xfff4d8], blendMode: 'ADD', frequency: LOWFX ? 40 : 14 }).setDepth(30);
      this.sfx('fw_launch', 0.35, 0.9 + Math.random() * 0.3);
      this.tweens.add({ targets: rk, x: tx, y: ty, duration: 450 + Math.random() * 200, ease: 'Quad.out', onComplete: () => {
        rk.destroy(); trail.stop(); this.time.delayedCall(600, () => trail.destroy());
        this.sfx('fw_pop', 0.6, 0.85 + Math.random() * 0.3); cam.shake(160, 0.005);
        const c2 = PAL[(i + 3) % PAL.length];
        const bl = this.add.particles(tx, ty, 'fx_spark', { speed: { min: 120, max: 480 }, angle: { min: 0, max: 360 }, gravityY: 160, lifespan: { min: 900, max: 1600 }, scale: { start: 0.95, end: 0 }, alpha: { start: 1, end: 0 }, tint: [col, c2, 0xffffff], blendMode: 'ADD', emitting: false }).setDepth(31);
        bl.explode(LOWFX ? 40 : 130);
        const fl = this.add.image(tx, ty, 'fx_soft').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setScale(3).setDepth(30); this.tweens.add({ targets: fl, scale: 6, alpha: 0, duration: 450, onComplete: () => fl.destroy() });
        this.time.delayedCall(350, () => {
          this.sfx('fw_crackle', 0.4);
          const sp = this.add.particles(tx, ty, 'fx_spark', { speed: { min: 20, max: 260 }, angle: { min: 0, max: 360 }, gravityY: 220, lifespan: { min: 300, max: 1000 }, scale: { start: 0.4, end: 0 }, alpha: { start: 1, end: 0, ease: 'Stepped' }, tint: 0xfff4d8, blendMode: 'ADD', emitting: false }).setDepth(31);
          sp.explode(LOWFX ? 15 : 45); this.time.delayedCall(1800, () => { sp.destroy(); bl.destroy(); });
        });
      } });
    });
  }

  debugState() {
    const p = this.pbody.position;
    return { x: p.x / U + LV.bounds.xMin, y: LV.bounds.yMax - p.y / U, speed: Math.hypot(this.pbody.velocity.x, this.pbody.velocity.y) * 60 / U, grounded: this.time.now - this.lastGround < 120, counts: this.counts, done: this.done };
  }

  // ---------- loop ----------
  update(time) {
    if (this.startTime === undefined) this.startTime = time;
    const k = this.keys, p = this.pbody;
    const left = k.A.isDown || k.LEFT.isDown || PAD.left, right = k.D.isDown || k.RIGHT.isDown || PAD.right;
    // ground probe (backs up the contact events): points just outside the orb, straight down and up to 50 deg either side
    if (!this.groundBodies || this.groundBodiesDirty) { this.groundBodies = this.matter.world.localWorld.bodies.filter(b => !b.isSensor && b !== p && b.label !== 'bolt'); this.groundBodiesDirty = false; }
    for (const a of [0, -0.45, 0.45, -0.87, 0.87]) {
      const q = { x: p.position.x + Math.sin(a) * (R + 5), y: p.position.y + Math.cos(a) * (R + 5) };
      if (Phaser.Physics.Matter.Matter.Query.point(this.groundBodies, q).length) { this.lastGround = time; if (a === 0 || !this.groundNormal) this.groundNormal = this.groundNormal || { x: 0, y: -1 }; break; }
    }
    const grounded = time - this.lastGround < 130;     // coyote time
    if (this.updateWorld(time, p, grounded, Math.min(0.05, this.game.loop.delta / 1000))) { this.syncOrb(p); this.updateParallax(); this.updateAmbient(time); return; }
    let dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (!dir && TILT.on) dir = Phaser.Math.Clamp(TILT.dir, -1, 1);   // analog tilt; keys/buttons override
    if (this.done) dir = 0;
    if (Math.abs(dir) > 0.15) this.facing = Math.sign(dir);
    // roll: spin the marble (torque) and push a little; less push in the air
    const maxSpin = 0.42;
    if (dir) {
      const av = p.angularVelocity + dir * (grounded ? 0.018 : 0.006), cap = maxSpin * Math.max(0.35, Math.abs(dir));
      MB.setAngularVelocity(p, Math.abs(av) > cap && Math.abs(av) > Math.abs(p.angularVelocity) ? Math.sign(av) * Math.max(cap, Math.abs(p.angularVelocity)) : Phaser.Math.Clamp(av, -maxSpin, maxSpin));
      const f = (grounded ? 0.00055 : 0.00018) * p.mass;
      const gn = grounded && this.groundNormal ? this.groundNormal : { x: 0, y: -1 };
      MB.applyForce(p, p.position, { x: dir * f * -gn.y, y: dir * f * gn.x });   // along the surface tangent
    } else if (grounded && (k.S.isDown || k.DOWN.isDown)) {
      MB.setVelocity(p, { x: p.velocity.x * 0.96, y: p.velocity.y }); MB.setAngularVelocity(p, p.angularVelocity * 0.9);
    }
    if (!grounded && k.W.isDown && !this.done) MB.applyForce(p, p.position, { x: 0, y: -0.00025 * p.mass });  // slight air lift
    // jump (buffered 120 ms, coyote 120 ms)
    if (this.jumpQueued && time - this.jumpQueued < Math.max(120, 2.5 * this.game.loop.delta) && grounded && time - this.lastJump > 250 && !this.done) {
      this.jumpQueued = 0; this.lastJump = time; this.lastGround = -1e9;
      const n = this.groundNormal || { x: 0, y: -1 };
      const jv = 10.2;
      MB.setVelocity(p, { x: p.velocity.x + n.x * jv * 0.35, y: Math.min(p.velocity.y, 0) - jv * (0.65 + 0.35 * -n.y) });
      this.sfx('jump', 0.5, 0.95 + Math.random() * 0.1);
    }
    // speed cap (prevents tunnelling)
    const sp = Math.hypot(p.velocity.x, p.velocity.y);
    if (sp > 24) MB.setVelocity(p, { x: p.velocity.x * 24 / sp, y: p.velocity.y * 24 / sp });
    this.prevSpeed = sp;
    // fell out of the world
    if (p.position.y > this.H + 100) this.respawn();

    // sync visuals
    this.landSquash = Math.max(0, (this.landSquash || 0) - 0.12);
    const lsq = Math.sin(this.landSquash * Math.PI) * 0.14;   // squash on landing (world axes: rig only)
    this.orb.setPosition(p.position.x, p.position.y + lsq * R).setRotation(p.angle);
    this.spec.setPosition(p.position.x, p.position.y + lsq * R);
    this.glow.setPosition(p.position.x, p.position.y);
    this.orbRig.set(p.position.x, p.position.y + lsq * R, 1 + lsq, 1 - lsq);
    this.placeShadow(this.orbShadow, p.position.x, p.position.y + R);
    if (grounded && sp > 6 && Math.random() < (LOWFX ? 0.15 : 0.5) * Math.min(1, (sp - 5) / 8)) {
      const gy = this.groundY(p.position.x, p.position.y);
      if (gy - p.position.y < R + 14) this.pDust.emitParticleAt(p.position.x - Math.sign(p.velocity.x) * R * 0.5, gy - 4, 1);
    }
    for (const d of this.dyn) d.img.setPosition(d.body.position.x, d.body.position.y).setRotation(d.body.angle);

    // tilting slab: weak self-righting spring + angle limit
    if (this.slab) {
      const s = this.slab.body;
      if (Math.abs(s.angle) > 0.45) { MB.setAngle(s, Math.sign(s.angle) * 0.45); MB.setAngularVelocity(s, 0); }
      MB.setAngularVelocity(s, s.angularVelocity - s.angle * 0.002);
    }
    // enemies
    for (const en of this.enemies) {
      if (!en.alive) continue;
      if (en.kind === 'roller') {
        const b = en.body, pa = en.e.patrol, xMin = this.X(pa.xMin), xMax = this.X(pa.xMax);
        const dx = p.position.x - b.position.x, dy = p.position.y - b.position.y;
        let want;
        if (Math.abs(dx) < 7 * U && Math.abs(dy) < 2.5 * U) want = Math.sign(dx);   // chase
        else { if (b.position.x < xMin) en.dir = 1; if (b.position.x > xMax) en.dir = -1; want = en.dir; }
        if (b.position.x < xMin - U && want < 0) want = 1; if (b.position.x > xMax + U && want > 0) want = -1;  // stay near its ledge
        MB.setAngularVelocity(b, Phaser.Math.Clamp(b.angularVelocity + want * 0.01, -0.18, 0.18));
        MB.applyForce(b, b.position, { x: want * 0.00025 * b.mass, y: 0 });
        if (b.position.y > this.H) this.killEnemy(en);
        if (b.velocity.y < 0.5 && en.pvy > 3) en.sq = 1; en.pvy = b.velocity.y; en.sq = Math.max(0, en.sq - 0.08); en.t = (en.t || 0) + 1 / 60;
        const sq = Math.sin(en.sq * Math.PI) * 0.2 + Math.sin(en.t * 14) * 0.025 * Math.min(1, Math.abs(b.velocity.x) / 2);
        en.img.setPosition(b.position.x, b.position.y + sq * en.r * 0.5).setRotation(b.angle).setScale(en.s0 * (1 + sq * 0.6), en.s0 * (1 - sq));
        en.rig.set(b.position.x, b.position.y + sq * en.r * 0.5, 1 + sq * 0.6, 1 - sq);
        this.placeShadow(en.shadow, b.position.x, b.position.y + en.r);
      } else if (en.kind === 'hover') {
        en.t += 1 / 60; const hv = en.e.hover; const cx = (this.X(hv.xMin) + this.X(hv.xMax)) / 2, ax = (hv.xMax - hv.xMin) / 2 * U;
        const x = cx + Math.sin(en.t * 0.6) * ax, y = en.base.y + Math.sin(en.t * 2.1) * 0.5 * U;
        MB.setPosition(en.body, { x, y });
        const vx = Math.cos(en.t * 0.6), vy = Math.cos(en.t * 2.1) * 2.1 * 0.5 * U / (0.6 * ax || 1);
        en.img.setPosition(x, y).setFlipX(vx < 0).setRotation(Math.atan2(vy * 0.15, 1) * (vx < 0 ? -1 : 1)).setScale(en.s0 * (1 + Math.sin(en.t * 4) * 0.04), en.s0 * (1 - Math.sin(en.t * 4) * 0.04));
        en.hist.unshift({ x, y }); if (en.hist.length > 60) en.hist.pop();
        en.segs.forEach((sg, i) => { const h = en.hist[Math.min(en.hist.length - 1, 4 + i * 5)]; sg.setPosition(h.x - (vx < 0 ? -1 : 1) * 10, h.y + 14 + Math.sin(en.t * 6 - i * 0.8) * 7); });
        en.aura.setPosition(x, y).setAlpha(0.22 + Math.sin(en.t * 3) * 0.08);
        this.placeShadow(en.shadow, x, y + 0.6 * U);
      } else if (en.kind !== 'flyer') {
        this.updateWorldEnemy(en, p, time, Math.min(0.05, this.game.loop.delta / 1000));
      } else if (en.kind === 'flyer') {
        en.t += 1 / 60; const rg = (en.e.range || 3) * U;
        const x = en.base.x + Math.sin(en.t * 0.7) * rg, flap = Math.sin(en.t * 16), y = en.base.y + Math.sin(en.t * 1.7) * 0.4 * U - flap * 3;
        const f = Math.cos(en.t * 0.7) < 0 ? -1 : 1;
        MB.setPosition(en.body, { x, y });
        en.img.setPosition(x, y).setFlipX(f < 0);
        en.wings.forEach((w, i) => { w.setPosition(x - f * 4, y - 6).setFlipX(f < 0).setOrigin(f < 0 ? 0.95 : 0.05, 0.9).setScale(0.55 + i * 0.05, (0.55 + i * 0.05) * (0.25 + 0.75 * Math.abs(flap))).setRotation(f * (flap * 0.5 - (i ? 0.3 : 0.6))); });
        this.placeShadow(en.shadow, x, y + 0.4 * U);
      }
    }
    // bolts
    for (const b of this.bolts) {
      if (b.dead) continue;
      b.img.setPosition(b.body.position.x, b.body.position.y); b.halo.setPosition(b.body.position.x, b.body.position.y);
      if (!LOWFX || (time | 0) % 3 === 0) this.pTrail.emitParticleAt(b.body.position.x, b.body.position.y, 1);
      if (time - b.born > 1200) this.killBolt(b);
    }
    this.bolts = this.bolts.filter(b => !b.dead);

    this.updateRollSound(sp, grounded);
    this.updateParallax(); this.updateAmbient(time);
    this.speedText.setText('Speed ' + (sp * 60 / U).toFixed(1) + ' u/s');
  }
}

Object.assign(Game.prototype, window.TEO_FXM, window.TEO_WFX);
window.TEO_GAME = Game;
