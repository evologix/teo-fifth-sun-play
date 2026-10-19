# Teò: Fifth Sun: Level 1 (web build)

A playable browser version of **Level01 "Temple Outskirts"**. It uses Phaser 3.80.1 with Matter.js physics, plain JavaScript and no build step. Phaser is vendored in `lib/phaser.min.js` and every asset is in `assets/`, so the folder works offline and stands on its own.

## Run it
Browsers block `fetch`/XHR from `file://`, so serve the folder over HTTP:

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000/web/
```
(or `cd web && python3 -m http.server 8000` and open http://localhost:8000/). VS Code **Live Server** works too: right-click `web/index.html`, then "Open with Live Server".

Audio starts on the first key press or click, because browsers block autoplay.

## Controls
| Action | Keys |
|---|---|
| Roll left / right | A / D or ← / → (applies spin plus a push along the surface) |
| Jump | Space or ↑ (only when grounded; 130 ms coyote time and a 120 ms jump buffer) |
| Air nudge | W (slight upward force while airborne) |
| Brake | S / ↓ on the ground |
| Sun-bolt | J (fires the way you face) or left click (fires toward the cursor) |
| Back to checkpoint / restart after the goal | R |
| Mute music | M |
| On-screen buttons | ◀ ▶ bottom-left, FIRE / JUMP bottom-right (mouse hold or multi-touch; for remote viewers without keyboard). Clicking a button never triggers click-fire. |

## What's in it
- A 1280x720 (16:9) canvas that scales to fit the window. Camera follows the orb with smoothing in every direction.
- A 4-layer Temple parallax (sky, far, mid, near). Each layer scrolls at its own factor on X and Y and repeats mirrored.
- Terrain built from `assets/Level01.json` at 64 px per unit:
  - Blocks: tiled fill, cap row, and corner caps only on exposed ends.
  - Ramps (22.5°, 30°, 45°): exact `tan(a)` triangle bodies, drawn as per-unit wedges as in `tools/preview_level01.py`.
  - The bowl and hump SpriteShapes: Catmull-Rom splines. Each is a masked fill plus an edge strip warped along the curve, with a chain of static segments whose top edge lies on the curve.
- The orb: a Matter circle (low friction, restitution 0.25). The sprite rotates with the body; a fixed specular/shade overlay stays on top so the lighting doesn't turn.
- Enemies: the stone-mask roller patrols its ledge and rolls toward you when you're close. Land on it with speed or hit it with a sun-bolt; touching it otherwise knocks you back. There is also a hovering serpent spirit over the plaza bowl. It is extra and not in the JSON.
- Traps:
  - Spike strip: sends you back to the checkpoint.
  - Crumbling step: shakes and falls about 0.6 s after contact, and comes back on respawn.
  - Tilting slab: on a hinge with a weak self-righting spring.
  - Speed gate: boosts you in the direction you're travelling.
- Pickups with a HUD counter (jade, pyrite, sun fragments, secrets) and a checkpoint.
- Secrets:
  - Cracked wall: breaks at 6 u/s or more (`minSpeed`).
  - Xólotl: the lore-card toast.
- The sun altar goal shows **Level complete**.
- Debug hooks: `TEO.state()` and `TEO.teleport(x, y)` (level units) in the browser console.

## Painted terrain (current)
The ground is now painted landscape segments (`assets/terrain/`). Collision polylines come from the image alpha (see `docs/game-design.md`, "Painted terrain pipeline"). Entities live in `assets/levels/level01.json`. The old tile layout `assets/Level01.json` and the block art stay for reference but aren't loaded. The tile-specific traps (spike strip, crumbling step, tilting slab) and the cracked wall aren't in the painted level yet.

## Deviations from Level01.json (old tile version)
- **Doorway at the foot of the x=93 column (y -8 to -6.2).** In the JSON that column closes the bottom of the drop shaft, which leaves the lower corridor and the goal unreachable without it.
- **Spike strip on the pit floor.** It sits on the floor (y -4) rather than at y -3.
- **Crumbling step.** It replaces the top 0.5 u of the terrace step it sits on.

## Tests
`tools/test_web_playwright.py` serves the repo, drives headless Chromium with Playwright (key presses, teleports), checks the console for errors and writes screenshots to `previews/web/`.

## Visual polish layer (`fx.js`)
`fx.js` is mixed into the scene by `main.js`. All of its art is procedural canvas textures. There is one warm key light from the upper left, and everything shares the palette in `PAL`.
- **Depth:** contact shadows under the orb, enemies, pickups and braziers. They come from a cached surface-height table and get offset to the lower right, shrinking and fading with height. Round things (the orb and rollers) carry a fixed shade and warm rim-light rig, so the lighting doesn't rotate with the sprite.
- **Enemies:** rollers spin and squash/stretch when they land. Serpent spirits bob on a sine wave, and their 9-segment jade body follows the head's path with a travelling wave. Two jade hummingbird flyers flap their wings (they're extra and not in the JSON). Hits flash white, and kills burst into a dust puff and sparks.
- **Pickups:** jade pulses, sways and glints, with an additive halo. Sun fragments and the goal get a preFX glow; the goal also has rotating rays and drifting sparks.
- **Particles:** dust when rolling fast and on landing, muzzle sparks and a bolt trail, jade/sun collect bursts and rings, and seven braziers with flames, a flickering light pool and drifting smoke. Incense rises from the temple props, with embers and pollen floating in screen space.
- **Layers:** god rays from the upper left, two haze bands between parallax layers L1|L2 and L2|L3, and dark blurred foreground ferns and broken columns that scroll at 1.35x. A warm vignette/key-light grade sits on top.
- **HUD:** styled panels with jade/pyrite/sun/secret icons that pop when a count changes. The score counts up with a tween, and a combo multiplier (collects within 1.5 s) shows floating `+N` texts.
- **Low-FX fallback:** `?lowfx=1` drops god rays, haze, smoke, incense, ambient particles and FX pipelines, and thins the other particles. The `F` key toggles rays, haze, smoke and ambient particles at runtime. `?fxoff=fg,vig,fog,rays,amb,glow,braz` turns individual parts off for profiling.
- **Cache-busting:** `tools/build_web_zip.sh` stamps `?v=<commit>` on the script tags in `index.html`. `main.js` reads it and adds it to every asset URL. The same script also rebuilds `/workspace/teo-fifth-sun-web.zip`.
- `tools/capture_polish.py <prefix> [query] [--video]` takes screenshots at five spots, measures fps and writes `previews/web/polish.mp4`.

## v4 polish layer (`polish.js`)
- **Living sprites:** enemies ~1.45x and collectibles/props ~1.3-1.4x (hitboxes ~1.15x). `polishEnemy` adds breathing, squash/stretch from vertical speed, lean into movement, anticipation squash + shake on tells (frog crouch, jaguar pre-pounce, dog tell, bat wind-up, plant shiver), blink, eye glints, hit recoil, spawn pop-in on first sight, and a knockback spin then dissolve into coloured particles on death. Each kind has a capped particle signature: jade motes, frog slime, macaw feathers, bat wing dust, sugar-skull ghost trail, jaguar paw dust, dog bone dust, roller grit, plant pollen, lava sparks. Walkers kick footstep puffs.
- **Orb:** motion-blur ghosts, speed streaks above ~8 px/frame, landing sparks, a thud scaled by landing speed, and dust puffs on landings, skids and fast rolls.
- **Weather:** three parallax depths of PIL-noise clouds (`tools/art/make_clouds_v4.py`). Temple has heat shimmer, sand gusts and dust devils. Jungle has rain cycles with splashes, lightning (sky flash so the terrain shows as a silhouette, a bolt, a screen flash and delayed thunder), butterflies and bird flocks. Mictlan has ash, glowing drips, lava bubbles, crystal light flicker, bat flocks and purple crackle. Foreground foliage sways and leans further in gusts. Additive light pools follow nearby braziers, lava and jets, and flare with lightning.
- **Audio** (`tools/audio/synth_v4.py`, numpy): rolling loops crossfade by surface, sampled from the painted terrain colour under the orb (stone/sand/grass/wood/obsidian), with pitch and volume following speed. Skid on sharp reversals, scrape on wall hits, and an air whoosh when fast or airborne. Each enemy has its own voice, played through `sfxAt` with distance falloff and stereo pan. Every world has an ambience loop, plus rain in the Jungle. The ♪ button opens SFX and music sliders (persisted in localStorage).
- **Low FX:** `?lowfx=1` drops the extra cloud layers, ghosts, shimmer, butterflies and light pools, and cuts particle caps to 30%. The F key toggles the heavy layers at runtime.
- **Capture:** `?capture=1` sleeps the RAF loop. `TEO_CAP.step(n, shot)` advances fixed 1/60 s frames and returns a JPEG (`tools/promo_capture.py`, `tools/promo_build.py`).
- **Test:** `tools/test_v4_polish_playwright.py` writes `previews/web/v4_*.png`.
