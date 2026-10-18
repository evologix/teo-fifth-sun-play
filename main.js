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

const TEX = {
  bg: { L0_sky: 'assets/bg/L0_sky.jpg', L1_far: 'assets/bg/L1_far.webp', L2_mid: 'assets/bg/L2_mid.webp', L3_near: 'assets/bg/L3_near.webp' },
  sprites: ['jade_bead', 'speed_gate', 'sun_fragment', 'mask_roller', 'serpent_spirit', 'orb', 'orb_spec', 'cracked_wall',
    'mask_a', 'mask_b', 'serpent_head', 'xolotl', 'spike_strip', 'tilting_slab'],
  blocks: ['block_fill', 'block_top', 'block_corner_L', 'block_corner_R', 'ramp_22_5', 'ramp_30', 'ramp_45', 'spriteshape_fill', 'edge_strip'],
  sfx: ['jump_01', 'collect_beads', 'collect_pyrite_bell', 'hit_01', 'hit_hurt_01', 'fire_01', 'hit_stone_01', 'land_stone_01', 'creak_01', 'door_open'],
};

const artKey = (type) => { const p = LV && LV.art && LV.art.sprites[type]; return p ? p.split('/').pop().replace('.png', '') : type; };

class Game extends Phaser.Scene {
  constructor() { super('game'); }

  preload() {
    this.load.json('level', V('assets/levels/level01.json'));
    this.load.json('terrain', V('assets/terrain/level01_terrain.json'));
    this.load.on('filecomplete-json-terrain', (key, type, data) => data.segments.forEach((sg, i) => this.load.image('seg' + i, V('assets/terrain/' + sg.image))));
    for (const [k, p] of Object.entries(TEX.bg)) this.load.image(k, V(p));
    for (const s of TEX.sprites) this.load.image(s, V('assets/sprites/' + s + '.png'));
    for (const s of TEX.sfx) this.load.audio(s, V('assets/sfx/' + s + '.ogg'));
    this.load.audio('music', V('assets/music/temple.ogg'));
  }

  // level units (+y up) -> world pixels (+y down)
  X(x) { return (x - LV.bounds.xMin) * U; }
  Y(y) { return (LV.bounds.yMax - y) * U; }

  create() {
    LV = this.cache.json.get('level'); this.TR = this.cache.json.get('terrain');
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
    this.secretsFound = 0; this.done = false; this.lastGround = -1e9; this.lastJump = -1e9; this.facing = 1; this.prevSpeed = 0;

    this.buildTerrain(); this.buildSurfaceCache(); this.makeParticles(); this.shadows = [];
    this.buildDecor(); this.traps = []; this.buildSecrets(); this.buildPickups(); this.buildEnemies();
    this.buildCheckpointsAndGoal(); this.buildHints();
    this.makePlayer(); this.buildBraziers(); this.buildAmbient(); this.fxOn = !LOWFX;

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
    this.input.keyboard.on('keydown-M', () => { if (this.music) this.music.setMute(!this.music.mute); });
    // canvas click fires toward the cursor; the DOM buttons sit above the canvas and swallow their own events, and we also
    // ignore any pointer whose DOM target is not the canvas itself
    this.input.on('pointerdown', (p) => { this.startAudio(); const tg = p.event && p.event.target; if (tg && tg !== this.game.canvas) return; if (p.leftButtonDown() || p.wasTouch) this.fire(p); });
    PAD.scene = this;
    this.input.keyboard.on('keydown', () => this.startAudio());

    this.matter.world.on('collisionstart', (e) => this.onCollide(e.pairs, true));
    this.matter.world.on('collisionactive', (e) => this.onCollide(e.pairs, false));

    this.makeHud();
    window.TEO = { lowfx: LOWFX, fps: () => this.game.loop.actualFps, scene: this, teleport: (x, y) => this.teleport(x, y), state: () => this.debugState(), shots: () => this.shots || 0 };
  }

  // ---------- audio ----------
  startAudio() {
    if (this.audioStarted) return;
    this.audioStarted = true;
    try { if (this.sound.context && this.sound.context.state === 'suspended') this.sound.context.resume(); } catch (e) { }
    if (this.cache.audio.exists('music')) { this.music = this.sound.add('music', { loop: true, volume: 0.45 }); this.music.play(); }
  }
  sfx(k, vol = 0.6) { if (this.audioStarted && this.cache.audio.exists(k)) this.sound.play(k, { volume: vol }); }

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
    this.add.rectangle(0, 0, VW, VH, 0x0a0814, 0.28).setOrigin(0).setScrollFactor(0).setDepth(-90);
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
    const res = (o) => { if (o && o.h !== undefined && o.y === undefined) o.y = LV.bounds.yMax - this.surfaceAt(o.x * U) / U + o.h; };
    res(LV.playerStart); res(LV.goal);
    for (const k of ['pickups', 'enemies', 'checkpoints', 'secrets', 'decor', 'tutorialHints']) for (const o of LV[k] || []) res(o);
    for (const o of LV.decor || []) o.y += 0.9;
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
      this.add.image(r.ox, 0, 'seg' + i).setOrigin(0).setScale(this.TR.scale).setDepth(0);
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
    tr.state = 'shaking'; this.sfx('creak_01', 0.7);
    this.tweens.add({ targets: tr.img, x: tr.img.x + 3, duration: 50, yoyo: true, repeat: 6 });
    this.time.delayedCall(600, () => {
      tr.state = 'falling'; this.groundBodiesDirty = true; this.sfx('hit_stone_01', 0.6);
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
    const size = { jade_bead: 0.6, speed_gate: 2.2, sun_fragment: 1.1, pyrite_sphere: 0.8 };
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
        .setTint(p.type === 'jade_bead' ? 0x5fe0a8 : 0xffc040).setScale(size[p.type] * U / 64).setAlpha(0.35);
      this.tweens.add({ targets: halo, alpha: 0.12, scale: halo.scale * 0.8, duration: 800 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const glint = this.add.image(img.x - size[p.type] * U * 0.18, img.y - size[p.type] * U * 0.2, 'fx_spark').setDepth(4.2).setBlendMode(Phaser.BlendModes.ADD).setScale(0).setTint(0xfff6e0);
      this.tweens.add({ targets: glint, scale: size[p.type] * 0.5, angle: 90, duration: 220, yoyo: true, repeat: -1, repeatDelay: 1400 + Math.random() * 2400, delay: Math.random() * 2000 });
      const shadow = this.addShadow(size[p.type] * U * 1.1); this.placeShadow(shadow, img.x, img.y + size[p.type] * U * 0.4);
      if (p.type !== 'jade_bead') { this.fxGlow(img, 0xffb030, 5); this.tweens.add({ targets: img, angle: 360, duration: 6000, repeat: -1 }); }
      img.extras = [halo, glint, shadow];
      const body = this.matter.add.circle(img.x, img.y, size[p.type] * U * 0.45, { isStatic: true, isSensor: true, label: 'pickup' });
      body.ref = { img, p };
    }
  }
  buildEnemies() {
    this.enemies = [];
    const list = LV.enemies.slice().concat([{ type: 'flyer', x: 53, h: 4.6, range: 3.5 }, { type: 'flyer', x: 110, h: 5, range: 3 }]);
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
    const gh = this.add.image(img.x, img.y - 1.5 * U, 'fx_soft').setDepth(1.9).setTint(0xffc050).setBlendMode(Phaser.BlendModes.ADD).setScale(3).setAlpha(0.55);
    this.tweens.add({ targets: gh, scale: 3.8, alpha: 0.3, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    for (let i = 0; i < 3; i++) { const ry = this.add.image(img.x, img.y - 1.5 * U, 'fx_ray').setOrigin(0.5, 0).setDepth(1.8).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6, 0.22).setAlpha(0.35).setRotation(i * 2.09); this.tweens.add({ targets: ry, rotation: ry.rotation + Math.PI * 2, duration: 14000, repeat: -1 }); }
    this.fxGlow(img, 0xffc050, 4);
    this.add.particles(img.x, img.y - 1.5 * U, 'fx_spark', { lifespan: 1400, speed: { min: 10, max: 40 }, scale: { start: 0.3, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xfff0b0, 0xffc050], blendMode: 'ADD', frequency: LOWFX ? 400 : 120, emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 70) } }).setDepth(7);
    this.matter.add.rectangle(img.x, img.y - 1.3 * U, 1.6 * U, 2.6 * U, { isStatic: true, isSensor: true, label: 'goal' });
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
  teleport(ux, uy) {
    MB.setPosition(this.pbody, { x: this.X(ux), y: this.Y(uy) }); MB.setVelocity(this.pbody, { x: 0, y: 0 }); MB.setAngularVelocity(this.pbody, 0);
    this.cameras.main.centerOn(this.X(ux), this.Y(uy));
  }
  respawn() {
    if (this.done) return;
    MB.setPosition(this.pbody, { x: this.checkpoint.x, y: this.checkpoint.y }); MB.setVelocity(this.pbody, { x: 0, y: 0 }); MB.setAngularVelocity(this.pbody, 0);
    this.cameras.main.flash(250, 255, 120, 60);
    for (const tr of this.traps) if (tr.type === 'crumble' && tr.state === 'gone') this.makeCrumble(tr);
    for (const en of this.enemies) if (en.kind === 'roller' && en.alive) { MB.setPosition(en.body, en.home); MB.setVelocity(en.body, { x: 0, y: 0 }); }
  }
  hurt(from) {
    if (this.time.now - (this.lastHurt || 0) < 800) return;
    this.lastHurt = this.time.now; this.sfx('hit_hurt_01', 0.8);
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
    this.sfx('fire_01', 0.5);
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
    if (!en.alive) return; en.alive = false; this.sfx('hit_01', 0.8);
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
          if (start && this.prevSpeed > 6 && ny > 0.45 && this.time.now - (this.lastLand || 0) > 300) { this.lastLand = this.time.now; if (this.prevSpeed > 9) this.sfx('land_stone_01', 0.35); const q = this.pbody.position; this.burst(this.pDust, q.x, q.y + R * 0.9, Math.min(18, Math.round(this.prevSpeed))); this.landSquash = 1; }
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
        this.sfx(r.p.type === 'jade_bead' ? 'collect_beads' : 'collect_pyrite_bell', 0.6);
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
      case 'spike': this.sfx('hit_hurt_01', 0.8); this.cameras.main.shake(150, 0.008); this.respawn(); break;
      case 'crumble': this.triggerCrumble(b.trap); break;
      case 'enemy': {
        const en = b.enemy; if (!en.alive) return;
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
        this.sfx('collect_pyrite_bell', 0.5); this.toast('Speed gate!');
        this.tweens.add({ targets: r.img, scale: r.img.scale * 1.15, duration: 120, yoyo: true });
        break;
      }
      case 'checkpoint': {
        const r = b.ref; if (r.active) return; r.active = true; r.img.clearTint();
        this.checkpoint = { x: r.img.x, y: r.img.y - 1.2 * U }; this.toast('Checkpoint'); this.burst(this.pSpark, r.img.x, r.img.y - 0.8 * U, 30); this.fxGlow(r.img, 0xffc050, 3); this.sfx('collect_pyrite_bell', 0.5); break;
      }
      case 'cracked': {
        const sp = Math.max(this.prevSpeed, Math.hypot(this.pbody.velocity.x, this.pbody.velocity.y)) * 60 / U;
        const sc = b.secret;
        if (sp >= sc.s.minSpeed) {
          this.matter.world.remove(b); this.groundBodiesDirty = true; this.sfx('door_open', 0.8); this.cameras.main.shake(200, 0.01);
          this.tweens.add({ targets: sc.img, alpha: 0, duration: 300, onComplete: () => sc.img.destroy() });
          for (let i = 0; i < 14; i++) { const c = this.add.rectangle(sc.img.x + U / 2, sc.img.y + Math.random() * sc.img.displayHeight, 10, 10, 0x8a7a68).setDepth(6); this.tweens.add({ targets: c, x: c.x - 80 - Math.random() * 120, y: c.y + 60 + Math.random() * 80, angle: 360, alpha: 0, duration: 700, onComplete: () => c.destroy() }); }
          this.secretsFound++; this.toast('Secret passage!'); this.addScore(2000, sc.img.x, sc.img.y, 'secret'); this.burst(this.pPuff, sc.img.x + U / 2, sc.img.y + sc.img.displayHeight / 2, 24); this.updateHud();
        } else if (this.time.now - (this.lastWallBonk || 0) > 600) { this.lastWallBonk = this.time.now; this.sfx('hit_stone_01', 0.4); this.toast('The wall is cracked... hit it faster (' + sp.toFixed(1) + '/' + sc.s.minSpeed + ')'); }
        break;
      }
      case 'xolotl': {
        const r = b.ref; if (r.found) return; r.found = true; this.secretsFound++;
        this.toast('Xólotl found! Lore card unlocked'); this.addScore(2000, r.img.x, r.img.y, 'secret'); this.burst(this.pJade, r.img.x, r.img.y, 30); this.sfx('collect_pyrite_bell', 0.7); this.updateHud(); break;
      }
      case 'goal': this.win(); break;
    }
  }

  // ---------- HUD ----------
  makeHud() {
    const st = { fontFamily: 'Georgia, serif', fontSize: '24px', color: '#ffe9b0', stroke: '#1a0c04', strokeThickness: 5 };
    this.makeFancyHud();
    this.add.text(VW - 20, 100 - 2, 'A/D roll  Space jump  J/click fire  R restart  F effects', Object.assign({}, st, { fontSize: '16px' })).setOrigin(1, 0).setScrollFactor(0).setDepth(100).setAlpha(0.8);
    this.toastText = this.add.text(VW / 2, 90, '', Object.assign({}, st, { fontSize: '28px' })).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.speedText = this.add.text(22, 78, '', Object.assign({}, st, { fontSize: '18px' })).setScrollFactor(0).setDepth(100);
    this.updateHud();
  }
  updateHud() {
    const c = this.counts, t = this.totals;
    this.refreshHudCounts(!!this.hudReady); this.hudReady = true;
  }
  toast(msg) {
    this.toastText.setText(msg).setAlpha(1); this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1500, duration: 500 });
  }
  win() {
    if (this.done) return; this.done = true; this.sfx('collect_pyrite_bell', 0.9);
    const st = { fontFamily: 'Georgia, serif', fontSize: '64px', color: '#ffd76a', stroke: '#2a1206', strokeThickness: 8 };
    this.add.rectangle(0, 0, VW, VH, 0x000000, 0.45).setOrigin(0).setScrollFactor(0).setDepth(110);
    this.add.text(VW / 2, VH / 2 - 40, 'Level complete', st).setOrigin(0.5).setScrollFactor(0).setDepth(111);
    const c = this.counts, t = this.totals, secs = ((this.time.now - (this.startTime || 0)) / 1000).toFixed(1);
    this.add.text(VW / 2, VH / 2 + 40, `Jade ${c.jade_bead}/${t.jade_bead}  Pyrite ${c.pyrite_sphere}/${t.pyrite_sphere}  Sun fragments ${c.sun_fragment}/${t.sun_fragment}  Secrets ${this.secretsFound}/${(LV.secrets || []).length}\nScore ${this.score.toLocaleString('en-GB')}   Time ${secs}s  -  press R to play again`,
      Object.assign({}, st, { fontSize: '24px', strokeThickness: 4, align: 'center' })).setOrigin(0.5).setScrollFactor(0).setDepth(111);
    this.input.keyboard.once('keydown-R', () => { if (this.music) this.music.stop(); this.scene.restart(); });
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
    let dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (this.done) dir = 0;
    if (dir) this.facing = dir;
    // roll: spin the marble (torque) and push a little; less push in the air
    const maxSpin = 0.42;
    if (dir) {
      const av = p.angularVelocity + dir * (grounded ? 0.018 : 0.006);
      MB.setAngularVelocity(p, Phaser.Math.Clamp(av, -maxSpin, maxSpin));
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
      this.sfx('jump_01', 0.5);
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

    this.updateParallax(); this.updateAmbient(time);
    this.speedText.setText('Speed ' + (sp * 60 / U).toFixed(1) + ' u/s');
  }
}

Object.assign(Game.prototype, window.TEO_FXM);
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VW, height: VH,
  backgroundColor: '#120c1c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'matter', matter: { gravity: { y: 1 }, debug: false } },
  input: { mouse: { preventDefaultDown: true } },
  scene: [Game],
});
